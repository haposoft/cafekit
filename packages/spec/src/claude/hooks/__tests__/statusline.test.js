'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STATUS_PATH = path.resolve(__dirname, '..', '..', 'status.cjs');
const GOLDEN_PATH = path.join(__dirname, 'fixtures', 'statusline-default.golden');
const NBSP = / /g;
const ANSI = /\x1b\[[0-9;]*m/g;
/** Visible text: colour codes removed, non-breaking spaces read as spaces, reset countdown masked. */
const visible = (text) => text.replace(ANSI, '').replace(NBSP, ' ').replace(/\d+h\d+m/g, '<reset>');

const cleanupDirs = [];
process.on('exit', () => {
  for (const dir of cleanupDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function basePayload(overrides = {}) {
  return {
    model: { display_name: 'TestModel' },
    workspace: { current_dir: '/fixture/dir' },
    cwd: '/fixture/dir',
    context_window: {
      context_window_size: 200000,
      current_usage: {
        input_tokens: 40000,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 20000,
      },
    },
    ...overrides,
  };
}

/**
 * Spawn status.cjs as a child process under a fully pinned environment:
 * - cwd: a fixture root carrying its own .claude/runtime.json
 * - TMPDIR/TEMP/TMP: an isolated per-case temp root (git + usage + context caches)
 * - NO_COLOR/FORCE_COLOR scrubbed unless the case provides them
 * - COLUMNS pinned so responsive wrapping is deterministic
 */
function runStatus({ runtime = { statusline: 'full', statuslineColors: true }, payload = basePayload(), envExtra = {}, tmpFiles = {} } = {}) {
  const caseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-case-'));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-tmp-'));
  try {
    fs.mkdirSync(path.join(caseDir, '.claude'));
    fs.writeFileSync(path.join(caseDir, '.claude', 'runtime.json'), JSON.stringify(runtime));
    for (const [name, content] of Object.entries(tmpFiles)) {
      fs.writeFileSync(path.join(tmpDir, name), JSON.stringify(content));
    }
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: tmpDir,
      TEMP: tmpDir,
      TMP: tmpDir,
      COLUMNS: '200',
      ...envExtra,
    };
    const result = spawnSync(process.execPath, [STATUS_PATH], {
      cwd: caseDir,
      env,
      input: Buffer.from(JSON.stringify(payload)),
    });
    return {
      status: result.status,
      stdoutBuffer: result.stdout,
      stdout: result.stdout.toString('utf8'),
      stderr: result.stderr.toString('utf8'),
      readTmpFile(name) {
        const p = path.join(tmpDir, name);
        return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
      },
    };
  } finally {
    // Defer cleanup so readTmpFile still works after the spawn returns.
    cleanupDirs.push(caseDir, tmpDir);
  }
}

/** Claude Code's own quota payload: used percentages and epoch-second resets 2h29m and 2d5h ahead. */
function rateLimits({ fiveHour = 20, weekly = 45 } = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    five_hour: { used_percentage: fiveHour, resets_at: nowSec + 2 * 3600 + 29 * 60 + 30 },
    seven_day: { used_percentage: weekly, resets_at: nowSec + 2 * 86400 + 5 * 3600 },
  };
}

/** The file the retired usage hook used to write; the statusline must ignore it. */
function freshUsageCache(now = Date.now()) {
  return {
    status: 'available',
    timestamp: now,
    data: {
      five_hour: { utilization: 20, resets_at: new Date(now + 2 * 3600 * 1000 + 29 * 60 * 1000).toISOString() },
      seven_day: { utilization: 45, resets_at: new Date(now + (2 * 86400 + 5 * 3600) * 1000).toISOString() },
    },
  };
}

test('statusline default output is byte-identical to the golden fixture when no layout is configured', () => {
  const golden = fs.readFileSync(GOLDEN_PATH);
  const run = runStatus();
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stdoutBuffer.equals(golden),
    `default output drifted from golden\nexpected: ${JSON.stringify(golden.toString('utf8'))}\nactual:   ${JSON.stringify(run.stdout)}`);
});

test('statusline custom layout renders named sections in order per line', () => {
  const run = runStatus({
    runtime: { statusline: 'full', statuslineColors: true, statuslineLayout: { lines: [['directory', 'model']] } },
  });
  assert.equal(run.status, 0, run.stderr);
  const dirIndex = run.stdout.indexOf('📁');
  const modelIndex = run.stdout.indexOf('🤖');
  assert.ok(dirIndex >= 0 && modelIndex >= 0, run.stdout);
  assert.ok(dirIndex < modelIndex, `directory must precede model: ${JSON.stringify(run.stdout)}`);
});

test('statusline ignores unknown section ids without crashing or rendering placeholders', () => {
  const run = runStatus({
    runtime: { statusline: 'full', statuslineColors: true, statuslineLayout: { lines: [['model', 'bogus']] } },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /🤖/);
  assert.doesNotMatch(run.stdout, /bogus/);
});

test('statusline modes slice the layout line count (minimal renders only the first line)', () => {
  const run = runStatus({
    runtime: { statusline: 'minimal', statuslineColors: true, statuslineLayout: { lines: [['model'], ['directory']] } },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /🤖/);
  assert.doesNotMatch(run.stdout, /📁/);
});

test('statusline empty or invalid layout falls back to the default renderers', () => {
  const golden = fs.readFileSync(GOLDEN_PATH);
  for (const layout of [{}, { lines: [] }, { lines: [['bogus']] }, 'nonsense']) {
    const run = runStatus({
      runtime: { statusline: 'full', statuslineColors: true, statuslineLayout: layout },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.ok(run.stdoutBuffer.equals(golden), `fallback drifted for layout ${JSON.stringify(layout)}: ${JSON.stringify(run.stdout)}`);
  }
});

test('statusline shows five-hour and weekly windows with countdowns from the payload', () => {
  const run = runStatus({ payload: basePayload({ rate_limits: rateLimits() }) });
  assert.equal(run.status, 0, run.stderr);
  const plain = visible(run.stdout);
  assert.match(plain, /⧗ 20% <reset>/, plain);
  assert.match(plain, /◷ 45%/, plain);
});

test('statusline shows no quota when the payload has no rate_limits, even with a fresh usage cache', () => {
  const run = runStatus({ tmpFiles: { 'ck-usage-limits-cache.json': freshUsageCache() } });
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /⧗/);
  assert.doesNotMatch(run.stdout, /◷/);
});

test('statusline cost renders only when the layout enables it, billing is api, and data exists', () => {
  const costLayout = { statusline: 'full', statuslineColors: true, statuslineLayout: { lines: [['model', 'cost']] } };
  const withCost = basePayload({ cost: { total_cost_usd: '1.2345' } });

  const enabled = runStatus({ runtime: costLayout, payload: withCost, envExtra: { CLAUDE_BILLING_MODE: 'api' } });
  assert.equal(enabled.status, 0, enabled.stderr);
  const plain = enabled.stdout.replace(NBSP, ' ');
  assert.match(plain, /💵 \$1\.23(?!\d)/, plain);

  const wrongBilling = runStatus({ runtime: costLayout, payload: withCost, envExtra: { CLAUDE_BILLING_MODE: 'subscription' } });
  assert.equal(wrongBilling.status, 0, wrongBilling.stderr);
  assert.doesNotMatch(wrongBilling.stdout, /💵/);

  const noData = runStatus({ runtime: costLayout, envExtra: { CLAUDE_BILLING_MODE: 'api' } });
  assert.equal(noData.status, 0, noData.stderr);
  assert.doesNotMatch(noData.stdout, /💵/);

  const noLayout = runStatus({ payload: withCost, envExtra: { CLAUDE_BILLING_MODE: 'api' } });
  assert.equal(noLayout.status, 0, noLayout.stderr);
  assert.doesNotMatch(noLayout.stdout, /💵/);
});

test('statusline writes the ck-context session file regardless of layout', () => {
  const run = runStatus({
    runtime: { statusline: 'full', statuslineColors: true, statuslineLayout: { lines: [['model']] } },
    payload: basePayload({ session_id: 'ctxcase' }),
  });
  assert.equal(run.status, 0, run.stderr);
  const contextFile = run.readTmpFile('ck-context-ctxcase.json');
  assert.ok(contextFile, 'ck-context-ctxcase.json must be written even under a custom layout');
  assert.equal(typeof contextFile.percent, 'number');
  assert.equal(typeof contextFile.tokens, 'number');
});

test('statusline honors NO_COLOR with no ANSI escapes in output', () => {
  const run = runStatus({ envExtra: { NO_COLOR: '1' } });
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /\[/);
});

test('statusline default is one labelled line and narrow terminals drop the least useful parts first', () => {
  const payload = basePayload({ rate_limits: rateLimits(), cost: { total_lines_added: 120, total_lines_removed: 30 } });
  const plainLines = (run) => visible(run.stdout).trimEnd().split('\n');
  const runtime = { statusline: 'full', statuslineColors: false };

  const wide = runStatus({ runtime, payload });
  assert.equal(wide.status, 0, wide.stderr);
  assert.deepEqual(plainLines(wide), ['◆ TestModel  ◑ 53%  ⧗ 20% <reset>  ◷ 45%  ± +120/-30']);

  const narrow = runStatus({ runtime, payload, envExtra: { COLUMNS: '34' } });
  assert.deepEqual(plainLines(narrow), ['◆ TestModel  ◑ 53%  ⧗ 20% <reset>']);
  const tiny = runStatus({ runtime, payload, envExtra: { COLUMNS: '10' } });
  assert.deepEqual(plainLines(tiny), ['◆ TestModel  ◑ 53%']);
});

test('statusline compact is the default line alone and minimal keeps model and context', () => {
  const payload = basePayload({ rate_limits: rateLimits() });
  const plain = (run) => visible(run.stdout).trimEnd();
  const compact = runStatus({ runtime: { statusline: 'compact', statuslineColors: false }, payload });
  assert.equal(plain(compact), '◆ TestModel  ◑ 53%  ⧗ 20% <reset>  ◷ 45%');
  const minimal = runStatus({ runtime: { statusline: 'minimal', statuslineColors: false }, payload });
  assert.equal(plain(minimal), '◆ TestModel  ◑ 53%');
});

test('statusline colours percentages by threshold and prints no escape when statuslineColors is false', () => {
  const hot = basePayload({ rate_limits: rateLimits({ fiveHour: 90 }) });
  const coloured = runStatus({ payload: hot });
  assert.match(coloured.stdout, /\x1b\[31m90%/, 'a five-hour quota at 90% is red');
  assert.match(coloured.stdout, /\x1b\[32m◑[ \u00A0]53%/, 'context at 53% is green');
  const plain = runStatus({ runtime: { statusline: 'full', statuslineColors: false }, payload: hot });
  assert.doesNotMatch(plain.stdout, /\x1b\[/);
});

test('statusline shows the live effort level next to the model, and nothing when the payload has none', () => {
  const runtime = { statusline: 'minimal', statuslineColors: false };
  const withEffort = runStatus({ runtime, payload: basePayload({ effort: { level: 'xhigh' } }) });
  assert.equal(visible(withEffort.stdout).trimEnd(), '◆ TestModel (xhigh)  ◑ 53%');
  const narrow = runStatus({ runtime: { statusline: 'full', statuslineColors: false }, payload: basePayload({ effort: { level: 'high' } }), envExtra: { COLUMNS: '10' } });
  assert.equal(visible(narrow.stdout).trimEnd(), '◆ TestModel (high)  ◑ 53%', 'effort travels with the model and never drops');
  const without = runStatus({ runtime });
  assert.equal(visible(without.stdout).trimEnd(), '◆ TestModel  ◑ 53%');
});

test('statusline reads quota from the payload rate_limits', () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = basePayload({ rate_limits: {
    five_hour: { used_percentage: 36, resets_at: nowSec + 2 * 3600 + 12 * 60 + 30 },
    seven_day: { used_percentage: 43, resets_at: nowSec + 2 * 86400 },
  } });
  const run = runStatus({ runtime: { statusline: 'compact', statuslineColors: false }, payload,
    tmpFiles: { 'ck-usage-limits-cache.json': freshUsageCache() } });
  assert.equal(visible(run.stdout).trimEnd(), '◆ TestModel  ◑ 53%  ⧗ 36% <reset>  ◷ 43%', 'the payload is the only source (the cache says 20%/45%)');
});

test('statusline layout quota section renders from the payload', () => {
  const run = runStatus({
    runtime: { statusline: 'full', statuslineColors: false, statuslineLayout: { lines: [['quota']] } },
    payload: basePayload({ rate_limits: rateLimits({ fiveHour: 36, weekly: 43 }) }),
  });
  assert.equal(run.status, 0, run.stderr);
  // Not visible(): its mask matches only \d+h\d+m, and the layout prints "2h 29m" plus a
  // weekly countdown that can roll over between seconds.
  const line = run.stdout.replace(ANSI, '').replace(NBSP, ' ').trimEnd();
  assert.match(line, /⌛ \d+h \d+m left \(36% used\)  wk 43% \(\d+d \d+h\)/, line);
});

/** A throwaway git repo on branch `feat`, so git, PR and worktree marks have a branch to ride on. */
function gitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-git-'));
  cleanupDirs.push(dir);
  for (const args of [['init', '-q', '-b', 'feat'], ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init']]) {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }
  return dir;
}

const stripAnsi = (text) => text.replace(ANSI, '').replace(NBSP, ' ').trimEnd();

test('statusline shows fast mode, thinking, PR state, worktree, session time and cache hit only when present', () => {
  const runtime = { statusline: 'compact', statuslineColors: false };
  const repo = gitRepo();
  const rich = basePayload({
    fast_mode: true,
    thinking: { enabled: true },
    pr: { number: 80, review_state: 'approved' },
    workspace: { current_dir: repo, git_worktree: 'feat-x' },
    cost: { total_duration_ms: 28147114 },
    prompt_cache: { requests: 77, hit_ratio: 0.986 },
  });
  assert.equal(stripAnsi(runStatus({ runtime, payload: rich }).stdout), '◆ TestModel ϟ✱  ◑ 53%  ⎇ feat #80✓ ⊟  ⏱ 7h49m  ↻ 99%');

  const off = basePayload({
    fast_mode: false, thinking: { enabled: false }, workspace: { current_dir: repo },
    cost: { total_duration_ms: 30000 }, prompt_cache: { requests: 0, hit_ratio: 0 },
  });
  assert.equal(stripAnsi(runStatus({ runtime, payload: off }).stdout), '◆ TestModel  ◑ 53%  ⎇ feat');
});

test('statusline marks each PR review state and a GitLab merge request', () => {
  const runtime = { statusline: 'minimal', statuslineColors: true };
  const repo = gitRepo();
  const line = (pr) => runStatus({ runtime: { statusline: 'compact', statuslineColors: true }, payload: basePayload({ pr, workspace: { current_dir: repo } }) }).stdout;
  assert.match(line({ number: 7, review_state: 'approved' }), /#7\x1b\[32m✓/);
  assert.match(line({ number: 7, review_state: 'changes_requested' }), /#7\x1b\[31m✗/);
  assert.match(line({ number: 7, review_state: 'draft' }), /\x1b\[2m#7\x1b\[0m/);
  assert.match(stripAnsi(line({ number: 7, review_state: 'pending' })), /⎇ feat #7$/);
  assert.match(stripAnsi(line({ number: 12, kind: 'mr' })), /⎇ feat !12$/);
  assert.doesNotMatch(runStatus({ runtime, payload: basePayload({ pr: { number: 7 }, workspace: { current_dir: repo } }) }).stdout, /#7/, 'minimal keeps only the branch name');
});

test('statusline drops session time and cache before changes on a narrow terminal', () => {
  const payload = basePayload({ cost: { total_duration_ms: 28147114, total_lines_added: 5, total_lines_removed: 1 }, prompt_cache: { requests: 3, hit_ratio: 0.4 } });
  const runtime = { statusline: 'full', statuslineColors: false };
  assert.equal(stripAnsi(runStatus({ runtime, payload, envExtra: { COLUMNS: '34' } }).stdout), '◆ TestModel  ◑ 53%  ± +5/-1');
  assert.equal(stripAnsi(runStatus({ runtime, payload, envExtra: { COLUMNS: '44' } }).stdout), '◆ TestModel  ◑ 53%  ± +5/-1  ⏱ 7h49m');
});
