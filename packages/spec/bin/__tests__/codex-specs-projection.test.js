'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { normalizeCodexBody, CODEX_SPECS_SCOPE_MARKER, CODEX_SPECS_SCOPE_NOTE,
  CODEX_RESEARCH_DEPTH_MARKER } = require('../lib/codex-install');
const { splitFrontmatter } = require('../lib/codex-frontmatter');

const SKILLS = path.resolve(__dirname, '../../src/claude/skills');
const specsPath = path.join(SKILLS, 'specs/SKILL.md');
const specs = fs.readFileSync(specsPath, 'utf8');

function skillFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? skillFiles(file) : entry.name === 'SKILL.md' ? [file] : [];
  });
}

function assertMarker() {
  assert.equal(typeof CODEX_SPECS_SCOPE_MARKER, 'string');
  assert.ok(CODEX_SPECS_SCOPE_MARKER.length > 0);
}

test('codex specs projection carries the scope note immediately after unchanged frontmatter', () => {
  assertMarker();
  assert.equal(typeof CODEX_SPECS_SCOPE_NOTE, 'string');
  const plain = normalizeCodexBody(specs);
  const projected = normalizeCodexBody(specs, specsPath);
  assert.match(projected, /^---\r?\n/);
  const before = splitFrontmatter(plain), after = splitFrontmatter(projected);
  assert.equal(after.frontmatter.name, 'cf-specs');
  assert.deepEqual(after.frontmatter, before.frontmatter);
  assert.equal(projected.slice(0, projected.length - after.body.length), plain.slice(0, plain.length - before.body.length));
  assert.equal(after.body, `\n${CODEX_SPECS_SCOPE_NOTE}\n\n${before.body}`);
  assert.equal(projected.split(CODEX_SPECS_SCOPE_MARKER).length - 1, 1);
  assert.equal(normalizeCodexBody(projected, specsPath), projected);
  assert.ok(CODEX_SPECS_SCOPE_NOTE.includes(CODEX_SPECS_SCOPE_MARKER));
  assert.match(CODEX_SPECS_SCOPE_MARKER, /GATE-SCOPE.*final answer/);
  assert.match(CODEX_SPECS_SCOPE_NOTE, /not in commentary or through `request_user_input`/);
  assert.match(CODEX_SPECS_SCOPE_NOTE, /Do not send a summary after/);
  assert.match(CODEX_SPECS_SCOPE_NOTE, /\[NEEDS CLARIFICATION: <question>\]/);
  assert.match(CODEX_SPECS_SCOPE_NOTE, /real question.*not a placeholder/);
  assert.match(CODEX_SPECS_SCOPE_NOTE, /EXPAND, KEEP, and CUT together/);
  assert.match(CODEX_SPECS_SCOPE_NOTE, /Preserve.*NEEDS CLARIFICATION.*EXPAND.*KEEP.*CUT.*do not translate/);
  assert.doesNotMatch(CODEX_SPECS_SCOPE_NOTE, /\b(?:Write|Edit|Read|Bash|WebSearch|WebFetch|AskUserQuestion)\b/);
  assert.doesNotMatch(CODEX_SPECS_SCOPE_NOTE, /customer|sales|notif|khách|bán hàng|thông báo/i);
});

test('specs marker is absent from every other skill and research retains exactly one depth marker', () => {
  assertMarker();
  const others = skillFiles(SKILLS).filter(file => file !== specsPath);
  for (const name of ['ask', 'research']) assert.ok(others.includes(path.join(SKILLS, name, 'SKILL.md')));
  for (const file of others) {
    const source = fs.readFileSync(file, 'utf8');
    const projected = normalizeCodexBody(source, file);
    assert.ok(!projected.includes(CODEX_SPECS_SCOPE_MARKER), file);
    if (file === path.join(SKILLS, 'research/SKILL.md')) {
      assert.equal(projected.split(CODEX_RESEARCH_DEPTH_MARKER).length - 1, 1);
    } else if (file !== path.join(SKILLS, 'ask/SKILL.md')) {
      assert.equal(projected, normalizeCodexBody(source), file);
    }
  }
});

test('specs note is scoped to the exact skill source path and supports Windows separators', () => {
  assertMarker();
  for (const sourcePath of ['', 'skills/specs/references/templates.md', 'other-skills/specs/SKILL.md']) {
    const projected = normalizeCodexBody(specs, sourcePath);
    assert.ok(!projected.includes(CODEX_SPECS_SCOPE_MARKER), sourcePath);
    assert.equal(projected, normalizeCodexBody(specs), sourcePath);
  }
  assert.ok(normalizeCodexBody(specs, 'C:\\project\\skills\\specs\\SKILL.md').includes(CODEX_SPECS_SCOPE_MARKER));
});
