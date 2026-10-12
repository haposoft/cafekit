import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { flags, model, buildPrompt, hashFor, parseVote, loadDataset } from './llm-judge-prompt.mjs';

export const cacheRoot = path.join(os.homedir(), 'Desktop/cafekit-codex-eval/llm-judge');
const cap = 60, perCallCap = 0.50, concurrency = 6;
const groups = ['negative', 'calib', 'new', 'old'];
const version = () => execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim();
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const ledger = root => fs.existsSync(path.join(root, 'calls.jsonl'))
  ? fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
const append = (root, file, row) => fs.appendFileSync(path.join(root, file), JSON.stringify(row) + '\n');
export const cacheFile = (root, entry, vote) => path.join(root, entry.group, entry.key, entry.id, `vote-${vote}.json`);
const spent = root => ledger(root).reduce((sum, call) => {
  if (!Number.isFinite(call.cost) || call.cost < 0) throw new Error('Chi phí không xác định; dừng để tránh vượt trần');
  return sum + call.cost;
}, 0);

function cached(root, entry, vote, cliVersion) {
  const file = cacheFile(root, entry, vote);
  if (!fs.existsSync(file)) return false;
  const row = read(file);
  if (row.hash !== hashFor(entry.body, entry.answer, cliVersion) || row.version !== cliVersion ||
    JSON.stringify(row.argv) !== JSON.stringify(flags) || row.exit !== 0) throw new Error(`Cache không hợp lệ: ${file}`);
  parseVote(row.stdout);
  return true;
}

export function projection(entries, root = cacheRoot) {
  const negative = ledger(root).filter(row => row.group === 'negative');
  if (!negative.length) return null;
  const cost = negative.reduce((n, row) => n + row.cost, 0);
  const inputChars = negative.reduce((n, row) => n + (row.inputChars || 0), 0);
  if (!inputChars || negative.some(row => !Number.isFinite(row.cost))) return null;
  // Extrapolate measured negative cost per input character; include the cost already incurred.
  const remainingChars = entries.reduce((n, e) => n + [1, 2, 3].filter(v => !fs.existsSync(cacheFile(root, e, v))).length * buildPrompt(e.body, e.answer).length, 0);
  return spent(root) + remainingChars * cost / inputChars;
}

async function invoke(entry, vote, root, cliVersion, cwd, state) {
  if (spent(root) + state.active * perCallCap + perCallCap > cap) {
    const error = new Error('Trần chi phí $60: không đủ dự phòng cho lời gọi tiếp theo'); error.exit = 2; throw error;
  }
  state.active++;
  const prompt = buildPrompt(entry.body, entry.answer);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(ORCA_|HERDR_)/.test(key)));
  let stdout = '', stderr = '', timedOut = false;
  let exit;
  try {
    exit = await new Promise((resolve, reject) => {
      const child = spawn('claude', flags, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 180000);
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('close', code => { clearTimeout(timer); resolve(code); });
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
    });
  } catch { exit = null; }
  let envelope, parsed, reason;
  try { envelope = JSON.parse(stdout); } catch { reason = 'stdout không phải JSON'; }
  const cost = Number.isFinite(envelope?.total_cost_usd) ? envelope.total_cost_usd : null;
  try {
    if (exit !== 0 || timedOut || envelope?.is_error) throw new Error('CLI lỗi, timeout hoặc đăng nhập không hợp lệ');
    parsed = parseVote(stdout);
  } catch (error) { reason = error.message; }
  const valid = !!parsed && cost !== null;
  const row = { group: entry.group, key: entry.key, id: entry.id, vote, createdAt: new Date().toISOString(),
    stdout, stderr, exit, cost, valid, argv: flags, version: cliVersion, hash: hashFor(entry.body, entry.answer, cliVersion), reason: valid ? null : reason || 'thiếu chi phí', inputChars: prompt.length };
  append(root, 'calls.jsonl', row);
  state.active--;
  if (!valid) {
    append(root, 'errors.jsonl', row);
    throw new Error(`${entry.group}/${entry.key}/${entry.id}/vote-${vote}: ${row.reason}; output giữ ngoài repo, không ghi cache`);
  }
  if (entry.group !== 'preflight') {
    const file = cacheFile(root, entry, vote);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...row, hash: hashFor(entry.body, entry.answer, cliVersion), argv: flags, version: cliVersion }, null, 2) + '\n', { flag: 'wx' });
  }
  return parsed;
}

export async function run({ only, root = cacheRoot, execute = false } = {}) {
  if (only && !groups.includes(only)) throw new Error(`Nhóm không hợp lệ: ${only}`);
  const dataset = loadDataset(), cliVersion = version(), entries = dataset.entries;
  for (const group of groups) {
    const count = entries.filter(e => e.group === group).length;
    console.log(`plan ${group}: answers ${count}, calls ${count * 3}`);
  }
  console.log(`judge: ${model}; CLI ${cliVersion}; cap: $${cap}`);
  const estimate = projection(entries, root);
  console.log(`projected cost: ${estimate === null ? 'pending negative controls' : '$' + estimate.toFixed(4)}`);
  if (!execute) return;
  fs.mkdirSync(root, { recursive: true });
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-llm-judge-'));
  const state = { active: 0 };
  try {
    // A new isolated authentication/schema probe precedes every requested group.
    for (const group of only ? [only] : groups) {
      if (group !== 'negative') {
        const negatives = entries.filter(e => e.group === 'negative');
        if (!negatives.every(e => [1, 2, 3].every(v => cached(root, e, v, cliVersion)))) throw new Error('Phải hoàn tất negative trước mọi nhóm khác');
        const predicted = projection(entries, root);
        console.log(`projected cost: $${predicted.toFixed(4)}`);
        if (predicted > cap) { const error = new Error('Ngoại suy vượt trần $60; dừng'); error.exit = 2; throw error; }
      }
      await invoke({ group: 'preflight', key: 'isolation', id: group, body: 'PASS if the answer is exactly READY; otherwise FAIL.', answer: 'READY' }, 1, root, cliVersion, cwd, state);
      console.log(`preflight ${group}: PASS`);
      const jobs = entries.filter(e => e.group === group).flatMap(e => [1, 2, 3].map(v => ({ e, v }))).filter(({ e, v }) => !cached(root, e, v, cliVersion));
      let next = 0, completed = 0, failure;
      const workers = Array.from({ length: concurrency }, async () => {
        while (!failure && next < jobs.length) {
          const { e, v } = jobs[next++];
          try {
            await invoke(e, v, root, cliVersion, cwd, state);
            completed++;
            if (completed % 15 === 0 || completed === jobs.length) console.log(`${group}: votes ${completed}/${jobs.length}, cost $${spent(root).toFixed(4)}`);
          } catch (error) { failure ||= error; }
        }
      });
      await Promise.all(workers);
      if (failure) throw failure;
      console.log(`${group}: complete, cost $${spent(root).toFixed(4)}`);
      if (group === 'negative') {
        const predicted = projection(entries, root);
        console.log(`projected cost: $${predicted.toFixed(4)}`);
        if (predicted > cap) { const error = new Error('Ngoại suy vượt trần $60; dừng'); error.exit = 2; throw error; }
      }
    }
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const unknown = args.filter((a, i) => !['--run', '--only'].includes(a) && args[i - 1] !== '--only');
  if (unknown.length) { console.error('Tham số không hợp lệ'); process.exitCode = 1; }
  else run({ execute: args.includes('--run'), only: args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined })
    .catch(error => { console.error(error.message); process.exitCode = error.exit || 1; });
}
