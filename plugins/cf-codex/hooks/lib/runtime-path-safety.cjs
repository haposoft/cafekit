'use strict';

const fs = require('fs');
const path = require('path');
const lstatSync = fs.lstatSync.bind(fs);
const readFileSync = fs.readFileSync.bind(fs);
const realpathSync = fs.realpathSync.bind(fs);

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative));
}

function canonicalDirectory(directory, label = 'runtime root') {
  const requested = path.resolve(directory);
  let stat;
  try { stat = lstatSync(requested); }
  catch (error) { throw new Error(`${label} cannot be inspected (${error.code || error.message})`); }
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label} must be a non-symlink directory`);
  return realpathSync(requested);
}

function assertComponentPath(root, target, { allowMissing = false } = {}) {
  const requestedRoot = path.resolve(root);
  const requestedTarget = path.resolve(target);
  if (!inside(requestedRoot, requestedTarget)) throw new Error(`path escapes trusted root: ${requestedTarget}`);
  let cursor = requestedRoot;
  for (const part of path.relative(requestedRoot, requestedTarget).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try {
      if (lstatSync(cursor).isSymbolicLink()) throw new Error(`symlink component rejected: ${cursor}`);
    } catch (error) {
      if (allowMissing && error.code === 'ENOENT') return null;
      throw error;
    }
  }
  return requestedTarget;
}

function canonicalRegularFile(root, target, label = 'runtime file') {
  const canonicalRoot = canonicalDirectory(root);
  const requested = assertComponentPath(root, target);
  const stat = lstatSync(requested);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} must be a non-symlink regular file`);
  const canonical = realpathSync(requested);
  if (!inside(canonicalRoot, canonical)) throw new Error(`${label} escapes the trusted root`);
  return canonical;
}

function resolveLocalDependency(root, sourceFile, request) {
  const unresolved = path.resolve(path.dirname(sourceFile), request);
  if (!inside(root, unresolved)) throw new Error(`runtime dependency escapes root: ${sourceFile} -> ${request}`);
  const candidates = path.extname(unresolved)
    ? [unresolved]
    : [unresolved, `${unresolved}.cjs`, `${unresolved}.js`, `${unresolved}.json`,
      path.join(unresolved, 'index.cjs'), path.join(unresolved, 'index.js')];
  for (const candidate of candidates) {
    try { return canonicalRegularFile(root, candidate, 'runtime dependency'); }
    catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR'
        || /cannot be inspected \((?:ENOENT|ENOTDIR)\)/.test(error.message)) continue;
      throw error;
    }
  }
  throw new Error(`runtime dependency is missing: ${sourceFile} -> ${request}`);
}

function relativeRequires(sourceFile) {
  if (path.extname(sourceFile) === '.json') return [];
  const source = readFileSync(sourceFile, 'utf8');
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

function verifyCommonJsClosure(root, entrypoint) {
  const canonicalRoot = canonicalDirectory(root);
  const pending = [canonicalRegularFile(root, entrypoint, 'runtime entrypoint')];
  const verified = new Set();
  while (pending.length) {
    const sourceFile = pending.shift();
    if (verified.has(sourceFile)) continue;
    verified.add(sourceFile);
    for (const request of relativeRequires(sourceFile)) {
      const dependency = resolveLocalDependency(canonicalRoot, sourceFile, request);
      if (!verified.has(dependency)) pending.push(dependency);
    }
  }
  return [...verified].sort();
}

module.exports = {
  assertComponentPath,
  canonicalDirectory,
  canonicalRegularFile,
  inside,
  verifyCommonJsClosure,
};
