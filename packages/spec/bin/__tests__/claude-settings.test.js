'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { mergeClaudeSettings } = require('../phases/claude-settings');
const manifest = require('../../src/claude/migration-manifest.json');
const template = require('../../src/claude/settings/settings.json');

const MATCHER = 'Read|Write|Edit|MultiEdit|NotebookEdit|Bash|Glob|Grep|mcp__.*';
const OLD = 'Read|Write|Edit|MultiEdit|Bash|Glob|Grep';
const templateGroup = template.hooks.PreToolUse[0];
const privacy = templateGroup.hooks.find(hook => hook.command.includes('/privacy-block.cjs'));
const inspect = templateGroup.hooks.find(hook => hook.command.includes('/inspect-block.cjs'));
const group = (matcher, hooks = [privacy, inspect]) => ({ matcher, hooks });

function withSettings(groups, run, dryRun = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-claude-settings-'));
  const previousCwd = process.cwd();
  try {
    process.chdir(root);
    fs.mkdirSync('.claude');
    const settingsPath = path.join(root, '.claude/settings.json');
    if (groups) fs.writeFileSync(settingsPath, JSON.stringify({ hooks: { PreToolUse: groups } }, null, 2));
    const before = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : null;
    const messages = [];
    const ctx = {
      manifest, dryRun, options: {}, results: { updated: 0, errors: 0 },
      ui: { detail: message => messages.push(message), warn: message => messages.push(message) },
    };
    mergeClaudeSettings(ctx, 'claude');
    const after = fs.readFileSync(settingsPath, 'utf8');
    run({ before, after, groups: JSON.parse(after).hooks.PreToolUse, messages });
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function assertNoDuplicateCommands(groups) {
  const commands = groups.flatMap(entry => entry.hooks.map(hook => hook.command));
  assert.equal(commands.length, new Set(commands).size);
}

test('(a) claude-settings updates the former matcher for managed privacy and inspect', () => {
  withSettings([group(OLD)], ({ groups, messages }) => {
    assert.equal(groups[0].matcher, MATCHER);
    assert.deepEqual(groups[0].hooks, [privacy, inspect]);
    assert.ok(messages.some(message => message.includes('matcher updated')));
    assertNoDuplicateCommands(groups);
  });
});

test('(b) claude-settings updates the former matcher without Grep', () => {
  withSettings([group('Read|Write|Edit|MultiEdit|Bash|Glob')], ({ groups, messages }) => {
    assert.equal(groups[0].matcher, MATCHER);
    assert.ok(messages.some(message => message.includes('matcher updated')));
    assertNoDuplicateCommands(groups);
  });
});

test('(c) claude-settings preserves a mixed entry with a user command', () => {
  const mixed = group(OLD, [privacy, inspect, { type: 'command', command: 'my-linter' }]);
  withSettings([mixed], ({ groups, messages }) => {
    assert.deepEqual(groups[0], mixed);
    assert.equal(messages.some(message => message.includes('matcher updated')), false);
    assertNoDuplicateCommands(groups);
  });
});

test('(d) claude-settings preserves a custom matcher for managed commands', () => {
  const custom = group('Read|Bash');
  withSettings([custom], ({ groups, messages }) => {
    assert.deepEqual(groups[0], custom);
    assert.equal(messages.some(message => message.includes('matcher updated')), false);
  });
});

test('(e) claude-settings installs the template matcher without duplicate entries', () => {
  withSettings(null, ({ groups }) => {
    assert.deepEqual(groups, template.hooks.PreToolUse);
    assertNoDuplicateCommands(groups);
  });
});

test('(f) claude-settings updates a split privacy entry without duplicate commands', () => {
  withSettings([group(OLD, [privacy]), group(MATCHER, [inspect])], ({ groups, messages }) => {
    assert.equal(groups.length, 2);
    assert.ok(groups.every(entry => entry.matcher === MATCHER));
    assert.deepEqual(groups.map(entry => entry.hooks), [[privacy], [inspect]]);
    assert.ok(messages.some(message => message.includes('matcher updated')));
    assertNoDuplicateCommands(groups);
  });
});

test('(g) claude-settings prunes the retired inspector before updating privacy', () => {
  const retired = { ...inspect, command: inspect.command.replace('inspect-block.cjs', 'inspector-block.cjs') };
  withSettings([group(OLD, [retired, privacy])], ({ groups, messages }) => {
    assert.equal(groups[0].matcher, MATCHER);
    assert.deepEqual(groups[0].hooks, [privacy, inspect]);
    assert.ok(messages.some(message => message.includes('matcher updated')));
    assertNoDuplicateCommands(groups);
  });
});

test('(h) claude-settings dry-run reports the matcher update without writing', () => {
  withSettings([group(OLD)], ({ before, after, messages }) => {
    assert.equal(after, before);
    assert.ok(messages.some(message => message.includes('[dry-run] Settings: hook PreToolUse matcher updated')));
  }, true);
});

test('(i) claude-settings preserves a null handler without updating the matcher', () => {
  const entry = group(OLD, [null]);
  assert.doesNotThrow(() => {
    withSettings([entry], ({ groups, messages }) => {
      assert.deepEqual(groups[0], entry);
      assert.equal(messages.some(message => message.includes('matcher updated')), false);
    });
  });
});
