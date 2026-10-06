'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLAUDE_RUNTIME_ENTRYPOINTS = Object.freeze([
  'scripts/spec-final-state.cjs',
  'scripts/spec-receipt.cjs',
  'scripts/spec-resolver.cjs',
  'scripts/validate-spec-output.cjs',
]);

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative));
}

function assertRegularSource(root, target) {
  if (!inside(root, target)) throw new Error(`runtime dependency escapes source root: ${target}`);
  const relative = path.relative(root, target);
  let cursor = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error(`runtime dependency cannot be a symlink: ${cursor}`);
  }
  if (!fs.lstatSync(target).isFile()) throw new Error(`runtime dependency is not a regular file: ${target}`);
  const canonical = fs.realpathSync(target);
  if (!inside(fs.realpathSync(root), canonical)) {
    throw new Error(`runtime dependency canonical path escapes source root: ${target}`);
  }
  return canonical;
}

function resolveDependency(sourceRoot, sourceFile, request) {
  const unresolved = path.resolve(path.dirname(sourceFile), request);
  if (!inside(sourceRoot, unresolved)) {
    throw new Error(`runtime dependency escapes source root: ${sourceFile} -> ${request}`);
  }
  const candidates = path.extname(unresolved)
    ? [unresolved]
    : [unresolved, `${unresolved}.cjs`, `${unresolved}.js`, `${unresolved}.json`,
      path.join(unresolved, 'index.cjs'), path.join(unresolved, 'index.js')];
  for (const candidate of candidates) {
    try { return assertRegularSource(sourceRoot, candidate); }
    catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue;
      throw error;
    }
  }
  throw new Error(`runtime dependency is missing: ${sourceFile} -> ${request}`);
}

function relativeRequires(sourceFile) {
  if (path.extname(sourceFile) === '.json') return [];
  const source = fs.readFileSync(sourceFile, 'utf8');
  if (/\brequire\s*\(\s*path\.(?:join|resolve)\s*\(\s*__dirname\b/.test(source)) {
    throw new Error(`dynamic local require is not allowed: ${sourceFile}`);
  }
  const localBindings = new Set();
  for (const match of source.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:String\s*\(\s*)?(['"])(\.\.?\/[^'"]*)\2\s*\)?/g,
  )) localBindings.add(match[1]);
  const requests = new Set();
  for (const match of source.matchAll(/\brequire\s*\(\s*([^()\r\n]+?)\s*\)/g)) {
    const expression = match[1].trim();
    const literal = expression.match(/^(['"])([^'"]+)\1$/);
    if (literal) {
      if (literal[2].startsWith('.')) requests.add(literal[2]);
      continue;
    }
    const identifier = expression.match(/^[A-Za-z_$][\w$]*$/)?.[0];
    const visiblyLocal = /^(['"])(\.\.?\/)/.test(expression)
      || /^`\.\.?\//.test(expression)
      || (identifier && localBindings.has(identifier));
    if (visiblyLocal) throw new Error(`dynamic local require is not allowed: ${sourceFile}`);
  }
  return [...requests].sort();
}

function copyCommonJsDependencyClosure({ sourceRoot, destinationRoot, entrypoints }) {
  const requestedSource = path.resolve(sourceRoot);
  const destination = path.resolve(destinationRoot);
  const sourceStat = fs.lstatSync(requestedSource);
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
    throw new Error(`source root must be a regular directory: ${requestedSource}`);
  }
  const source = fs.realpathSync(requestedSource);
  if (!Array.isArray(entrypoints) || entrypoints.length === 0) {
    throw new Error('at least one runtime entrypoint is required');
  }
  const pending = entrypoints.map((entrypoint) => {
    if (typeof entrypoint !== 'string' || path.isAbsolute(entrypoint)) {
      throw new Error(`runtime entrypoint must be relative: ${entrypoint}`);
    }
    return resolveDependency(source, path.join(source, '__entrypoint__.cjs'), `./${entrypoint}`);
  }).sort();
  const closure = new Set();
  while (pending.length > 0) {
    const sourceFile = pending.shift();
    if (closure.has(sourceFile)) continue;
    closure.add(sourceFile);
    for (const request of relativeRequires(sourceFile)) {
      const dependency = resolveDependency(source, sourceFile, request);
      if (!closure.has(dependency)) pending.push(dependency);
    }
    pending.sort();
  }
  const files = [...closure].map((file) => path.relative(source, file)).sort();
  for (const relative of files) {
    const target = path.resolve(destination, relative);
    if (!inside(destination, target)) throw new Error(`runtime destination escapes fixture: ${relative}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(source, relative), target);
  }
  return files;
}

function copyClaudeTestRuntime(packageRoot, destinationRoot, entrypoints = CLAUDE_RUNTIME_ENTRYPOINTS) {
  return copyCommonJsDependencyClosure({
    sourceRoot: path.join(packageRoot, 'src/claude'),
    destinationRoot,
    entrypoints,
  });
}

module.exports = { copyCommonJsDependencyClosure, copyClaudeTestRuntime };

if (require.main === module) {
  const { test } = require('node:test');
  function fixture(run) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-runtime-closure-'));
    const source = path.join(root, 'source');
    const destination = path.join(root, 'destination');
    fs.mkdirSync(source);
    try { run({ root, source, destination }); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
  }

  test('copies a deterministic transitive closure and preserves layout', () => fixture(({ source, destination }) => {
    fs.mkdirSync(path.join(source, 'nested'));
    fs.writeFileSync(path.join(source, 'entry.cjs'), "require('./nested/one.cjs');\n");
    fs.writeFileSync(path.join(source, 'nested/one.cjs'), "require('../two');\n");
    fs.writeFileSync(path.join(source, 'two.cjs'), 'module.exports = 2;\n');
    const files = copyCommonJsDependencyClosure({ sourceRoot: source, destinationRoot: destination, entrypoints: ['entry.cjs'] });
    assert.deepEqual(files, ['entry.cjs', 'nested/one.cjs', 'two.cjs']);
    assert.equal(fs.readFileSync(path.join(destination, 'nested/one.cjs'), 'utf8'), "require('../two');\n");
  }));

  test('fails closed for missing dependencies', () => fixture(({ source, destination }) => {
    fs.writeFileSync(path.join(source, 'entry.cjs'), "require('./missing.cjs');\n");
    assert.throws(() => copyCommonJsDependencyClosure({ sourceRoot: source, destinationRoot: destination, entrypoints: ['entry.cjs'] }), /dependency is missing/);
    assert.equal(fs.existsSync(destination), false);
  }));

  test('fails closed for symlinks and source-root escapes', () => fixture(({ root, source, destination }) => {
    const outside = path.join(root, 'outside.cjs');
    fs.writeFileSync(outside, 'module.exports = true;\n');
    fs.symlinkSync(outside, path.join(source, 'linked.cjs'));
    fs.writeFileSync(path.join(source, 'entry.cjs'), "require('./linked.cjs');\n");
    const copy = (entrypoints) => copyCommonJsDependencyClosure({ sourceRoot: source, destinationRoot: destination, entrypoints });
    assert.throws(() => copy(['entry.cjs']), /cannot be a symlink/);
    assert.throws(() => copy(['../outside.cjs']), /escapes source root/);
  }));

  test('fails closed for dynamic local requires', () => fixture(({ source, destination }) => {
    fs.writeFileSync(path.join(source, 'dependency.cjs'), 'module.exports = true;\n');
    const copy = () => copyCommonJsDependencyClosure({ sourceRoot: source, destinationRoot: destination, entrypoints: ['entry.cjs'] });
    for (const body of [
      "const target = './dependency.cjs';\nrequire(target);\n",
      "const path = require('node:path');\nrequire(path.join(__dirname, 'dependency.cjs'));\n",
      "const request = String('./dependency.cjs');\nrequire(request);\n",
    ]) {
      fs.writeFileSync(path.join(source, 'entry.cjs'), body);
      assert.throws(copy, /dynamic local require/);
    }
  }));
}
