import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRun, grade, loadGrader } from './grade.mjs';

export const cases = ['cam-sua', 'co-bang-chung', 'docs-lech-code', 'hoi-lai', 'khong-co-bang-chung'];
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const defaultRoot = path.join(os.homedir(), 'Desktop/cafekit-codex-eval/ask-clean-base');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function sessions(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(e => e.isDirectory() && (e.name === 'sessions' || e.name.startsWith('sessions-')))
    .flatMap(e => fs.readdirSync(path.join(directory, e.name))
      .filter(f => f.endsWith('.jsonl')).map(f => path.join(directory, e.name, f)));
}

// Catalog available không chứng minh skill được đọc hoặc tuân thủ.
function catalog(raw) {
  const names = new Set();
  let observed = false;
  for (const line of raw.split('\n').filter(Boolean)) {
    const event = JSON.parse(line);
    const body = event.type === 'world_state' && event.payload?.state?.host_skills?.body;
    if (typeof body !== 'string') continue;
    observed = true;
    for (const hit of body.matchAll(/^- ([^\s:]+(?::[^\s:]+)?): /gm)) names.add(hit[1]);
  }
  return observed ? [...names].sort() : null;
}

export function inspect(root = defaultRoot) {
  const output = { root, excluded: 0, attempts: 0, loaded: 0, total: 0, errors: [], cases: [], catalogs: {} };
  for (const name of cases) {
    const directory = path.join(root, name);
    const graders = fs.readdirSync(path.join(repo, 'evals/ask', name, 'graders')).filter(f => f.endsWith('.md'))
      .sort().map(f => loadGrader(path.join(repo, 'evals/ask', name, 'graders', f)));
    const cell = { name, runs: [], graders, scores: Object.fromEntries(graders.map(g => [g.name, { pass: 0, scored: 0, na: 0 }])) };
    const entries = fs.readdirSync(directory, { withFileTypes: true }).filter(e => e.isDirectory())
      .sort((a, b) => Number(a.name) - Number(b.name) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (!/^\d+$/.test(entry.name)) {
        if (/\.attempt-|\.replacement-history-/.test(entry.name)) { output.excluded++; output.attempts++; }
        continue;
      }
      output.attempts++;
      const runDirectory = path.join(directory, entry.name);
      const resultFile = path.join(runDirectory, 'result.json');
      if (!fs.existsSync(resultFile)) { output.errors.push(`${name}/${entry.name}: thiếu result.json`); continue; }
      const result = json(resultFile);
      if (result.status === 'run_error') { output.excluded++; continue; }
      if (result.status !== 'completed' || result.exit !== 0) {
        output.errors.push(`${name}/${entry.name}: lượt không hợp lệ`); continue;
      }
      if (result.requestedModel !== 'gpt-6.1-sol' || result.reasoningEffort !== 'medium') {
        output.errors.push(`${name}/${entry.name}: sai model hoặc reasoning effort`);
      }
      const invocationFile = path.join(runDirectory, 'invocation.json');
      if (fs.existsSync(invocationFile)) {
        const invocation = json(invocationFile);
        if (invocation.cleanHome !== true || invocation.configuration !== 'C-clean-home-5d') {
          output.errors.push(`${name}/${entry.name}: không phải cấu hình home sạch đã chọn`);
        }
        const captureFile = path.join(runDirectory, 'capture.json');
        const captured = fs.existsSync(captureFile) ? json(captureFile).sessions : null;
        if (!Array.isArray(captured) || !captured.some(s => s.root) || !captured.every(s => s.valid === true)) {
          output.errors.push(`${name}/${entry.name}: thiếu capture hợp lệ`);
        }
      } else if (path.resolve(root) === defaultRoot) output.errors.push(`${name}/${entry.name}: thiếu invocation.json`);
      const context = readRun(runDirectory, 'ask');
      const files = sessions(runDirectory);
      if (!files.length) output.errors.push(`${name}/${entry.name}: thiếu nhật ký session`);
      const raw = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
      const loaded = raw.includes('AGENTS.md instructions');
      output.loaded += Number(loaded); output.total++;
      const available = catalog(raw);
      const signature = available === null ? 'unknown' : available.join(', ');
      output.catalogs[signature] = (output.catalogs[signature] || 0) + 1;
      const verdicts = Object.fromEntries(graders.map(g => [g.name, grade(g, context)]));
      for (const [key, verdict] of Object.entries(verdicts)) {
        const score = cell.scores[key];
        if (verdict.status === 'scored') { score.scored++; score.pass += Number(verdict.passed); }
        else score.na++;
      }
      cell.runs.push({ slot: entry.name, directory: runDirectory, loaded, available, verdicts, last: context.last });
    }
    if (cell.runs.length !== 10) output.errors.push(`${name}: cần đúng 10 lượt hợp lệ, thấy ${cell.runs.length}`);
    output.cases.push(cell);
  }
  const cam = output.cases.find(c => c.name === 'cam-sua');
  const gate = cam.graders.filter(g => g.name.startsWith('khong-sua-') || g.name === 'khong-file-moi');
  const hasGreet = gate.some(g => g.name === 'khong-sua-greet');
  output.decision = hasGreet && gate.every(g => cam.scores[g.name].scored === 10 && cam.scores[g.name].pass === 10)
    ? 'environment' : 'fix-needed';
  if (output.attempts > 60) output.errors.push(`Vượt trần 60 lượt: ${output.attempts}`);
  if (output.loaded) output.errors.push(`Có AGENTS.md toàn cục trong ${output.loaded} lượt`);
  return output;
}

export function printProbe(data) {
  for (const cell of data.cases) {
    const scores = Object.entries(cell.scores).map(([key, s]) => `${key} ${s.scored ? `${s.pass}/${s.scored}` : 'N/A'}`);
    console.log(`ask/${cell.name}: runs ${cell.runs.length}/10; ${scores.join(', ')}`);
  }
  console.log(`excluded runs: ${data.excluded}`);
  console.log(`global AGENTS.md loaded: ${data.loaded}/50`);
  for (const [names, n] of Object.entries(data.catalogs)) console.log(`skills available (${n}/50): ${names}`);
  console.log('skills invoked by prompt: cf-ask; available không đồng nghĩa đã đọc SKILL.md');
  console.log(`decision: ${data.decision}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    let phase, root = defaultRoot;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--phase') phase = args[++i];
      else if (args[i] === '--log-root') root = args[++i];
      else throw new Error(`Tham số không hỗ trợ: ${args[i]}`);
    }
    if (phase !== 'base' || !root) throw new Error('Cần --phase base [--log-root <dir>]');
    const data = inspect(path.resolve(root));
    printProbe(data);
    for (const error of data.errors) console.error(error);
    if (data.errors.length || data.total !== 50) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
