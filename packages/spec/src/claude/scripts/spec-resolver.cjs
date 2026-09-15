'use strict';

const fs = require('fs');
const path = require('path');

function specsDirectory(projectRoot, runtime) {
  const rel = runtime && runtime.paths && typeof runtime.paths.specs === 'string' && runtime.paths.specs.trim()
    ? runtime.paths.specs.trim()
    : 'specs';
  const resolved = path.resolve(projectRoot, rel);
  assertSpecsRootContained(projectRoot, resolved);
  return resolved;
}

function isMissingError(e) {
  return e && (e.code === 'ENOENT' || e.code === 'ENOTDIR');
}

function isPathInside(parentReal, childReal) {
  if (parentReal === childReal) return false;
  const rel = path.relative(parentReal, childReal);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

function isPathInsideOrEqual(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function assertSpecsRootContained(projectRoot, specsDir) {
  const projectPath = path.resolve(projectRoot);
  const specsPath = path.resolve(specsDir);
  if (!isPathInsideOrEqual(projectPath, specsPath)) {
    throw candidateError('configured specs root escapes project root', 'SPECS_ROOT_OUTSIDE_PROJECT');
  }

  let projectReal;
  try {
    projectReal = fs.realpathSync(projectPath);
  } catch (e) {
    throw candidateError(`project root canonicalization error: ${e.message}`, 'PROJECT_ROOT_INVALID');
  }

  let probe = specsPath;
  try {
    while (!fs.existsSync(probe)) {
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
    const canonicalProbe = fs.realpathSync(probe);
    if (!isPathInsideOrEqual(projectReal, canonicalProbe)) {
      throw candidateError('configured specs root traverses outside project root', 'SPECS_ROOT_OUTSIDE_PROJECT');
    }
  } catch (e) {
    if (e && e.code === 'SPECS_ROOT_OUTSIDE_PROJECT') throw e;
    throw candidateError(`configured specs root canonicalization error: ${e.message}`, 'SPECS_ROOT_INVALID');
  }
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function candidateError(reason, code = 'malformed') {
  const error = new Error(reason);
  error.code = code;
  return error;
}

const WORKFLOW_STATUSES = new Set(['pending', 'in_progress', 'paused', 'blocked', 'done']);
const WORKFLOW_TASK_NAME = /^task-[A-Za-z0-9][A-Za-z0-9._-]*\.md$/;
const WORKFLOW_CONTRACT = 'process-first-ready-v1';

function annotatedMarkdownLines(content) {
  let fence = null;
  return String(content || '').split(/\r?\n/).map((line, index) => {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    const outsideFence = fence === null && !fenceMatch;
    let fenceEvent = null;
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = { char: marker[0], length: marker.length };
        fenceEvent = 'open';
      } else if (marker[0] === fence.char && marker.length >= fence.length && fenceMatch[2].trim() === '') {
        fence = null;
        fenceEvent = 'close';
      }
    }
    return { index, line, outsideFence, fenceEvent };
  });
}

function workflowPlanContract(content) {
  const markers = annotatedMarkdownLines(content)
    .filter(({ line, outsideFence }) => outsideFence && /^\s*Specs-Contract\s*:/i.test(line))
    .map(({ line }) => line);
  if (markers.length === 0) return { workflowContract: null, queueReady: false };
  if (markers.length !== 1 || markers[0] !== `Specs-Contract: ${WORKFLOW_CONTRACT}`) {
    throw candidateError(`plan.md must contain exactly one Specs-Contract: ${WORKFLOW_CONTRACT} marker`);
  }
  return { workflowContract: WORKFLOW_CONTRACT, queueReady: true };
}

function workflowTaskStatus(content, taskName) {
  const values = annotatedMarkdownLines(content)
    .filter(({ outsideFence }) => outsideFence)
    .map(({ line }) => line.match(/^\s*(?:\*\*)?Status(?:\*\*)?\s*:\s*(?:\*\*)?\s*([A-Za-z_-]+)(?:\*\*)?\s*$/i))
    .filter(Boolean)
    .map((match) => match[1].toLowerCase().replaceAll('-', '_'));
  if (values.length !== 1 || !WORKFLOW_STATUSES.has(values[0])) {
    throw candidateError(`${taskName} must contain exactly one supported Status field`);
  }
  return values[0];
}

function workflowTaskNumericPrefix(taskName) {
  const match = taskName.match(/^task-(\d+)(?:-|\.md$)/);
  return match ? match[1].replace(/^0+(?=\d)/, '') : null;
}

function workflowTaskDependencies(content, taskName, taskNames, queueReady) {
  const lines = annotatedMarkdownLines(content);
  let sectionStart = -1;
  let sectionEnd = lines.length;
  let sectionCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].outsideFence) continue;

    const heading = lines[index].line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!heading || heading[1].length > 2) continue;
    const title = heading[2].trim().toLowerCase();
    if (heading[1].length === 2 && title === 'dependencies') {
      sectionCount += 1;
      if (sectionStart < 0) sectionStart = index + 1;
      continue;
    }
    if (sectionStart >= 0 && sectionEnd === lines.length) sectionEnd = index;
  }

  if (!queueReady && sectionCount === 0) return [];
  if (sectionCount !== 1 || sectionStart < 0) {
    throw candidateError(`${taskName} must contain exactly one ## Dependencies section`);
  }

  const entries = lines.slice(sectionStart, sectionEnd)
    .filter(({ outsideFence }) => outsideFence)
    .map(({ line }) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bullet = line.match(/^-\s+(.+?)\s*$/);
      if (!bullet) throw candidateError(`${taskName} Dependencies must contain only bullet entries`);
      const value = bullet[1].replace(/^`([^`]+)`$/, '$1').trim();
      if (!value) throw candidateError(`${taskName} contains an empty dependency`);
      return value;
    });

  if (entries.length === 1 && entries[0].toLowerCase() === 'none') return [];
  if (entries.length === 0 || entries.some((entry) => entry.toLowerCase() === 'none')) {
    throw candidateError(`${taskName} must use either - none or exact task basenames`);
  }
  const resolved = entries.map((entry) => {
    if (WORKFLOW_TASK_NAME.test(entry)) return entry;
    const legacy = !queueReady && entry.match(/^(?:Task\s+)?(\d+)$/i);
    if (!legacy) throw candidateError(`${taskName} dependencies must be exact flat task basenames`);
    const numericId = legacy[1].replace(/^0+(?=\d)/, '');
    const matches = taskNames.filter((candidate) => workflowTaskNumericPrefix(candidate) === numericId);
    if (matches.length !== 1) {
      throw candidateError(`${taskName} legacy dependency ${entry} maps to ${matches.length} task basenames`);
    }
    return matches[0];
  });
  if (new Set(resolved).size !== resolved.length) {
    throw candidateError(`${taskName} contains duplicate dependencies`);
  }
  return resolved;
}

function assertAcyclicWorkflow(tasks) {
  const dependencies = new Map(tasks.map((task) => [task.path, [...task.dependencies].sort()]));
  const state = new Map();
  const stack = [];

  function visit(taskPath) {
    state.set(taskPath, 'visiting');
    stack.push(taskPath);
    for (const dependency of dependencies.get(taskPath) || []) {
      if (state.get(dependency) === 'visiting') {
        const start = stack.indexOf(dependency);
        throw candidateError(`dependency cycle detected: ${[...stack.slice(start), dependency].join(' -> ')}`);
      }
      if (state.get(dependency) !== 'visited') visit(dependency);
    }
    stack.pop();
    state.set(taskPath, 'visited');
  }

  for (const taskPath of [...dependencies.keys()].sort()) {
    if (!state.has(taskPath)) visit(taskPath);
  }
}

function inspectWorkflowFeature(specsDir, canonicalSpecs, requestedName) {
  const featureDir = path.join(specsDir, requestedName);
  let featureLstat;
  try {
    featureLstat = fs.lstatSync(featureDir);
  } catch (error) {
    if (isMissingError(error)) return { missing: true };
    throw candidateError(`feature lstat error: ${error.message}`);
  }
  if (featureLstat.isSymbolicLink() || !featureLstat.isDirectory()) {
    throw candidateError('workflow feature entry must be a regular directory');
  }

  const canonicalFeature = fs.realpathSync(featureDir);
  if (!isPathInside(canonicalSpecs, canonicalFeature) || path.dirname(canonicalFeature) !== canonicalSpecs) {
    throw candidateError('workflow feature directory must be a direct child of specs root');
  }

  const featureName = path.basename(canonicalFeature);
  if (fs.existsSync(path.join(canonicalFeature, 'spec.json'))) {
    return { legacyPresent: true, featureName, featureDir: canonicalFeature };
  }

  const planFile = path.join(canonicalFeature, 'plan.md');
  let planLstat;
  try {
    planLstat = fs.lstatSync(planFile);
  } catch (error) {
    if (isMissingError(error)) return { missingWorkflow: true, featureName, featureDir: canonicalFeature };
    throw candidateError(`plan.md lstat error: ${error.message}`);
  }
  if (planLstat.isSymbolicLink() || !planLstat.isFile() || fs.realpathSync(planFile) !== planFile) {
    throw candidateError('plan.md must be a regular non-symlink file in the workflow feature directory');
  }
  const { workflowContract, queueReady } = workflowPlanContract(fs.readFileSync(planFile, 'utf8'));

  const taskNames = fs.readdirSync(canonicalFeature, { withFileTypes: true })
    .filter((entry) => WORKFLOW_TASK_NAME.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (taskNames.length === 0) {
    return { missingWorkflow: true, featureName, featureDir: canonicalFeature };
  }

  const tasks = taskNames.map((taskName) => {
    const taskFile = path.join(canonicalFeature, taskName);
    const taskLstat = fs.lstatSync(taskFile);
    if (taskLstat.isSymbolicLink() || !taskLstat.isFile() || fs.realpathSync(taskFile) !== taskFile) {
      throw candidateError(`${taskName} must be a regular non-symlink file in the workflow feature directory`);
    }
    const taskContent = fs.readFileSync(taskFile, 'utf8');
    return {
      path: taskName,
      status: workflowTaskStatus(taskContent, taskName),
      dependencies: workflowTaskDependencies(taskContent, taskName, taskNames, queueReady),
    };
  });
  const taskNameSet = new Set(taskNames);
  for (const task of tasks) {
    if (task.dependencies.includes(task.path)) {
      throw candidateError(`${task.path} cannot depend on itself`);
    }
    const missing = task.dependencies.find((dependency) => !taskNameSet.has(dependency));
    if (missing) throw candidateError(`${task.path} references missing dependency ${missing}`);
  }
  assertAcyclicWorkflow(tasks);
  const taskRegistry = Object.fromEntries(tasks.map((task) => [task.path, {
    status: task.status,
    dependencies: task.dependencies,
  }]));
  const allTasksDone = tasks.every((task) => task.status === 'done');
  return {
    layoutKind: 'process-v3',
    featureName,
    specsDir: canonicalSpecs,
    featureDir: canonicalFeature,
    planFile,
    stateFile: planFile,
    phase: allTasksDone ? 'done' : 'execution',
    taskRegistry,
    tasks,
    allTasksDone,
    workflowContract,
    queueReady,
  };
}

function normalizeLegacyWorkflowCandidate(candidate) {
  const registry = candidate.spec?.task_registry || {};
  const tasks = Object.entries(registry).map(([taskPath, task]) => ({
    path: taskPath,
    status: task?.status || 'pending',
  }));
  return {
    ...candidate,
    layoutKind: 'legacy-spec',
    stateFile: candidate.specFile,
    phase: candidate.spec?.current_phase || candidate.spec?.phase || 'unknown',
    taskRegistry: registry,
    tasks,
    allTasksDone: tasks.length > 0 && tasks.every((task) => task.status === 'done'),
  };
}

function inspectFeature(specsDir, canonicalSpecs, requestedName) {
  const featureDir = path.join(specsDir, requestedName);
  let featureLstat;
  try {
    featureLstat = fs.lstatSync(featureDir);
  } catch (e) {
    if (isMissingError(e)) return { missing: true };
    throw candidateError(`feature lstat error: ${e.message}`);
  }

  let canonicalFeature;
  try {
    canonicalFeature = fs.realpathSync(featureDir);
    if (!fs.statSync(featureDir).isDirectory()) {
      throw candidateError('feature entry must be a directory');
    }
  } catch (e) {
    if (e && e.code) throw e;
    throw candidateError(`feature canonicalization error: ${e.message}`);
  }
  if (canonicalFeature !== canonicalSpecs && !isPathInside(canonicalSpecs, canonicalFeature)) {
    throw candidateError('feature symlink escapes specs root');
  }
  if (path.dirname(canonicalFeature) !== canonicalSpecs) {
    throw candidateError('feature directory must resolve to a direct child of specs root');
  }

  const featureName = path.basename(canonicalFeature);
  const specFile = path.join(featureDir, 'spec.json');
  let specLstat;
  try {
    specLstat = fs.lstatSync(specFile);
  } catch (e) {
    if (isMissingError(e)) return { missingSpec: true, featureName, featureDir, canonicalFeature, specFile };
    throw candidateError(`spec.json lstat error: ${e.message}`);
  }

  let canonicalSpecFile;
  try {
    canonicalSpecFile = fs.realpathSync(specFile);
    if (!fs.statSync(specFile).isFile()) {
      throw candidateError('spec.json must be a regular file');
    }
  } catch (e) {
    if (e && e.code) throw e;
    throw candidateError(`spec.json canonicalization error: ${e.message}`);
  }
  if (canonicalSpecFile !== canonicalSpecs && !isPathInside(canonicalSpecs, canonicalSpecFile)) {
    throw candidateError('spec file symlink escapes specs root');
  }
  const expectedSpecFile = path.join(canonicalFeature, 'spec.json');
  if (canonicalSpecFile !== expectedSpecFile) {
    throw candidateError(`spec.json does not belong to feature directory ${featureName}`);
  }

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(canonicalSpecFile, 'utf8'));
  } catch (e) {
    throw candidateError(e.message);
  }
  if (!isPlainObject(spec)) throw candidateError('spec.json must contain a JSON object');
  if (typeof spec.feature_name !== 'string' || spec.feature_name.trim() !== featureName) {
    throw candidateError(`spec.json.feature_name must equal canonical feature name ${featureName}`);
  }

  return {
    featureName,
    spec,
    specsDir,
    featureDir: canonicalFeature,
    specFile: canonicalSpecFile,
    canonicalFeature,
    canonicalSpecFile,
    featureLstat,
    specLstat,
  };
}

function scanSpecs(specsDir) {
  let canonicalSpecs;
  let specsLstat = null;
  try {
    specsLstat = fs.lstatSync(specsDir);
  } catch (e) {
    if (isMissingError(e)) return { active: [], candidates: [], invalid: [], canonicalSpecs: path.resolve(specsDir) };
    return { active: [], candidates: [], invalid: [{ featureName: '<specs>', reason: `specs lstat error: ${e.message}`, specFile: specsDir }], canonicalSpecs: path.resolve(specsDir) };
  }
  try {
    canonicalSpecs = fs.realpathSync(specsDir);
  } catch (e) {
    return { active: [], candidates: [], invalid: [{ featureName: '<specs>', reason: `specs root canonicalization error: ${e.message}`, specFile: specsDir }], canonicalSpecs: path.resolve(specsDir) };
  }

  let entries;
  try {
    entries = fs.readdirSync(specsDir, { withFileTypes: true });
  } catch (e) {
    return { active: [], candidates: [], invalid: [{ featureName: '<specs>', reason: `specs directory read error: ${e.message}`, specFile: specsDir }], canonicalSpecs };
  }
  const active = [];
  const candidates = [];
  const invalid = [];
  const seenCanonicalFeatures = new Set();
  const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of sorted) {
    try {
      const candidate = inspectFeature(specsDir, canonicalSpecs, entry.name);
      if (candidate.missing) {
        invalid.push({
          featureName: entry.name,
          reason: 'feature entry disappeared during scan',
          specFile: path.join(specsDir, entry.name, 'spec.json'),
        });
        continue;
      }
      if (candidate.missingSpec) {
        continue;
      }
      if (seenCanonicalFeatures.has(candidate.canonicalFeature)) continue;
      seenCanonicalFeatures.add(candidate.canonicalFeature);
      candidates.push(candidate);
      if (candidate.spec.status === 'in_progress' || candidate.spec.status === 'in-progress') {
        active.push(candidate);
      }
    } catch (e) {
      invalid.push({
        featureName: entry.name,
        reason: e.message,
        specFile: path.join(specsDir, entry.name, 'spec.json'),
      });
    }
  }
  return { active, candidates, invalid, canonicalSpecs };
}

function findAllSpecCandidates(projectRoot, runtime) {
  let specsDir;
  try {
    specsDir = specsDirectory(projectRoot, runtime);
  } catch (error) {
    const wrapped = new Error(`Invalid spec candidates: <specs>: ${error.message}`);
    wrapped.code = 'INVALID_SPECS';
    wrapped.invalid = [{ featureName: '<specs>', reason: error.message, specFile: path.resolve(projectRoot, 'specs') }];
    throw wrapped;
  }
  const scanned = scanSpecs(specsDir);
  if (scanned.invalid.length > 0) {
    const error = new Error(`Invalid spec candidates: ${scanned.invalid.map((item) => `${item.featureName}: ${item.reason}`).join('; ')}`);
    error.code = 'INVALID_SPECS';
    error.invalid = scanned.invalid;
    throw error;
  }
  return scanned.candidates.sort((left, right) => left.featureName.localeCompare(right.featureName));
}

function findAllActiveSpecs(projectRoot, runtime) {
  let specsDir;
  try {
    specsDir = specsDirectory(projectRoot, runtime);
  } catch (error) {
    const wrapped = new Error(`Invalid spec candidates: <specs>: ${error.message}`);
    wrapped.code = 'INVALID_SPECS';
    wrapped.invalid = [{ featureName: '<specs>', reason: error.message, specFile: path.resolve(projectRoot, 'specs') }];
    throw wrapped;
  }
  const { active, invalid } = scanSpecs(specsDir);
  if (invalid.length > 0) {
    const error = new Error(`Invalid spec candidates: ${invalid.map((item) => `${item.featureName}: ${item.reason}`).join('; ')}`);
    error.code = 'INVALID_SPECS';
    error.invalid = invalid;
    throw error;
  }
  return active;
}

function isPathInsideLegacy(parent, child) {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel);
}

function explicitTargetValue(value) {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Normalize host-provided feature targets without making runtime adapters
 * guess from the first active directory. The resolver remains the authority
 * for containment, existence, JSON, and ambiguity checks.
 */
function extractExplicitTarget(...sources) {
  for (const source of sources.flat()) {
    if (!source || typeof source !== 'object') continue;

    for (const key of ['explicitFeature', 'featureName', 'feature']) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        return { explicitFeature: explicitTargetValue(source[key]) };
      }
    }
    for (const key of ['explicitPath', 'specPath', 'spec_path', 'featurePath']) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        return { explicitPath: explicitTargetValue(source[key]) };
      }
    }

    const target = source.target;
    if (target && typeof target === 'object') {
      const nested = extractExplicitTarget(target);
      if (nested) return nested;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'target')) {
      const targetValue = explicitTargetValue(target);
      return /[\\/]/.test(targetValue) || /(?:^|[\\/])spec\.json$/.test(targetValue)
        ? { explicitPath: targetValue }
        : { explicitFeature: targetValue };
    }
  }
  return null;
}

function lstatOptional(p) {
  try {
    const s = fs.lstatSync(p);
    return { exists: true, stat: s, isSymlink: s.isSymbolicLink(), error: null };
  } catch (e) {
    if (isMissingError(e)) return { exists: false, stat: null, isSymlink: false, error: null };
    return { exists: false, stat: null, isSymlink: false, error: e };
  }
}

function resolveActiveSpec({ projectRoot, runtime, explicitFeature, explicitPath, target } = {}) {
  if (!projectRoot) throw new TypeError('projectRoot required');
  const rt = runtime || {};
  const normalizedTarget = extractExplicitTarget(target);
  if (explicitFeature === undefined && normalizedTarget
    && Object.prototype.hasOwnProperty.call(normalizedTarget, 'explicitFeature')) {
    explicitFeature = normalizedTarget.explicitFeature;
  }
  if (explicitPath === undefined && normalizedTarget
    && Object.prototype.hasOwnProperty.call(normalizedTarget, 'explicitPath')) {
    explicitPath = normalizedTarget.explicitPath;
  }
  const hasExplicitFeature = explicitFeature !== undefined && explicitFeature !== null;
  const hasExplicitPath = explicitPath !== undefined && explicitPath !== null;
  const hasExplicitTarget = hasExplicitFeature || hasExplicitPath;
  let specsDir;
  try {
    specsDir = specsDirectory(projectRoot, rt);
  } catch (error) {
    return {
      error: hasExplicitTarget ? 'explicit_malformed' : 'invalid_specs',
      candidates: ['<specs>'],
      explicitFeature,
      explicitPath,
      reason: error.message,
    };
  }
  let canonicalSpecs;
  const specsLstat = lstatOptional(specsDir);
  if (specsLstat.error) {
    if (hasExplicitTarget) {
      return { error: 'explicit_malformed', explicitFeature, explicitPath, reason: `specs lstat error: ${specsLstat.error.message}` };
    }
    return { error: 'invalid_specs', candidates: ['<specs>'], invalid: [{ featureName: '<specs>', reason: `specs lstat error: ${specsLstat.error.message}`, specFile: specsDir }], reason: `Invalid spec JSON: <specs>: specs lstat error: ${specsLstat.error.message}` };
  }
  if (!specsLstat.exists) {
    canonicalSpecs = path.resolve(specsDir);
  } else {
    try {
      canonicalSpecs = fs.realpathSync(specsDir);
    } catch (e) {
      if (hasExplicitTarget) {
        return { error: 'explicit_malformed', explicitFeature, explicitPath, reason: `specs root canonicalization error: ${e.message}` };
      }
      return { error: 'invalid_specs', candidates: ['<specs>'], invalid: [{ featureName: '<specs>', reason: `specs root canonicalization error: ${e.message}`, specFile: specsDir }], reason: `Invalid spec JSON: <specs>: specs root canonicalization error: ${e.message}` };
    }
  }

  if (hasExplicitFeature) {
    if (typeof explicitFeature !== 'string' || explicitFeature.trim() === '' || explicitFeature.includes('/') || explicitFeature.includes('\\') || explicitFeature.includes('..')) {
      return { error: 'explicit_malformed', explicitFeature, reason: `malformed feature name: ${explicitFeature}` };
    }
    const featureDir = path.join(specsDir, explicitFeature);
    const resolvedFeature = path.resolve(featureDir);
    if (!isPathInsideLegacy(path.resolve(specsDir), resolvedFeature) && resolvedFeature !== path.resolve(specsDir)) {
      return { error: 'explicit_malformed', explicitFeature, reason: 'feature path escapes specs root' };
    }
    if (path.relative(path.resolve(specsDir), resolvedFeature) !== explicitFeature) {
      return { error: 'explicit_malformed', explicitFeature, reason: 'feature name does not canonicalize inside specs root' };
    }
    try {
      const candidate = inspectFeature(specsDir, canonicalSpecs, explicitFeature);
      if (candidate.missing || candidate.missingSpec) {
        return { error: 'explicit_not_found', explicitFeature, reason: `spec not found for feature ${explicitFeature}` };
      }
      if (candidate.featureName !== explicitFeature) {
        return {
          error: 'explicit_malformed',
          explicitFeature,
          reason: `feature directory resolves to canonical feature ${candidate.featureName}`,
        };
      }
      return candidate;
    } catch (e) {
      return { error: 'explicit_malformed', explicitFeature, reason: e.message };
    }
  }

  if (hasExplicitPath) {
    if (typeof explicitPath !== 'string' || explicitPath.trim() === '') {
      return { error: 'explicit_malformed', explicitPath, reason: 'empty explicit path' };
    }
    let specFile = explicitPath;
    if (!path.isAbsolute(specFile)) {
      specFile = path.resolve(projectRoot, specFile);
    } else {
      specFile = path.resolve(specFile);
    }
    try {
      const st = fs.lstatSync(specFile);
      if (st.isDirectory()) {
        specFile = path.join(specFile, 'spec.json');
      } else if (st.isSymbolicLink()) {
        try {
          if (fs.statSync(specFile).isDirectory()) specFile = path.join(specFile, 'spec.json');
        } catch (e) {
          if (!isMissingError(e)) throw e;
        }
      }
    } catch (e) {
      if (!isMissingError(e)) {
        return { error: 'explicit_malformed', explicitPath, reason: `explicit path stat error: ${e.message}` };
      }
      // If lstat is missing, the candidate is handled as an explicit not-found below.
    }
    const featureDir = path.dirname(specFile);
    if (!isPathInsideLegacy(path.resolve(specsDir), path.resolve(featureDir)) && path.resolve(featureDir) !== path.resolve(specsDir)) {
      return { error: 'explicit_malformed', explicitPath, reason: 'explicit path escapes specs root' };
    }
    const rel = path.relative(path.resolve(specsDir), path.resolve(specFile));
    const segs = rel.split(path.sep);
    if (segs.length !== 2 || segs[1] !== 'spec.json') {
      return { error: 'explicit_malformed', explicitPath, reason: 'explicit path must be <specs>/<feature>/spec.json or <specs>/<feature>' };
    }
    try {
      const candidate = inspectFeature(specsDir, canonicalSpecs, segs[0]);
      if (candidate.missing || candidate.missingSpec) {
        return { error: 'explicit_not_found', explicitPath, reason: `spec not found at ${explicitPath}` };
      }
      if (candidate.featureName !== segs[0]) {
        return {
          error: 'explicit_malformed',
          explicitPath,
          reason: `explicit path resolves to canonical feature ${candidate.featureName}, not ${segs[0]}`,
        };
      }
      return candidate;
    } catch (e) {
      return { error: 'explicit_malformed', explicitPath, reason: e.message };
    }
  }

  const { active, invalid } = scanSpecs(specsDir);
  if (invalid.length > 0) {
    return {
      error: 'invalid_specs',
      candidates: invalid.map((i) => i.featureName),
      invalid,
      reason: `Invalid spec JSON: ${invalid.map((i) => `${i.featureName}: ${i.reason}`).join('; ')}`,
    };
  }
  active.sort((left, right) => left.featureName.localeCompare(right.featureName));
  if (active.length === 0) return null;
  if (active.length === 1) return active[0];
  return {
    error: 'multiple_active',
    candidates: active.map((a) => a.featureName),
    active,
    reason: `Multiple active specs found: ${active.map((a) => a.featureName).join(', ')}. Provide explicit feature.`,
  };
}

/**
 * Resolve one persisted feature identity. Explicit host targets are inspected
 * directly and never scan siblings; only the no-target path performs a global
 * persisted-candidate scan and therefore owns ambiguity/invalid-sibling errors.
 */
function resolvePersistedSpec({ projectRoot, runtime, explicitFeature, explicitPath, target } = {}) {
  const normalized = extractExplicitTarget(
    target,
    explicitFeature !== undefined ? { explicitFeature } : null,
    explicitPath !== undefined ? { explicitPath } : null,
  );
  if (normalized) {
    const value = Object.prototype.hasOwnProperty.call(normalized, 'explicitFeature')
      ? normalized.explicitFeature
      : normalized.explicitPath;
    if (value === null || value === undefined) {
      return { error: 'explicit_malformed', ...normalized, reason: 'explicit target must be a non-empty string' };
    }
    return resolveActiveSpec({ projectRoot, runtime, ...normalized });
  }
  try {
    const candidates = findAllSpecCandidates(projectRoot, runtime);
    if (candidates.length === 0) return null;
    // One packet resolves on its own terms. Closeout approval is claimed against a
    // finished spec, so status must never decide identity here.
    if (candidates.length === 1) return candidates[0];
    // This path serves closeout approval, so only a packet actually claiming closeout is
    // a real rival. Counting finished history as ambiguity is what made the gate
    // unsatisfiable in a repository that had simply accumulated features.
    const { isDurableCloseout } = require('./spec-final-state.cjs');
    const claiming = candidates.filter((candidate) => isDurableCloseout(candidate.spec));
    if (claiming.length === 1) return claiming[0];
    if (claiming.length === 0) return null;
    return {
      error: 'multiple_persisted',
      candidates: claiming.map((candidate) => candidate.featureName),
      reason: `Multiple persisted specs found: ${claiming.map((candidate) => candidate.featureName).join(', ')}. Provide explicit feature.`,
    };
  } catch (error) {
    return {
      error: 'invalid_specs',
      candidates: Array.isArray(error.invalid)
        ? error.invalid.map((entry) => entry.featureName)
        : ['<specs>'],
      invalid: error.invalid || [],
      reason: error.message,
    };
  }
}

function scanWorkflowFeatures(specsDir) {
  let canonicalSpecs;
  try {
    canonicalSpecs = fs.realpathSync(specsDir);
  } catch (error) {
    if (isMissingError(error)) return { active: [], candidates: [], invalid: [] };
    return { active: [], candidates: [], invalid: [{ featureName: '<specs>', reason: error.message }] };
  }

  const active = [];
  const candidates = [];
  const invalid = [];
  const entries = fs.readdirSync(canonicalSpecs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    try {
      const candidate = inspectWorkflowFeature(canonicalSpecs, canonicalSpecs, entry.name);
      if (candidate.missing || candidate.missingWorkflow || candidate.legacyPresent) continue;
      candidates.push(candidate);
      if (!candidate.allTasksDone) active.push(candidate);
    } catch (error) {
      invalid.push({ featureName: entry.name, reason: error.message, planFile: path.join(canonicalSpecs, entry.name, 'plan.md') });
    }
  }
  return { active, candidates, invalid };
}

function explicitWorkflowFeatureName({ projectRoot, specsDir, explicitFeature, explicitPath }) {
  if (explicitFeature !== undefined && explicitFeature !== null) {
    if (typeof explicitFeature !== 'string' || explicitFeature.trim() === ''
      || explicitFeature.includes('/') || explicitFeature.includes('\\') || explicitFeature.includes('..')) {
      return { error: 'explicit_malformed', explicitFeature, reason: `malformed feature name: ${explicitFeature}` };
    }
    return { featureName: explicitFeature.trim() };
  }

  if (typeof explicitPath !== 'string' || explicitPath.trim() === '') {
    return { error: 'explicit_malformed', explicitPath, reason: 'empty explicit path' };
  }
  const targetPath = path.resolve(projectRoot, explicitPath);
  let targetLstat;
  try {
    targetLstat = fs.lstatSync(targetPath);
  } catch (error) {
    return isMissingError(error)
      ? { error: 'explicit_not_found', explicitPath, reason: `workflow target not found at ${explicitPath}` }
      : { error: 'explicit_malformed', explicitPath, reason: `explicit path stat error: ${error.message}` };
  }
  if (targetLstat.isSymbolicLink()) {
    return { error: 'explicit_malformed', explicitPath, reason: 'explicit workflow target must not be a symlink' };
  }

  let featureDir;
  if (targetLstat.isDirectory()) {
    featureDir = targetPath;
  } else if (targetLstat.isFile()
    && (path.basename(targetPath) === 'plan.md' || WORKFLOW_TASK_NAME.test(path.basename(targetPath)))) {
    featureDir = path.dirname(targetPath);
  } else {
    return { error: 'explicit_malformed', explicitPath, reason: 'explicit workflow path must target a feature directory, plan.md, or flat task-*.md' };
  }
  const relative = path.relative(path.resolve(specsDir), featureDir);
  if (!relative || relative.includes(path.sep) || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return { error: 'explicit_malformed', explicitPath, reason: 'explicit workflow path must target a direct child of specs root' };
  }
  return { featureName: relative };
}

/**
 * Resolve the authoring/execution workflow visible to prompt and Stop hooks.
 * Persisted spec resolution remains unchanged; process-v3 is an additive adapter
 * and never becomes completion-authority input by way of findAllSpecCandidates.
 */
function resolveWorkflowCandidate({ projectRoot, runtime, explicitFeature, explicitPath, target, includeCompleted = false } = {}) {
  if (!projectRoot) throw new TypeError('projectRoot required');
  const normalized = extractExplicitTarget(
    target,
    explicitFeature !== undefined ? { explicitFeature } : null,
    explicitPath !== undefined ? { explicitPath } : null,
  );
  if (normalized) {
    if (Object.prototype.hasOwnProperty.call(normalized, 'explicitFeature')) explicitFeature = normalized.explicitFeature;
    if (Object.prototype.hasOwnProperty.call(normalized, 'explicitPath')) explicitPath = normalized.explicitPath;
  }
  const hasExplicit = explicitFeature !== undefined && explicitFeature !== null
    || explicitPath !== undefined && explicitPath !== null;
  let specsDir;
  try {
    specsDir = specsDirectory(projectRoot, runtime || {});
  } catch (error) {
    return { error: hasExplicit ? 'explicit_malformed' : 'invalid_specs', candidates: ['<specs>'], reason: error.message };
  }

  if (hasExplicit) {
    const legacyDirect = resolveActiveSpec({ projectRoot, runtime, explicitFeature, explicitPath });
    if (legacyDirect && !legacyDirect.error) return normalizeLegacyWorkflowCandidate(legacyDirect);
    const identity = explicitWorkflowFeatureName({ projectRoot, specsDir, explicitFeature, explicitPath });
    if (identity.error) return identity;

    const legacy = resolveActiveSpec({ projectRoot, runtime, explicitFeature: identity.featureName });
    if (legacy && !legacy.error) return normalizeLegacyWorkflowCandidate(legacy);
    if (legacy && legacy.error !== 'explicit_not_found') return legacy;

    let canonicalSpecs;
    try {
      canonicalSpecs = fs.realpathSync(specsDir);
      const candidate = inspectWorkflowFeature(specsDir, canonicalSpecs, identity.featureName);
      if (candidate.missing || candidate.missingWorkflow || candidate.legacyPresent) {
        return { error: 'explicit_not_found', explicitFeature: identity.featureName, explicitPath, reason: `workflow not found for feature ${identity.featureName}` };
      }
      return candidate;
    } catch (error) {
      return { error: 'explicit_malformed', explicitFeature: identity.featureName, explicitPath, reason: error.message };
    }
  }

  let legacyActive;
  try {
    const legacyCandidates = includeCompleted
      ? findAllSpecCandidates(projectRoot, runtime || {})
      : findAllActiveSpecs(projectRoot, runtime || {});
    legacyActive = legacyCandidates.map(normalizeLegacyWorkflowCandidate);
  } catch (error) {
    return {
      error: 'invalid_specs',
      candidates: Array.isArray(error.invalid) ? error.invalid.map((entry) => entry.featureName) : ['<specs>'],
      invalid: error.invalid || [],
      reason: error.message,
    };
  }
  const workflow = scanWorkflowFeatures(specsDir);
  if (workflow.invalid.length > 0) {
    return {
      error: 'invalid_specs',
      candidates: workflow.invalid.map((entry) => entry.featureName),
      invalid: workflow.invalid,
      reason: `Invalid workflow candidates: ${workflow.invalid.map((entry) => `${entry.featureName}: ${entry.reason}`).join('; ')}`,
    };
  }
  const workflowCandidates = includeCompleted ? workflow.candidates : workflow.active;
  const active = [...legacyActive, ...workflowCandidates]
    .sort((left, right) => left.featureName.localeCompare(right.featureName));
  if (active.length === 0) return null;
  if (active.length === 1) return active[0];
  return {
    error: includeCompleted ? 'multiple_persisted' : 'multiple_active',
    candidates: active.map((candidate) => candidate.featureName),
    active,
    reason: `Multiple ${includeCompleted ? 'persisted' : 'active'} workflows found: ${active.map((candidate) => candidate.featureName).join(', ')}. Provide explicit feature.`,
  };
}

/**
 * Narrow a Stop-gate ambiguity without changing legacy persisted-spec rules.
 * A single unfinished process-v3 packet is the current workflow; completed
 * packets are historical. If every process-v3 packet is complete, return the
 * set so the gate can revalidate all receipts instead of blocking on identity.
 */
function refineWorkflowGateResolution(resolved) {
  if (!resolved || resolved.error !== 'multiple_persisted' || !Array.isArray(resolved.active)) {
    return resolved;
  }
  const candidates = resolved.active;
  if (candidates.length === 0) return resolved;

  // Which packet still has work decides this, not which layout it uses: a repository of
  // legacy packets was permanently ambiguous only because the check below used to sit
  // here and reject the whole set on sight.
  const unfinished = candidates.filter((candidate) => !candidate.allTasksDone);
  if (unfinished.length === 1) return unfinished[0];
  if (unfinished.length > 1) {
    return {
      ...resolved,
      error: 'multiple_active',
      candidates: unfinished.map((candidate) => candidate.featureName),
      active: unfinished,
      reason: `Multiple active workflows found: ${unfinished.map((candidate) => candidate.featureName).join(', ')}. Provide explicit feature.`,
    };
  }
  // The bulk-audit branch exits before the semantic-digest, FLASH_UNVERIFIED,
  // feature-receipt, and completion-policy layers that the single-candidate path runs, so
  // only process-first packets may reach it. Anything else keeps the existing ambiguity.
  if (candidates.some((candidate) => candidate.layoutKind !== 'process-v3')) return resolved;
  return {
    layoutKind: 'process-v3-completed-set',
    candidates,
    specsDir: candidates[0].specsDir,
    allTasksDone: true,
  };
}

module.exports = {
  annotatedMarkdownLines,
  specsDirectory,
  findAllActiveSpecs,
  findAllSpecCandidates,
  extractExplicitTarget,
  resolveActiveSpec,
  resolvePersistedSpec,
  resolveWorkflowCandidate,
  refineWorkflowGateResolution,
};
