'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BUILD = path.resolve(__dirname, '../../../../scripts/build-claude-plugin.mjs');
const SAMPLE_PAYLOADS = {
  SessionStart: { source: 'startup' },
  UserPromptSubmit: { prompt: 'hello' },
  PreToolUse: { tool_name: 'Read', tool_input: { file_path: 'README.md' } },
  PostToolUse: { tool_name: 'Edit', tool_input: { file_path: 'README.md' }, tool_response: {} },
  Stop: { stop_hook_active: false },
  SubagentStart: { agent_type: 'cf:debugger' },
  SubagentStop: { agent_type: 'cf:debugger', stop_hook_active: false, last_assistant_message: 'done' },
  PreCompact: { trigger: 'manual' },
};

let work;
let tree;

function walk(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? [`${full}/`, ...walk(full)] : [full];
  }).sort();
}

function makeRepo(name, withDotClaude) {
  const repo = path.join(work, name);
  fs.mkdirSync(repo, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), '# demo\n');
  if (withDotClaude) {
    fs.mkdirSync(path.join(repo, '.claude'));
    fs.writeFileSync(path.join(repo, '.claude/settings.local.json'), '{}\n');
  }
  return repo;
}

// Runs every hook the plugin registers, the way Claude Code would, and returns
// the SessionStart output so callers can inspect it.
function runAllHooks(repo, env) {
  const { hooks } = JSON.parse(fs.readFileSync(path.join(tree, 'hooks/hooks.json'), 'utf8'));
  let sessionOutput = '';
  for (const [event, entries] of Object.entries(hooks)) {
    for (const entry of entries) {
      for (const { command } of entry.hooks) {
        const file = command.match(/hooks\/([^"]+)"$/)[1];
        const payload = { session_id: 'isolation-test', hook_event_name: event, cwd: repo, transcript_path: path.join(repo, 'none.jsonl'), ...SAMPLE_PAYLOADS[event] };
        const run = spawnSync('node', [path.join(tree, 'hooks', file)], {
          cwd: repo, input: JSON.stringify(payload), encoding: 'utf8', timeout: 20000,
          env: { ...process.env, HOME: path.join(work, 'home'), CLAUDE_PLUGIN_ROOT: tree, CLAUDE_PROJECT_DIR: repo, ...env },
        });
        assert.equal(run.status, 0, `${event} ${file}: ${run.stderr}`);
        if (event === 'SessionStart') sessionOutput += run.stdout;
      }
    }
  }
  return sessionOutput;
}

before(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-plugin-isolation-'));
  tree = path.join(work, 'cf');
  const built = spawnSync('node', [BUILD, '--out', tree], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
});

after(() => fs.rmSync(work, { recursive: true, force: true }));

for (const [label, withDotClaude] of [['empty-repo', false], ['repo-with-dot-claude', true]]) {
  test(`${label}: hooks write only under CLAUDE_PLUGIN_DATA`, () => {
    const repo = makeRepo(label, withDotClaude);
    const data = fs.mkdtempSync(path.join(work, `data-${label}-`));
    const repoBefore = walk(repo);
    const treeBefore = walk(tree);
    runAllHooks(repo, { CLAUDE_PLUGIN_DATA: data });
    assert.deepEqual(walk(repo), repoBefore, 'the project gained files');
    assert.deepEqual(walk(tree), treeBefore, 'the plugin tree gained files');
    assert.ok(walk(data).some((p) => p.endsWith('hook-log.jsonl') || p.includes('session-states')), 'no state under CLAUDE_PLUGIN_DATA');
  });
}

test('no-data-env-uses-tmp: without CLAUDE_PLUGIN_DATA state goes to the OS temp directory', () => {
  const repo = makeRepo('no-data', true);
  const tmp = fs.mkdtempSync(path.join(work, 'tmp-'));
  const repoBefore = walk(repo);
  const treeBefore = walk(tree);
  runAllHooks(repo, { CLAUDE_PLUGIN_DATA: '', TMPDIR: tmp });
  assert.deepEqual(walk(repo), repoBefore, 'the project gained files');
  assert.deepEqual(walk(tree), treeBefore, 'the plugin tree gained files');
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  assert.ok(walk(path.join(tmp, `cafekit-plugin-${uid}`)).length > 0, 'no state under the temp directory');
});

test('no-npx-notice: the plugin session hook prints no npx update notice and writes no update cache', () => {
  const repo = makeRepo('npx-notice', true);
  // An old npx install left version metadata behind; the plugin must ignore it.
  fs.writeFileSync(path.join(repo, '.claude/cafekit.json'), JSON.stringify({ version: '0.0.1' }));
  // A fresh cached "latest" makes the npx branch print its notice without any
  // network access, so this test cannot pass merely because the registry is unreachable.
  const cache = path.join(repo, '.claude/.cafekit-update-cache.json');
  const cacheBytes = JSON.stringify({ ts: Date.now(), latest: '99.0.0' });
  fs.writeFileSync(cache, cacheBytes);
  const data = fs.mkdtempSync(path.join(work, 'data-notice-'));
  const output = runAllHooks(repo, { CLAUDE_PLUGIN_DATA: data });
  assert.doesNotMatch(output, /npx @haposoft\/cafekit/);
  assert.equal(fs.readFileSync(cache, 'utf8'), cacheBytes, 'update cache rewritten');
});

test('npx-branch-unchanged: outside a plugin, source-tree hooks keep the temp log directory', () => {
  const script = `delete process.env.CLAUDE_PLUGIN_ROOT; delete process.env.CLAUDE_PLUGIN_DATA;
    process.stdout.write(require(${JSON.stringify(path.resolve(__dirname, '../lib/hook-state-dir.cjs'))}).hookStateDir());`;
  const env = { ...process.env };
  delete env.CLAUDE_PLUGIN_ROOT;
  delete env.CLAUDE_PLUGIN_DATA;
  const run = spawnSync('node', ['-e', script], { encoding: 'utf8', env });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, path.join(os.tmpdir(), 'cafekit-hook-logs', 'claude'));
});
