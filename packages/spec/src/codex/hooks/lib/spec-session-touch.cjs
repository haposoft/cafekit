'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { atomicWrite, assertConfiguredSpecsPath, hookStateDir } = require('./hook-context.cjs');

function sessionIdentity(payload) {
  return [payload.session_id, payload.sessionId, payload.sessionID, payload.session?.id]
    .find((value) => typeof value === 'string' && value.trim()) || null;
}

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

function patchPaths(command) {
  if (typeof command !== 'string') return [];
  const lines = command.trim().split(/\r?\n/);
  if (lines.shift() !== '*** Begin Patch' || lines.pop() !== '*** End Patch') return [];
  const paths = [];
  let operation = null;
  let body = false;
  for (const line of lines) {
    const header = line.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/);
    if (header) {
      if (operation && operation !== 'Delete' && !body) return [];
      operation = header[1]; body = operation === 'Delete';
      paths.push(header[2]);
    } else if (/^\*\*\* Move to: .+/.test(line) && operation === 'Update' && !body) {
      paths.push(line.slice('*** Move to: '.length));
    } else if (operation === 'Add' && /^\+/.test(line)) {
      body = true;
    } else if (operation === 'Update' && /^(?:@@|[ +\-]|\*\*\* End of File$)/.test(line)) {
      body = true;
    } else {
      return [];
    }
  }
  return operation && body ? paths : [];
}

function responseText(response) {
  if (typeof response === 'string') return response;
  if (!response || typeof response !== 'object') return '';
  const value = response.output ?? response.result ?? response.message ?? response.content;
  if (typeof value === 'string') return value;
  return Array.isArray(value) ? value.map((item) => item?.text || '').join('\n') : '';
}

function successfulMutation(payload) {
  const response = payload.tool_response;
  if (payload.hook_event_name !== 'PostToolUse' || payload.success === false || response == null) return false;
  if (typeof response === 'object') {
    if (response.isError === true || response.is_error === true || response.success === false
      || response.ok === false || response.error || ['error', 'failed', 'failure'].includes(response.status)) return false;
    for (const key of ['exit_code', 'exitCode']) {
      if (response[key] !== undefined && response[key] !== 0) return false;
    }
  }
  const text = responseText(response).trim();
  if (/^(?:error\b|failed\b|failure\b|apply_patch verification failed)/im.test(text)) return false;
  // Contract: github.com/openai/codex/blob/main/codex-rs/core/src/tools/context.rs
  // Native ApplyPatchToolOutput emits a string summary to PostToolUse, whereas its
  // code-mode return is {}. Unknown/empty output is not observed successful mutation.
  const nativeSuccess = /^Success\. Updated the following files:\r?\n[AMD] .+/m.test(text);
  if (payload.tool_name === 'apply_patch') return nativeSuccess;
  return nativeSuccess || response?.ok === true || response?.success === true
    || /^(?:success\b|.*\bupdated successfully[.!]?\s*$)/i.test(text);
}

function mutationPaths(payload) {
  if (!successfulMutation(payload)) return [];
  const input = payload.tool_input || {};
  if (payload.tool_name === 'apply_patch') return patchPaths(input.command);
  if (!['Edit', 'Write', 'MultiEdit'].includes(payload.tool_name)) return [];
  return [input.file_path, input.path, ...(Array.isArray(input.edits) ? input.edits.map((edit) => edit?.file_path || edit?.path) : [])]
    .filter((value) => typeof value === 'string');
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

function touchSession(payload, context) {
  const sessionId = sessionIdentity(payload);
  const specsRoot = assertConfiguredSpecsPath(context.projectRoot, context.runtime);
  if (!sessionId) return { sessionId, names: [], touched: [], specsRoot };
  const key = crypto.createHash('sha256').update(`${context.projectRoot}\0${sessionId}`).digest('hex');
  const file = path.join(hookStateDir(context.projectRoot), `spec-touched-${key}.json`);
  let previous = [];
  try { previous = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first touch */ }
  const touched = new Set(Array.isArray(previous) ? previous.filter((name) => typeof name === 'string') : []);
  let names;
  if (payload.hook_event_name === 'PostToolUse') {
    names = mutationPaths(payload).map((value) => packetAt(value, specsRoot, context.sessionCwd)).filter(Boolean);
  } else {
    let packets = [];
    try { packets = fs.readdirSync(specsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name); } catch { /* absent root */ }
    names = namedPackets(payload.prompt || payload.user_prompt, packets, specsRoot, context.projectRoot);
    const feature = payload.explicitFeature ?? payload.featureName ?? payload.feature;
    if (typeof feature === 'string' && feature.trim() && !/[\\/]/.test(feature) && !['.', '..', '_shared'].includes(feature)) names.push(feature);
    const explicitPath = payload.explicitPath ?? payload.specPath ?? payload.spec_path ?? payload.featurePath;
    const fromPath = packetAt(explicitPath, specsRoot, context.projectRoot);
    if (fromPath) names.push(fromPath);
  }
  for (const name of names) touched.add(name);
  if (names.length) {
    try { atomicWrite(file, `${JSON.stringify([...touched].sort())}\n`); } catch { /* no shared fallback */ }
  }
  return { sessionId, names: [...new Set(names)], touched: [...touched], specsRoot };
}

module.exports = { touchSession, sessionIdentity };
