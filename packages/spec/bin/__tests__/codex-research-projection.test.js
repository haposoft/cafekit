'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { normalizeCodexBody, CODEX_RESEARCH_DEPTH_MARKER, CODEX_RESEARCH_DEPTH_NOTE } = require('../lib/codex-install');
const { splitFrontmatter } = require('../lib/codex-frontmatter');

const SKILLS = path.resolve(__dirname, '../../src/claude/skills');
const researchPath = path.join(SKILLS, 'research/SKILL.md');
const research = fs.readFileSync(researchPath, 'utf8');

function skillFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? skillFiles(file) : entry.name === 'SKILL.md' ? [file] : [];
  });
}

function assertMarker() {
  assert.equal(typeof CODEX_RESEARCH_DEPTH_MARKER, 'string');
  assert.ok(CODEX_RESEARCH_DEPTH_MARKER.length > 0);
}

test('codex research projection carries the depth note immediately after unchanged frontmatter', () => {
  assertMarker();
  assert.equal(typeof CODEX_RESEARCH_DEPTH_NOTE, 'string');
  const plain = normalizeCodexBody(research);
  const projected = normalizeCodexBody(research, researchPath);
  assert.match(projected, /^---\r?\n/);
  const before = splitFrontmatter(plain), after = splitFrontmatter(projected);
  assert.equal(after.frontmatter.name, 'cf-research');
  assert.equal(after.frontmatter.description, before.frontmatter.description);
  assert.deepEqual(after.frontmatter, before.frontmatter);
  assert.equal(projected.slice(0, projected.length - after.body.length), plain.slice(0, plain.length - before.body.length));
  assert.equal(after.body, `\n${CODEX_RESEARCH_DEPTH_NOTE}\n\n${before.body}`);
  assert.equal(projected.split(CODEX_RESEARCH_DEPTH_MARKER).length - 1, 1);
  assert.ok(CODEX_RESEARCH_DEPTH_NOTE.includes(CODEX_RESEARCH_DEPTH_MARKER));
  assert.match(CODEX_RESEARCH_DEPTH_NOTE, /known option/);
  assert.match(CODEX_RESEARCH_DEPTH_NOTE, /Quick/);
  assert.match(CODEX_RESEARCH_DEPTH_NOTE, /outdated supporting rationale/i);
  assert.match(CODEX_RESEARCH_DEPTH_NOTE, /changes the recommendation/);
  assert.match(CODEX_RESEARCH_DEPTH_NOTE, /conflicting evidence/i);
  assert.doesNotMatch(CODEX_RESEARCH_DEPTH_NOTE, /\b(?:Write|Edit|Read|Bash|WebSearch|WebFetch|AskUserQuestion|Drizzle|Prisma|BullMQ|pg-boss|billing|ADR-004)\b/);
});

test('research marker is absent from every other projected skill including ask', () => {
  assertMarker();
  const others = skillFiles(SKILLS).filter(file => file !== researchPath);
  assert.ok(others.includes(path.join(SKILLS, 'ask/SKILL.md')));
  for (const file of others) {
    const source = fs.readFileSync(file, 'utf8');
    const projected = normalizeCodexBody(source, file);
    assert.ok(!projected.includes(CODEX_RESEARCH_DEPTH_MARKER), file);
    // Ask intentionally has its own boundary; all other skill bodies stay identical.
    if (file !== path.join(SKILLS, 'ask/SKILL.md')) assert.equal(projected, normalizeCodexBody(source), file);
  }
});

test('research note is scoped to the exact skill source path and supports Windows separators', () => {
  assertMarker();
  for (const sourcePath of ['', 'skills/research/templates/x.md', 'other-skills/research/SKILL.md']) {
    const projected = normalizeCodexBody(research, sourcePath);
    assert.ok(!projected.includes(CODEX_RESEARCH_DEPTH_MARKER), sourcePath);
    assert.equal(projected, normalizeCodexBody(research), sourcePath);
  }
  const windows = normalizeCodexBody(research, 'C:\\project\\skills\\research\\SKILL.md');
  assert.ok(windows.includes(CODEX_RESEARCH_DEPTH_MARKER));
});
