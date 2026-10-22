'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PROVENANCE = require('./provenance.cjs');

const PLACEHOLDER_TOKENS = new Set(['TBD','TODO','N/A','NA','NONE','UNKNOWN','PENDING','PLACEHOLDER','REPLACE_ME','-','?']);
const TAP_METADATA_HEADING_RE = /^\s*#\s*(?:(?:tests?|suites?|pass|fail|cancel(?:l)?ed|skipped|todo)\s+\d+|duration(?:_ms)?\s+\d+(?:\.\d+)?)\s*$/i;
const ARTIFACT_DECLARATION_KEY = 'artifacts';
const TASK_ARTIFACT_KEYS = Object.freeze(['artifact', 'artifact_ref', 'artifact_path']);
const PROVENANCE_VALUE_RE = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const PROSE_RECEIPT_FIELD_RE = /^\s*(?:Notes?|Description|Command(?:\(s\))?)\s*:/i;
function isPlaceholderToken(value) {
  if (typeof value !== 'string') return true;
  const v = value.trim();
  if (v === '') return true;
  if (/^\{\{.*\}\}$/.test(v)) return true;
  if (/^<.*>$/.test(v)) return true;
  const upper = v.toUpperCase();
  if (PLACEHOLDER_TOKENS.has(upper)) return true;
  return false;
}
function isTapMetadataHeading(line) {
  return typeof line === 'string' && TAP_METADATA_HEADING_RE.test(line);
}

function hasConcreteArtifactDeclaration(value) {
  if (typeof value === 'string') return !isPlaceholderToken(value);
  if (Array.isArray(value)) return value.some(hasConcreteArtifactDeclaration);
  return Boolean(value && typeof value === 'object');
}

function isSafeArtifactPath(value) {
  if (typeof value !== 'string' || value !== value.trim() || isPlaceholderToken(value)) return false;
  if (/^(?:[a-z]:[\\/]|[\\/]|https?:\/\/)/i.test(value)) return false;
  return !value.split(/[\\/]+/).includes('..');
}

function isPathInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function stableStat(stat) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs?.toString(), stat.ctimeNs?.toString()].join(':');
}

function hashValidatedArtifact(root, relativePath, expectedHash) {
  if (!isSafeArtifactPath(relativePath) || typeof root !== 'string' || root.trim() === '') return false;
  const rootPath = path.resolve(root);
  const target = path.resolve(rootPath, relativePath);
  if (!isPathInside(rootPath, target)) return false;

  const segments = path.relative(rootPath, target).split(path.sep).filter(Boolean);
  let current = rootPath;
  try {
    for (let index = 0; index < segments.length; index += 1) {
      current = path.join(current, segments[index]);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return false;
      if (index < segments.length - 1 && !stat.isDirectory()) return false;
    }
    const rootReal = fs.realpathSync(rootPath);
    const targetReal = fs.realpathSync(target);
    if (!isPathInside(rootReal, targetReal)) return false;
    const before = fs.statSync(target);
    if (!before.isFile()) return false;
    const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
    const fd = fs.openSync(target, flags);
    try {
      const opened = fs.fstatSync(fd);
      if (!opened.isFile() || stableStat(opened) !== stableStat(before)) return false;
      const bytes = fs.readFileSync(fd);
      const after = fs.fstatSync(fd);
      if (stableStat(after) !== stableStat(opened)) return false;
      const actual = crypto.createHash('sha256').update(bytes).digest('hex');
      return actual.toLowerCase() === String(expectedHash).toLowerCase();
    } finally {
      fs.closeSync(fd);
    }
  } catch (_) {
    return false;
  }
}

function artifactDeclaration(task = {}) {
  if (Object.prototype.hasOwnProperty.call(task, ARTIFACT_DECLARATION_KEY)) {
    const artifacts = task[ARTIFACT_DECLARATION_KEY];
    const unique = Array.isArray(artifacts) ? new Set(artifacts).size === artifacts.length : false;
    return {
      declared: true,
      valid: Array.isArray(artifacts)
        && artifacts.length > 0
        && unique
        && artifacts.every(isSafeArtifactPath),
      paths: Array.isArray(artifacts) ? [...artifacts] : [],
    };
  }

  // Read legacy aliases only for compatibility with pre-P0 task registries.
  const legacyKey = TASK_ARTIFACT_KEYS.find((key) => hasConcreteArtifactDeclaration(task?.[key]));
  const legacyValue = legacyKey ? task[legacyKey] : null;
  const legacyPaths = typeof legacyValue === 'string'
    ? [legacyValue]
    : Array.isArray(legacyValue) && legacyValue.every((value) => typeof value === 'string')
      ? [...legacyValue]
      : [];
  return {
    declared: Boolean(legacyKey),
    valid: !legacyKey || (legacyPaths.length > 0 && legacyPaths.every(isSafeArtifactPath)),
    legacy: true,
    paths: legacyPaths,
  };
}

function normalizeProvenanceValue(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^sha256:/i, '');
  return normalized || null;
}

function isConcreteProvenanceValue(value) {
  return PROVENANCE_VALUE_RE.test(normalizeProvenanceValue(value) || '');
}

function firstDefined(source, keys) {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  }
  return undefined;
}

function receiptValidatorOptions(task = {}, {
  requireProvenanceBinding = false,
  requireExplicitBinding = false,
  runtimeContext,
} = {}) {
  const declaration = artifactDeclaration(task);
  let trusted = null;
  if (runtimeContext !== undefined && PROVENANCE.isTrustedRuntimeContext(runtimeContext)) {
    try { trusted = PROVENANCE.recomputeRuntimeContext(runtimeContext); } catch (_) { trusted = null; }
  }
  return {
    requireArtifactHash: declaration.declared,
    artifactDeclarationValid: declaration.valid,
    artifactPaths: declaration.paths,
    artifactRoot: trusted?.project_root || null,
    verifyArtifactBytes: Boolean(trusted?.project_root),
    expectedProvenance: trusted ? { base: trusted.base, head: trusted.head } : null,
    requireProvenanceBinding: requireProvenanceBinding || (runtimeContext !== undefined && runtimeContext !== null) || requireExplicitBinding,
  };
}

function sha256ValuesFromLine(line) {
  const values = [];
  const labels = [...line.matchAll(/\b(?:artifact[_-])?sha-?256\s*:/gi)];
  for (const label of labels) {
    const remainder = line.slice(label.index + label[0].length);
    const token = remainder.match(/^\s*([^\s)\],;`]+)/);
    values.push(token ? token[1].trim() : '');
  }
  return values;
}

function artifactPathText(line) {
  return line
    .replace(/^\s*Artifacts?\s*:\s*/i, '')
    .replace(/^\s*Artifact\s+produced\s*:?\s*/i, '')
    .replace(/\b(?:artifact[_-])?sha-?256\s*:\s*[^\s)\],;`]+/gi, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?:\s*[+,;]\s*)+$/, '')
    .trim();
}

function parseArtifactDeclarations(body) {
  const declarations = [];
  let previous = null;
  for (const raw of body.split('\n')) {
    if (PROSE_RECEIPT_FIELD_RE.test(raw)) {
      previous = null;
      continue;
    }
    const isDeclaration = /^\s*Artifacts?\s*:/i.test(raw)
      || /^\s*Artifact\s+produced\b/i.test(raw)
      || /^\s*artifact[_-]?sha-?256\s*:/i.test(raw);
    if (isDeclaration) {
      previous = {
        raw,
        pathText: artifactPathText(raw),
        hashes: sha256ValuesFromLine(raw),
      };
      declarations.push(previous);
      continue;
    }
    if (previous && /^\s*sha-?256\s*:/i.test(raw)) {
      previous.hashes.push(...sha256ValuesFromLine(raw));
      continue;
    }
    if (raw.trim() !== '') previous = null;
  }
  return declarations;
}

function hasExplicitFailure(body) {
  if (typeof body !== 'string') return false;
  const lines = body.split('\n');
  for (const raw of lines) {
    if (PROSE_RECEIPT_FIELD_RE.test(raw)) continue;
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    // 1. Zero execution (structured, anchored): zero tests, zero passing, or no collection.
    if (/^\s*(?:#|ℹ)?\s*tests?\s+0\b/i.test(raw)) return true;
    if (/^\s*(?:#|ℹ)?\s*0\s+tests?\b/i.test(raw)) return true;
    if (/^\s*(?:#|ℹ)?\s*tests?\s+run\s*:\s*0\b/i.test(raw)) return true;
    if (/^\s*0\s+(?:passing|passed)\b/i.test(raw)) return true;
    if (/^\s*Tests?\s*:\s*0\s+(?:passing|passed)\b/i.test(raw)) return true;
    if (/^\s*Tests?\s+passed\s*:\s*0\b/i.test(raw)) return true;
    if (/^\s*Passed\s*:\s*0\b/i.test(raw)) return true;
    if (/^\s*Tests:\s*0\s+total\b/i.test(raw)) return true;
    if (/^\s*collected\s+0\s+items\b/i.test(raw)) return true;
    if (/^\s*No tests? found\b/i.test(raw)) return true;
    // 2. Cancellation (optional marker #/ℹ, cancelled/canceled, both orders, count >0; 0 passes)
    if (/^\s*(?:#|ℹ)?\s*cancel(?:l)?ed\s*[:\s]*[1-9]\d*\b/i.test(raw)) return true;
    if (/^\s*(?:#|ℹ)?\s*[1-9]\d*\s+cancel(?:l)?ed\b/i.test(raw)) return true;
    // 3. Suite / file failures: Test Suites: N failed, Test Files N failed (N>0)
    if (/^\s*Test Suites?:?\s*[1-9]\d*\s+failed\b/i.test(raw)) return true;
    if (/^\s*Test Files?:?\s*[1-9]\d*\s+failed\b/i.test(raw)) return true;
    if (/^\s*Test Suites?:?\s*0\s+failed\b[^\r\n]*\b0\s+passed\b/i.test(raw)) return true;
    if (/^\s*Test Files?:?\s*0\s+failed\b[^\r\n]*\b0\s+passed\b/i.test(raw)) return true;
    // 4. Pytest short-summary entries (anchored to a Python test path)
    if (/^\s*FAILED[ \t]+\S+\.py(?:::\S+)?(?:[ \t]+-[^\r\n]*)?\s*$/i.test(raw)) return true;
    // 5. Runner FAIL (anchored exact FAIL, horizontal whitespace/colon/end; --- FAIL:)
    if (/^\s*FAIL(?:[ \t]+|:|$)/.test(raw)) return true;
    if (/^\s*---\s*FAIL:/.test(raw)) return true;
    // 6. Error/failure summaries (anchored, N>0; prose Notes/Description/Command skipped)
    if (/^\s*[1-9]\d*\s+errors?\b/i.test(raw)) return true;
    if (/^\s*errors?\s*[:\s]*[1-9]\d*\b/i.test(raw)) return true;
    if (/^\s*failures?\s*[:\s]*[1-9]\d*\b/i.test(raw)) return true;
    if (/^\s*failure\s+summary\s*[:.]?\s*$/i.test(raw)) return true;
    if (/^\s*Found\s+[1-9]\d*\s+errors?\b/i.test(raw)) return true;
    if (/^\s*failureCount\s*:\s*[1-9]\d*\s*[,;]?\s*$/i.test(raw)) return true;
    if (/^\s*ERROR\s*$/i.test(raw)) return true;
    if (/^\s*ERROR\s+collecting\b/i.test(raw)) return true;
    if (/^\s*Tests run\s*:/i.test(raw) && (/\b(?:Failures?|Errors?)\s*[:=]\s*[1-9]/i.test(raw) || /\b0\s+(?:tests?|passing|passed)\b/i.test(raw))) return true;
    // Maven Surefire's structured failure lines; do not treat arbitrary [ERROR] prose as failure.
    if (/^\s*\[ERROR\]\s+Tests run:\s*\d+\b[^\r\n]*\b(?:Failures?|Errors?):\s*[1-9]\d*\b/i.test(raw)) return true;
    if (/^\s*\[ERROR\]\s+Failed to execute goal\b/i.test(raw)) return true;
    // 7. Gradle (anchored, optional)
    if (/^\s*\d+\s+tests?\s+completed,\s*[1-9]\d*\s+failed\b/i.test(raw)) return true;
    // Existing structured checks (preserve, anchored where needed to avoid prose false positive)
    if (/^\s*Tests?\s+failed\s*$/i.test(raw)) return true;
    if (/^\s*Tests?\s+failed\s*:\s*[1-9]\d*\b/i.test(raw)) return true;
    if (/\b(?:Verification|Result|Status|Outcome)\s*:\s*FAIL(?:ED|URE)?\b/i.test(raw)) return true;
    if (/^\s*FAIL\s*$/i.test(trimmed)) return true;
    if (/^\s*FAIL\s*:/i.test(trimmed)) return true;
    if (/^\s*FAILED\s*$/i.test(trimmed)) return true;
    if (/^\s*FAILED\s*:/i.test(trimmed)) return true;
    if (/^\s*FAILURE\s*$/i.test(trimmed)) return true;
    if (/^\s*FAILURE\s*:/i.test(trimmed)) return true;
    if (/^\s*one\s+failing(?:\s+(?:test|tests|suite|suites))?\s*[,:]?\s*$/i.test(raw)) return true;
    if (/^\s*(?:#|ℹ)?\s*fail\s+[1-9]/i.test(raw)) return true;
    if (/^\s*not ok\b/i.test(raw)) return true;
    if (/^\s*Tests\s*:?\s*[1-9]/i.test(raw) && /\bfailed\b/i.test(raw)) return true;
    if (/^\s*\d+\s+failed\b/i.test(raw)) {
      const m = raw.match(/^\s*(\d+)\s+failed\b/i);
      if (m && parseInt(m[1], 10) !== 0) return true;
    }
    if (/exit\s+code\s*[:=]?\s*[1-9]/i.test(raw)) return true;
  }
  return false;
}
function executionPolicy({ flash = false, parallel = false } = {}) {
  if (flash && parallel) {
    return {
      allowed: false,
      failFast: true,
      mode: 'flash-parallel-conflict',
      reason: '--flash cannot be combined with --parallel; no execution starts',
    };
  }
  return {
    allowed: true,
    failFast: false,
    mode: parallel ? 'parallel' : flash ? 'flash' : 'standard',
    reason: null,
  };
}

// Every other section of a task file writes its fields as list items — the Verification
// Plan's own `- Command:` sits a few lines above the Receipt — so continuing that house
// style inside the Receipt is the natural mistake, and it used to fail five checks at
// once with a message that pointed at the content instead of the dash. Accept either
// form. The receipt body is cut to its own `## Receipt` section, so this cannot pick up
// the Verification Plan's fields.
const RECEIPT_FIELD_PREFIX = '\\s*(?:[-*+]\\s+)?';

function receiptFieldPattern(name, tail = '\\s*:', flags = '') {
  return new RegExp(`^${RECEIPT_FIELD_PREFIX}${name}${tail}`, flags);
}

function validateCanonicalReceipt(body, options = {}) {
  if (typeof body !== 'string') return ['verification_state'];
  const failures = [];
  const addFailure = (failure) => {
    if (!failures.includes(failure)) failures.push(failure);
  };
  // Fail-closed on placeholders anywhere — provenance, command, or artifact must not be templated
  if (/\{\{[^}]+\}\}/.test(body)) {
    addFailure('placeholder');
    // placeholder also implies missing concrete provenance/command; keep explicit failures for mapping
  }
  // Explicit failure outcome anywhere in body must make canonical validator fail (structured only)
  if (hasExplicitFailure(body)) {
    addFailure('verification_state');
  }
  // Unambiguous verification state: must be Verification: PASS exactly
  if (!receiptFieldPattern('Verification', '\\s*:\\s*PASS\\s*$', 'm').test(body)) {
    addFailure('verification_state');
  }
  // Command must be present with non-empty concrete value on same line, not placeholder
  const cmdLine = body.split('\n').find((l) => receiptFieldPattern('Command(?:\\(s\\))?', '\\s*:', 'm').test(l)) || null;
  if (!cmdLine || !receiptFieldPattern('Command(?:\\(s\\))?', '\\s*:[ \\t]*\\S', 'm').test(cmdLine)) {
    addFailure('command');
  } else {
    const m = cmdLine.match(receiptFieldPattern('Command(?:\\(s\\))?', '\\s*:[ \\t]*(.*)$', 'm'));
    const val = m ? m[1].trim() : '';
    if (isPlaceholderToken(val)) {
      addFailure('command');
    } else if (/\{\{[^}]+\}\}/.test(cmdLine)) {
      addFailure('command');
    }
  }
  // Exit / Result handling: collect all Result lines; if no Exit then need at least one Result and all PASS; if has Exit then every Exit integer 0 and every Result if any all PASS
  const lines = body.split('\n');
  const exitValues = [];
  const resultValues = [];
  for (const line of lines) {
    if (receiptFieldPattern('Exit', '\\s*:', 'i').test(line)) {
      const m = line.match(receiptFieldPattern('Exit', '\\s*:\\s*(.*)$', 'i'));
      exitValues.push(m ? m[1].trim() : '');
    } else if (/exit\s+code\s*[:=]/i.test(line)) {
      const m = line.match(/exit\s+code\s*[:=]\s*(.*)$/i);
      if (m) exitValues.push(m[1].trim());
    }
    if (receiptFieldPattern('Result', '\\s*:', 'i').test(line)) {
      const m = line.match(receiptFieldPattern('Result', '\\s*:\\s*(.+?)\\s*$', 'i'));
      resultValues.push(m ? m[1].trim() : '');
    }
  }

  if (exitValues.length === 0) {
    if (resultValues.length === 0 || resultValues.some((v) => v !== 'PASS')) {
      addFailure('exit_result');
    }
  } else {
    let exitOk = true;
    for (const v of exitValues) {
      if (!/^-?\d+$/.test(v)) { exitOk = false; break; }
      const n = Number.parseInt(v, 10);
      if (n !== 0) { exitOk = false; break; }
    }
    if (!exitOk) addFailure('exit_result');
    if (resultValues.length > 0 && resultValues.some((v) => v !== 'PASS')) {
      addFailure('exit_result');
    }
  }
  // Provenance is either a concrete Base/Head pair or a concrete base_sha/head_sha pair.
  // Without expected values this validates schema only; it does not claim identity binding.
  const receiptLines = body.split('\n');
  const readField = (name) => receiptLines
    .filter((line) => receiptFieldPattern(name, '\\s*:', 'i').test(line))
    .map((line) => line.replace(receiptFieldPattern(name, '\\s*:\\s*', 'i'), '').trim());
  const baseValues = readField('Base');
  const headValues = readField('Head');
  const baseShaValues = readField('base_sha');
  const headShaValues = readField('head_sha');
  const labelStyle = baseValues.length > 0 || headValues.length > 0;
  const shaStyle = baseShaValues.length > 0 || headShaValues.length > 0;
  let actualProvenance = null;
  if (labelStyle === shaStyle || labelStyle && (baseShaValues.length > 0 || headShaValues.length > 0)) {
    addFailure('provenance');
  } else {
    const base = labelStyle ? baseValues : baseShaValues;
    const head = labelStyle ? headValues : headShaValues;
    if (base.length !== 1 || head.length !== 1 || !isConcreteProvenanceValue(base[0]) || !isConcreteProvenanceValue(head[0])) {
      addFailure('provenance');
    } else {
      actualProvenance = { base: normalizeProvenanceValue(base[0]), head: normalizeProvenanceValue(head[0]) };
    }
  }
  const expected = options.expectedProvenance || options.expected_provenance || options.expected || null;
  const expectedBase = expected && typeof expected === 'object'
    ? firstDefined(expected, ['base', 'Base', 'base_sha', 'baseSha', 'expectedBase', 'expected_base'])
    : options.expectedBase ?? options.expected_base ?? options.expectedBaseSha ?? options.expected_base_sha;
  const expectedHead = expected && typeof expected === 'object'
    ? firstDefined(expected, ['head', 'Head', 'head_sha', 'headSha', 'expectedHead', 'expected_head'])
    : options.expectedHead ?? options.expected_head ?? options.expectedHeadSha ?? options.expected_head_sha;
  if (options.requireProvenanceBinding === true || expectedBase !== undefined || expectedHead !== undefined) {
    if (!actualProvenance
      || !isConcreteProvenanceValue(expectedBase)
      || !isConcreteProvenanceValue(expectedHead)
      || normalizeProvenanceValue(expectedBase) !== actualProvenance.base
      || normalizeProvenanceValue(expectedHead) !== actualProvenance.head) {
      addFailure('provenance');
    }
  }

  if (options.artifactDeclarationValid === false) addFailure('artifact_declaration');
  const artifactDeclarations = parseArtifactDeclarations(body);
  for (const declaration of artifactDeclarations) {
    if (declaration.hashes.length === 0 || declaration.hashes.some((hash) => !/^[a-f0-9]{64}$/i.test(hash))) {
      addFailure('artifact_hash');
    }
    const declaredPaths = declaration.pathText
      .split(/\s*(?:\+|,|;|\band\b)\s*/i)
      .map((value) => value.trim())
      .filter(Boolean);
    if (declaredPaths.length > 1 && declaration.hashes.length !== declaredPaths.length) {
      addFailure('artifact_hash');
    }
  }
  const artifactPaths = Array.isArray(options.artifactPaths) ? options.artifactPaths : [];
  if (options.requireArtifactHash) {
    if (artifactDeclarations.length === 0) addFailure('artifact_hash');
    for (const artifactPath of artifactPaths) {
      const matches = artifactDeclarations.filter((declaration) => {
        const candidates = declaration.pathText.split(/\s*(?:\+|,|;|\band\b)\s*/i).map((value) => value.trim()).filter(Boolean);
        return candidates.length === 1 && candidates.includes(artifactPath);
      });
      if (matches.length !== 1 || matches[0].hashes.length !== 1 || !/^[a-f0-9]{64}$/i.test(matches[0].hashes[0])) {
        addFailure('artifact_hash');
      }
    }
  }
  if (options.verifyArtifactBytes === true || typeof options.artifactRoot === 'string') {
    if (typeof options.artifactRoot !== 'string' || options.artifactRoot.trim() === '') {
      if (artifactDeclarations.length > 0 || options.requireArtifactHash) addFailure('artifact_hash');
    } else {
      for (const declaration of artifactDeclarations) {
        const declaredPaths = declaration.pathText
          .split(/\s*(?:\+|,|;|\band\b)\s*/i)
          .map((value) => value.trim())
          .filter(Boolean);
        if (declaredPaths.length === 0 || declaration.hashes.length !== declaredPaths.length) {
          addFailure('artifact_hash');
          continue;
        }
        for (let index = 0; index < declaredPaths.length; index += 1) {
          if (!hashValidatedArtifact(options.artifactRoot, declaredPaths[index], declaration.hashes[index])) {
            addFailure('artifact_hash');
          }
        }
      }
    }
  }
  return failures;
}

function parseCliArgs(argv) {
  const options = { flash: false, parallel: false, json: false };
  for (const arg of argv) {
    if (arg === '--flash') options.flash = true;
    else if (arg === '--parallel') options.parallel = true;
    else if (arg === '--json') options.json = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function cliResult(result, json) {
  process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${result.message}\n`);
  return result.exitCode;
}

function runCli(argv = process.argv.slice(2)) {
  try {
    const options = parseCliArgs(argv);
    const policy = executionPolicy(options);
    if (!policy.allowed) {
      return cliResult({
        ok: false,
        contract: 'execution-policy',
        ...policy,
        message: 'Unsupported flags: --flash and --parallel are incompatible.\nNo spec state, task receipt, worktree, subagent, or commit was created.',
        exitCode: 2,
      }, options.json);
    }

    return cliResult({ ok: true, contract: 'execution-policy', ...policy, exitCode: 0, message: `Execution mode: ${policy.mode}` }, options.json);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
}

if (require.main === module) process.exitCode = runCli();

module.exports = {
  executionPolicy,
  isTapMetadataHeading,
  deriveRuntimeContext: PROVENANCE.deriveRuntimeContext,
  receiptValidatorOptions,
  validateCanonicalReceipt,
};
