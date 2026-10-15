'use strict';

const fs = require('fs');
const path = require('path');

// Deleted/new paths still resolve through their deepest existing ancestor. This also
// prevents an innocent lexical prefix from hiding a symlink outside the specs root.
function canonicalTarget(value) {
  const missing = [];
  let current = path.resolve(value);
  while (true) {
    try { return path.join(fs.realpathSync(current), ...missing); } catch (error) {
      if (error.code !== 'ENOENT') return null;
      const parent = path.dirname(current);
      if (parent === current) return null;
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

function packetAt(value, specsRoot, cwd) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const root = canonicalTarget(specsRoot);
  const target = canonicalTarget(path.resolve(cwd, value));
  if (!root || !target) return null;
  const rel = path.relative(root, target);
  if (!rel || path.isAbsolute(rel) || rel === '..' || rel.startsWith(`..${path.sep}`)) return null;
  const segments = rel.split(path.sep);
  return segments[0] === '_shared' ? null : segments[0];
}

function namedPackets(prompt, names, specsRoot, projectRoot) {
  if (typeof prompt !== 'string') return [];
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefix = path.relative(projectRoot, specsRoot).split(path.sep).join('/');
  const named = names.filter((name) => {
    const n = escape(name);
    const absolute = specsRoot.split(path.sep).join('/');
    return new RegExp(`(^|[^\\w])${escape(absolute)}/${n}(?![\\w-])`).test(prompt)
      || new RegExp(`(^|[^\\w/-])${escape(prefix)}/${n}(?![\\w-])`).test(prompt)
      || new RegExp(`(?:\\$cf-[\\w-]+|/cf:[\\w-]+)\\s+(?:${escape(prefix)}/)?${n}(?![\\w-])`).test(prompt)
      || (/[-_0-9]/.test(name) && new RegExp(`(^|[^\\w/-])${n}(?![\\w-])`).test(prompt));
  });
  // Absolute prompt references may use another realpath alias (notably /var on macOS).
  const paths = [...prompt.matchAll(/(?:^|[\s"'`])((?:\/|[A-Za-z]:[\\/])[^\s"'`]+)/g)].map((match) => match[1]);
  for (const match of prompt.matchAll(/["']([^"']+)["']/g)) {
    if (path.isAbsolute(match[1])) paths.push(match[1]);
  }
  for (const value of paths) {
    const name = packetAt(value, specsRoot, projectRoot);
    if (names.includes(name)) named.push(name);
  }
  return [...new Set(named)];
}

function explicitFailure(payload) {
  const failed = (value) => {
    if (!value || typeof value !== 'object') return false;
    if (value.success === false || value.is_error === true || value.isError === true
      || value.ok === false || value.error || ['error', 'failed', 'failure'].includes(value.status)) return true;
    return ['exit_code', 'exitCode'].some((key) => value[key] !== undefined && value[key] !== 0);
  };
  return payload.success === false || failed(payload.tool_response);
}

module.exports = { canonicalTarget, packetAt, namedPackets, explicitFailure };
