'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const { planMigration, planSteps } = require('../lib/migrate-apply');
const { sha256 } = require('../lib/manifest');

const INSTALLER = path.join(__dirname, '../install.js');
const LIB = path.join(__dirname, '../lib');

// Runs applyMigration (or lock.acquire) in its own process so its cwd can be the
// temp repository; an injected fs counts, slows or fails the apply writes.
const RUNNER = `
'use strict';
const fs = require('fs');
const [lib, mode, raw] = process.argv.slice(2);
const opts = JSON.parse(raw);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
if (mode === 'lock') {
  const lock = require(lib + '/lock.js');
  process.stdout.write('READY\\n');
  while (!fs.existsSync(opts.go)) sleep(1);
  const got = lock.acquire(opts.dir);
  process.stdout.write('RESULT ' + JSON.stringify(got) + '\\n');
  sleep(300);
  process.exit(0);
}
const { applyMigration, planMigration } = require(lib + '/migrate-apply.js');
const APPLY_WRITES = new Set(['unlinkSync', 'writeFileSync', 'renameSync', 'rmdirSync']);
let writes = 0;
const io = { ...fs };
for (const name of Object.keys(fs)) {
  if (typeof fs[name] !== 'function') continue;
  io[name] = (...args) => {
    if (APPLY_WRITES.has(name)) {
      writes++;
      if (writes === 1 && opts.editDuringApply) fs.appendFileSync(opts.repo + '/' + opts.editDuringApply, '\\nedited during apply\\n');
      if (opts.slowMs) sleep(opts.slowMs);
      if (opts.failAt === writes) throw Object.assign(new Error('injected write failure'), { code: 'EIO' });
    }
    if (name === 'writeFileSync' && opts.failTempWriteOf && String(args[0]).includes('/' + opts.failTempWriteOf + '.cafekit-migrate-')) {
      fs.writeFileSync(args[0], '', { flag: 'wx' });
      throw Object.assign(new Error('injected disk full'), { code: 'ENOSPC' });
    }
    if (name === 'renameSync' && opts.failRenameOf && String(args[1]).endsWith('/' + opts.failRenameOf)) {
      throw Object.assign(new Error('injected rename failure'), { code: 'EPERM' });
    }
    if (name === 'rmSync' && opts.failRestoreTarget && args[0] === opts.failRestoreTarget) {
      throw Object.assign(new Error('injected restore failure'), { code: 'EIO' });
    }
    return fs[name](...args);
  };
}
const plan = planMigration(opts.repo);
if (opts.editAfterPlan) fs.appendFileSync(opts.repo + '/' + opts.editAfterPlan, '\\nedited after the plan\\n');
let announced = false;
applyMigration(opts.repo, {
  plan,
  fs: io,
  onStep: () => { if (!announced) { announced = true; process.stdout.write('STEP\\n'); } }
}).then((result) => {
  process.stdout.write('RESULT ' + JSON.stringify(result) + '\\n');
  process.exit(result.ok ? 0 : 1);
});
`;

let work;
let pristine;
let runner;
let counter = 0;

function copyRepo(name = `repo-${++counter}`) {
  const target = path.join(work, name, 'repo');
  fs.cpSync(pristine, target, { recursive: true, verbatimSymlinks: true });
  return target;
}

function treeHash(root, skip = ['.cafekit-backup', '.cafekit.lock']) {
  const hash = crypto.createHash('sha256');
  const visit = (rel) => {
    const abs = path.join(root, rel);
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink()) hash.update(`L ${rel} ${fs.readlinkSync(abs)}\n`);
    else if (stat.isDirectory()) {
      for (const name of fs.readdirSync(abs).sort()) {
        if (rel === '.' && skip.includes(name)) continue;
        visit(path.join(rel, name));
      }
    } else hash.update(`F ${rel} ${sha256(fs.readFileSync(abs))}\n`);
  };
  visit('.');
  return hash.digest('hex');
}

function runApply(repo, opts = {}, cwd = repo) {
  const run = spawnSync(process.execPath, [runner, LIB, 'apply', JSON.stringify({ repo, ...opts })], { cwd, encoding: 'utf8' });
  const line = run.stdout.split('\n').find((item) => item.startsWith('RESULT '));
  assert.ok(line, `no result: ${run.stderr}`);
  return { status: run.status, result: JSON.parse(line.slice(7)) };
}

before(() => {
  work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ck-migrate-apply-')));
  runner = path.join(work, 'runner.cjs');
  fs.writeFileSync(runner, RUNNER);
  fs.mkdirSync(path.join(work, 'home'));
  pristine = path.join(work, 'pristine', 'repo');
  fs.mkdirSync(pristine, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: pristine });
  // The installer writes into its cwd, so it must run inside the temp repository.
  const run = spawnSync(process.execPath, [INSTALLER, '--platform', 'claude,codex', '-y'], {
    cwd: pristine,
    env: { ...process.env, HOME: path.join(work, 'home'), CI: '1' },
    encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const agents = path.join(pristine, 'AGENTS.md');
  fs.writeFileSync(agents, `# Team rules\n\n${fs.readFileSync(agents, 'utf8')}`);
  fs.writeFileSync(path.join(pristine, '.claude/.env'), 'TOKEN=[redacted]\n');
});

after(() => fs.rmSync(work, { recursive: true, force: true }));

test('apply-removes-planned, kept-bytes-equal, merged-match-plan, backup-holds-pre-run, second-run-nothing', async (t) => {
  const repo = copyRepo();
  const plan = planMigration(repo);
  const removed = plan.manifest.entries.filter((entry) => entry.action === 'remove').map((entry) => entry.path);
  const kept = [...plan.manifest.entries.filter((entry) => entry.action === 'keep').map((entry) => entry.path), '.claude/.env'];
  const keptHashes = new Map(kept.map((rel) => [rel, sha256(fs.readFileSync(path.join(repo, rel)))]));
  const preBytes = new Map([...removed, 'AGENTS.md'].map((rel) => [rel, fs.readFileSync(path.join(repo, rel))]));
  assert.ok(removed.length > 100);

  const { status, result } = runApply(repo);
  assert.equal(status, 0, JSON.stringify(result));
  assert.equal(result.ok, true);

  await t.test('apply-removes-planned', () => {
    for (const rel of removed) assert.ok(!fs.existsSync(path.join(repo, rel)), rel);
  });
  await t.test('kept-bytes-equal', () => {
    for (const [rel, hash] of keptHashes) assert.equal(sha256(fs.readFileSync(path.join(repo, rel))), hash, rel);
  });
  await t.test('merged-match-plan', () => {
    for (const file of plan.merged.files) {
      const abs = path.join(repo, file.path);
      if (file.action === 'remove') assert.ok(!fs.existsSync(abs), file.path);
      else assert.equal(fs.readFileSync(abs, 'utf8'), file.after, file.path);
    }
    assert.ok(plan.merged.files.some((file) => file.action === 'write' && file.path === 'AGENTS.md'));
  });
  await t.test('backup-holds-pre-run', () => {
    for (const [rel, bytes] of preBytes) {
      assert.deepEqual(fs.readFileSync(path.join(repo, result.backupDir, 'data', rel)), bytes, rel);
    }
  });
  await t.test('second-run-nothing', () => {
    const again = planMigration(repo);
    assert.equal(again.manifest.entries.filter((entry) => entry.action === 'remove').length, 0);
    assert.deepEqual(planSteps(again), []);
    assert.equal(runApply(repo).result.nothing, true);
  });
});

test('injected-failure-restores: a failed fifth write puts every byte back', () => {
  const repo = copyRepo();
  const beforeHash = treeHash(repo);
  const { status, result } = runApply(repo, { failAt: 5 });
  assert.notEqual(status, 0);
  assert.equal(result.ok, false);
  assert.equal(result.removed, 4);
  assert.deepEqual(result.restoreErrors, []);
  assert.equal(treeHash(repo), beforeHash);
  assert.ok(!fs.existsSync(path.join(repo, '.cafekit.lock')));
});

test('temp-file-cleaned: a failed rename of a root-level merged file leaves no temp file behind', () => {
  const repo = copyRepo();
  const beforeHash = treeHash(repo);
  const { status, result } = runApply(repo, { failRenameOf: 'AGENTS.md' });
  assert.notEqual(status, 0);
  assert.equal(result.reason, 'EPERM');
  assert.match(result.message, /Rolled back .*AGENTS\.md/);
  assert.deepEqual(fs.readdirSync(repo).filter((name) => name.includes('cafekit-migrate')), []);
  assert.equal(treeHash(repo), beforeHash);
});

test('partial-temp-cleaned: a temp file created but not fully written is removed too', () => {
  const repo = copyRepo();
  const beforeHash = treeHash(repo);
  const { status, result } = runApply(repo, { failTempWriteOf: 'AGENTS.md' });
  assert.notEqual(status, 0);
  assert.equal(result.reason, 'ENOSPC');
  assert.deepEqual(fs.readdirSync(repo).filter((name) => name.includes('cafekit-migrate')), []);
  assert.equal(treeHash(repo), beforeHash);
});

test('merged-keeps-mode: a rewritten merged file keeps its permissions', () => {
  const repo = copyRepo();
  fs.chmodSync(path.join(repo, 'AGENTS.md'), 0o600);
  const { status } = runApply(repo);
  assert.equal(status, 0);
  assert.equal(fs.statSync(path.join(repo, 'AGENTS.md')).mode & 0o777, 0o600);
});

test('restore-continues-past-failure: one target that cannot be restored does not stop the others', () => {
  const repo = copyRepo();
  const beforeHash = treeHash(repo, ['.cafekit-backup', '.cafekit.lock', '.claude']);
  const { status, result } = runApply(repo, { failAt: 5, failRestoreTarget: '.claude' });
  assert.notEqual(status, 0);
  assert.deepEqual(result.restoreErrors.map((item) => item.target), ['.claude']);
  assert.doesNotMatch(result.message.split('Rolled back')[1], /\.claude\b/);
  assert.ok(result.manualSteps[0].includes(path.join(result.backupDir, 'data', '.claude')));
  // Every other target (.codex, .agents, AGENTS.md, CLAUDE.md, .gitignore) is back.
  assert.equal(treeHash(repo, ['.cafekit-backup', '.cafekit.lock', '.claude']), beforeHash);
});

test('sigint-restores: an interrupt mid-apply puts every byte back', async () => {
  const repo = copyRepo();
  const beforeHash = treeHash(repo);
  const child = spawn(process.execPath, [runner, LIB, 'apply', JSON.stringify({ repo, slowMs: 20 })], { cwd: repo });
  let stdout = '';
  const exit = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    if (stdout.includes('STEP\n') && !child.killed) child.kill('SIGINT');
  });
  const code = await exit;
  const line = stdout.split('\n').find((item) => item.startsWith('RESULT '));
  assert.ok(line, stdout);
  const result = JSON.parse(line.slice(7));
  assert.notEqual(code, 0);
  assert.equal(result.reason, 'interrupted');
  assert.ok(result.removed > 0);
  assert.equal(treeHash(repo), beforeHash);
});

test('stale-plan-refused: a planned file edited after the plan stops apply before any change', () => {
  const repo = copyRepo();
  const twin = copyRepo();
  fs.appendFileSync(path.join(twin, '.claude/agents/debugger.md'), '\nedited after the plan\n');
  const { status, result } = runApply(repo, { editAfterPlan: '.claude/agents/debugger.md' });
  assert.notEqual(status, 0);
  assert.equal(result.reason, 'stale');
  assert.equal(result.removed, 0);
  assert.equal(treeHash(repo), treeHash(twin));
});

test('stale-during-apply-refused: a planned file edited while apply runs is caught by the per-file re-check', () => {
  const repo = copyRepo();
  const beforeHash = treeHash(repo);
  const plan = planMigration(repo);
  const last = plan.manifest.entries.filter((entry) => entry.action === 'remove').at(-1).path;
  const { status, result } = runApply(repo, { editDuringApply: last });
  assert.notEqual(status, 0);
  assert.equal(result.reason, 'stale');
  assert.match(result.message, new RegExp(last.replace(/[.]/g, '\\.')));
  // The rollback restores the snapshot, so the tree is back to its state before apply.
  assert.equal(treeHash(repo), beforeHash);
});

test('wrong-cwd-refused: apply from another directory changes nothing', () => {
  const repo = copyRepo();
  const beforeHash = treeHash(repo, []);
  const { status, result } = runApply(repo, {}, work);
  assert.notEqual(status, 0);
  assert.equal(result.reason, 'wrong-cwd');
  assert.equal(treeHash(repo, []), beforeHash);
});

async function raceAcquire(dir) {
  const go = path.join(dir, `go-${++counter}`);
  const children = [0, 1].map(() => spawn(process.execPath, [runner, LIB, 'lock', JSON.stringify({ dir, go })]));
  const outputs = children.map(() => '');
  const ready = children.map((child, index) => new Promise((resolve) => child.stdout.on('data', (chunk) => {
    outputs[index] += chunk;
    if (outputs[index].includes('READY')) resolve();
  })));
  const exits = children.map((child) => new Promise((resolve) => child.on('exit', resolve)));
  await Promise.all(ready);
  fs.writeFileSync(go, '');
  await Promise.all(exits);
  return outputs.map((output) => JSON.parse(output.split('\n').find((line) => line.startsWith('RESULT ')).slice(7)));
}

function deadPid() {
  const child = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
  return Number(child.stdout);
}

test('lock-exclusive: two concurrent acquires never both succeed', async () => {
  const dir = fs.mkdtempSync(path.join(work, 'lock-'));
  for (let round = 0; round < 8; round++) {
    const results = await raceAcquire(dir);
    assert.equal(results.filter((result) => result.acquired).length, 1, JSON.stringify(results));
    fs.rmSync(path.join(dir, '.cafekit.lock'), { force: true });
  }
});

test('stale-lock-exclusive: two runs reclaiming the same stale lock never both succeed', async () => {
  const dir = fs.mkdtempSync(path.join(work, 'stale-'));
  for (let round = 0; round < 8; round++) {
    fs.writeFileSync(path.join(dir, '.cafekit.lock'), JSON.stringify({ pid: deadPid(), since: 'earlier' }));
    const results = await raceAcquire(dir);
    // The reclaimer may delete the stale lock and then lose the `wx` create to the other
    // run's first attempt; either way exactly one run holds the lock.
    assert.equal(results.filter((result) => result.acquired).length, 1, JSON.stringify(results));
    assert.ok(!fs.existsSync(path.join(dir, '.cafekit.lock.reclaim')));
    fs.rmSync(path.join(dir, '.cafekit.lock'), { force: true });
  }

  // Deterministic half: while another run holds the reclaim guard, a stale lock is not taken.
  fs.writeFileSync(path.join(dir, '.cafekit.lock'), JSON.stringify({ pid: deadPid(), since: 'earlier' }));
  fs.writeFileSync(path.join(dir, '.cafekit.lock.reclaim'), JSON.stringify({ pid: process.pid, since: 'now' }));
  const lock = require('../lib/lock');
  const blocked = lock.acquire(dir);
  assert.equal(blocked.acquired, false);
  assert.equal(blocked.reason, 'reclaiming');
  assert.ok(fs.existsSync(path.join(dir, '.cafekit.lock.reclaim')), 'a guard held by another run is left alone');
  fs.rmSync(path.join(dir, '.cafekit.lock.reclaim'));

  // A lock file is never visible without its owner's pid, so a reader cannot mistake a
  // lock being created for a stale one.
  fs.rmSync(path.join(dir, '.cafekit.lock'));
  const realLink = fs.linkSync;
  let seenAtLink = null;
  fs.linkSync = (from, to) => {
    seenAtLink = fs.existsSync(to) ? 'present' : JSON.parse(fs.readFileSync(from, 'utf8')).pid;
    return realLink(from, to);
  };
  try {
    assert.equal(lock.acquire(dir).acquired, true);
  } finally {
    fs.linkSync = realLink;
  }
  assert.equal(seenAtLink, process.pid);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '.cafekit.lock'), 'utf8')).pid, process.pid);
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.startsWith('.cafekit.lock.')), []);

  // A full disk while writing the lock's temp file is an error, and leaves no lock behind.
  const realWrite = fs.writeFileSync;
  fs.writeFileSync = (file, ...rest) => {
    if (String(file).includes('.cafekit.lock.')) {
      realWrite(file, '', { flag: 'wx' });
      throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
    }
    return realWrite(file, ...rest);
  };
  fs.rmSync(path.join(dir, '.cafekit.lock'));
  try {
    assert.throws(() => lock.acquire(dir), { code: 'ENOSPC' });
  } finally {
    fs.writeFileSync = realWrite;
  }
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.startsWith('.cafekit.lock')), []);
  realWrite(path.join(dir, '.cafekit.lock'), JSON.stringify({ pid: process.pid }));

  // Without hard links (exFAT, some shares) the lock still works through a plain `wx` create.
  fs.rmSync(path.join(dir, '.cafekit.lock'));
  fs.linkSync = () => { throw Object.assign(new Error('operation not permitted, link'), { code: 'EPERM' }); };
  try {
    assert.equal(lock.acquire(dir).acquired, true);
    assert.equal(lock.acquire(dir).acquired, false);
  } finally {
    fs.linkSync = realLink;
  }
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.startsWith('.cafekit.lock.')), []);
});
