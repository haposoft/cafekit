'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const AGENTS = path.join(__dirname, '../../src/claude/agents');
const read = (name) => fs.readFileSync(path.join(AGENTS, name), 'utf8');

// No hook injects a `## Naming` section, so an agent told to follow one has nothing to follow.
test('agent sources reference no hook-injected Naming section', () => {
  for (const name of fs.readdirSync(AGENTS).filter((file) => file.endsWith('.md'))) {
    const text = read(name);
    assert.doesNotMatch(text, /## Naming/, `${name} points at a ## Naming section`);
    assert.doesNotMatch(text, /Naming Hooks/, `${name} points at naming hooks`);
  }
});

// Running the failing test is how the debugger reproduces a bug; verifying a fix is not its job.
test('debugger runs tests only to reproduce', () => {
  const text = read('debugger.md');
  assert.doesNotMatch(text, /run (unit|integration) tests/i);
  assert.match(text, /Run the failing test or reproduction command; do not run tests to verify a fix\./);
});

// Code already says what it does; docs that restate it drift, so docs keep only the reasons and the map.
test('docs-keeper keeps WHY and WHERE', () => {
  const text = read('docs-keeper.md');
  assert.match(text, /Code owns WHAT and HOW; docs own only WHY and WHERE\./);
  for (const layer of ['**Intent:**', '**Current decisions:**', '**Current evidence:**', '**Stateful records:**']) {
    assert.ok(text.includes(layer), `docs-keeper misses the ${layer} layer`);
  }
  assert.match(text, /Do not hand-maintain counts, LOC, file trees or inventories/);
  assert.match(text, /`development-roadmap\.md` and `project-changelog\.md` are the exception/);
  assert.match(text, /`codebase-summary\.md` is a WHERE map/);
  assert.match(text, /state both and name the gap/);
  assert.match(text, /Do not create a changelog, roadmap, ADR or metric file/);
});

test('manage-docs does not churn docs on a phase change', () => {
  const rule = fs.readFileSync(path.join(__dirname, '../../src/claude/rules/manage-docs.md'), 'utf8');
  assert.doesNotMatch(rule, /development phase transitions/i);
});

// The review roles already live in review.md; spec-maker points at them instead of copying a checklist.
test('spec-maker runs the review roles on its own claims', () => {
  const text = read('spec-maker.md');
  assert.match(text, /Scope Auditor\s+roles from `\.claude\/skills\/specs\/references\/review\.md` on your own claims/);
  assert.match(text, /self-check does not replace the fresh review/);
  for (const role of ['Fact Checker', 'Flow Tracer', 'Scope Auditor']) {
    assert.ok(text.includes(role), `spec-maker does not name the ${role} role`);
  }
});
