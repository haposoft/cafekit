import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readRun, inventory } from './grade.mjs';
import { repo } from './room.mjs';
import { flags, hashFor, parseVote } from './llm-judge-prompt.mjs';
import { fisher } from '../lean/compare.mjs';

const require = createRequire(import.meta.url), YAML = require('yaml');
const { normalizeCodexBody, CODEX_SPECS_SCOPE_MARKER } = require('../../packages/spec/bin/lib/codex-install.js');
const logs = path.join(os.homedir(), 'Desktop/cafekit-codex-eval');
export const cases = ['sua-typo', 'khong-kich-hoat', 'lam-thang-doi-ten', 'lam-thang-xoa-module', 'sua-nho-lam-luon', 'develop-auth'];
export const defaults = { logRoot: path.join(logs, 'specs-routing'), controlRoot: path.join(logs, 'specs-routing-control'), oldRoot: path.join(logs, 'batch-all/specs') };
const json = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const events = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
const files = dir => fs.existsSync(dir) ? inventory(dir).filter(f => !/^\.(git|agents|codex)(\/|$)/.test(f) && fs.statSync(path.join(dir, f)).isFile()) : [];
const gate = text => text.includes('NEEDS CLARIFICATION') || ['EXPAND', 'KEEP', 'CUT'].every(word => new RegExp(`\\b${word}\\b`).test(text));
const direct = name => name.startsWith('lam-thang-') || name === 'sua-nho-lam-luon';

function judge(name, arm, slot, last, version) {
  const text = read(path.join(repo, 'evals/specs', name, 'graders/tra-loi-thang.md'));
  const body = text.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)([\s\S]*)$/)?.[1];
  if (body === undefined) throw new Error(`Thiếu thân thước ${name}`);
  const group = { old: 'old', new: 'routing', control: 'routing-control' }[arm], votes = [];
  for (let v = 1; v <= 3; v++) {
    const file = path.join(logs, 'llm-judge', group, 'specs', name, 'tra-loi-thang', String(slot), `vote-${v}.json`);
    const cache = json(file);
    if (cache.exit !== 0 || cache.version !== version || cache.hash !== hashFor(body, last, version) || JSON.stringify(cache.argv) !== JSON.stringify(flags)) throw new Error(`Cache giám khảo lệch: ${file}`);
    votes.push(parseVote(cache.stdout).pass);
  }
  return votes.filter(Boolean).length >= 2;
}

export function inspect(root, arm, expected, version) {
  const data = { arm, cells: [], errors: [], excluded: [], calls: 0, versions: new Set() };
  for (const name of cases) {
    const dir = path.join(root, name), runs = [], slots = fs.existsSync(dir) ? fs.readdirSync(dir).filter(s => /^\d+(?:\.attempt-\d+)?$/.test(s)).sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b)) : [];
    for (const slot of slots) {
      const d = path.join(dir, slot); data.calls++;
      const result = fs.existsSync(path.join(d, 'result.json')) ? json(path.join(d, 'result.json')) : null;
      if (result?.status !== 'completed' || slot.includes('.attempt-')) {
        const reason = result?.status === 'completed' ? 'attempt hợp lệ bị loại' : result?.error || result?.status || 'thiếu result.json';
        data.excluded.push({ name, slot, reason });
        if (result?.status === 'completed') data.errors.push(`${arm} ${name}/${slot}: ${reason}`);
        continue;
      }
      const context = readRun(d, 'specs'), workspace = context.root;
      const fixture = path.join(repo, 'evals/specs', name, 'fixture');
      const before = arm === 'new' ? path.join(d, 'workspace-before') : fixture;
      if (arm !== 'old') {
        const inv = json(path.join(d, 'invocation.json')), capture = json(path.join(d, 'capture.json'));
        const prompt = normalizeCodexBody(YAML.parse(read(path.join(repo, 'evals/specs', name, 'case.yaml'))).execution.prompt);
        if (result.exit !== 0 || result.requestedModel !== 'gpt-6.1-sol' || result.reasoningEffort !== 'medium' || inv.cleanHome !== true ||
          inv.configuration !== 'C-clean-home-5d' || inv.argv.at(-1) !== prompt || json(path.join(d, 'initial.json')).prompt !== prompt ||
          !capture.sessions.some(s => s.root) || !capture.sessions.every(s => s.valid === true)) data.errors.push(`${arm} ${name}/${slot}: sai điều kiện chạy`);
        if (!fs.existsSync(path.join(d, 'workspace-before'))) data.errors.push(`${arm} ${name}/${slot}: thiếu workspace-before`);
        if (name === 'develop-auth' && !fs.existsSync(path.join(d, 'workspace-before/.agents/skills/cf-develop/SKILL.md'))) data.errors.push(`${arm} ${name}/${slot}: thiếu cf-develop`);
        const installed = read(path.join(d, 'workspace-before/.agents/skills/cf-specs/SKILL.md'));
        if (!installed || installed.includes(CODEX_SPECS_SCOPE_MARKER) !== (arm === 'new')) data.errors.push(`${arm} ${name}/${slot}: bản chiếu specs sai nhánh`);
      }
      const baseline = files(before), after = files(workspace);
      const changed = baseline.filter(f => !fs.existsSync(path.join(workspace, f)) || !fs.readFileSync(path.join(before, f)).equals(fs.readFileSync(path.join(workspace, f))));
      const srcPaths = [...new Set([...baseline, ...after].filter(f => f.startsWith('src/')))];
      const srcChanged = srcPaths.some(f => !fs.existsSync(path.join(before, f)) || !fs.existsSync(path.join(workspace, f)) || read(path.join(before, f)) !== read(path.join(workspace, f)));
      const extra = after.filter(f => !baseline.includes(f) && (/^(specs|plans)\//.test(f) || f.endsWith('.md')));
      let outputs = context.stdoutEvents.filter(e => e.type === 'item.completed' && e.item?.type === 'command_execution').map(e => e.item.aggregated_output || ''), native = [];
      if (arm !== 'old') {
        const sessions = path.join(d, 'sessions');
        native = fs.readdirSync(sessions).filter(f => f.endsWith('.jsonl')).flatMap(f => events(path.join(sessions, f)));
        for (const e of native.filter(e => e.type === 'session_meta')) data.versions.add(e.payload.cli_version);
        outputs.push(...native.filter(e => e.type === 'response_item' && ['function_call_output', 'custom_tool_call_output'].includes(e.payload?.type)).map(e => typeof e.payload.output === 'string' ? e.payload.output : JSON.stringify(e.payload.output)));
      }
      const requested = native.some(e => e.type === 'response_item' && (e.payload?.name === 'request_user_input' ||
        e.payload?.name === 'exec' && /\btools\.request_user_input\s*\(/.test(e.payload.input || e.payload.arguments || '')));
      const skillRead = outputs.some(s => s.includes('name: cf-specs'));
      const overgateFinal = gate(context.last), overgateAny = context.agentMessages.some(gate) || overgateFinal || requested;
      const srcText = after.filter(f => f.startsWith('src/')).map(f => read(path.join(workspace, f))).join('\n');
      const testText = after.filter(f => f.startsWith('test/')).map(f => read(path.join(workspace, f))).join('\n');
      const blocked = /^Status:\s*blocked\b/m.test(read(path.join(workspace, 'specs/google-login/task-01-google-login.md')));
      const done = name === 'lam-thang-doi-ten' ? [srcText, testText].every(t => t.includes('formatCustomerName') && !t.includes('fmtName')) :
        name === 'lam-thang-xoa-module' ? !after.includes('src/legacy-export.js') && !after.includes('test/legacy-export.test.js') && after.includes('src/app.js') && !read(path.join(workspace, 'src/app.js')).includes('legacy-export') :
          name === 'sua-nho-lam-luon' ? read(path.join(workspace, 'README.md')).includes('nội bộ') && !read(path.join(workspace, 'README.md')).includes('nôi bộ') : changed.length === 0;
      let llm;
      if (['sua-typo', 'khong-kich-hoat'].includes(name)) try { llm = judge(name, arm, slot, context.last, version); } catch (e) { data.errors.push(`${arm} ${name}/${slot}: ${e.code === 'ENOENT' ? 'thiếu cache giám khảo' : e.message}`); }
      runs.push({ slot: Number(slot), directory: d, last: context.last, changed, extra, srcChanged, blocked, done, unchanged: changed.length === 0,
        stoppedWrong: skillRead || !srcChanged && !blocked, overgateFinal, overgateAny, askedStopped: direct(name) && !changed.length && /\?\s*[*_`"'\])]*$/.test(context.last.trim()),
        skillRead, noteLoaded: outputs.some(s => s.includes(CODEX_SPECS_SCOPE_MARKER)), llm });
    }
    if (runs.length !== expected || new Set(runs.map(r => r.slot)).size !== expected || runs.some(r => r.slot < 1 || r.slot > expected)) data.errors.push(`${arm} ${name}: runs ${runs.length}/${expected}`);
    data.cells.push({ name, runs, expected });
  }
  return data;
}
const n = (cell, key) => cell.runs.filter(r => key === 'extra' ? r.extra.length : r[key]).length;
export function selfCheck(root, version) {
  const data = inspect(root, 'old', 10, version), errors = [...data.errors];
  for (const [i, cell] of data.cells.entries()) {
    const pins = { overgateFinal: 0, skillRead: [0, 0, 3, 1, 0, 4][i], extra: [0, 0, 4, 4, 0, 0][i] };
    if (i < 2) Object.assign(pins, { unchanged: 10, llm: 10 });
    else if (i < 5) pins.done = 10;
    else Object.assign(pins, { srcChanged: 3, blocked: 0 });
    for (const [key, value] of Object.entries(pins)) if (n(cell, key) !== value) errors.push(`${cell.name} ${key} ${n(cell, key)} != ${value}`);
    if ([2, 3].includes(i)) {
      const slots = cell.runs.filter(r => r.extra.length).map(r => r.slot).sort((a, b) => a - b);
      const pinned = i === 2 ? [1, 2, 4, 9] : [2, 5, 7, 9];
      if (JSON.stringify(slots) !== JSON.stringify(pinned)) errors.push(`${cell.name} extra-artifacts slots ${slots.join(',')} != ${pinned.join(',')}`);
    }
  }
  return { data, errors };
}
export function measure(options = {}) {
  const roots = { ...defaults, ...options }, version = execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim();
  const self = selfCheck(roots.oldRoot, version);
  if (self.errors.length) return { self };
  const fresh = inspect(roots.logRoot, 'new', 10, version), control = inspect(roots.controlRoot, 'control', 5, version);
  const errors = [...fresh.errors, ...control.errors], calls = fresh.calls + control.calls, regressions = [], watches = [], comparisons = [];
  if (calls > 100) errors.push(`calls ${calls}/100`);
  for (const a of fresh.cells) {
    const b = control.cells.find(c => c.name === a.name);
    const metrics = a.name === 'develop-auth' ? ['stoppedWrong'] : [direct(a.name) ? 'done' : 'unchanged', 'overgateAny', 'askedStopped', 'extra', ...(['sua-typo', 'khong-kich-hoat'].includes(a.name) ? ['llm'] : [])];
    for (const key of metrics) {
      const x = n(a, key), y = n(b, key), loss = (x / 10 - y / 5) * (['done', 'unchanged', 'llm'].includes(key) ? -1 : 1);
      const regression = a.name === 'develop-auth' ? x >= 3 && x / 10 > y / 5 : loss >= 0.2 - 1e-9;
      const row = { name: a.name, key, new: x, control: y, loss, p: fisher(x, a.runs.length, y, b.runs.length), regression };
      comparisons.push(row); if (regression) regressions.push(row);
    }
    const readIncrease = n(a, 'skillRead') - n(b, 'skillRead') * 2;
    if (readIncrease >= 3) watches.push({ name: a.name, new: n(a, 'skillRead'), control: n(b, 'skillRead'), increase: readIncrease });
  }
  return { self, fresh, control, errors, calls, regressions, watches, comparisons };
}
export function print(r) {
  if (r.self.errors.length) { console.log(`self-check: FAIL ${r.self.errors.join('; ')}`); return false; }
  console.log('self-check: PASS');
  for (const data of [r.fresh, r.control, r.self.data]) for (const c of data.cells) {
    const metric = c.name === 'develop-auth' ? 'stoppedWrong' : direct(c.name) ? 'done' : 'unchanged';
    const total = c.runs.length, readN = n(c, 'skillRead');
    console.log(`${c.name} ${data.arm}: ${metric === 'stoppedWrong' ? 'stopped-wrong' : metric} ${n(c, metric)}/${total}; overgate-final ${n(c, 'overgateFinal')}/${total}; overgate-any ${n(c, 'overgateAny')}/${total}; asked-stopped ${n(c, 'askedStopped')}/${total}; extra-artifacts ${n(c, 'extra')}/${total}; skill-read ${readN}/${total}; note-loaded ${n(c, 'noteLoaded')}/${total}; overgate-in-read ${c.runs.filter(x => x.skillRead && x.overgateAny).length}/${readN}${data.arm === 'old' && c.name === 'develop-auth' ? '; invalid (no cf-develop)' : ''}`);
    if (['sua-typo', 'khong-kich-hoat'].includes(c.name)) console.log(`${c.name} ${data.arm}: tra-loi-thang ${n(c, 'llm')}/${total} (judge, uncalibrated)`);
  }
  for (const c of r.comparisons) console.log(`Fisher ${c.name}/${c.key}: p=${c.p.toPrecision(8)} (reference)`);
  console.log(r.regressions.length ? r.regressions.map(x => `regression: ${x.name}/${x.key} new ${x.new}/10 vs control ${x.control}/5`).join('\n') : 'regression: none');
  console.log(r.watches.length ? r.watches.map(x => `watch: ${x.name} skill-read ${x.new}/10 vs control ${x.control}/5; delta ${x.increase}/10`).join('\n') : 'watch: none');
  for (const d of [r.fresh, r.control]) for (const x of d.excluded) console.log(`excluded: ${d.arm} ${x.name}/${x.slot}: ${x.reason}`);
  console.log(`cli_version: ${[...new Set([...r.fresh.versions, ...r.control.versions])].sort().join(', ') || 'N/A'}`);
  console.log(`calls: ${r.calls}/100`); for (const error of r.errors) console.error(error);
  console.log(`verdict: ${r.errors.length ? 'INCOMPLETE' : 'MEASURED'}`); return !r.errors.length;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) { if (!['--log-root', '--control-root', '--old-root'].includes(args[i]) || !args[i + 1]) throw new Error('Tham số không hợp lệ'); options[{ '--log-root': 'logRoot', '--control-root': 'controlRoot', '--old-root': 'oldRoot' }[args[i]]] = path.resolve(args[i + 1]); }
    if (!print(measure(options))) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
