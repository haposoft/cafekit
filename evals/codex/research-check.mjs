import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readRun, grade, loadGrader } from './grade.mjs';
import { readManifest, repo } from './room.mjs';

export const cases = readManifest().skills.find(s => s.name === 'research').cases.map(c => c.case);
const logs = path.join(os.homedir(), 'Desktop/cafekit-codex-eval');
export const baselineRoot = path.join(logs, 'batch-all-B/research');
export const afterRoot = path.join(logs, 'research-depth');
const require = createRequire(import.meta.url);
const { CODEX_RESEARCH_DEPTH_MARKER, normalizeCodexBody } = require('../../packages/spec/bin/lib/codex-install.js');
const YAML = require('yaml');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const events = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const alternate = (directory, first, old) => path.join(directory, fs.existsSync(path.join(directory, first)) ? first : old);
const nonAgent = name => !name.endsWith('-agent');

export function runError(directory) {
  const resultFile = path.join(directory, 'result.json');
  if (!fs.existsSync(resultFile)) return 'thiếu result.json';
  const result = json(resultFile);
  if (result.status !== 'completed') return `status ${result.status}: ${result.error || 'runtime chưa hoàn tất'}`;
  const web = new Map();
  for (const event of events(path.join(directory, 'events.jsonl'))) {
    if (event.item?.type === 'web_search') web.set(event.item.id, event.item);
  }
  if (web.size && [...web.values()].every(item => item.error || ['failed', 'error'].includes(item.status))) {
    return 'mọi mục web_search đều lỗi';
  }
  return null;
}

export function firstDepth(last) {
  const label = /(?:Depth|Độ sâu)\s*:/iu.exec(last);
  if (!label) return { depth: 'không rõ', reason: 'Không có nhãn Depth: hoặc Độ sâu:' };
  const tail = last.slice(label.index + label[0].length);
  const value = /(?<!\p{L})(Quick|Standard|Deep|Nhanh|Tiêu chuẩn|Sâu)(?!\p{L})/iu.exec(tail);
  const translation = { quick: 'Quick', nhanh: 'Quick', standard: 'Standard', 'tiêu chuẩn': 'Standard', deep: 'Deep', sâu: 'Deep' };
  return { depth: value ? translation[value[1].toLowerCase()] : 'không rõ', reason: tail.split(/\r?\n\s*\r?\n/)[0].trim() };
}

function changedExisting(directory, context, name) {
  const before = path.join(directory, 'workspace-before');
  if (fs.existsSync(before)) return context.initialFiles.filter(file =>
    !fs.existsSync(path.join(context.root, file)) || sha(path.join(before, file)) !== sha(path.join(context.root, file)));
  // Legacy runs retained scaffold fixture bytes and per-installed-file hashes, not workspace-before.
  const initial = json(path.join(directory, 'initial-research.json'));
  const fixture = path.join(repo, 'evals/research/fixtures', name.replace(/-agent$/, ''));
  return context.initialFiles.filter(file => {
    const expected = initial.harness?.[file] || (fs.existsSync(path.join(fixture, file)) ? sha(path.join(fixture, file)) : null);
    if (!expected) throw new Error(`Thiếu byte gốc: ${name}/${file}`);
    return !fs.existsSync(path.join(context.root, file)) || sha(path.join(context.root, file)) !== expected;
  });
}

export function inspect(root) {
  const data = { root, cells: [], excluded: [], errors: [], attempts: 0 };
  for (const name of cases) {
    const directory = path.join(root, name);
    const graders = fs.readdirSync(path.join(repo, 'evals/research', name, 'graders')).filter(f => f.endsWith('.md'))
      .sort().map(f => loadGrader(path.join(repo, 'evals/research', name, 'graders', f)));
    const cell = { name, graders, runs: [], scores: Object.fromEntries(graders.map(g => [g.name, { pass: 0, scored: 0, na: 0 }])) };
    const entries = fs.existsSync(directory) ? fs.readdirSync(directory).filter(n => /^\d+(?:\.attempt-\d+)?$/.test(n)).sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b)) : [];
    for (const slot of entries) {
      const runDir = path.join(directory, slot);
      data.attempts++;
      const error = runError(runDir);
      if (error || slot.includes('.attempt-')) {
        if (!error) data.errors.push(`${name}/${slot}: lượt attempt hợp lệ bị loại, không được chọn lọc kết quả`);
        data.excluded.push({ run: `${name}/${slot}`, reason: error || 'lượt lịch sử attempt' });
        continue;
      }
      const result = json(path.join(runDir, 'result.json'));
      if (result.exit !== 0 || result.requestedModel !== 'gpt-6.1-sol' || result.reasoningEffort !== 'medium') data.errors.push(`${name}/${slot}: sai runtime/model`);
      const modern = fs.existsSync(path.join(runDir, 'invocation.json'));
      const invocation = json(alternate(runDir, 'invocation.json', 'invocation-research.json'));
      const capture = json(alternate(runDir, 'capture.json', 'capture-research.json'));
      if (!capture.sessions?.some(s => s.root)) data.errors.push(`${name}/${slot}: thiếu root session`);
      if (modern && (invocation.cleanHome !== true || invocation.configuration !== 'C-clean-home-5d' ||
        !invocation.argv?.includes('web_search="live"') || !capture.sessions?.every(s => s.valid === true))) data.errors.push(`${name}/${slot}: sai clean-home/config/capture`);
      if (modern) {
        const spec = YAML.parse(fs.readFileSync(path.join(repo, 'evals/research', name, 'case.yaml'), 'utf8'));
        const prompt = normalizeCodexBody(spec.execution.prompt);
        if (json(path.join(runDir, 'initial.json')).prompt !== prompt || invocation.argv?.at(-1) !== prompt) {
          data.errors.push(`${name}/${slot}: không dùng prompt gốc`);
        }
      }
      const context = readRun(runDir, 'research');
      const sessionDir = alternate(runDir, 'sessions', 'sessions-research');
      const raw = fs.readdirSync(sessionDir).filter(f => f.endsWith('.jsonl')).map(f => fs.readFileSync(path.join(sessionDir, f), 'utf8')).join('\n');
      // Marker must appear in a tool response, not merely in catalog metadata or an unevaluated call.
      const noteLoaded = raw.split('\n').filter(Boolean).map(JSON.parse).some(e => e.type === 'response_item' &&
        ['function_call_output', 'custom_tool_call_output'].includes(e.payload?.type) && JSON.stringify(e.payload.output).includes(CODEX_RESEARCH_DEPTH_MARKER));
      const verdicts = Object.fromEntries(graders.map(g => [g.name, grade(g, context)]));
      const depth = firstDepth(context.last);
      const disagreements = graders.filter(g => g.name.startsWith('do-sau-') && verdicts[g.name].status === 'scored').filter(g => {
        const allowed = { 'do-sau-quick': ['Quick'], 'do-sau-standard': ['Standard'], 'do-sau-standard-deep': ['Standard', 'Deep'] }[g.name];
        if (!allowed) throw new Error(`Thước độ sâu lạ: ${g.name}`);
        return verdicts[g.name].passed !== allowed.includes(depth.depth);
      }).map(g => g.name);
      for (const [key, verdict] of Object.entries(verdicts)) {
        const score = cell.scores[key];
        if (verdict.status === 'scored') { score.scored++; score.pass += Number(verdict.passed); } else score.na++;
      }
      cell.runs.push({ slot, directory: runDir, depth, noteLoaded, disagreements, verdicts,
        changed: changedExisting(runDir, context, name), sessions: capture.sessions.length });
    }
    if (cell.runs.length !== 10 || new Set(cell.runs.map(r => Number(r.slot))).size !== 10 ||
      cell.runs.some(r => Number(r.slot) < 1 || Number(r.slot) > 10)) data.errors.push(`${name}: cần đủ slot 1–10 hợp lệ, thấy ${cell.runs.length}`);
    data.cells.push(cell);
  }
  return data;
}

// One-sided Fisher: probability of at least this many after-pass outcomes, conditional on margins.
export function fisherImprovement(before, after) {
  const choose = (n, k) => { let value = 1; for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i; return value; };
  const successes = before.pass + after.pass, denominator = choose(before.scored + after.scored, successes);
  let p = 0;
  for (let k = after.pass; k <= Math.min(after.scored, successes); k++) {
    const previous = successes - k;
    if (previous >= 0 && previous <= before.scored) p += choose(after.scored, k) * choose(before.scored, previous) / denominator;
  }
  return Math.min(1, p);
}

export function check(root = afterRoot) {
  const data = inspect(root), baseline = inspect(baselineRoot), regressions = [];
  const errors = [...data.errors, ...baseline.errors.map(e => `baseline: ${e}`)];
  let loaded = 0;
  for (const cell of data.cells.filter(c => nonAgent(c.name))) {
    const before = baseline.cells.find(c => c.name === cell.name);
    loaded += cell.runs.filter(r => r.noteLoaded).length;
    for (const g of cell.graders.filter(g => g.name.startsWith('khong-') || (cell.name === 'nguon-cu-mau-thuan' && g.name === 'do-sau-standard-deep'))) {
      const a = cell.scores[g.name], b = before.scores[g.name];
      if (b.scored && (a.scored !== b.scored || a.pass < b.pass)) regressions.push(`${cell.name}/${g.name}: ${b.pass}/${b.scored} → ${a.pass}/${a.scored}`);
    }
    const changed = cell.runs.filter(r => r.changed.length).length, oldChanged = before.runs.filter(r => r.changed.length).length;
    const children = cell.runs.filter(r => r.sessions > 1).length, oldChildren = before.runs.filter(r => r.sessions > 1).length;
    if (changed > oldChanged) regressions.push(`${cell.name}/existing-bytes: ${oldChanged} → ${changed} lượt đổi file`);
    if (children > oldChildren) regressions.push(`${cell.name}/child-sessions: ${oldChildren} → ${children} lượt gọi agent con`);
  }
  const cam = data.cells.find(c => c.name === 'da-co-quyet-dinh');
  const disagreements = data.cells.flatMap(c => c.runs.flatMap(r => r.disagreements.map(g => `${c.name}/${r.slot}/${g}: first label ${r.depth.depth}, regex ${r.verdicts[g].passed}`)));
  const gateDisagreements = cam.runs.reduce((sum, r) => sum + r.disagreements.length, 0);
  const fishers = ['da-co-quyet-dinh', 'chon-kien-truc-theo-rang-buoc'].map(name => {
    const grader = name === 'da-co-quyet-dinh' ? 'do-sau-quick' : 'do-sau-standard';
    return { name, grader, p: fisherImprovement(baseline.cells.find(c => c.name === name).scores[grader], data.cells.find(c => c.name === name).scores[grader]) };
  });
  if (data.attempts > 110) errors.push(`Vượt trần 110: ${data.attempts}`);
  const passed = !errors.length && cam.scores['do-sau-quick'].pass >= 8 && gateDisagreements === 0 && loaded === 40 && !regressions.length;
  return { data, baseline, regressions, errors, disagreements, gateDisagreements, loaded, fishers, passed };
}

export function print(result) {
  for (const cell of result.data.cells) {
    const distribution = Object.fromEntries(['Quick', 'Standard', 'Deep', 'không rõ'].map(d => [d, cell.runs.filter(r => r.depth.depth === d).length]));
    console.log(`research/${cell.name}: runs ${cell.runs.length}/10; depth ${JSON.stringify(distribution)}`);
    for (const g of cell.graders.filter(g => cell.scores[g.name].na)) console.log(`N/A: ${cell.name}/${g.name}: ${cell.runs.find(r => r.verdicts[g.name].reason)?.verdicts[g.name].reason}`);
    if (cell.name.endsWith('-agent') || ['da-co-quyet-dinh', 'chon-kien-truc-theo-rang-buoc'].includes(cell.name)) {
      for (const run of cell.runs) console.log(`depth reason: ${cell.name}/${run.slot}: ${run.depth.reason.replace(/\n/g, ' ')}`);
    }
  }
  const gate = result.data.cells.find(c => c.name === 'da-co-quyet-dinh').scores['do-sau-quick'];
  console.log(`research/da-co-quyet-dinh gate: do-sau-quick ${gate.pass}/10`);
  console.log(`depth disagreements: ${result.gateDisagreements}`);
  console.log(`depth disagreements all cases: ${result.disagreements.length}`);
  for (const line of result.disagreements) console.log(`disagreement: ${line}`);
  console.log(`note loaded: ${result.loaded}/40`);
  console.log(`regressions: ${result.regressions.length}`);
  for (const line of result.regressions) console.log(`regression: ${line}`);
  for (const f of result.fishers) console.log(`Fisher one-sided improvement ${f.name}/${f.grader}: p=${f.p.toPrecision(8)}`);
  console.log(`calls: ${result.data.attempts}/110; excluded runs: ${result.data.excluded.length}`);
  for (const r of result.data.excluded) console.log(`excluded: ${r.run}: ${r.reason}`);
  for (const error of result.errors) console.error(error);
  console.log(`verdict: ${result.passed ? 'PASS' : 'FAIL'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args[0] !== '--phase' || args[1] !== 'after' || (args.length !== 2 && !(args.length === 4 && args[2] === '--log-root'))) throw new Error('Dùng --phase after [--log-root <dir>]');
    const result = check(path.resolve(args[3] || afterRoot));
    print(result);
    if (!result.passed) process.exitCode = 1;
  } catch (error) { console.error(error.message); console.log('verdict: FAIL'); process.exitCode = 1; }
}
