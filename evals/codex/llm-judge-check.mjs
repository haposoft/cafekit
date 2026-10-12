import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { flags, hashFor, parseVote, loadDataset } from './llm-judge-prompt.mjs';
import { flagCell } from './rescore.mjs';
import { loadGrader, readRun, grade } from './grade.mjs';
import { condition } from './mapping.mjs';
import { repo, readManifest, logRoot } from './room.mjs';

const defaults = { cacheRoot: path.join(os.homedir(), 'Desktop/cafekit-codex-eval/llm-judge'), gradersRoot: path.join(repo, 'evals') };
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const identity = e => `${e.group}/${e.key}/${e.id}`;
const count = rows => rows.filter(r => r.pass).length;

function readCosts(root, errors) {
  const file = path.join(root, 'calls.jsonl');
  let cost = 0; const calls = [];
  if (!fs.existsSync(file)) { errors.push(`Thiếu sổ chi phí: ${file}`); return { cost, calls }; }
  for (const [i, line] of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).entries()) {
    try {
      const call = JSON.parse(line), raw = JSON.parse(call.stdout), value = raw.total_cost_usd;
      if (!Number.isFinite(value) || value < 0 || call.cost !== value) throw new Error('Chi phí thiếu/lệch stdout gốc');
      cost += value;
      calls.push(call);
    } catch (error) { errors.push(`calls.jsonl:${i + 1}: ${error.message}`); }
  }
  return { cost, calls };
}

function descriptiveScores(gradersRoot, judged) {
  const manifest = readManifest(), root = logRoot(manifest), rows = [];
  for (const skill of manifest.skills.filter(s => ['scout', 'brainstorm'].includes(s.name))) {
    for (const cell of skill.cases) {
      const directory = path.join(gradersRoot, skill.name, cell.case, 'graders');
      const graders = fs.readdirSync(directory).filter(f => f.endsWith('.md') && !f.startsWith('dem-')).sort().map(f => loadGrader(path.join(directory, f)));
      const groups = new Map();
      for (const slot of cell.slots) {
        const c = condition(skill, slot);
        if (!groups.has(c.id)) groups.set(c.id, { condition: c, slots: [] });
        groups.get(c.id).slots.push(slot);
      }
      for (const { condition: c, slots } of groups.values()) {
        const contexts = slots.map(slot => readRun(path.join(root, slot.directory), skill.name, { mapping: true, manifest, logRoot: root }));
        for (const g of graders) {
          const scores = contexts.map((context, i) => {
            if (g.type !== 'llm') return grade(g, context);
            const result = judged.get(`old/${skill.name}/${cell.case}/${g.name}/${slots[i].slot}`);
            if (!result) throw new Error(`Thiếu LLM mô tả: ${skill.name}/${cell.case}/${g.name}/${slots[i].slot}`);
            return { status: 'scored', passed: result.pass };
          });
          const valid = scores.filter(s => s.status === 'scored');
          const conditions = `${c.home}, ${c.configuration}, ${c.model}, ${c.reasoningEffort}, ${c.sandbox}, runner ${c.runnerSha256}`;
          rows.push({ skill: skill.name, case: cell.case, grader: g.name, passed: valid.filter(s => s.passed).length, scored: valid.length,
            conditions, reasons: [...new Set(scores.filter(s => s.status !== 'scored').map(s => s.reason))] });
        }
      }
    }
  }
  return rows;
}

export function check(options = {}) {
  const { cacheRoot, gradersRoot } = { ...defaults, ...options }, errors = [], lines = [], judged = new Map();
  const routingGroups = ['routing', 'routing-control'].filter(group => fs.existsSync(path.join(cacheRoot, group)));
  const history = fs.existsSync(path.join(cacheRoot, 'history'));
  const dataset = loadDataset({ gradersRoot, routingGroups, history });
  const version = execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim();
  const { cost, calls } = readCosts(cacheRoot, errors);
  if (cost > 60) errors.push(`Chi phí vượt trần $60: $${cost.toFixed(6)}`);
  const logged = new Set(calls.filter(c => c.valid && c.exit === 0).map(c => `${c.group}/${c.key}/${c.id}/${c.vote}`));
  for (const entry of dataset.entries) {
    if (entry.missingFile) {
      judged.set(identity(entry), { ...entry, pass: false, reason: 'missing file', votes: [] });
      continue;
    }
    const votes = [];
    for (let k = 1; k <= 3; k++) {
      const file = path.join(cacheRoot, identity(entry), `vote-${k}.json`);
      try {
        const cached = readJSON(file);
        if (cached.hash !== hashFor(entry.body, entry.answer, version) || cached.version !== version || JSON.stringify(cached.argv) !== JSON.stringify(flags)) throw new Error('Cache cũ: hash/version/argv lệch');
        if (cached.exit !== 0) throw new Error('Cache chứa lời gọi lỗi');
        if (!logged.has(`${identity(entry)}/${k}`)) throw new Error('Cache thiếu lời gọi trong sổ chi phí');
        votes.push(parseVote(cached.stdout));
      } catch (error) { errors.push(`${identity(entry)}/vote-${k}.json: ${error.code === 'ENOENT' ? 'Thiếu cache' : error.message}`); }
    }
    if (votes.length === 3) judged.set(identity(entry), { ...entry, pass: count(votes) >= 2, votes });
  }
  if (errors.length) return { lines, errors, cost, dataset, judged, verdict: null, metrics: [], calibration: [], descriptive: [], excluded: dataset.excluded };

  const calibration = dataset.calibrationRows.map(row => {
    const entries = row.entries.map(id => judged.get(`calib/${row.key}/${id}`));
    if (entries.some(e => !e)) throw new Error(`Thiếu cấu hình hiệu chuẩn: ${row.id}`);
    const passed = count(entries), correct = entries.filter(e => e.pass === e.expected).length;
    const ok = entries.length === row.lockedN && (row.source === 'c' ? entries.length - passed >= 9 : row.source === 'd' ? correct === entries.length : Math.abs(passed - row.lockedPassed) <= 1);
    return { ...row, passed, scored: entries.length, correct, ok };
  });
  for (const row of calibration.filter(r => ['a', 'b'].includes(r.source))) lines.push(`calibration ${row.source} ${row.cell} ${row.grader} ${row.model}: judge ${row.passed}/${row.scored} vs locked ${row.lockedPassed}/${row.lockedN}`);
  const anchors = calibration.filter(r => r.source === 'c');
  for (const row of anchors) lines.push(`anchor mo-ho-c1 khong-tu-chot: ${row.scored - row.passed}/${row.scored} failed`);
  const synthetic = calibration.filter(r => r.source === 'd'), correct = synthetic.reduce((sum, r) => sum + r.correct, 0), syntheticN = synthetic.reduce((sum, r) => sum + r.scored, 0);
  lines.push(`synthetic: ${correct}/${syntheticN} correct`);
  const negative = dataset.entries.filter(e => e.group === 'negative').map(e => judged.get(identity(e)));
  lines.push(`negative controls: ${negative.length - count(negative)}/${negative.length} failed`);
  const calibrated = calibration.length > 0 && calibration.every(r => r.ok);
  lines.push(`calibration: ${calibrated ? 'PASS' : 'FAIL'}`);
  for (const excluded of dataset.excluded) lines.push(`excluded: ${typeof excluded === 'string' ? excluded : JSON.stringify(excluded)}`);

  const baselineRows = readJSON(path.join(repo, 'evals/codex/fixtures/baselines.json')).rows, metrics = [];
  for (const skill of new Set(dataset.keys.map(k => k.skill))) {
    for (const cell of new Set(dataset.keys.filter(k => k.skill === skill).map(k => k.case))) {
      const keys = dataset.keys.filter(k => k.skill === skill && k.case === cell);
      for (const set of ['new', 'old', ...routingGroups]) {
        const entries = [...judged.values()].filter(e => e.group === set && keys.some(k => k.key === e.key));
        if (!entries.length) continue;
        const runs = [...new Set(entries.map(e => e.id))].map(slot => ({ slot, scores: entries.filter(e => e.id === slot).map(e => ({ family: 'H', grader: e.key.split('/')[2], status: 'scored', passed: e.pass })) }));
        const result = flagCell(skill, cell, runs, baselineRows);
        for (const k of keys) {
          const scored = entries.filter(e => e.key === k.key), passed = count(scored);
          const d = synthetic.find(r => r.key === k.key), c = anchors.filter(r => r.key === k.key);
          let label = k.label;
          const anchorOK = c.length > 0 && c.every(r => r.ok);
          if (label === 'uncalibrated' && d?.ok && anchorOK) label = 'calibrated';
          for (const model of ['sonnet', 'opus']) {
            const b = baselineRows.find(b => b.skill === skill && b.case === cell && b.family === 'H' && b.grader === k.grader && b.model === model);
            const comparable = b?.status === 'current_archived' && Number.isInteger(b.passed) && b.scored > 0;
            const flag = result.flags.find(f => f.model === model && f.key === `${skill}/${cell}/H/${k.grader}`);
            const flagged = calibrated && label === 'calibrated' && comparable ? Boolean(flag) : null;
            const baseline = Number.isInteger(b?.passed) && b.scored > 0 ? `${b.passed}/${b.scored}` : 'n/a';
            const oldRunner = set === 'old' && !dataset.entries.some(e => e.group === 'new' && e.key === k.key);
            const item = { key: k.key, model, set, passed, scored: scored.length, baseline, baselineStatus: b?.status, label, flagged, oldRunner, flag: flag || null };
            metrics.push(item);
            lines.push(`${k.key} ${model} ${set}: codex ${passed}/${scored.length} vs claude ${baseline}; flagged ${flagged === null ? 'n/a' : flagged ? 'yes' : 'no'}; label ${label}${oldRunner ? '; old-runner' : ''}`);
          }
        }
      }
    }
  }
  const descriptive = descriptiveScores(gradersRoot, judged);
  for (const r of descriptive) lines.push(`descriptive ${r.skill} ${r.case}/${r.grader}: ${r.passed}/${r.scored} (${r.conditions}${r.reasons.length ? `; N/A: ${r.reasons.join('; ')}` : ''})`);
  if (history) {
    const entries = [...judged.values()].filter(e => e.group === 'history');
    lines.push(`specs/sau-keep/moi-ac-co-task history: codex ${count(entries)}/${entries.length}; label uncalibrated`);
    for (const entry of entries.filter(e => e.missingFile)) lines.push(`history/${entry.key}/${entry.id}: FAIL missing file`);
  }
  const verdict = calibrated ? 'PASS' : 'REFERENCE';
  lines.push(`cost: $${cost.toFixed(6)}`, `verdict: ${verdict}`);
  return { lines, errors, metrics, calibration, calibrated, negative, synthetic: { correct, scored: syntheticN }, cost, verdict, descriptive, excluded: dataset.excluded, dataset, judged };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--cache-root', '--graders-root'].includes(args[i]) || !args[i + 1]) throw new Error('Dùng [--cache-root <dir>] [--graders-root <dir>]');
      options[args[i] === '--cache-root' ? 'cacheRoot' : 'gradersRoot'] = path.resolve(args[i + 1]);
    }
    const result = check(options);
    result.lines.forEach(line => console.log(line));
    result.errors.forEach(error => console.error(error));
    if (result.errors.length) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
