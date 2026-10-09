import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifest, logRoot } from './room.mjs';
import { gradeV } from './grade-v.mjs';

const signature = score => JSON.stringify({ status: score?.status,
  ...(score?.status === 'scored' ? { passed: score.passed } : {}) });

export function replayV({ manifest = readManifest(), logs, results } = {}) {
  const root = logs || logRoot(manifest), resultRoot = results || root;
  const summary = [], diagnostics = [], seen = new Set();
  const skills = ['sync', 'git'].map(name => {
    const matches = manifest.skills.filter(s => s.name === name);
    if (matches.length !== 1) throw new Error(`Manifest thiếu/trùng skill: ${name}`);
    return matches[0];
  });
  const expected = skills.reduce((n, skill) => n + skill.cases.reduce((m, c) => m + c.slots.length, 0), 0);
  for (const skill of skills) {
    const row = { skill: skill.name, runs: 0, mismatches: 0, unexplained: 0 };
    for (const cell of skill.cases) for (const slot of cell.slots) {
      if (!Number.isInteger(slot.slot) || slot.slot < 1 || slot.slot > 10 ||
        slot.directory !== `${skill.canonicalDirectory}/${cell.case}/${slot.slot}` || seen.has(slot.directory)) {
        throw new Error(`Slot không chuẩn/trùng: ${slot.directory}`);
      }
      seen.add(slot.directory); row.runs++;
      // Bản sao kết quả phải đầy đủ; không fallback sang verdict thật khi thiếu file.
      const saved = JSON.parse(fs.readFileSync(path.join(resultRoot, slot.directory, slot.result), 'utf8'));
      const observed = (saved.scores || []).filter(s => s.family === 'V');
      const byName = new Map(observed.map(s => [s.grader, s]));
      if (byName.size !== observed.length) throw new Error(`Thước V trùng: ${slot.directory}`);
      const current = gradeV(skill.name, cell.case, path.join(root, slot.directory));
      const mismatch = (grader, old, replay, cause) => {
        row.mismatches++; row.unexplained++;
        diagnostics.push({ slot: slot.directory, grader, saved: old ?? null, replay: replay ?? null, cause });
      };
      if (saved.status !== 'completed') mismatch('(run)', saved.status, 'completed', 'Kết quả chuẩn không completed');
      // Không có quy ước lệch đã biết: so trực tiếp thước gốc, không dùng verdict làm đầu vào.
      for (const score of current) if (signature(score) !== signature(byName.get(score.grader))) {
        mismatch(score.grader, byName.get(score.grader), score, 'Không khớp verdict tái tính bằng thước V gốc');
      }
      for (const score of observed) if (!current.some(s => s.grader === score.grader)) {
        mismatch(score.grader, score, null, 'Thước V đã lưu không có trong registry gốc');
      }
    }
    summary.push(row);
  }
  const totalRuns = summary.reduce((n, row) => n + row.runs, 0);
  if (totalRuns !== expected || seen.size !== expected) throw new Error(`Replay thiếu lượt: ${totalRuns}/${expected}`);
  return { summary, diagnostics, totalRuns, expected, passed: summary.every(row => row.unexplained === 0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--log-root', '--results-root'].includes(args[i]) || !args[i + 1]) throw new Error('Dùng --log-root <logs> hoặc --results-root <copy>');
      options[args[i] === '--log-root' ? 'logs' : 'results'] = path.resolve(args[i + 1]);
    }
    const result = replayV(options);
    for (const row of result.summary) console.log(`${row.skill}: runs ${row.runs}, mismatches ${row.mismatches}, unexplained ${row.unexplained}`);
    for (const diagnostic of result.diagnostics) console.error(JSON.stringify(diagnostic));
    if (!result.passed) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
