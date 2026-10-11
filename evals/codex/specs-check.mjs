import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readRun, grade, loadGrader, inventory } from './grade.mjs';
import { repo } from './room.mjs';
import { fisherImprovement } from './research-check.mjs';

const require = createRequire(import.meta.url);
const { CODEX_SPECS_SCOPE_MARKER, normalizeCodexBody } = require('../../packages/spec/bin/lib/codex-install.js');
const YAML = require('yaml');
export const cases = ['mo-ho-c1', 'dung-o-c1', 'export-csv', 'mo-ho-du-cua'];
const logs = path.join(os.homedir(), 'Desktop/cafekit-codex-eval');
export const baselineRoot = path.join(logs, 'batch-all/specs');
export const afterRoot = path.join(logs, 'specs-gate');
export const controlRoot = path.join(logs, 'specs-gate-control');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const events = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const gates = ['co-marker', 'mot-cau-hoi-c1'];
// Keep the locked regex; the echo guard also prevents whitespace backtracking into <question>.
export const genuineMarker = last => /\[(NEEDS CLARIFICATION|CẦN LÀM RÕ):\s*(?!<question>)[^\]]{5,}\]/i.test(last) && !echoedNote(last);
export const echoedNote = last => last.includes(CODEX_SPECS_SCOPE_MARKER) || last.includes('<question>');

export function runError(directory) {
  const file = path.join(directory, 'result.json');
  if (!fs.existsSync(file)) return 'thiếu result.json';
  const result = json(file);
  return result.status !== 'completed' ? `status ${result.status}: ${result.error || 'runtime chưa hoàn tất'}` : null;
}

function srcChanges(directory, root) {
  const before = fs.existsSync(path.join(directory, 'workspace-before'))
    ? path.join(directory, 'workspace-before/src') : path.join(repo, 'evals/specs/dung-o-c1/fixture/src');
  const after = path.join(root, 'src');
  const list = dir => fs.existsSync(dir) ? inventory(dir) : [];
  return [...new Set([...list(before), ...list(after)])].filter(file =>
    !fs.existsSync(path.join(before, file)) || !fs.existsSync(path.join(after, file)) ||
    sha(path.join(before, file)) !== sha(path.join(after, file))).map(file => `src/${file}`);
}

export function inspect(root, names = cases, expected = 10) {
  const data = { root, cells: [], excluded: [], errors: [], attempts: 0 };
  for (const name of names) {
    const directory = path.join(root, name);
    const graderRoot = path.join(repo, 'evals/specs', name, 'graders');
    const graders = fs.readdirSync(graderRoot).filter(f => f.endsWith('.md')).sort().map(f => loadGrader(path.join(graderRoot, f)));
    const cell = { name, graders, runs: [], scores: Object.fromEntries(graders.map(g => [g.name, { pass: 0, scored: 0, na: 0 }])) };
    const entries = fs.existsSync(directory) ? fs.readdirSync(directory).filter(n => /^\d+(?:\.attempt-\d+)?$/.test(n))
      .sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b)) : [];
    for (const slot of entries) {
      const runDir = path.join(directory, slot);
      data.attempts++;
      const error = runError(runDir);
      if (error || slot.includes('.attempt-')) {
        if (!error) data.errors.push(`${name}/${slot}: attempt hợp lệ bị loại, không được chọn lọc kết quả`);
        data.excluded.push({ run: `${name}/${slot}`, reason: error || 'attempt hợp lệ bị loại' });
        continue;
      }
      const context = readRun(runDir, 'specs');
      const modern = fs.existsSync(path.join(runDir, 'invocation.json'));
      const result = json(path.join(runDir, 'result.json'));
      if (result.exit !== 0 || result.requestedModel !== 'gpt-6.1-sol' || result.reasoningEffort !== 'medium') data.errors.push(`${name}/${slot}: sai runtime/model`);
      let outputs, cli = null;
      if (modern) {
        const invocation = json(path.join(runDir, 'invocation.json')), capture = json(path.join(runDir, 'capture.json'));
        const spec = YAML.parse(fs.readFileSync(path.join(repo, 'evals/specs', name, 'case.yaml'), 'utf8'));
        const prompt = normalizeCodexBody(spec.execution.prompt);
        if (!invocation.cleanHome || invocation.configuration !== 'C-clean-home-5d' || invocation.argv.includes('web_search="live"') ||
          invocation.argv.at(-1) !== prompt || json(path.join(runDir, 'initial.json')).prompt !== prompt ||
          !capture.sessions.some(s => s.root) || !capture.sessions.every(s => s.valid)) data.errors.push(`${name}/${slot}: sai home/config/prompt/capture`);
        const native = fs.readdirSync(path.join(runDir, 'sessions')).filter(f => f.endsWith('.jsonl'))
          .flatMap(f => events(path.join(runDir, 'sessions', f)));
        cli = native.find(e => e.type === 'session_meta')?.payload.cli_version;
        outputs = native.filter(e => e.type === 'response_item' && ['function_call_output', 'custom_tool_call_output'].includes(e.payload?.type))
          .map(e => typeof e.payload.output === 'string' ? e.payload.output : JSON.stringify(e.payload.output));
      } else {
        // The original batch retained stdout only: no invocation, capture or native session required.
        outputs = context.stdoutEvents.filter(e => e.type === 'item.completed' && e.item?.type === 'command_execution').map(e => e.item.aggregated_output || '');
      }
      const skillOutputs = outputs.filter(output => output.includes('name: cf-specs'));
      const installed = ['cf-specs', 'specs'].map(skill => path.join(runDir, 'workspace-before/.agents/skills', skill, 'SKILL.md')).find(file => fs.existsSync(file));
      const verdicts = Object.fromEntries(graders.map(g => [g.name, grade(g, context)]));
      for (const [key, verdict] of Object.entries(verdicts)) {
        const score = cell.scores[key];
        if (verdict.status === 'scored') { score.scored++; score.pass += Number(verdict.passed); } else score.na++;
      }
      const all = Object.fromEntries(graders.filter(g => gates.includes(g.name)).map(g =>
        [g.name, grade(g, { ...context, last: context.agentMessages.join('\n') }).passed]));
      const trio = graders.find(g => g.name === 'mot-cau-hoi-c1');
      const firstTrio = trio ? context.agentMessages.findIndex(last => grade(trio, { ...context, last }).passed) : -1;
      cell.runs.push({ slot, directory: runDir, verdicts, all, messages: context.agentMessages.length,
        firstTrio: firstTrio < 0 ? null : firstTrio + 1, afterTrio: firstTrio < 0 ? null : context.agentMessages.length - firstTrio - 1,
        genuine: genuineMarker(context.last), echoed: echoedNote(context.last), skillRead: skillOutputs.length > 0,
        noteLoaded: skillOutputs.some(output => output.includes(CODEX_SPECS_SCOPE_MARKER)), cli,
        installedNote: installed ? fs.readFileSync(installed, 'utf8').includes(CODEX_SPECS_SCOPE_MARKER) : null,
        srcCitation: /src\/|\/customers/.test(context.last), changed: srcChanges(runDir, context.root) });
    }
    if (cell.runs.length !== expected || new Set(cell.runs.map(r => Number(r.slot))).size !== expected ||
      cell.runs.some(r => Number(r.slot) < 1 || Number(r.slot) > expected)) data.errors.push(`${name}: cần slot 1–${expected}, thấy ${cell.runs.length}`);
    data.cells.push(cell);
  }
  return data;
}

export function check(root = afterRoot, controls = controlRoot) {
  const data = inspect(root), baseline = inspect(baselineRoot), control = inspect(controls, ['mo-ho-c1'], 5);
  const cam = data.cells[0], before = baseline.cells[0], regressions = [];
  const errors = [...data.errors, ...baseline.errors.map(e => `baseline: ${e}`), ...control.errors.map(e => `control: ${e}`)];
  for (const cell of data.cells) {
    const score = cell.scores['khong-code'];
    if (score.pass !== 10 || score.scored !== 10) regressions.push(`${cell.name}/khong-code: ${score.pass}/${score.scored}`);
    for (const run of cell.runs.filter(r => r.changed.length)) regressions.push(`${cell.name}/${run.slot}: ${run.changed.join(', ')}`);
  }
  if (control.cells[0].runs.some(r => r.noteLoaded || r.installedNote !== false)) errors.push('control: thiếu snapshot không ghi chú specs, đối chứng không hợp lệ');
  const genuine = cam.runs.filter(r => r.genuine).length, echoed = cam.runs.filter(r => r.echoed).length;
  const loaded = cam.runs.filter(r => r.noteLoaded).length;
  const others = data.cells.slice(1).flatMap(c => c.runs).filter(r => r.skillRead);
  const otherLoaded = others.filter(r => r.noteLoaded).length;
  const fishers = gates.map(grader => ({ grader, p: fisherImprovement(before.scores[grader], cam.scores[grader]) }));
  const calls = data.attempts + control.attempts;
  if (calls > 62) errors.push(`Vượt trần: ${calls}/62`);
  const passed = !errors.length && !regressions.length && gates.every(g => cam.scores[g].pass >= 8) &&
    genuine >= 8 && echoed === 0 && loaded === 10 && otherLoaded === others.length;
  return { data, baseline, control, regressions, errors, genuine, echoed, loaded, otherLoaded, otherRead: others.length, fishers, calls, passed };
}

export function print(r) {
  for (const cell of r.data.cells) {
    const before = r.baseline.cells.find(c => c.name === cell.name).runs.filter(x => x.srcCitation).length;
    const after = cell.runs.filter(x => x.srcCitation).length;
    console.log(`specs/${cell.name}: runs ${cell.runs.length}/10; src citations ${before}/10 → ${after}/10 (delta ${after - before})`);
    for (const g of cell.graders.filter(g => cell.scores[g.name].na)) console.log(`N/A: ${cell.name}/${g.name}: ${cell.runs.find(x => x.verdicts[g.name].reason)?.verdicts[g.name].reason}`);
  }
  for (const run of r.data.cells[0].runs) console.log(`placement: mo-ho-c1/${run.slot}: final ${gates.map(g => `${g}=${run.verdicts[g].passed}`).join(', ')}; all ${JSON.stringify(run.all)}; messages ${run.messages}; first trio ${run.firstTrio}; after trio ${run.afterTrio}`);
  for (const g of gates) console.log(`specs/mo-ho-c1 gate: ${g} ${r.data.cells[0].scores[g].pass}/10`);
  console.log(`genuine markers: ${r.genuine}/10`);
  console.log(`echoed note: ${r.echoed}`);
  console.log(`note loaded: mo-ho-c1 ${r.loaded}/10`);
  console.log(`note loaded: others ${r.otherLoaded}/${r.otherRead}`);
  console.log(`regressions: ${r.regressions.length}`);
  for (const x of r.regressions) console.log(`regression: ${x}`);
  for (const f of r.fishers) console.log(`Fisher one-sided improvement ${f.grader}: p=${f.p.toPrecision(8)}`);
  const control = r.control.cells[0];
  console.log(`control: runs ${control.runs.length}/5; ${gates.map(g => `${g} ${control.scores[g].pass}/5`).join('; ')}; genuine markers ${control.runs.filter(x => x.genuine).length}/5`);
  console.log(`calls: ${r.calls}/62; excluded runs: ${r.data.excluded.length + r.control.excluded.length}`);
  for (const [phase, data] of [['after', r.data], ['control', r.control]]) for (const x of data.excluded) console.log(`excluded: ${phase}/${x.run}: ${x.reason}`);
  for (const x of r.errors) console.error(x);
  console.log(`verdict: ${r.passed ? 'PASS' : 'FAIL'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args[0] !== '--phase' || args[1] !== 'after') throw new Error('Dùng --phase after [--log-root <dir>] [--control-root <dir>]');
    const options = {};
    for (let i = 2; i < args.length; i += 2) {
      if (!['--log-root', '--control-root'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error('Tham số không hợp lệ');
      options[args[i]] = path.resolve(args[i + 1]);
    }
    const result = check(options['--log-root'], options['--control-root']);
    print(result);
    if (!result.passed) process.exitCode = 1;
  } catch (error) { console.error(error.message); console.log('verdict: FAIL'); process.exitCode = 1; }
}
