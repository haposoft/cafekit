'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const RESOLVER = path.join(ROOT, 'src/claude/scripts/spec-resolver.cjs');
const SPEC_RESOLVER = require(RESOLVER);
const { normalizeCodexBody } = require(path.join(ROOT, 'bin/lib/codex-install.js'));

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

test('Codex installer transform preserves all owned spec assets idempotently', () => {
  for (const relative of [
    'src/claude/skills/specs/SKILL.md',
    'src/claude/skills/specs/references/review.md',
    'src/claude/skills/specs/references/templates.md',
    'src/claude/scripts/spec-receipt.cjs',
  ]) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    const transformed = normalizeCodexBody(source, relative);
    assert.equal(normalizeCodexBody(transformed, relative), transformed, `${relative} must normalize idempotently`);
  }

  const skill = fs.readFileSync(path.join(ROOT, 'src/claude/skills/specs/SKILL.md'), 'utf8');
  const review = fs.readFileSync(path.join(ROOT, 'src/claude/skills/specs/references/review.md'), 'utf8');
  const templates = fs.readFileSync(path.join(ROOT, 'src/claude/skills/specs/references/templates.md'), 'utf8');
  assert.match(skill, /specs\/<feature>\/[\s\S]{0,160}plan\.md[\s\S]{0,160}task-01-<slug>\.md/);
  assert.match(skill, /GATE-SCOPE[\s\S]*GATE-REVIEW[\s\S]*GATE-DONE/);
  assert.doesNotMatch(skill, /--(?:status|validate|archive)\b/);
  assert.match(review, /path:line/);
  assert.match(review, /Cap the presented[\s\S]{0,40}list at 15/);
  assert.match(review, /Round three requires runtime evidence/);
  assert.match(templates, /\| ID \| EARS criterion \| Proof \|/);
  assert.match(templates, /## Canonical inline Receipt[\s\S]*Verification: PASS[\s\S]*Exit: 0[\s\S]*Base:[\s\S]*Head:/);

});

test('resolver binds feature identity and rejects cross-feature plan aliases', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-resolver-identity-'));
  const packet = (dir) => {
    write(path.join(dir, 'plan.md'), '# Plan\nSpecs-Contract: process-first-ready-v1\n');
    write(path.join(dir, 'task-01-x.md'), '# Task 01\n\nStatus: pending\n\n## Dependencies\n\n- none\n');
  };
  try {
    const specsDir = path.join(root, 'specs');
    packet(path.join(specsDir, 'bar'));
    fs.mkdirSync(path.join(specsDir, 'foo'), { recursive: true });
    fs.symlinkSync('../bar/plan.md', path.join(specsDir, 'foo', 'plan.md'));

    const explicit = SPEC_RESOLVER.resolveWorkflowCandidate({ projectRoot: root, explicitFeature: 'foo' });
    assert.equal(explicit.error, 'explicit_malformed');
    assert.match(explicit.reason, /plan\.md must be a regular non-symlink file/);

    const implicit = SPEC_RESOLVER.resolveWorkflowCandidate({ projectRoot: root });
    assert.equal(implicit.error, 'invalid_specs');
    assert.deepEqual(implicit.candidates, ['foo']);
    assert.doesNotMatch(implicit.reason, /Multiple active/);

    // A directory alias is refused rather than resolved to the packet it points at.
    const aliasRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-resolver-directory-alias-'));
    try {
      const aliasSpecs = path.join(aliasRoot, 'specs');
      packet(path.join(aliasSpecs, 'bar'));
      fs.symlinkSync('bar', path.join(aliasSpecs, 'foo'), 'dir');
      const resolved = SPEC_RESOLVER.resolveWorkflowCandidate({ projectRoot: aliasRoot });
      assert.equal(resolved.error, 'invalid_specs');
      assert.deepEqual(resolved.candidates, ['foo']);
    } finally {
      fs.rmSync(aliasRoot, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
