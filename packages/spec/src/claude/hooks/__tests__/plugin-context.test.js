'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SOURCE = path.resolve(__dirname, '../..');
const BUILD = path.resolve(SOURCE, '../../scripts/build-claude-plugin.mjs');
const LIMIT = 10000;
const MARKER = 'CAFEKIT-CORE-LOADED';

let work;
let tree;

// Install the built plugin under a long path, so the budget covers real roots.
before(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-plugin-context-'));
  const longRoot = path.join(work, 'x'.repeat(Math.max(1, 120 - work.length - 4)));
  tree = path.join(longRoot, 'cf');
  const built = spawnSync('node', [BUILD, '--out', tree], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  assert.ok(tree.length >= 120, `plugin root is only ${tree.length} characters`);
});

after(() => fs.rmSync(work, { recursive: true, force: true }));

function runHook(env, root = tree) {
  return spawnSync('node', [path.join(root, 'hooks/plugin-context.cjs')], {
    input: JSON.stringify({ session_id: 'ctx', hook_event_name: 'SessionStart', source: 'startup', cwd: work }),
    encoding: 'utf8',
    env: { ...process.env, HOME: path.join(work, 'home'), CLAUDE_PLUGIN_DATA: path.join(work, 'data'), ...env },
  });
}

function context(env = {}) {
  const run = runHook({ CLAUDE_PLUGIN_ROOT: tree, ...env });
  assert.equal(run.status, 0, run.stderr);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  return parsed.hookSpecificOutput.additionalContext;
}

test('core-under-10000-chars: the injected core fits the host limit with a 120-character root', () => {
  const text = context();
  assert.ok([...text].length <= LIMIT, `core is ${[...text].length} characters`);
  assert.ok(!text.includes('${CLAUDE_PLUGIN_ROOT}'), 'root variable left unsubstituted');
});

test('emits-session-start-json: the hook prints one JSON object with additionalContext', () => {
  const run = runHook({ CLAUDE_PLUGIN_ROOT: tree });
  assert.equal(run.status, 0);
  assert.equal(typeof JSON.parse(run.stdout).hookSpecificOutput.additionalContext, 'string');
});

test('rule-paths-exist: every rules path in the core resolves inside the plugin', () => {
  const text = context();
  // Only absolute paths under the plugin root; prose such as specs/<feature>/plan.md is not a path to resolve.
  const paths = text.split(/[\s`'"()]+/).filter((token) => token.startsWith(`${tree}/`) && token.endsWith('.md'));
  assert.ok(paths.length > 0, 'the core names no plugin path');
  const rules = fs.readdirSync(path.join(tree, 'rules'));
  for (const rule of rules) assert.ok(paths.some((p) => p.endsWith(`/rules/${rule}`)), `core does not point to rules/${rule}`);
  for (const p of paths) assert.ok(fs.existsSync(p), `missing ${p}`);
});

test('dollar-in-root: a plugin root containing $& stays literal in every path', () => {
  const odd = path.join(work, 'r$&$$z', 'cf');
  const built = spawnSync('node', [BUILD, '--out', odd], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  const run = runHook({ CLAUDE_PLUGIN_ROOT: odd }, odd);
  const text = JSON.parse(run.stdout).hookSpecificOutput.additionalContext;
  assert.ok(text.includes(`${odd}/rules/state-sync.md`), 'root was rewritten by replacement patterns');
  assert.ok(fs.existsSync(`${odd}/rules/state-sync.md`));
});

test('marker-in-first-2000: the load marker survives the host preview cut', () => {
  assert.ok(context().slice(0, 2000).includes(MARKER));
});

test('silent-without-plugin-root: outside the plugin the hook prints nothing', () => {
  const env = { ...process.env };
  delete env.CLAUDE_PLUGIN_ROOT;
  const run = spawnSync('node', [path.join(tree, 'hooks/plugin-context.cjs')], { input: '{}', encoding: 'utf8', env });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '');
});

test('npx-settings-untouched: the npx settings template does not register the plugin hook', () => {
  const settings = fs.readFileSync(path.join(SOURCE, 'settings/settings.json'), 'utf8');
  assert.ok(!settings.includes('plugin-context.cjs'));
  const hooks = JSON.parse(fs.readFileSync(path.join(tree, 'hooks/hooks.json'), 'utf8')).hooks;
  const sessionStart = hooks.SessionStart.flatMap((entry) => entry.hooks.map((h) => h.command));
  assert.ok(sessionStart.some((c) => c.endsWith('/hooks/plugin-context.cjs"')), 'plugin hook not registered on SessionStart');
});
