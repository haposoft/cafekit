'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { normalizeCodexBody } = require('../lib/codex-install');
const { splitFrontmatter } = require('../lib/codex-frontmatter');

const ROOT = path.resolve(__dirname, '../..');
const skillPath = name => path.join(ROOT, 'src/claude/skills', name, 'SKILL.md');
const readSkill = name => fs.readFileSync(skillPath(name), 'utf8');

test('codex ask projection carries the answer-only instruction after frontmatter', () => {
  const source = readSkill('ask');
  const projected = normalizeCodexBody(source, skillPath('ask'));
  assert.match(projected, /^---\r?\n/);
  const { frontmatter, body } = splitFrontmatter(projected);
  assert.equal(frontmatter.name, 'cf-ask');
  assert.match(projected.slice(0, projected.length - body.length), /^name:\s*cf-ask$/m);
  assert.match(body, /^\s*Codex note: this skill answers only\./);
  const note = body.trimStart().split('\n\n')[0];
  assert.match(note, /If the user asks you to fix or change something/);
  assert.match(note, /"sửa giúp luôn" or "fix it"/);
  assert.match(note, /do not edit, create, or delete any file/);
  assert.match(note, /do not run commands that write files/);
  assert.match(note, /Explain the cause with evidence/);
  assert.match(note, /tell the user to run \$cf-fix for the change/);
  assert.match(note, /A request to fix is not permission to edit while this skill is active\./);
  assert.doesNotMatch(note, /\b(?:Write|Edit|Read|Bash|WebSearch|WebFetch|AskUserQuestion)\b/);
  assert.match(body, /\n\n# Ask Skill\n/);

  for (const name of ['fix', 'develop']) {
    assert.doesNotMatch(normalizeCodexBody(readSkill(name), skillPath(name)), /Codex note:/);
  }
  assert.doesNotMatch(normalizeCodexBody(source), /Codex note:/);
  assert.doesNotMatch(normalizeCodexBody(source, 'skills/ask/templates/question.md'), /Codex note:/);
  assert.doesNotMatch(normalizeCodexBody(source, 'other-skills/ask/SKILL.md'), /Codex note:/);
  assert.match(normalizeCodexBody(source, 'C:\\project\\skills\\ask\\SKILL.md'), /Codex note:/);
});
