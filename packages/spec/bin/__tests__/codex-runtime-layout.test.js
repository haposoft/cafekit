'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.resolve(__dirname, '../../src');
const SHIM = /^(?:['"]use strict['"];?\s*)?module\.exports\s*=\s*require\(['"]\.\.\/\.\.\/\.\.\/claude\/hooks\/lib\/([^'"/]+)['"]\);?\s*$/;

function layout() {
  return require('../phases/codex-runtime').codexRuntimeLayout();
}

const destinations = (entries) => entries.map((entry) => entry.dest);

test('shims-resolved: every shim lib ships as the real Claude library, never as the shim', () => {
  const libDir = path.join(SRC, 'codex/hooks/lib');
  const shims = fs.readdirSync(libDir).filter((name) => (fs.readFileSync(path.join(libDir, name), 'utf8').match(SHIM) || [])[1] === name);
  assert.equal(shims.length, 8, `expected 8 shim libraries, found ${shims.join(', ')}`);
  const entries = layout();
  for (const name of shims) {
    const shipped = entries.filter((entry) => entry.dest === `hooks/lib/${name}`);
    assert.equal(shipped.length, 1, `hooks/lib/${name} shipped ${shipped.length} times`);
    assert.equal(shipped[0].src, path.join(SRC, 'claude/hooks/lib', name));
  }
});

test('hooks-copied: every non-shim Codex hook file ships from the Codex source', () => {
  const entries = layout();
  const hooksDir = path.join(SRC, 'codex/hooks');
  for (const name of fs.readdirSync(hooksDir).filter((n) => n !== 'lib')) {
    const entry = entries.find((e) => e.dest === `hooks/${name}`);
    assert.ok(entry, `hooks/${name} missing`);
    assert.equal(entry.src, path.join(hooksDir, name));
  }
  const libDir = path.join(hooksDir, 'lib');
  for (const name of fs.readdirSync(libDir).filter((n) => !SHIM.test(fs.readFileSync(path.join(libDir, n), 'utf8')))) {
    const entry = entries.find((e) => e.dest === `hooks/lib/${name}`);
    assert.ok(entry, `hooks/lib/${name} missing`);
    assert.equal(entry.src, path.join(libDir, name));
  }
});

test('groups-installed: every layout group is one the installer writes', () => {
  const { LAYOUT_GROUPS } = require('../phases/codex-runtime');
  const known = LAYOUT_GROUPS.map(([name]) => name);
  for (const entry of layout()) assert.ok(known.includes(entry.group), `${entry.dest} has unknown group ${entry.group}`);
});

test('rules-composed: Claude rules minus Codex overrides, plus Codex rules, with the right transform', () => {
  const entries = layout().filter((entry) => entry.dest.startsWith('rules/'));
  const overrides = fs.readdirSync(path.join(SRC, 'codex/rules'));
  const claudeRules = fs.readdirSync(path.join(SRC, 'claude/rules')).filter((name) => !overrides.includes(name));
  assert.deepEqual(destinations(entries).sort(), [...claudeRules, ...overrides].map((name) => `rules/${name}`).sort());
  for (const entry of entries) {
    const override = overrides.includes(path.basename(entry.dest));
    assert.equal(entry.src, path.join(SRC, override ? 'codex/rules' : 'claude/rules', path.basename(entry.dest)));
    assert.equal(entry.transform, override ? null : 'codex-body', `${entry.dest} transform`);
  }
});

test('styles-and-schema: output styles carry the Codex transform and the schema ships once', () => {
  const entries = layout();
  const styles = entries.filter((entry) => entry.dest.startsWith('output-styles/'));
  assert.deepEqual(destinations(styles).sort(), fs.readdirSync(path.join(SRC, 'claude/output-styles')).map((n) => `output-styles/${n}`).sort());
  assert.ok(styles.every((entry) => entry.transform === 'codex-body'));
  const schema = entries.filter((entry) => entry.dest === 'runtime.schema.json');
  assert.equal(schema.length, 1);
  assert.equal(schema[0].src, path.join(SRC, 'claude/runtime.schema.json'));
});

test('sources-exist: every layout source is a regular file and every destination is unique and relative', () => {
  const entries = layout();
  assert.equal(new Set(destinations(entries)).size, entries.length, 'duplicate destination');
  for (const entry of entries) {
    assert.ok(fs.lstatSync(entry.src).isFile(), `${entry.src} is not a regular file`);
    assert.ok(!path.isAbsolute(entry.dest) && !entry.dest.split('/').includes('..'), `${entry.dest} escapes the runtime root`);
    assert.equal(typeof entry.group, 'string');
  }
});
