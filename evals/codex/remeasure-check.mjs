import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readRun, loadGrader, grade } from './grade.mjs';
import { repo } from './room.mjs';
import { flagCell } from './rescore.mjs';
import { fisher } from '../lean/compare.mjs';

const require = createRequire(import.meta.url), YAML = require('yaml');
const { normalizeCodexBody } = require('../../packages/spec/bin/lib/codex-install.js');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const events = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const logs = path.join(os.homedir(), 'Desktop/cafekit-codex-eval');
export const afterRoot = path.join(logs, 'remeasure'), oldRoot = path.join(logs, 'batch-all');
export const preflight = path.join(logs, 'remeasure-preflight/1');
export const cells = ['test/thuong-do', 'test/thuong-sach', 'code-review/thieu-tieu-chi', 'code-review/thieu-tieu-chi-agent'];
const baselines = json(path.join(repo, 'evals/codex/fixtures/baselines.json')).rows;
const selected = id => /^(?:F04[5-9]|F05[01]|F06[9]|F07[0-4])$/.test(id);
const expected = fs.readFileSync(path.join(repo, 'evals/codex/report-parity.md'), 'utf8').split('\n').filter(l => l.startsWith('| F'))
  .map(l => l.split('|').slice(1, -1).map(s => s.trim())).filter(r => selected(r[0]))
  .map(r => ({ id: r[0], key: r[1], model: r[2], baseline: r[3], codex: r[4] }));
const identity = f => `${f.key}/${f.model}`;

export function runError(directory) {
  const file = path.join(directory, 'result.json');
  if (!fs.existsSync(file)) return 'thiếu result.json';
  const result = json(file);
  return result.status === 'completed' ? null : `status ${result.status}: ${result.error || 'runtime chưa hoàn tất'}`;
}

function nativeEvents(directory) {
  const dir = path.join(directory, 'sessions');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).flatMap(f => events(path.join(dir, f))) : [];
}

export function label(grader, run) {
  if (grader === 'chay-test' && run.tap) return 'cách viết tool input';
  if ((grader === 'co-verdict' || grader.startsWith('verdict-')) && /\b(?:PASS_WITH_WARNINGS|PASS|FAIL|BLOCKED)\b/.test(run.last)) return 'cách viết';
  if (grader === 'neu-task' && /\btask[ -]01\b/i.test(run.last)) return 'cách viết';
  if (grader === 'co-header' && run.last.includes('# Code Review Results [cf-code-review]')) return 'đổi tên khi chiếu';
  return 'khác thật';
}

export function inspect(root, modern = false) {
  const data = { cells: [], errors: [], excluded: [], calls: 0, versions: new Set() };
  for (const cell of cells) {
    const [skill, name] = cell.split('/'), dir = path.join(root, cell), graderDir = path.join(repo, 'evals', cell, 'graders');
    const graders = fs.readdirSync(graderDir).filter(f => f.endsWith('.md')).sort().map(f => loadGrader(path.join(graderDir, f)));
    const runs = [], entries = fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => /^\d+(?:\.attempt-\d+)?$/.test(n))
      .sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b)) : [];
    for (const slot of entries) {
      const directory = path.join(dir, slot), native = nativeEvents(directory);
      data.calls++;
      for (const e of native.filter(e => e.type === 'session_meta')) if (e.payload.cli_version) data.versions.add(e.payload.cli_version);
      const error = runError(directory);
      if (error || slot.includes('.attempt-')) {
        if (!error) data.errors.push(`${cell}/${slot}: attempt hợp lệ bị loại`);
        data.excluded.push({ run: `${cell}/${slot}`, reason: error || 'attempt hợp lệ bị loại', role: /Native role\/model\/effort\/sandbox không khớp/.test(error || '') });
        continue;
      }
      const result = json(path.join(directory, 'result.json'));
      if (modern) {
        const inv = json(path.join(directory, 'invocation.json')), capture = json(path.join(directory, 'capture.json'));
        const prompt = normalizeCodexBody(YAML.parse(fs.readFileSync(path.join(repo, 'evals', skill, name, 'case.yaml'), 'utf8')).execution.prompt);
        if (result.exit !== 0 || result.requestedModel !== 'gpt-6.1-sol' || result.reasoningEffort !== 'medium' ||
          inv.cleanHome !== true || inv.configuration !== 'C-clean-home-5d' || inv.argv.at(-1) !== prompt ||
          json(path.join(directory, 'initial.json')).prompt !== prompt || !capture.sessions.some(s => s.root) ||
          !capture.sessions.every(s => s.valid === true)) data.errors.push(`${cell}/${slot}: sai điều kiện chạy`);
      }
      const context = readRun(directory, skill);
      const rootOutputs = context.stdoutEvents.filter(e => e.type === 'item.completed' && e.item?.type === 'command_execution').map(e => e.item.aggregated_output || '');
      const nativeOutputs = native.filter(e => e.type === 'response_item' && e.payload?.type === 'function_call_output').map(e => e.payload.output || '');
      const summaries = outputs => outputs.reduce((n, output) => n + [...String(output).matchAll(/^# tests \d+/gm)].length, 0);
      const tapRoot = summaries(rootOutputs), tapNative = summaries(nativeOutputs);
      runs.push({ slot: Number(slot), directory, last: context.last, tap: tapRoot + tapNative > 0, tapRoot, tapNative,
        scores: graders.map(g => ({ family: 'H', grader: g.name, ...grade(g, context) })) });
    }
    if (runs.length !== 10 || new Set(runs.map(r => r.slot)).size !== 10 || runs.some(r => r.slot < 1 || r.slot > 10)) data.errors.push(`${cell}: runs ${runs.length}/10`);
    data.cells.push({ cell, graders, runs, ...flagCell(skill, name, runs, baselines) });
  }
  return data;
}

// Locked per-run readings: parity F045–F051/F069–F074 and report-code-review.md:603.
const readings = {
  'code-review/thieu-tieu-chi/H/co-header': Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 'đổi tên khi chiếu'])),
  'code-review/thieu-tieu-chi/H/neu-task': Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 'cách viết'])),
  'code-review/thieu-tieu-chi-agent/H/co-verdict': Object.fromEntries([1, 2, 3, 4, 6, 8, 9].map(i => [i, 'cách viết'])),
  'code-review/thieu-tieu-chi-agent/H/neu-task': Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, [1, 8].includes(i + 1) ? 'khác thật' : 'cách viết'])),
  'test/thuong-do/H/chay-test': Object.fromEntries([2, 8, 9, 10].map(i => [i, 'khác thật'])),
  'test/thuong-sach/H/chay-test': { 4: 'khác thật', 7: 'cách viết tool input' },
  'test/thuong-sach/H/verdict': { 6: 'khác thật', 8: 'khác thật' },
};
const labels = (key, cell, failedSlots) => Object.fromEntries(cell.runs.filter(r => failedSlots ? failedSlots.includes(r.slot) : r.scores.some(s => `H/${s.grader}` === key.split('/').slice(-2).join('/') && s.status === 'scored' && !s.passed))
  .map(r => [r.slot, label(key.split('/').at(-1), r)]));

export function selfCheck(root = oldRoot) {
  const data = inspect(root), flags = data.cells.flatMap(c => c.flags), errors = [...data.errors];
  if (expected.length !== 13) errors.push(`parity: ${expected.length}/13 cờ`);
  for (const f of expected) {
    const actual = flags.filter(a => identity(a) === identity(f));
    if (actual.length !== 1 || actual[0].codex !== f.codex || actual[0].baseline !== f.baseline) errors.push(`${f.id}: số/cờ lệch parity`);
  }
  if (flags.length !== 13 || flags.some(f => !expected.some(e => identity(e) === identity(f)))) errors.push('cờ NEW hoặc số cờ lệch');
  for (const [key, locked] of Object.entries(readings)) {
    const actual = labels(key, data.cells.find(c => key.startsWith(`${c.cell}/`)));
    if (JSON.stringify(actual) !== JSON.stringify(locked)) errors.push(`${key}: nhãn lệch parity; ${JSON.stringify(actual)}`);
  }
  return { data, errors };
}

const inconclusive = f => f && !(f.class === 'safety' && f.baseline.split('/')[0] === f.baseline.split('/')[1]) && f.p >= 0.05 && f.loss >= 0.20 - 1e-9;
export function measure(root = afterRoot, old = oldRoot) {
  const self = selfCheck(old);
  if (self.errors.length) return { self };
  const data = inspect(root, true), errors = [...data.errors];
  const pre = fs.existsSync(preflight) ? { error: runError(preflight), capture: fs.existsSync(path.join(preflight, 'capture.json')) ? json(path.join(preflight, 'capture.json')) : null } : null;
  if (!pre) errors.push('thiếu lượt thử');
  else {
    for (const e of nativeEvents(preflight).filter(e => e.type === 'session_meta')) if (e.payload.cli_version) data.versions.add(e.payload.cli_version);
    const files = ['result.json', 'invocation.json', 'initial.json'];
    if (files.some(file => !fs.existsSync(path.join(preflight, file)))) errors.push('lượt thử thiếu result/invocation/initial');
    else {
      const result = json(path.join(preflight, 'result.json')), inv = json(path.join(preflight, 'invocation.json'));
      const prompt = normalizeCodexBody(YAML.parse(fs.readFileSync(path.join(repo, 'evals/test/thuong-do/case.yaml'), 'utf8')).execution.prompt);
      if (inv.cleanHome !== true || inv.configuration !== 'C-clean-home-5d' || inv.argv.at(-1) !== prompt ||
        json(path.join(preflight, 'initial.json')).prompt !== prompt || result.requestedModel !== 'gpt-6.1-sol' || result.reasoningEffort !== 'medium') errors.push('lượt thử sai điều kiện chạy');
      if (pre.error && !/Native role\/model\/effort\/sandbox không khớp/.test(pre.error)) errors.push(`lượt thử lỗi môi trường/runtime: ${pre.error}`);
      if (!pre.capture?.sessions.some(s => s.root) || (!pre.error && (result.exit !== 0 || !pre.capture.sessions.every(s => s.valid)))) errors.push('lượt thử thiếu capture đúng điều kiện');
    }
  }
  const calls = data.calls + Number(Boolean(pre));
  if (calls > 50) errors.push(`calls ${calls}/50`);
  const flags = data.cells.flatMap(c => c.flags), rows = [];
  const entries = [...expected, ...flags.filter(f => !expected.some(e => identity(e) === identity(f))).map(f => ({ id: 'NEW', ...f }))];
  for (const f of entries) {
    const cell = data.cells.find(c => f.key.startsWith(`${c.cell}/`)), oldCell = self.data.cells.find(c => c.cell === cell.cell);
    const g = f.key.split('/').at(-1), count = c => { const scores = c.runs.map(r => r.scores.find(s => s.grader === g)).filter(s => s?.status === 'scored'); return [scores.filter(s => s.passed).length, scores.length]; };
    const a = count(oldCell), b = count(cell), flag = flags.find(x => identity(x) === identity(f));
    rows.push({ ...f, old: a.join('/'), new: b[1] ? b.join('/') : 'N/A', state: !flag ? 'no' : inconclusive(flag) ? 'inconclusive' : 'yes',
      pOldNew: fisher(...a, ...b), labels: labels(f.key, cell, flag?.failedRuns), flag });
  }
  const stillReal = [...new Set(rows.filter(r => r.state === 'yes' && !r.key.endsWith('/co-header') && Object.values(r.labels).includes('khác thật')).map(r => r.key))];
  return { self, data, errors, pre, calls, rows, stillReal };
}

export function print(r) {
  if (r.self.errors.length) { console.log(`self-check: FAIL ${r.self.errors.join('; ')}`); return false; }
  console.log('self-check: PASS');
  for (const c of r.data.cells) {
    console.log(`${c.cell}: runs ${c.runs.length}/10`);
    console.log(`role exclusions: ${c.cell} ${r.data.excluded.filter(e => e.role && e.run.startsWith(`${c.cell}/`)).length}`);
    if (c.cell.startsWith('test/')) console.log(`tap summaries: ${c.cell} root/native: ${c.runs.map(x => `${x.slot}=${x.tapRoot}/${x.tapNative}`).join(',')}`);
    for (const o of c.observations.filter(o => ['primary', 'safety'].includes(o.class))) {
      const base = baselines.some(b => b.skill === o.skill && b.case === o.case && b.family === o.family && b.grader === o.grader && b.status === 'current_archived' && Number.isInteger(b.passed) && b.scored > 0);
      if (!o.after.scored || !base) console.log(`N/A: ${c.cell}/${o.grader}: ${!o.after.scored ? [...new Set(o.na)].join('; ') : 'không có số gốc current_archived hợp lệ'}`);
    }
  }
  console.log(`cli_version: ${[...r.data.versions].sort().join(', ') || 'N/A'}`);
  for (const f of r.rows) console.log(`${f.id} ${f.key} ${f.model}: old ${f.old} → new ${f.new}; flagged ${f.state}; p_old_new ${f.pOldNew.toPrecision(8)}; labels ${Object.entries(f.labels).map(([n, l]) => `${n}=${l}`).join(',') || 'none'}`);
  for (const e of r.data.excluded) console.log(`excluded: ${e.run}: ${e.reason}`);
  console.log(`preflight: agent children ${r.pre?.capture?.sessions.filter(s => !s.root).length ?? 'N/A'}; ${r.pre?.error || (r.pre ? 'completed' : 'missing')}`);
  console.log(`still real: ${r.stillReal.join(', ') || 'none'}`);
  console.log(`calls: ${r.calls}/50`);
  for (const error of r.errors) console.error(error);
  console.log(`verdict: ${r.errors.length ? 'INCOMPLETE' : 'MEASURED'}`);
  return !r.errors.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--log-root', '--old-root'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error('Dùng [--log-root <dir>] [--old-root <dir>]');
      options[args[i]] = path.resolve(args[i + 1]);
    }
    if (!print(measure(options['--log-root'], options['--old-root']))) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
