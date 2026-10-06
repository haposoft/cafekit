'use strict';

// runtime.json is the only configuration surface a CafeKit user edits by hand, so the
// schema beside it has to stay true: every shipped key described, every documented key
// still real, and no key silently drifting out of sync with what the runtime honours.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const SCHEMA_PATH = path.join(PACKAGE_ROOT, 'src/claude/runtime.schema.json');
const SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const RUNTIMES = ['src/claude/runtime.json', 'src/codex/runtime.json', 'src/omp/runtime.json'];
const MANIFEST = require(path.join(PACKAGE_ROOT, 'src/claude/migration-manifest.json'));

function readRuntime(relative) {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, relative), 'utf8'));
}

/** Walk a config object against a schema node, collecting undescribed key paths. */
function undescribedKeys(value, schemaNode, trail = []) {
  if (!schemaNode || typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  const properties = schemaNode.properties || {};
  const found = [];
  for (const [key, child] of Object.entries(value)) {
    const childSchema = properties[key];
    if (!childSchema) {
      if (schemaNode.additionalProperties === true || typeof schemaNode.additionalProperties === 'object') continue;
      found.push([...trail, key].join('.'));
      continue;
    }
    found.push(...undescribedKeys(child, childSchema, [...trail, key]));
  }
  return found;
}

/** Every property node in the schema, keyed by dotted path. */
function schemaProperties(node, trail = [], out = new Map()) {
  for (const [key, child] of Object.entries(node.properties || {})) {
    const dotted = [...trail, key].join('.');
    out.set(dotted, child);
    schemaProperties(child, [...trail, key], out);
  }
  return out;
}

test('the schema is a valid, self-describing JSON Schema document', () => {
  assert.equal(SCHEMA.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(SCHEMA.type, 'object');
  assert.ok(SCHEMA.title, 'the schema needs a title');
  assert.ok(SCHEMA.description, 'the schema needs a description');
  assert.equal(SCHEMA.additionalProperties, false, 'an unknown top-level key must be reported, not accepted silently');
});

test('every key in each shipped runtime.json is described by the schema', () => {
  for (const relative of RUNTIMES) {
    const missing = undescribedKeys(readRuntime(relative), SCHEMA);
    assert.deepEqual(missing, [], `${relative} ships keys the schema does not describe: ${missing.join(', ')}`);
  }
});

test('every runtime points at the schema that installs beside it', () => {
  for (const relative of RUNTIMES) {
    assert.equal(readRuntime(relative).$schema, './runtime.schema.json', `${relative} must reference the schema`);
  }
  assert.ok(
    MANIFEST.runtime.files.includes('runtime.schema.json'),
    'the schema must be installed for Claude, or its $schema reference dangles'
  );
  const codexPhase = fs.readFileSync(path.join(PACKAGE_ROOT, 'bin/phases/codex-runtime.js'), 'utf8');
  assert.match(codexPhase, /runtime\.schema\.json/, 'the schema must also be installed for Codex');
  const ompPhase = fs.readFileSync(path.join(PACKAGE_ROOT, 'bin/phases/omp-runtime.js'), 'utf8');
  assert.match(ompPhase, /runtime\.schema\.json/, 'the schema must also be installed for omp');
});

test('every documented property carries a description a reader can act on', () => {
  for (const [dotted, node] of schemaProperties(SCHEMA)) {
    if (dotted === '$schema') continue;
    assert.ok(node.description, `${dotted} has no description`);
    assert.ok(node.description.length > 20, `${dotted} has a description too short to help: ${node.description}`);
  }
});

test('keys the runtime does not honour are marked deprecated, not documented as working', () => {
  // develop.parallel and the hooks toggle map are still shipped for compatibility, but
  // nothing reads them. The schema must say so rather than imply they work.
  for (const dead of ['hooks', 'develop', 'usage', 'spec.scaffold_guard']) {
    // A dotted path walks nested `properties`: `spec.scaffold_guard` is spec.properties.scaffold_guard.
    const node = dead.split('.').reduce((schema, key) => schema && schema.properties && schema.properties[key], SCHEMA);
    assert.ok(node, `${dead} is shipped in runtime.json and must appear in the schema`);
    assert.equal(node.deprecated, true, `${dead} is not honoured and must be marked deprecated`);
    assert.match(node.description, /[Nn]ot honoured/, `${dead} must say plainly that it does nothing`);
  }
});

test('the completion gate flag is documented as a block, never as a switch', () => {
  const node = SCHEMA.properties.spec.properties.completion_gate;
  assert.match(node.description, /[Nn]ot a switch/);
  assert.match(node.description, /blocks/, 'the description must say the gate blocks while the flag is present');
});

test('statusline values in the schema match the modes the renderer implements', () => {
  const status = fs.readFileSync(path.join(PACKAGE_ROOT, 'src/claude/status.cjs'), 'utf8');
  const implemented = new Set((status.match(/case '([a-z]+)':/g) || []).map((line) => line.slice(6, -2)));
  for (const mode of SCHEMA.properties.statusline.enum) {
    assert.ok(implemented.has(mode), `schema offers statusline "${mode}" but the renderer has no branch for it`);
  }
  const sections = SCHEMA.properties.statuslineLayout.properties.lines.items.items.enum;
  for (const section of sections) {
    assert.ok(status.includes(`'${section}'`), `schema offers layout section "${section}" but status.cjs never names it`);
  }
});
