import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifest, logRoot, repo } from './room.mjs';
import { loadGrader, grade, readRun } from './grade.mjs';

const signature = score => JSON.stringify({ status: score?.status,
  ...(score?.status === 'scored' ? { passed: score.passed, ...(score.count === undefined ? {} : { count: score.count }) } : {}) });

// Chỉ tái hiện biến thể runner đã lưu; không dùng saved verdict làm đầu vào bộ chấm.
const oldProfiles = {
  'code-review': { flags: false, wholeInventory: true }, debug: { flags: false },
  develop: { flags: false, rootEvents: true, wholeInventory: true },
  sync: { flags: false, rootEvents: true, wholeInventory: true },
  test: { flagsOutsideFiles: false, rootEvents: true }, specs: { bashFlags: false, rootEvents: true, wholeInventory: true },
  ask: { rawCommands: true }, brainstorm: { rawCommands: true }, scout: { rawCommands: true },
  fix: {}, git: {}, research: {},
};

function legacyScore(g, context, skill) {
  const profile = oldProfiles[skill];
  if (!profile) return null;
  const rubric = { ...g }, old = { ...context }, causes = [];
  if (profile.flags === false || (profile.flagsOutsideFiles === false && g.target !== 'files') ||
    (profile.bashFlags === false && g.type === 'tool_used')) {
    if (g.flags) causes.push('runner cũ bỏ flags ở thước này');
    rubric.flags = undefined;
    // flags chỉ thuộc regex/tool_used; tránh thêm trường lạ vào schema khác.
    if (!['regex', 'tool_used'].includes(g.type)) delete rubric.flags;
  }
  if (profile.rootEvents) { old.events = context.stdoutEvents; causes.push('runner cũ chấm Bash từ stdout root'); }
  if (profile.rawCommands) { old.unwrapCommands = false; causes.push('runner cũ dùng command nguyên byte, không unwrap shell'); }
  if (profile.wholeInventory && g.type === 'regex' && g.target === 'files') {
    old.files = context.files.filter(file => !file.startsWith('.agents/'));
    old.initialFiles = []; causes.push('runner cũ chấm inventory toàn phòng, bỏ .agents, thay vì file mới');
  }
  return { score: grade(rubric, old), causes };
}

export function replay({ manifest = readManifest(), logs, results } = {}) {
  const root = logs || logRoot(manifest), resultRoot = results || root;
  const diagnostics = [], summary = [], allSlots = new Set();
  const expected = manifest.skills.reduce((total, skill) => total + skill.cases.reduce((n, cell) => n + cell.slots.length, 0), 0);
  if (manifest.skills.length !== 12 || new Set(manifest.skills.map(s => s.name)).size !== 12) throw new Error('Manifest phải có 12 skill');
  let totalRuns = 0;
  for (const skill of manifest.skills) {
    const row = { skill: skill.name, runs: 0, mismatches: 0, unexplained: 0 };
    for (const cell of skill.cases) {
      const gradersDir = path.join(repo, 'evals', skill.name, cell.case, 'graders');
      const graders = fs.existsSync(gradersDir) ? fs.readdirSync(gradersDir).filter(f => f.endsWith('.md')).sort()
        .map(file => loadGrader(path.join(gradersDir, file))) : [];
      for (const slot of cell.slots) {
        if (!Number.isInteger(slot.slot) || slot.slot < 1 || slot.slot > 10 ||
          slot.directory !== `${skill.canonicalDirectory}/${cell.case}/${slot.slot}` || allSlots.has(slot.directory)) throw new Error('Slot không chuẩn/trùng');
        allSlots.add(slot.directory); row.runs++; totalRuns++;
        const directory = path.join(root, slot.directory);
        // --results-root là bản sao đầy đủ kết quả; không fallback sang bản gốc khi thiếu.
        const saved = JSON.parse(fs.readFileSync(path.join(resultRoot, slot.directory, slot.result), 'utf8'));
        const context = readRun(directory, skill.name);
        const scores = (saved.scores || []).filter(s => s.family === 'H');
        const byName = new Map(scores.map(s => [s.grader, s]));
        if (byName.size !== scores.length) throw new Error(`Thước H trùng: ${slot.directory}`);
        if (saved.status !== 'completed') {
          row.mismatches++; row.unexplained++;
          diagnostics.push({ slot: slot.directory, grader: '(run)', cause: 'Kết quả chuẩn không completed', saved: saved.status });
        }
        for (const g of graders) {
          const observed = byName.get(g.name), current = grade(g, context);
          if (signature(current) === signature(observed)) continue;
          row.mismatches++;
          const legacy = legacyScore(g, context, skill.name);
          const explained = legacy?.causes.length > 0 && signature(legacy.score) !== signature(current) &&
            signature(legacy.score) === signature(observed);
          if (!explained) row.unexplained++;
          diagnostics.push({ slot: slot.directory, grader: g.name, saved: observed || null, replay: current,
            cause: explained ? legacy.causes.join('; ') : 'Không khớp verdict tái tính theo quy ước hiện tại hoặc runner cũ' });
        }
        for (const score of scores) if (!graders.some(g => g.name === score.grader)) {
          row.mismatches++; row.unexplained++;
          diagnostics.push({ slot: slot.directory, grader: score.grader, cause: 'Thước H đã lưu không có trong rubric' });
        }
      }
    }
    summary.push(row);
  }
  if (totalRuns !== expected || allSlots.size !== expected) throw new Error(`Replay thiếu lượt: ${totalRuns}/${expected}`);
  return { summary, diagnostics, totalRuns, expected, passed: summary.every(row => row.unexplained === 0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--log-root', '--results-root'].includes(args[i]) || !args[i + 1]) throw new Error('Dùng --log-root <logs> hoặc --results-root <copy>');
      options[args[i] === '--log-root' ? 'logs' : 'results'] = path.resolve(args[i + 1]);
    }
    const result = replay(options);
    for (const row of result.summary) console.log(`${row.skill}: runs ${row.runs}, mismatches ${row.mismatches}, unexplained ${row.unexplained}`);
    for (const diagnostic of result.diagnostics) console.error(JSON.stringify(diagnostic));
    console.error(`replay: ${result.totalRuns}/${result.expected} manifest slots`);
    if (!result.passed) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
