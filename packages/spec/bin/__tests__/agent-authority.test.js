'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const AGENTS = path.join(__dirname, '../../src/claude/agents');

function frontmatter(name) {
  const text = fs.readFileSync(path.join(AGENTS, `${name}.md`), 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, `${name}.md has no frontmatter`);
  return { text, header: match[1] };
}

// Claude Code grants Read, Write and Edit to any agent that declares `memory:`,
// whatever its `tools:` line says, so a read-only agent must not declare it.
test('read-only agents declare no memory or write tools', () => {
  for (const name of ['researcher', 'inspector', 'debugger']) {
    const { header } = frontmatter(name);
    assert.doesNotMatch(header, /^memory:/m, `${name} declares memory:`);
    const tools = header.match(/^tools:(.*)$/m);
    assert.ok(tools, `${name} has no tools: line`);
    assert.doesNotMatch(tools[1], /\b(?:Write|Edit|MultiEdit|NotebookEdit)\b/, `${name} lists a write tool`);
  }
});

test('deployer asks before pushing a rollback', () => {
  const { text } = frontmatter('deployer');
  assert.doesNotMatch(text, /(?:&&|;|\|\|)\s*git push\b/, 'deployer chains git push after another command');
  assert.match(text, /[Aa]sk the user before `git push`; never push without explicit approval\./);
});

test('inspector forbids reading secrets', () => {
  const { text } = frontmatter('inspector');
  assert.match(text, /Did NOT read `\.env\*`, keys, credentials or other secret files\./);
});
