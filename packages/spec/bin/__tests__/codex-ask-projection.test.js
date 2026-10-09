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
  const boundary = 'A request to fix or change something is still answered without editing any file; point the user to $cf-fix.';
  const originalDescription = splitFrontmatter(normalizeCodexBody(source)).frontmatter.description;
  // A JSON-quoted scalar is valid YAML; verify the serialized value as well as the split header.
  const description = JSON.parse(projected.match(/^description: (.+)$/m)[1]);
  assert.equal(description, `${originalDescription} ${boundary}`);
  assert.equal(frontmatter.description, description);
  assert.ok(description.length <= 1024);
  assert.match(body, /^\s*Rule 1 \(Codex\): never edit, create, or delete files in this skill,/);
  const note = body.trimStart().split('\n\n')[0];
  assert.match(note, /even when the user says fix it or sửa giúp luôn/);
  assert.match(note, /Do not run commands that write files/);
  assert.match(note, /Answer the cause with evidence and tell the user to run \$cf-fix\./);
  assert.doesNotMatch(`${description}\n${note}`, /\b(?:Write|Edit|Read|Bash|WebSearch|WebFetch|AskUserQuestion)\b/);
  assert.match(body, /\n\n# Ask Skill\n/);

  for (const name of ['fix', 'develop']) {
    const otherSource = readSkill(name);
    const other = normalizeCodexBody(otherSource, skillPath(name));
    assert.doesNotMatch(other, /Rule 1 \(Codex\):/);
    assert.equal(splitFrontmatter(other).frontmatter.description,
      splitFrontmatter(normalizeCodexBody(otherSource)).frontmatter.description);
    assert.ok(!other.includes(boundary));
  }
  for (const sourcePath of ['', 'skills/ask/templates/question.md', 'other-skills/ask/SKILL.md']) {
    const prompt = normalizeCodexBody(source, sourcePath);
    assert.doesNotMatch(prompt, /Rule 1 \(Codex\):/);
    assert.ok(!prompt.includes(boundary));
    assert.equal(splitFrontmatter(prompt).frontmatter.description, originalDescription);
  }
  assert.match(normalizeCodexBody(source, 'C:\\project\\skills\\ask\\SKILL.md'), /Rule 1 \(Codex\):/);
});
