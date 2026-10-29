'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  normalizeCodexBody,
  CODEX_SPECS_SCOPE_MARKER, CODEX_SPECS_SCOPE_NOTE,
  CODEX_RESEARCH_DEPTH_MARKER, CODEX_RESEARCH_DEPTH_NOTE,
} = require('../lib/codex-install');
const { splitFrontmatter } = require('../lib/codex-frontmatter');

const SKILLS = path.resolve(__dirname, '../../src/claude/skills');

// Skills that Codex projects with an extra note inserted after the frontmatter.
const PROJECTED = [
  { skill: 'specs', codexName: 'cf-specs', marker: CODEX_SPECS_SCOPE_MARKER, note: CODEX_SPECS_SCOPE_NOTE, idempotent: true },
  { skill: 'research', codexName: 'cf-research', marker: CODEX_RESEARCH_DEPTH_MARKER, note: CODEX_RESEARCH_DEPTH_NOTE },
].map((entry) => {
  const file = path.join(SKILLS, entry.skill, 'SKILL.md');
  return { ...entry, file, source: fs.readFileSync(file, 'utf8') };
});

// Ask carries its own boundary note; every other skill body is projected unchanged.
const OWN_PROJECTION = new Set([...PROJECTED.map(({ file }) => file), path.join(SKILLS, 'ask/SKILL.md')]);

function skillFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? skillFiles(file) : entry.name === 'SKILL.md' ? [file] : [];
  });
}

const occurrences = (text, marker) => text.split(marker).length - 1;

for (const { skill, codexName, marker, note, file, source, idempotent } of PROJECTED) {
  test(`codex ${skill} projection carries its note immediately after unchanged frontmatter`, () => {
    assert.ok(typeof marker === 'string' && marker.length > 0);
    assert.equal(typeof note, 'string');
    const plain = normalizeCodexBody(source);
    const projected = normalizeCodexBody(source, file);
    assert.match(projected, /^---\r?\n/);
    const before = splitFrontmatter(plain), after = splitFrontmatter(projected);
    assert.equal(after.frontmatter.name, codexName);
    assert.deepEqual(after.frontmatter, before.frontmatter);
    assert.equal(projected.slice(0, projected.length - after.body.length), plain.slice(0, plain.length - before.body.length));
    assert.equal(after.body, `\n${note}\n\n${before.body}`);
    assert.equal(occurrences(projected, marker), 1);
    if (idempotent) assert.equal(normalizeCodexBody(projected, file), projected, 'projection must be idempotent');
    assert.ok(note.includes(marker));
    assert.doesNotMatch(note, /\b(?:Write|Edit|Read|Bash|WebSearch|WebFetch|AskUserQuestion)\b/);
  });

  test(`codex ${skill} note is scoped to the exact skill source path and supports Windows separators`, () => {
    for (const sourcePath of ['', `skills/${skill}/references/templates.md`, `other-skills/${skill}/SKILL.md`]) {
      const projected = normalizeCodexBody(source, sourcePath);
      assert.ok(!projected.includes(marker), sourcePath);
      assert.equal(projected, normalizeCodexBody(source), sourcePath);
    }
    assert.ok(normalizeCodexBody(source, `C:\\project\\skills\\${skill}\\SKILL.md`).includes(marker));
  });
}

test('each projection marker appears only in its own skill and other skill bodies stay unchanged', () => {
  const all = skillFiles(SKILLS);
  for (const name of ['ask', 'research', 'specs']) assert.ok(all.includes(path.join(SKILLS, name, 'SKILL.md')));
  for (const file of all) {
    const source = fs.readFileSync(file, 'utf8');
    const projected = normalizeCodexBody(source, file);
    for (const { marker, file: ownFile } of PROJECTED) {
      assert.equal(occurrences(projected, marker), file === ownFile ? 1 : 0, `${marker} in ${file}`);
    }
    if (!OWN_PROJECTION.has(file)) assert.equal(projected, normalizeCodexBody(source), file);
  }
});

test('codex specs scope note keeps the GATE-SCOPE answer boundary', () => {
  assert.match(CODEX_SPECS_SCOPE_MARKER, /GATE-SCOPE.*final answer/);
  assert.match(CODEX_SPECS_SCOPE_NOTE, /not in commentary or through `request_user_input`/);
  assert.match(CODEX_SPECS_SCOPE_NOTE, /Do not send a summary after/);
  assert.match(CODEX_SPECS_SCOPE_NOTE, /\[NEEDS CLARIFICATION: <question>\]/);
  assert.match(CODEX_SPECS_SCOPE_NOTE, /EXPAND, KEEP, and CUT together/);
  assert.match(CODEX_SPECS_SCOPE_NOTE, /Preserve.*NEEDS CLARIFICATION.*EXPAND.*KEEP.*CUT.*do not translate/);
  assert.doesNotMatch(CODEX_SPECS_SCOPE_NOTE, /customer|sales|notif|khách|bán hàng|thông báo/i);
});

test('codex research depth note keeps the quick-answer boundary', () => {
  assert.match(CODEX_RESEARCH_DEPTH_NOTE, /known option/);
  assert.match(CODEX_RESEARCH_DEPTH_NOTE, /Quick/);
  assert.match(CODEX_RESEARCH_DEPTH_NOTE, /changes the recommendation/);
  assert.match(CODEX_RESEARCH_DEPTH_NOTE, /conflicting evidence/i);
  assert.doesNotMatch(CODEX_RESEARCH_DEPTH_NOTE, /\b(?:Drizzle|Prisma|BullMQ|pg-boss|billing|ADR-004)\b/);
});
