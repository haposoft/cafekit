'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, after } = require('node:test');
const SOURCE = path.resolve(__dirname, '../../src');
const roots = [];

function fixture(host) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-privacy-paths-'));
  roots.push(root);
  if (host === 'codex') {
    assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
    const install = spawnSync(process.execPath, [path.resolve(__dirname, '../install.js'), '--platform', 'codex', '-y'], {
      cwd: root, encoding: 'utf8',
    });
    assert.equal(install.status, 0, install.stderr);
  } else {
    fs.cpSync(path.join(SOURCE, 'claude/hooks'), path.join(root, '.claude/hooks'), { recursive: true });
  }
  return { root, hooks: path.join(root, `.${host}/hooks`) };
}

function invoke(f, tool_name, tool_input) {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  const result = spawnSync(process.execPath, [path.join(f.hooks, 'privacy-block.cjs')], {
    cwd: f.root, encoding: 'utf8', env,
    input: JSON.stringify({ tool_name, tool_input, cwd: f.root, session_id: 'privacy-paths-probe' }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '', 'hook must not emit a stack trace');
  return result.stdout.trim() ? JSON.parse(result.stdout).hookSpecificOutput : null;
}

after(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); });

const cases = [
  ['Read sensitive', 'Read', { file_path: '.env' }, true],
  ['Grep sensitive glob', 'Grep', { pattern: 'x', glob: '.env*' }, true],
  ['NotebookEdit sensitive notebook_path', 'NotebookEdit', { notebook_path: '.env' }, true],
  ['MCP path', 'mcp__fs__read_file', { path: '.env' }, true],
  ['MCP nested file_path', 'mcp__x__y', { args: { file_path: 'certs/a.pem' } }, true],
  ['MCP file uri', 'mcp__fs__read', root => ({ uri: `file://${root}/.env` }), true],
  ['MCP source destination', 'mcp__fs__move_file', { source: '.env', destination: 'x' }, true],
  ['MCP relative_path', 'mcp__s__read', { relative_path: '.env' }, true],
  ['Bash sensitive operand', 'Bash', { command: 'cat .env' }, true],
  ['Bash env-file option', 'Bash', { command: 'docker compose --env-file .env up' }, true],
  ['shell argv bash -lc', 'shell', { command: ['bash', '-lc', 'cat .env'] }, true],
  ['patch Update File', 'apply_patch', { command: '*** Begin Patch\n*** Update File: .env\n*** End Patch' }, true],
  ['patch Move to', 'apply_patch', { command: '*** Begin Patch\n*** Update File: a.txt\n*** Move to: .env\n*** End Patch' }, true],
  ['Read ordinary file', 'Read', { file_path: 'app.ts' }, false],
  ['Read exempt .env.example', 'Read', { file_path: '.env.example' }, false],
  ['Grep ordinary glob', 'Grep', { pattern: 'API_KEY', glob: '*.ts' }, false],
  ['Bash ls', 'Bash', { command: 'ls' }, false],
];

for (const host of ['claude', 'codex']) {
  const f = fixture(host);
  for (const [name, tool, input, sensitive] of cases) {
    test(`privacy-paths ${host}: ${name}`, () => {
      const output = invoke(f, tool, typeof input === 'function' ? input(f.root) : input);
      if (!sensitive) return assert.equal(output, null);
      assert.equal(output?.permissionDecision, host === 'claude' ? 'ask' : 'deny');
      if (host === 'codex') assert.match(output.permissionDecisionReason, /APPROVE CAFEKIT PRIVACY /);
    });
  }
}

test('privacy-paths codex: missing shared lib denies even Bash ls', () => {
  const f = fixture('codex');
  fs.rmSync(path.join(f.hooks, 'lib/privacy-paths.cjs'), { force: true });
  const output = invoke(f, 'Bash', { command: 'ls' });
  assert.equal(output?.permissionDecision, 'deny');
  assert.match(output.permissionDecisionReason, /could not be evaluated safely/);
});
