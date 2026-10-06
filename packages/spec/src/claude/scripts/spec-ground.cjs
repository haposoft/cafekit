#!/usr/bin/env node
'use strict';

/** CafeKit Specs v2 grounding checker (Layer 2, no command execution). */

const fs = require('fs');
const path = require('path');
const POLICY = require('./workflow-policy.cjs');
const SEMANTIC = require('./spec-semantic-model.cjs');

const ANCHOR_TYPES = new Set([
  'file', 'symbol', 'command', 'route', 'schema', 'contract', 'artifact', 'external',
]);
const TASK_PATH_RE = /^task-(R\d+-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

function usage() {
  console.error('Usage: node spec-ground.cjs <specDir> [--root <work-context>]');
}

function parseArgs(argv) {
  const args = { specDir: null, root: null };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--root') {
      args.root = argv[++index];
      if (!args.root) throw new Error('--root requires a value');
    } else if (!args.specDir) args.specDir = argv[index];
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  return args;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function unsafeRelative(value) {
  return typeof value !== 'string' || value.trim() === '' || value !== value.trim()
    || path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)
    || value.split(/[\\/]+/).includes('..');
}

function inspectRoot(directory, label, errors) {
  try {
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      errors.push(`${label}: must be a real directory, not a symlink`);
      return null;
    }
    return fs.realpathSync(directory);
  } catch (error) {
    errors.push(`${label}: cannot be inspected (${error.message})`);
    return null;
  }
}

function inspectPath(root, relativePath) {
  if (unsafeRelative(relativePath)) return { valid: false, reason: 'must be a safe relative path' };
  const target = path.resolve(root, relativePath);
  if (!inside(root, target)) return { valid: false, reason: 'escapes work root' };
  let current = path.resolve(root);
  for (const segment of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return { valid: false, reason: `contains symlink ${path.relative(root, current)}` };
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return { valid: true, exists: false, target };
      return { valid: false, reason: error.message };
    }
  }
  try {
    const real = fs.realpathSync(target);
    if (!inside(root, real)) return { valid: false, reason: 'canonical path escapes work root' };
    return { valid: true, exists: true, target, stat: fs.statSync(target) };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

function extractSection(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`^##\\s+${escaped}\\s*$`, 'im'));
  if (!match) return null;
  const after = content.slice(match.index + match[0].length);
  const next = after.match(/^##\s+/m);
  return next ? after.slice(0, next.index) : after;
}

function parseTable(section, expectedHeaders) {
  if (typeof section !== 'string') return [];
  const lines = section.split('\n');
  for (let index = 0; index + 1 < lines.length; index += 1) {
    if (!/^\s*\|/.test(lines[index]) || !/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[index + 1])) continue;
    const headers = lines[index].split('|').slice(1, -1).map((cell) => cell.trim().toLowerCase());
    if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders.map((header) => header.toLowerCase()))) continue;
    const rows = [];
    for (let row = index + 2; row < lines.length && /^\s*\|/.test(lines[row]); row += 1) {
      const cells = lines[row].split('|').slice(1, -1)
        .map((cell) => cell.trim().replace(/^`|`$/g, '').trim());
      if (cells.some(Boolean)) rows.push(cells);
    }
    return rows;
  }
  return [];
}

function normalizeCanonicalAccessAction(rawAccess, rawAction) {
  return SEMANTIC.normalizeAccessAction(rawAccess, rawAction);
}

function listTasks(specDir) {
  const directory = path.join(specDir, 'tasks');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => ({
      path: path.join(directory, entry.name),
      relative: `tasks/${entry.name}`,
      basename: entry.name,
      id: entry.name.match(TASK_PATH_RE)?.[1] || null,
    }))
    .sort((left, right) => left.relative.localeCompare(right.relative));
}

function parseTypedAnchors(content, label, design, errors, schema21 = false) {
  const section = extractSection(content, design ? 'Typed Anchors' : (schema21 ? 'Anchors and Ownership' : 'Scope and Typed Anchors')) || '';
  const rows = parseTable(section, schema21
    ? ['ID', 'Type', 'Target', 'Role', 'Access', 'Action']
    : ['ID', 'Type', 'Target', 'Role']);
  const consumesDesign = !design && /\bA-D-\d{2}\b/.test(section);
  if (rows.length === 0 && !consumesDesign) errors.push(`${label}: typed anchor table is missing or empty`);
  return rows.map(([id = '', rawType = '', target = '', role = '', access = '', action = '']) => {
    const type = rawType.toLowerCase();
    if (!ANCHOR_TYPES.has(type)) errors.push(`${label}: anchor ${id || '(missing id)'} has unknown Type ${rawType || '(empty)'}`);
    if (schema21) {
      const normalized = normalizeCanonicalAccessAction(access, action);
      access = normalized.access;
      action = normalized.action;
      if (normalized.error) errors.push(`${label}: anchor ${id} ${normalized.error}`);
      if (unsafeRelative(target) || /[{}*?\[\]]/.test(target) || /[\\/]$/.test(target)) errors.push(`${label}: anchor ${id} requires one exact grounded target`);
    }
    const namespace = design ? /^A-D-\d{2}$/ : new RegExp(`^A-${path.basename(label).match(TASK_PATH_RE)?.[1] || 'INVALID'}-\\d{2}$`);
    if (schema21 && !namespace.test(id)) errors.push(`${label}: anchor ${id || '(missing id)'} has invalid ${design ? 'design' : 'task'} namespace`);
    if (!target || unsafeRelative(target) || /[{}*?\[\]]/.test(target) || /[\\/]$/.test(target)) {
      errors.push(`${label}: anchor ${id || '(missing id)'} requires one exact grounded target`);
    }
    if (!role) errors.push(`${label}: anchor ${id || '(missing id)'} Role must be concrete`);
    return { id, type, target, role: role.toLowerCase(), access, action, label, design, schema21 };
  });
}

function parseCanonicalAnchors(content, options, errors) {
  return SEMANTIC.parseAnchors(content, options, errors).map((anchor) => ({
    ...anchor,
    label: options.label,
    design: options.design === true,
    schema21: true,
  }));
}

function parseVerificationDefinitions(designText, errors) {
  return SEMANTIC.parseVerificationDefinitions(designText, errors);
}

function parseLegacyRelatedFiles(content, label) {
  const section = extractSection(content, 'Related Files');
  if (section === null) return { present: false, anchors: [] };
  return { present: true, anchors: parseTable(section, ['Path', 'Action', 'Description']).map(([target, action], index) => ({
    id: `${label}:${index}:${target}`,
    type: 'file',
    target,
    role: action,
    label,
    legacy: true,
  })) };
}

function expandBraces(pattern) {
  const match = pattern.match(/\{([^{}]*)\}/);
  if (!match) return [pattern];
  return match[1].split(',').flatMap((part) => expandBraces(
    `${pattern.slice(0, match.index)}${part}${pattern.slice(match.index + match[0].length)}`,
  ));
}

function globRegExp(pattern) {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        index += 1;
        if (pattern[index + 1] === '/') index += 1;
        source += '.*';
      } else source += '[^/]*';
    } else if (character === '?') source += '[^/]';
    else source += character.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`${source}$`);
}

function relativeEntries(root) {
  const entries = [];
  function visit(directory, relative) {
    let children;
    try { children = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { return; }
    for (const child of children) {
      const nextRelative = relative ? `${relative}/${child.name}` : child.name;
      entries.push(nextRelative);
      if (child.isDirectory() && !child.isSymbolicLink()) visit(path.join(directory, child.name), nextRelative);
    }
  }
  visit(root, '');
  return entries;
}

function matchingEntries(root, target) {
  if (!/[{}*?]/.test(target)) return fs.existsSync(path.join(root, target)) ? [target] : [];
  const entries = relativeEntries(root);
  const matches = new Set();
  for (const expanded of expandBraces(target)) {
    const pattern = globRegExp(expanded.replaceAll('\\', '/'));
    for (const entry of entries) if (pattern.test(entry)) matches.add(entry);
  }
  return [...matches];
}

function groundLegacy(anchors, taskRegistry, root, errors) {
  const allowed = new Set(['create', 'modify', 'delete', 'read']);
  const byTask = new Map();
  for (const anchor of anchors) {
    if (!byTask.has(anchor.label)) byTask.set(anchor.label, []);
    byTask.get(anchor.label).push(anchor);
    if (!allowed.has(anchor.role.toLowerCase())) errors.push(`${anchor.label}: unsupported Related Files action "${anchor.role}" for ${anchor.target}`);
    if (unsafeRelative(anchor.target)) errors.push(`${anchor.label}: Related Files path must be relative and stay within work root: ${anchor.target}`);
  }
  for (const [taskFile, rows] of byTask) {
    const firstCreate = new Map();
    rows.forEach((row, index) => {
      if (row.role.toLowerCase() === 'create' && !firstCreate.has(row.target)) firstCreate.set(row.target, index);
    });
    rows.forEach((row, index) => {
      const action = row.role.toLowerCase();
      if (!['modify', 'delete', 'read'].includes(action) || !firstCreate.has(row.target)) return;
      if (firstCreate.get(row.target) > index) errors.push(`${taskFile}: Create must precede ${action} for ${row.target}`);
    });
  }

  const producers = new Map();
  for (const anchor of anchors) if (anchor.role.toLowerCase() === 'create' && !producers.has(anchor.target)) producers.set(anchor.target, anchor.label);
  const consumers = anchors.filter((anchor) => ['modify', 'delete', 'read'].includes(anchor.role.toLowerCase())
    && producers.has(anchor.target) && producers.get(anchor.target) !== anchor.label);
  if (consumers.length > 0 && !isPlainObject(taskRegistry)) {
    errors.push('spec.json task_registry is missing or invalid for a cross-task producer/consumer dependency (fail-closed)');
  } else if (consumers.length > 0) {
    const dependencies = new Map(Object.entries(taskRegistry).map(([taskFile, entry]) => [
      taskFile,
      new Set(Array.isArray(entry?.dependencies) ? entry.dependencies : []),
    ]));
    function dependsOn(taskFile, ancestor, seen = new Set()) {
      if (taskFile === ancestor) return true;
      if (seen.has(taskFile)) return false;
      seen.add(taskFile);
      return [...(dependencies.get(taskFile) || [])].some((dependency) => dependsOn(dependency, ancestor, seen));
    }
    for (const consumer of consumers) {
      if (!dependsOn(consumer.label, producers.get(consumer.target))) {
        errors.push(`${consumer.label}: ${consumer.role.toLowerCase()} of ${consumer.target} must depend on creator ${producers.get(consumer.target)}`);
      }
    }
  }

  const created = new Set(anchors.filter((anchor) => anchor.role.toLowerCase() === 'create').map((anchor) => anchor.target));
  for (const anchor of anchors) {
    const action = anchor.role.toLowerCase();
    if (!allowed.has(action) || unsafeRelative(anchor.target)) continue;
    const matches = matchingEntries(root, anchor.target);
    if (/[{}*?]/.test(anchor.target) && matches.length === 0) errors.push(`${anchor.label}: glob matches no paths in work tree: ${anchor.target}`);
    else if (action === 'create' && matches.length > 0) errors.push(`${anchor.label}: Create path already exists in work tree: ${anchor.target}`);
    else if (action !== 'create' && matches.length === 0 && !created.has(anchor.target)) errors.push(`${anchor.label}: ${action} path not found in work tree: ${anchor.target}`);
  }
}

function designContracts(designText) {
  return new Set([
    ...[...designText.matchAll(/^#{3,6}\s+(C\d+)\s+(?:—|-)\s+.+$/gim)].map((match) => match[1].toUpperCase()),
    ...[...designText.matchAll(/<!--\s*contract:([A-Za-z0-9_.-]+)\s*-->/g)].map((match) => match[1]),
  ]);
}

function packageJsonFiles(root) {
  const found = [];
  function visit(directory, depth) {
    if (depth > 5) return;
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink() || ['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target, depth + 1);
      else if (entry.name === 'package.json') found.push(target);
    }
  }
  visit(root, 0);
  return found;
}

function packageScripts(root) {
  const scripts = new Map();
  for (const file of packageJsonFiles(root)) {
    try {
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const name of Object.keys(json.scripts || {})) {
        if (!scripts.has(name)) scripts.set(name, []);
        scripts.get(name).push(path.relative(root, file));
      }
    } catch (_) {}
  }
  return scripts;
}

function commandScript(command) {
  const tokens = command.trim().split(/\s+/);
  const manager = tokens[0];
  if (!['npm', 'pnpm', 'yarn', 'bun'].includes(manager)) return null;
  const runIndex = tokens.indexOf('run');
  if (runIndex >= 0) return tokens[runIndex + 1] || '';
  const filtered = tokens.filter((token, index) => index > 0 && !token.startsWith('-')
    && tokens[index - 1] !== '--filter' && tokens[index - 1] !== '-C' && tokens[index - 1] !== '--dir');
  return filtered[0] || '';
}

function legacyIntendedAction(anchor) {
  return /\b(?:create|planned|new|produce|output)\b/i.test(anchor.role) ? 'create' : 'read';
}

function intendedAction(anchor) {
  return anchor.schema21 ? anchor.action : legacyIntendedAction(anchor);
}

function createTargetMayAlreadyExist(anchor) {
  return anchor.schema21 && ['in_progress', 'done'].includes(anchor.taskStatus);
}

function groundPathTarget(anchor, root, createdTargets, plannedDependencyReads, errors) {
  const prefix = `${anchor.label}: ${anchor.id || anchor.type}`;
  const inspected = inspectPath(root, anchor.target);
  if (!inspected.valid) {
    errors.push(`${prefix}: ${anchor.type} target ${anchor.target} ${inspected.reason}`);
    return;
  }
  const action = intendedAction(anchor);
  if (action === 'create') {
    const parent = inspectPath(root, path.dirname(anchor.target));
    if (!parent.valid || !parent.exists || !parent.stat.isDirectory()) {
      errors.push(`${prefix}: create target parent is not grounded for ${anchor.target}`);
    } else if (inspected.exists && !createTargetMayAlreadyExist(anchor)) {
      errors.push(`${prefix}: create target already exists: ${anchor.target}`);
    }
    else createdTargets.add(anchor.target);
  } else if (!inspected.exists && !plannedDependencyReads.has(`${anchor.label}\0${anchor.target}`)) {
    errors.push(`${prefix}: ${action} target not found in work tree: ${anchor.target}`);
  }
}

function symbolParts(target) {
  const separator = target.lastIndexOf('#');
  if (separator <= 0 || separator === target.length - 1) return null;
  return {
    file: target.slice(0, separator),
    symbol: target.slice(separator + 1).replace(/\(.*\)$/, ''),
  };
}

function sourceBodies(root, excludedDirectories = []) {
  const bodies = [];
  const excluded = excludedDirectories.map((directory) => path.resolve(directory));
  const ignored = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'vendor', '.next']);
  function visit(directory, relative, depth) {
    if (depth > 8) return;
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink() || ignored.has(entry.name)) continue;
      const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const target = path.join(directory, entry.name);
      if (excluded.some((excludedDirectory) => target === excludedDirectory || inside(excludedDirectory, target))) continue;
      if (entry.isDirectory()) visit(target, nextRelative, depth + 1);
      else if (/\.(?:[cm]?[jt]sx?|py|go|rs|swift|java|kt|rb|php|sql|graphql|ya?ml|json)$/i.test(entry.name)) {
        try {
          if (fs.statSync(target).size <= 1024 * 1024) bodies.push([nextRelative, fs.readFileSync(target, 'utf8')]);
        } catch (_) {}
      }
    }
  }
  visit(root, '', 0);
  return bodies;
}

function semanticTargetExists(anchor, bodies) {
  const needle = anchor.type === 'route'
    ? anchor.target.replace(/^\s*(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+/i, '')
    : anchor.target;
  return bodies.some(([, body]) => body.includes(needle));
}

function groundCommand(anchor, root, scripts, errors, warnings) {
  const prefix = `${anchor.label}: ${anchor.id || anchor.type}`;
  const script = commandScript(anchor.target);
  if (script === '') errors.push(`${prefix}: command is missing a package script name`);
  else if (script !== null && !scripts.has(script)) errors.push(`${prefix}: package script "${script}" is not declared by project tooling`);
  else if (script === null && !/^(?:node|npx|git|gh|make|pytest|jest|vitest|go|cargo|swift)\b/.test(anchor.target)) {
    errors.push(`${prefix}: command tooling is not deterministically reachable: ${anchor.target}`);
  }
  if (script !== null) return;
  const pathTokens = anchor.target.split(/\s+/).map((token) => token.replace(/^['"]|['";,]$/g, ''))
    .filter((token) => /[\\/]/.test(token) && !token.startsWith('-') && !/^https?:/.test(token));
  for (const candidate of pathTokens) {
    const inspected = inspectPath(root, candidate);
    if (!inspected.valid || !inspected.exists) errors.push(`${prefix}: command target not found in work tree: ${candidate}`);
  }
  void warnings;
}

function groundAnchor(anchor, root, scripts, bodies, createdTargets, plannedDependencyReads, reachableAnchors, errors, warnings) {
  const prefix = `${anchor.label}: ${anchor.id || anchor.type}`;
  if (!ANCHOR_TYPES.has(anchor.type)) return;
  if (anchor.type === 'file' || anchor.type === 'artifact') {
    return groundPathTarget(anchor, root, createdTargets, plannedDependencyReads, errors);
  }
  if (anchor.type === 'symbol') {
    const parts = symbolParts(anchor.target);
    if (!parts) {
      errors.push(`${prefix}: symbol target must use path/to/file#Symbol`);
      return;
    }
    const inspected = inspectPath(root, parts.file);
    if (!inspected.valid || !inspected.exists || !inspected.stat.isFile()) {
      if (!(intendedAction(anchor) === 'create' && createdTargets.has(parts.file))) {
        errors.push(`${prefix}: containing file not found for symbol ${anchor.target}`);
      }
      return;
    }
    const body = fs.readFileSync(inspected.target, 'utf8');
    const escaped = parts.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exists = new RegExp(`(?:^|[^A-Za-z0-9_$])${escaped}(?:$|[^A-Za-z0-9_$])`, 'm').test(body);
    if (intendedAction(anchor) === 'create' && exists && !createTargetMayAlreadyExist(anchor)) {
      errors.push(`${prefix}: create symbol already exists: ${anchor.target}`);
    }
    else if (intendedAction(anchor) !== 'create' && !exists) {
      errors.push(`${prefix}: symbol ${parts.symbol} not found in containing file ${parts.file}`);
    }
    return;
  }
  if (anchor.type === 'command') return groundCommand(anchor, root, scripts, errors, warnings);
  if (['route', 'schema', 'contract'].includes(anchor.type)) {
    const exists = semanticTargetExists(anchor, bodies);
    if (intendedAction(anchor) === 'create' && !reachableAnchors.has(anchor.id)) {
      errors.push(`${prefix}: create ${anchor.type} requires repository entrypoint registration reachability`);
    } else if (intendedAction(anchor) === 'create' && exists && !createTargetMayAlreadyExist(anchor)) {
      errors.push(`${prefix}: create ${anchor.type} already exists: ${anchor.target}`);
    }
    else if (intendedAction(anchor) !== 'create' && !exists) errors.push(`${prefix}: ${anchor.type} target is not semantically reachable: ${anchor.target}`);
    return;
  }
  if (anchor.type === 'external' && !/^https?:\/\/[^\s]+$/.test(anchor.target)) {
    errors.push(`${prefix}: external target must be one exact http(s) URL`);
  }
}

function canonicalProjectRoot(specDir, requestedRoot = null) {
  const canonicalSpecDir = fs.realpathSync(specDir);
  if (requestedRoot) return fs.realpathSync(requestedRoot);
  const cwd = fs.realpathSync(process.cwd());
  return inside(cwd, canonicalSpecDir) ? cwd : fs.realpathSync(path.resolve(canonicalSpecDir, '..', '..'));
}

function groundSpec({ specDir: inputSpecDir, root: inputRoot = null, spec: inputSpec = null }) {
  const errors = [];
  const warnings = [];
  const specDir = inspectRoot(path.resolve(inputSpecDir), 'spec directory', errors);
  if (!specDir) return { errors, warnings, checked: 0, specDir: null, root: null };
  let root;
  try { root = inspectRoot(canonicalProjectRoot(specDir, inputRoot), 'work context', errors); } catch (error) {
    errors.push(`work context: cannot be resolved (${error.message})`);
  }
  if (!root) return { errors, warnings, checked: 0, specDir, root: null };
  if (!inside(root, specDir)) errors.push('spec directory: must be inside canonical work context');

  let spec = inputSpec;
  if (!isPlainObject(spec)) {
    try { spec = JSON.parse(fs.readFileSync(path.join(specDir, 'spec.json'), 'utf8')); } catch (_) { spec = null; }
  }
  let policy = null;
  if (isPlainObject(spec) && Object.prototype.hasOwnProperty.call(spec, 'workflow_policy')) {
    const validation = POLICY.validateWorkflowPolicySnapshot(spec.workflow_policy);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `spec.json: ${error}`));
    else try { policy = POLICY.readWorkflowPolicySnapshot(spec); } catch (error) { errors.push(`spec.json: ${error.message}`); }
  }
  let designText = '';
  try { designText = fs.readFileSync(path.join(specDir, 'design.md'), 'utf8'); } catch (error) {
    if (spec?.workflow_policy?.version === '2' || spec?.schema_version === '2.1') errors.push(`design.md: cannot be read (${error.message})`);
  }
  const tasks = listTasks(specDir);
  const isV2 = ['2', '2.1'].includes(spec?.workflow_policy?.version);
  const is21 = spec?.schema_version === '2.1';
  let anchors = isV2 ? parseTypedAnchors(designText, 'design.md', true, errors, is21) : [];
  let verificationDefinitions = is21 ? parseVerificationDefinitions(designText, errors) : new Map();
  const taskContents = new Map();
  for (const task of tasks) {
    const content = fs.readFileSync(task.path, 'utf8');
    taskContents.set(task.relative, content);
    if (isV2) anchors.push(...parseTypedAnchors(content, task.relative, false, errors, is21));
    else {
      const legacy = parseLegacyRelatedFiles(content, task.relative);
      if (!legacy.present) errors.push(`${task.relative}: missing Related Files section`);
      else if (legacy.anchors.length === 0) errors.push(`${task.relative}: Related Files section must not be empty`);
      anchors.push(...legacy.anchors);
    }
  }
  if (is21) {
    const projection = SEMANTIC.modelFromMarkdown(specDir, spec);
    errors.push(...projection.errors);
    if (!spec.semantic_model || typeof spec.semantic_model !== 'object' || Array.isArray(spec.semantic_model)) {
      errors.push('spec.json: schema 2.1 grounding requires promoted semantic_model authority');
    } else {
      errors.push(...SEMANTIC.validateSemanticModel(spec.semantic_model, spec));
      if (SEMANTIC.stableJson(spec.semantic_model) !== SEMANTIC.stableJson(projection.model)) {
        errors.push('spec.json: semantic_model differs from authored Markdown projection; rerun spec-readiness with the current semantic review result');
      }
      const taskById = new Map(Object.entries(spec.task_registry || {}).map(([taskPath, entry]) => [entry?.id, {
        path: taskPath,
        status: entry?.status,
      }]));
      anchors = (spec.semantic_model.anchors || []).map((anchor) => {
        const taskId = anchor.id.match(/^A-(R\d+-\d{2})-/)?.[1];
        const task = taskId ? taskById.get(taskId) : null;
        return {
          ...anchor,
          label: task?.path || taskId || 'design.md',
          taskStatus: task?.status || null,
          design: !taskId,
          schema21: true,
        };
      });
      verificationDefinitions = new Map((spec.semantic_model.verification_definitions || []).map((definition) => [definition.id, definition]));
    }
  }
  if (policy?.planning_depth === 'None') errors.push('spec.json: None planning depth cannot be grounded as a durable spec');
  if (isV2) {
    const tasksRequired = is21 ? tasks.length > 0 : spec?.coordination?.tasks_required === true;
    if (tasksRequired !== (tasks.length > 0)) errors.push('spec.json: coordination.tasks_required must match physical task inventory');
    const byId = new Map();
    const designTargets = new Map();
    for (const anchor of anchors) {
      if (byId.has(anchor.id)) errors.push(`${anchor.label}: duplicate anchor ID ${anchor.id}`);
      else byId.set(anchor.id, anchor);
      if (anchor.design) designTargets.set(`${anchor.type}\0${anchor.target}`, anchor.id);
      else if (designTargets.has(`${anchor.type}\0${anchor.target}`)) {
        errors.push(`${anchor.label}: anchor ${anchor.id} duplicates canonical design target ${designTargets.get(`${anchor.type}\0${anchor.target}`)}; reference the A-D anchor instead`);
      }
    }
    for (const [taskPath, content] of taskContents) for (const reference of content.match(/\bA-D-\d{2}\b/g) || []) {
      if (!byId.has(reference)) errors.push(`${taskPath}: dangling canonical design anchor reference ${reference}`);
    }
    for (const reference of designText.match(/\bA-D-\d{2}\b/g) || []) if (!byId.has(reference)) {
      errors.push(`design.md: dangling canonical design anchor reference ${reference}`);
    }
    for (const definition of verificationDefinitions.values()) {
      for (const reference of definition.reachability?.anchor_refs || []) {
        if (!byId.has(reference)) errors.push(`design.md: ${definition.id} has dangling reachability anchor ${reference}`);
      }
    }
  }
  const scripts = packageScripts(root);
  const bodies = sourceBodies(root, [specDir]);
  const createdTargets = new Set();
  const plannedDependencyReads = new Set();
  if (is21) {
    const creatorsByTarget = new Map();
    for (const anchor of anchors) if (!anchor.design && intendedAction(anchor) === 'create') {
      if (!creatorsByTarget.has(anchor.target)) creatorsByTarget.set(anchor.target, []);
      creatorsByTarget.get(anchor.target).push(anchor.label);
    }
    for (const anchor of anchors) if (!anchor.design && intendedAction(anchor) === 'read') {
      const dependencies = spec.task_registry?.[anchor.label]?.dependencies || [];
      if ((creatorsByTarget.get(anchor.target) || []).some((producer) => producer === anchor.label || dependencies.includes(producer))) {
        plannedDependencyReads.add(`${anchor.label}\0${anchor.target}`);
      }
    }
  }
  const reachableAnchors = new Set();
  if (is21) for (const definition of verificationDefinitions.values()) {
    const entrypoint = inspectPath(root, definition.reachability?.entrypoint);
    if (!entrypoint.valid || !entrypoint.exists || !entrypoint.stat.isFile()) {
      errors.push(`design.md: ${definition.id} repository entrypoint not found: ${definition.reachability?.entrypoint || '(empty)'}`);
    } else for (const anchorId of definition.reachability.anchor_refs) reachableAnchors.add(anchorId);
    if (definition.method?.kind === 'command') {
      groundCommand({
        id: definition.id,
        label: 'design.md',
        type: 'command',
        target: definition.method.value,
      }, root, scripts, errors, warnings);
    }
  }
  if (isV2) for (const anchor of anchors) {
    groundAnchor(anchor, root, scripts, bodies, createdTargets, plannedDependencyReads, reachableAnchors, errors, warnings);
  }
  else groundLegacy(anchors, spec?.task_registry, root, errors);
  return { errors, warnings, checked: anchors.length, specDir, root };
}

function main() {
  let args;
  try { args = parseArgs(process.argv); } catch (error) {
    usage();
    console.error(`- ${error.message}`);
    process.exit(2);
  }
  if (!args.specDir) { usage(); process.exit(2); }

  const result = groundSpec({
    specDir: path.resolve(process.cwd(), args.specDir),
    root: args.root ? path.resolve(process.cwd(), args.root) : null,
  });
  for (const warning of result.warnings) console.warn(`[WARN] ${warning}`);
  const relativeSpec = result.specDir ? path.relative(process.cwd(), result.specDir) || result.specDir : args.specDir;
  if (result.errors.length > 0) {
    console.error(`GROUNDING_FAIL ${relativeSpec}${result.root ? ` (root: ${result.root})` : ''}`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`GROUNDED ${relativeSpec} (${result.checked} typed/legacy anchor(s) checked; semantic and execution proof not claimed)`);
}

module.exports = {
  canonicalProjectRoot,
  groundSpec,
  normalizeCanonicalAccessAction,
  parseCanonicalAnchors,
  parseVerificationDefinitions,
};

if (require.main === module) main();
