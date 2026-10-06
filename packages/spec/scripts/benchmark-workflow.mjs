#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const changeFirewall = require('../src/claude/scripts/change-firewall.cjs');

const LANES = ['Direct', 'Standard', 'Critical'];
const ARMS = ['baseline', 'treatment'];
const RECEIPT_METRICS = ['wall_ms', 'input_tokens', 'output_tokens', 'context_loaded_tokens', 'tool_calls', 'subagent_calls', 'user_corrections', 'useful_reviewer_findings', 'false_positive_reviewer_findings'];
const QUALITY = ['correctness', 'regression', 'unsupported_completion_claim'];

function fail(message) { throw new Error(message); }
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(`${file}: invalid JSON (${error.message})`); }
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha(value) { return `sha256:${crypto.createHash('sha256').update(canonical(value)).digest('hex')}`; }
function rawSha(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function concrete(value, name) {
  if (typeof value !== 'string' || !value.trim() || /<[^>]+>|\{\{.+\}\}|placeholder|example|replace_me|change_me|todo|tbd|unknown|changeme|your[_-]/i.test(value) || /^sha256:0+$/.test(value)) fail(`${name}: missing or placeholder freeze field`);
  return value;
}
function hash(value, name) {
  concrete(value, name);
  if (!/^sha256:[0-9a-f]{64}$/.test(value)) fail(`${name}: expected sha256:<64 hex>`);
}
function object(value, name) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name}: expected object`); }
function nonnegative(value, name, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) fail(`${name}: expected non-negative ${integer ? 'integer' : 'number'}`);
}
// --- Secret-aware helpers (mirrors scan-staged-secrets contract, avoids tokenizer/_path false positives) ---
const STRONG_SENSITIVE_NAMES = new Set([
  'api_key', 'apikey', 'api-key', 'password', 'passwd', 'access_token',
  'auth_token', 'bearer_token', 'client_secret', 'private_key',
  'aws_secret_access_key', 'aws_access_key_id', 'github_token', 'jwt_secret',
  'openai_api_key', 'anthropic_api_key', 'credential_url', 'credentials_url',
  'database_url', 'connection_string', 'connection_url', 'dsn', 'basic_auth',
  'basic-auth', 'auth_header', 'authorization'
]);
const GENERIC_SENSITIVE_NAMES = new Set(['secret', 'token', 'key', 'auth']);
const SAFE_SUFFIXES = /(?:_label|_hint|_path|_file)$/i;
const PLACEHOLDER_SECRET = /^(?:$|(?:your|my|replace|change|set)[-_ ]?(?:value|secret|key|token|password)?$|(?:changeme|change-me|example|sample|dummy|placeholder|test|testing|fake|xxx+|<[^>]+>|\.{3,}|\*{3,}))/i;
const ENV_REFERENCE = /^(?:\$\{?[A-Z0-9_]+\}?|process\.env(?:\.|\[)|import\.meta\.env(?:\.|\[)|(?:env|os\.environ)\s*\()/i;
const FUNCTION_REFERENCE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(/;
const VALUE_SIGNAL = /(?:^|[\s_-])(sk-[a-z0-9_-]{8,}|gh[pousr]_[a-z0-9_]{8,}|ey[a-z0-9_-]{20,}|[a-f0-9]{24,}|[a-z0-9+/]{20,}={0,2})(?:$|[^a-z0-9_])/i;
const PEM_SIGNAL = /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)[A-Z0-9 ]*-----/i;
const CREDENTIAL_URL_SIGNAL = /\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/@:]+(?::[^\s/@]*)?@[^\s/]+/i;
const PUBLIC_URL_SIGNAL = /^(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?:)\/\//i;
const BASIC_AUTH_SIGNAL = /\bBasic\s+[A-Za-z0-9+/]{4,}={0,2}\b/i;
const SAFE_LITERAL = /^(?:true|false|null|undefined|enabled|disabled|none|safe)$/i;
const ASSIGNMENT = /(?:^|[\s,{\-])(["']?[A-Za-z_$][A-Za-z0-9_$-]*["']?)\s*(?::|=)\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s#},]*))/g;
function normalizeIdentifier(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase();
}
function sensitivityLevel(name) {
  const normalized = normalizeIdentifier(name);
  if (SAFE_SUFFIXES.test(normalized) || normalized === 'tokenizer') return null;
  if (STRONG_SENSITIVE_NAMES.has(normalized) || /(?:^|_)(?:api_key|password|passwd|private_key|client_secret|access_token|auth_token|credential|credentials)(?:_|$)/i.test(normalized)) return 'strong';
  if (GENERIC_SENSITIVE_NAMES.has(normalized) || /(?:^|_)(?:secret|token|key|auth)(?:_|$)/i.test(normalized)) return 'generic';
  return null;
}
function stripValue(value) {
  return String(value || '').trim().replace(/^(['"`])([\s\S]*)\1$/, '$2').replace(/[;,]$/, '');
}
function valueLooksSecret(value, level = 'generic') {
  const clean = stripValue(value);
  if (!clean || PLACEHOLDER_SECRET.test(clean) || ENV_REFERENCE.test(clean) || FUNCTION_REFERENCE.test(clean)) return false;
  if (PUBLIC_URL_SIGNAL.test(clean) && !CREDENTIAL_URL_SIGNAL.test(clean)) return false;
  if (PEM_SIGNAL.test(clean) || CREDENTIAL_URL_SIGNAL.test(clean) || BASIC_AUTH_SIGNAL.test(clean)) return true;
  if (level === 'strong') return clean.length >= 4 && !SAFE_LITERAL.test(clean);
  return VALUE_SIGNAL.test(clean) || (clean.length >= 20 && /[A-Za-z]/.test(clean) && /\d/.test(clean));
}
function isSecretArgv(argv) {
  for (let i = 0; i < argv.length; i++) {
    const part = String(argv[i] ?? '');
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) {
      const rawName = part.slice(0, eqIdx).replace(/^--?/, '');
      const rawValue = part.slice(eqIdx + 1);
      const name = rawName.replace(/^["']|["']$/g, '');
      const level = sensitivityLevel(name);
      if (!level) continue;
      if (valueLooksSecret(rawValue, level)) return { index: i, name, reason: 'assignment' };
      if (level === 'strong' && stripValue(rawValue).length >= 4 && !SAFE_LITERAL.test(stripValue(rawValue)) && !PLACEHOLDER_SECRET.test(stripValue(rawValue))) return { index: i, name, reason: 'assignment' };
    } else if (part.startsWith('-')) {
      const rawName = part.replace(/^--?/, '').replace(/^["']|["']$/g, '');
      const level = sensitivityLevel(rawName);
      if (!level) continue;
      const next = argv[i + 1];
      if (next !== undefined && typeof next === 'string' && !String(next).startsWith('-')) {
        if (valueLooksSecret(next, level)) return { index: i, name: rawName, reason: 'flag-value' };
        if (level === 'strong' && stripValue(next).length >= 4 && !SAFE_LITERAL.test(stripValue(next)) && !PLACEHOLDER_SECRET.test(stripValue(next)) && !ENV_REFERENCE.test(stripValue(next))) return { index: i, name: rawName, reason: 'flag-value' };
      } else if (level === 'strong') {
        return { index: i, name: rawName, reason: 'flag' };
      }
    } else if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(part)) {
      const m = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        const name = m[1];
        const rawValue = m[2];
        const level = sensitivityLevel(name);
        if (!level) continue;
        if (valueLooksSecret(rawValue, level)) return { index: i, name, reason: 'env-assignment' };
        if (level === 'strong' && stripValue(rawValue).length >= 4 && !SAFE_LITERAL.test(stripValue(rawValue)) && !PLACEHOLDER_SECRET.test(stripValue(rawValue))) return { index: i, name, reason: 'env-assignment' };
      }
    }
  }
  return null;
}
function redactSecrets(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  // Redact PEM blocks
  out = out.replace(PEM_SIGNAL, '[REDACTED-PEM]');
  // Redact credential URLs (keep scheme but hide credentials)
  out = out.replace(CREDENTIAL_URL_SIGNAL, (m) => m.replace(/\/\/[^@]+@/, '//[REDACTED]@'));
  // Redact basic auth
  out = out.replace(BASIC_AUTH_SIGNAL, 'Basic [REDACTED]');
  // Redact assignments where name is sensitive and value looks secret
  out = out.replace(ASSIGNMENT, (full, nameWithQuotes, v1, v2, v3, v4) => {
    const name = String(nameWithQuotes).replace(/^["']|["']$/g, '');
    const value = v1 ?? v2 ?? v3 ?? v4 ?? '';
    const level = sensitivityLevel(name);
    if (!level) return full;
    if (valueLooksSecret(value, level) || (level === 'strong' && stripValue(value).length >= 4 && !SAFE_LITERAL.test(stripValue(value)) && !PLACEHOLDER_SECRET.test(stripValue(value)))) {
      return full.replace(value, '[REDACTED]');
    }
    return full;
  });
  // Redact flag-style --name value or --name=value
  out = out.replace(/(--?[A-Za-z0-9_-]+)(?:\s*=\s*|\s+)(["']?)([^\s"'`,;]+)\2/g, (m, flag, q, val) => {
    const name = String(flag).replace(/^--?/, '');
    const level = sensitivityLevel(name);
    if (!level) return m;
    if (valueLooksSecret(val, level) || (level === 'strong' && stripValue(val).length >= 4 && !SAFE_LITERAL.test(stripValue(val)) && !PLACEHOLDER_SECRET.test(stripValue(val)))) {
      const sep = m.includes('=') ? '=' : ' ';
      return `${flag}${sep}[REDACTED]`;
    }
    return m;
  });
  // Redact env-like NAME=VALUE without dashes
  out = out.replace(/\b([A-Z][A-Z0-9_]*)\s*=\s*(["']?)([^\s"'`,;]+)\2/g, (m, name, q, val) => {
    const level = sensitivityLevel(name);
    if (!level) return m;
    if (valueLooksSecret(val, level) || (level === 'strong' && stripValue(val).length >= 4 && !SAFE_LITERAL.test(stripValue(val)) && !PLACEHOLDER_SECRET.test(stripValue(val)))) {
      return `${name}=[REDACTED]`;
    }
    return m;
  });
  // Redact bare sensitive name followed by space-separated value (e.g., "password supersecret" without dash/equals) — must respect safe suffixes/tokenizer
  out = out.replace(/\b([A-Za-z_][A-Za-z0-9_-]*)\s+([^\s"'`,;]{4,})\b/g, (m, name, val) => {
    if (String(name).startsWith('-')) return m;
    const level = sensitivityLevel(name);
    if (!level) return m;
    if (val === '[REDACTED]') return m;
    if (valueLooksSecret(val, level) || (level === 'strong' && stripValue(val).length >= 4 && !SAFE_LITERAL.test(stripValue(val)) && !PLACEHOLDER_SECRET.test(stripValue(val)) && !ENV_REFERENCE.test(stripValue(val)))) {
      return `${name} [REDACTED]`;
    }
    return m;
  });
  // Redact standalone high-entropy tokens not caught above
  out = out.replace(/(sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|ey[A-Za-z0-9_-]{20,})/g, '[REDACTED]');
  return out;
}
function validateCorpus(corpus) {
  if (corpus?.schema_version !== 'b1.v1') fail('corpus.schema_version: expected b1.v1');
  if (!['frozen', 'example_template'].includes(corpus?.status)) fail('corpus.status: expected frozen or example_template');
  concrete(corpus?.corpus_id, 'corpus.corpus_id');
  if (!Array.isArray(corpus.tasks) || !corpus.tasks.length) fail('corpus.tasks: expected non-empty array');
  const ids = new Set();
  for (const [index, task] of corpus.tasks.entries()) {
    const p = `corpus.tasks[${index}]`;
    concrete(task.task_id, `${p}.task_id`);
    if (ids.has(task.task_id)) fail(`duplicate task_id: ${task.task_id}`); ids.add(task.task_id);
    if (!LANES.includes(task.lane)) fail(`${p}.lane: invalid lane`);
    const hasPrompt = Object.hasOwn(task, 'prompt');
    const hasPromptHash = Object.hasOwn(task, 'prompt_sha256');
    if (hasPrompt === hasPromptHash) fail(`${p}: exactly one of prompt or prompt_sha256 required`);
    if (hasPrompt) concrete(task.prompt, `${p}.prompt`);
    else hash(task.prompt_sha256, `${p}.prompt_sha256`);
    concrete(task.repo_sample, `${p}.repo_sample`);
    object(task.acceptance, `${p}.acceptance`); object(task.risk, `${p}.risk`);
    if (!Object.keys(task.acceptance).length || !Object.keys(task.risk).length) fail(`${p}: acceptance/risk metadata cannot be empty`);
  }
  return sha(corpus);
}
function validateConfig(config, corpusHash) {
  if (config?.schema_version !== 'b1.v1') fail('config.schema_version: expected b1.v1');
  if (config.status !== 'frozen') fail('config.status: must be frozen; placeholders cannot run');
  if (!ARMS.includes(config.arm)) fail('config.arm: expected baseline or treatment');
  object(config.model, 'config.model'); concrete(config.model.name, 'config.model.name'); concrete(config.model.version, 'config.model.version');
  concrete(config.reasoning_effort, 'config.reasoning_effort'); concrete(config.experiment_id, 'config.experiment_id');
  object(config.repo, 'config.repo'); concrete(config.repo.identifier, 'config.repo.identifier'); concrete(config.repo.commit, 'config.repo.commit'); hash(config.repo.clean_initial_tree_sha, 'config.repo.clean_initial_tree_sha');
  hash(config.permissions_fingerprint, 'config.permissions_fingerprint'); hash(config.tool_availability_fingerprint, 'config.tool_availability_fingerprint');
  for (const rate of ['input_usd_per_1k', 'output_usd_per_1k']) if (config[rate] !== undefined) nonnegative(config[rate], `config.${rate}`);
  if (config.corpus_sha256 !== corpusHash) fail('config.corpus_sha256: does not match corpus');
  hash(config.config_sha256, 'config.config_sha256');
  const withoutHash = { ...config }; delete withoutHash.config_sha256;
  if (sha(withoutHash) !== config.config_sha256) fail('config.config_sha256: freeze hash mismatch');
  object(config.repeat_policy, 'config.repeat_policy');
  nonnegative(config.repeat_policy.repeats_per_task, 'config.repeat_policy.repeats_per_task', true);
  if (!config.repeat_policy.repeats_per_task || config.repeat_policy.context_isolated !== true) fail('config.repeat_policy: require positive repeats_per_task and context_isolated=true');
  return config;
}
function comparableConfig(config) {
  const { arm, config_sha256: ignoredHash, ...shared } = config;
  return canonical(shared);
}
function validateArtifact(evidence, receiptDir) {
  const ref = evidence.artifact_ref;
  if (typeof ref !== 'string' || path.isAbsolute(ref) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) fail('receipt.evidence.artifact_ref: expected a relative local file, not a URI');
  concrete(ref, 'receipt.evidence.artifact_ref');
  const bundlePath = path.resolve(receiptDir);
  const artifactPath = path.resolve(bundlePath, ref);
  const relativeArtifact = path.relative(bundlePath, artifactPath);
  if (relativeArtifact === '..' || relativeArtifact.startsWith(`..${path.sep}`) || path.isAbsolute(relativeArtifact)) fail('receipt.evidence.artifact_ref: path escapes receipt bundle directory');
  let bundleRealPath;
  let artifactRealPath;
  try {
    bundleRealPath = fs.realpathSync(bundlePath);
    artifactRealPath = fs.realpathSync(artifactPath);
  } catch { fail('receipt.evidence.artifact_ref: local artifact does not exist'); }
  const relativeRealArtifact = path.relative(bundleRealPath, artifactRealPath);
  if (relativeRealArtifact === '..' || relativeRealArtifact.startsWith(`..${path.sep}`) || path.isAbsolute(relativeRealArtifact)) fail('receipt.evidence.artifact_ref: resolved artifact escapes receipt bundle directory');
  let bytes;
  try { bytes = fs.readFileSync(artifactRealPath); }
  catch { fail('receipt.evidence.artifact_ref: local artifact does not exist'); }
  if (rawSha(bytes) !== evidence.artifact_sha256) fail('receipt.evidence.artifact_sha256: raw-byte hash mismatch');
}
function validateReceipt(receipt, config, taskIds, receiptDir) {
  object(receipt, 'receipt');
  concrete(receipt.task_id, 'receipt.task_id'); if (!taskIds.has(receipt.task_id)) fail(`receipt.task_id: unknown task ${receipt.task_id}`);
  if (receipt.lane !== taskIds.get(receipt.task_id)) fail('receipt.lane: does not match corpus');
  if (receipt.arm !== config.arm || receipt.corpus_sha256 !== config.corpus_sha256 || receipt.config_sha256 !== config.config_sha256) fail('receipt: frozen hash or arm mismatch');
  if (receipt.model?.name !== config.model.name || receipt.model?.version !== config.model.version || receipt.reasoning_effort !== config.reasoning_effort) fail('receipt: model/reasoning freeze mismatch');
  if (receipt.repo_commit !== config.repo.commit || receipt.clean_initial_tree_sha !== config.repo.clean_initial_tree_sha || receipt.permissions_fingerprint !== config.permissions_fingerprint || receipt.tool_availability_fingerprint !== config.tool_availability_fingerprint) fail('receipt: repository/permission/tool freeze mismatch');
  nonnegative(receipt.repeat, 'receipt.repeat', true); if (!receipt.repeat) fail('receipt.repeat: must be positive');
  if (receipt.repeat > config.repeat_policy.repeats_per_task) fail('receipt.repeat: exceeds repeat_policy.repeats_per_task');
  for (const metric of RECEIPT_METRICS) nonnegative(receipt[metric], `receipt.${metric}`, metric !== 'wall_ms');
  for (const metric of QUALITY) if (typeof receipt[metric] !== 'boolean') fail(`receipt.${metric}: expected boolean`);
  object(receipt.evidence, 'receipt.evidence'); hash(receipt.evidence.artifact_sha256, 'receipt.evidence.artifact_sha256'); concrete(receipt.evidence.command, 'receipt.evidence.command');
  validateArtifact(receipt.evidence, receiptDir);
}
function loadReceipts(file) { const value = readJson(file); const receipts = Array.isArray(value) ? value : value?.receipts; if (!Array.isArray(receipts)) fail('receipts: expected array or {receipts: []}'); return receipts; }
function matrixCoverage(receipts, configs, corpus) {
  const repeats = configs[0].value.repeat_policy.repeats_per_task;
  const arms = {};
  for (const { value: config } of configs) {
    arms[config.arm] = {};
    for (const lane of LANES) {
      const expected = corpus.tasks.filter((task) => task.lane === lane).flatMap((task) => Array.from({ length: repeats }, (_, index) => `${task.task_id}/${index + 1}`)).sort();
      const actual = receipts.filter((receipt) => receipt.arm === config.arm && receipt.lane === lane).map((receipt) => `${receipt.task_id}/${receipt.repeat}`).sort();
      arms[config.arm][lane] = { complete: actual.length === expected.length && expected.every((key) => actual.includes(key)), expected_receipts: expected.length, actual_receipts: actual.length, missing: expected.filter((key) => !actual.includes(key)), unexpected: actual.filter((key) => !expected.includes(key)) };
    }
  }
  const coverage = { arms, complete: Object.values(arms).every((lanes) => LANES.every((lane) => lanes[lane].complete)) };
  return coverage;
}
function validateCompleteMatrix(coverage) {
  if (coverage.complete) return;
  const missing = Object.entries(coverage.arms).flatMap(([arm, lanes]) => Object.entries(lanes).flatMap(([lane, matrix]) => matrix.missing.map((key) => `${arm}/${lane}/${key}`)));
  fail(`incomplete receipt matrix: missing ${missing.join(', ') || 'expected task/repeat coverage'}`);
}
function validateAll(corpusFile, configFiles, receiptFile, requireCompleteMatrix = false) {
  const corpus = readJson(corpusFile); const corpusHash = validateCorpus(corpus); const taskIds = new Map(corpus.tasks.map((task) => [task.task_id, task.lane]));
  if (corpus.status === 'example_template' && receiptFile) fail('example_template corpus: receipt validation and live summary are not allowed');
  const configs = configFiles.map((file) => ({ file, value: readJson(file) })); configs.forEach(({ value }) => validateConfig(value, corpusHash));
  const arms = configs.map(({ value }) => value.arm);
  if (new Set(arms).size !== arms.length) fail('configs: duplicate arm; supply at most one baseline and one treatment config');
  if (configs.length === 2 && comparableConfig(configs[0].value) !== comparableConfig(configs[1].value)) fail('configs: baseline and treatment must share all freeze metadata and differ only by arm');
  const receipts = receiptFile ? loadReceipts(receiptFile) : [];
  if (receiptFile) {
    const byHash = new Map(configs.map(({ value }) => [value.config_sha256, value])); const seen = new Set();
    for (const receipt of receipts) {
      const config = byHash.get(receipt.config_sha256); if (!config) fail(`receipt.config_sha256: no supplied frozen config (${receipt.config_sha256})`);
      validateReceipt(receipt, config, taskIds, path.dirname(path.resolve(receiptFile))); const key = `${receipt.arm}/${receipt.task_id}/${receipt.repeat}`;
      if (seen.has(key)) fail(`duplicate arm/task/repeat: ${key}`); seen.add(key);
    }
  }
  const matrix = receiptFile ? matrixCoverage(receipts, configs, corpus) : null;
  if (requireCompleteMatrix && matrix) validateCompleteMatrix(matrix);
  return { corpus, configs: configs.map(({ value }) => value), corpusHash, receipts, matrix };
}
function quantile(values, q) { const sorted = [...values].sort((a, b) => a - b); if (!sorted.length) return null; const index = (sorted.length - 1) * q; const low = Math.floor(index); const high = Math.ceil(index); return sorted[low] + (sorted[high] - sorted[low]) * (index - low); }
function summaryStats(values) { return { p25: quantile(values, 0.25), median: quantile(values, 0.5), p75: quantile(values, 0.75) }; }
function summarize(receipts, configs, corpus, suppliedCoverage) {
  const groups = {};
  for (const receipt of receipts) {
    groups[receipt.arm] ??= {};
    const group = groups[receipt.arm][receipt.lane] ??= { receipt_count: 0, task_ids: new Set(), matrix_keys: new Set(), metrics: {}, quality_rates: {} };
    group.receipt_count++;
    group.task_ids.add(receipt.task_id);
    group.matrix_keys.add(`${receipt.task_id}/${receipt.repeat}`);
  }
  for (const receipt of receipts) {
    const group = groups[receipt.arm][receipt.lane];
    const config = configs.find((item) => item.config_sha256 === receipt.config_sha256);
    const values = { ...receipt, estimated_cost_usd: (receipt.input_tokens * (config.input_usd_per_1k ?? 0) + receipt.output_tokens * (config.output_usd_per_1k ?? 0)) / 1000 };
    for (const key of [...RECEIPT_METRICS, 'estimated_cost_usd']) (group.metrics[key] ??= []).push(values[key]);
    for (const key of QUALITY) (group.quality_rates[key] ??= []).push(receipt[key] ? 1 : 0);
    for (const [key, value] of Object.entries({ user_correction_rate: receipt.user_corrections, useful_reviewer_finding_rate: receipt.useful_reviewer_findings, false_positive_reviewer_finding_rate: receipt.false_positive_reviewer_findings })) (group.quality_rates[key] ??= []).push(value);
  }
  for (const arm of Object.keys(groups)) for (const lane of Object.keys(groups[arm])) {
    const group = groups[arm][lane]; group.task_ids = [...group.task_ids].sort();
    for (const key of Object.keys(group.metrics)) group.metrics[key] = summaryStats(group.metrics[key]);
    for (const key of Object.keys(group.quality_rates)) group.quality_rates[key] = group.quality_rates[key].reduce((a, b) => a + b, 0) / group.quality_rates[key].length;
  }
  const coverage = suppliedCoverage ?? matrixCoverage(receipts, configs.map((value) => ({ value })), corpus);
  const emptyMatrix = { complete: false, expected_receipts: 0, actual_receipts: 0, missing: [], unexpected: [] };
  let ready = receipts.length > 0 && ARMS.every((arm) => groups[arm]);
  const gates = {};
  for (const lane of LANES.filter((item) => corpus.tasks.some((task) => task.lane === item))) {
    const expected = coverage.arms.baseline?.[lane] ? coverage.arms.baseline[lane].missing.concat(coverage.arms.baseline[lane].unexpected) : [];
    const baseline = coverage.arms.baseline?.[lane] ?? { ...emptyMatrix, missing: expected };
    const treatment = coverage.arms.treatment?.[lane] ?? emptyMatrix;
    const complete = baseline.complete && treatment.complete;
    const base = groups.baseline?.[lane]; const current = groups.treatment?.[lane];
    const relativeQuality = complete && current.quality_rates.correctness >= base.quality_rates.correctness && current.quality_rates.regression <= base.quality_rates.regression && current.quality_rates.unsupported_completion_claim <= base.quality_rates.unsupported_completion_claim && current.quality_rates.user_correction_rate <= base.quality_rates.user_correction_rate && current.quality_rates.useful_reviewer_finding_rate >= base.quality_rates.useful_reviewer_finding_rate && current.quality_rates.false_positive_reviewer_finding_rate <= base.quality_rates.false_positive_reviewer_finding_rate;
    const absoluteQuality = complete && current.quality_rates.correctness === 1 && current.quality_rates.regression === 0 && current.quality_rates.unsupported_completion_claim === 0;
    const quality = complete && relativeQuality && absoluteQuality;
    const efficiency = quality && ['Direct', 'Standard'].includes(lane) && current.metrics.wall_ms.median < base.metrics.wall_ms.median && current.metrics.estimated_cost_usd.median < base.metrics.estimated_cost_usd.median;
    const pass = complete && (lane === 'Critical' ? quality : efficiency);
    gates[lane] = { comparable_tasks: complete, baseline_matrix: baseline, treatment_matrix: treatment, quality_pass: Boolean(quality), efficiency_pass: Boolean(efficiency), pass };
    ready &&= pass;
  }
  for (const arm of Object.keys(groups)) for (const lane of Object.keys(groups[arm])) delete groups[arm][lane].matrix_keys;
  return { status: receipts.length ? (ready ? 'ready' : 'not-ready') : 'exploratory/no-live-runs', live_runs: receipts.length > 0, groups, rollout_recommendation: { status: receipts.length && ready ? 'ready' : receipts.length ? 'not-ready' : 'exploratory', gates } };
}

// --- Runner adapter boundary (reproducible execution) ---

function validateRunnerContract(file) {
  const runner = readJson(file);
  if (runner?.schema_version !== 'b1.v1') fail('runner.schema_version: expected b1.v1');
  if (!Array.isArray(runner.command) || runner.command.length === 0) fail('runner.command: expected non-empty array of strings (explicit argv, no shell string)');
  for (const [index, part] of runner.command.entries()) {
    if (typeof part !== 'string' || !part.trim()) fail(`runner.command[${index}]: expected non-empty string`);
    concrete(part, `runner.command[${index}]`);
    if (/^shell:/i.test(part) || /^sh\s+-c/i.test(part)) fail(`runner.command[${index}]: shell string is forbidden; use explicit argv array`);
  }
  const secret = isSecretArgv(runner.command);
  if (secret) fail(`runner.command[${secret.index}]: secret-like assignment/flag is forbidden (Value not shown)`);
  if (runner.timeout_ms !== undefined) {
    nonnegative(runner.timeout_ms, 'runner.timeout_ms', true);
    if (!runner.timeout_ms) fail('runner.timeout_ms: must be positive');
    if (runner.timeout_ms > 600_000) fail('runner.timeout_ms: exceeds 600s sanity cap');
  }
  if (runner.shell !== undefined) fail('runner.shell: implicit shell execution is forbidden');
  if (typeof runner.command === 'string') fail('runner.command: shell string is forbidden; use explicit argv array');
  return runner;
}

function secureEnv() {
  const allow = new Set(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE', 'NO_COLOR', 'FORCE_COLOR', 'TERM', 'TZ']);
  const out = {};
  for (const key of allow) if (process.env[key] !== undefined) out[key] = process.env[key];
  return out;
}

function validateRunnerResult(result, label) {
  object(result, label);
  // wall_ms is measured by harness, not runner; runner must not fabricate it
  for (const metric of RECEIPT_METRICS) {
    if (metric === 'wall_ms') continue;
    nonnegative(result[metric], `${label}.${metric}`, true);
  }
  for (const metric of QUALITY) if (typeof result[metric] !== 'boolean') fail(`${label}.${metric}: expected boolean`);
}

function runBenchmark({ corpusFile, configFiles, runnerFile, outDir, receiptsFile }) {
  if (!runnerFile) fail('runner contract is required: pass --runner FILE with explicit command array (no implicit shell string)');
  if (!outDir && !receiptsFile) fail('output is required: pass --out DIR (receipts will be written as <out>/receipts.json) or --receipts FILE');
  const runner = validateRunnerContract(runnerFile);
  // Freeze validation before any execution
  const corpus = readJson(corpusFile);
  const corpusHash = validateCorpus(corpus);
  if (corpus.status === 'example_template') fail('example_template corpus: live execution is not allowed');
  const configs = configFiles.map((file) => ({ file, value: readJson(file) }));
  configs.forEach(({ value }) => validateConfig(value, corpusHash));
  const arms = configs.map(({ value }) => value.arm);
  if (new Set(arms).size !== arms.length) fail('configs: duplicate arm; supply at most one baseline and one treatment config');
  if (configs.length === 2 && comparableConfig(configs[0].value) !== comparableConfig(configs[1].value)) fail('configs: baseline and treatment must share all freeze metadata and differ only by arm');
  const outResolved = path.resolve(outDir || path.dirname(path.resolve(receiptsFile)));
  const receiptsPath = receiptsFile ? path.resolve(receiptsFile) : path.join(outResolved, 'receipts.json');
  const bundleDir = path.dirname(receiptsPath);
  fs.mkdirSync(bundleDir, { recursive: true });
  const artifactsRoot = path.join(bundleDir, 'artifacts');
  fs.mkdirSync(artifactsRoot, { recursive: true });
  const receipts = [];
  const env = secureEnv();
  let totalRuns = 0;
  for (const { value: config } of configs) {
    for (const task of corpus.tasks) {
      for (let repeat = 1; repeat <= config.repeat_policy.repeats_per_task; repeat++) {
        totalRuns++;
        const artifactRel = path.join('artifacts', config.arm, `${task.task_id}__${repeat}.bin`);
        const artifactAbs = path.join(bundleDir, artifactRel);
        fs.mkdirSync(path.dirname(artifactAbs), { recursive: true });
        // Ensure no prior artifact leaks: remove stale file
        try { fs.rmSync(artifactAbs, { force: true }); } catch {}
        const payload = {
          schema_version: 'b1.v1',
          task_id: task.task_id,
          lane: task.lane,
          arm: config.arm,
          repeat,
          corpus_sha256: corpusHash,
          config_sha256: config.config_sha256,
          model: config.model,
          reasoning_effort: config.reasoning_effort,
          repo: config.repo,
          permissions_fingerprint: config.permissions_fingerprint,
          tool_availability_fingerprint: config.tool_availability_fingerprint,
          repo_sample: task.repo_sample,
          acceptance: task.acceptance,
          risk: task.risk,
          artifact_path: artifactAbs,
          experiment_id: config.experiment_id,
        };
        if (task.prompt !== undefined) payload.prompt = task.prompt;
        if (task.prompt_sha256 !== undefined) payload.prompt_sha256 = task.prompt_sha256;
        const commandStr = runner.command.join(' ');
        const start = Date.now();
        let result;
        try {
          result = spawnSync(runner.command[0], runner.command.slice(1), {
            input: JSON.stringify(payload),
            encoding: 'utf8',
            env,
            timeout: runner.timeout_ms ?? 120_000,
            maxBuffer: 10 * 1024 * 1024,
            shell: false,
          });
        } catch (error) {
          fail(`runner execution failed for ${config.arm}/${task.task_id}/${repeat}: ${error.message}`);
        }
        const wall_ms = Date.now() - start;
        if (result.error) {
          const code = result.error.code || result.error.message;
          fail(`runner execution failed for ${config.arm}/${task.task_id}/${repeat}: ${code} (no receipt fabricated)`);
        }
        if (result.status !== 0) {
          const rawSnippet = (result.stderr || '').slice(0, 500).replace(/\s+/g, ' ').trim();
          const stderrSnippet = redactSecrets(rawSnippet);
          fail(`runner exited non-zero for ${config.arm}/${task.task_id}/${repeat}: exit ${result.status}${stderrSnippet ? ` — ${stderrSnippet}` : ''} (no receipt fabricated)`);
        }
        let runnerOutput;
        const stdoutTrim = (result.stdout || '').trim();
        if (!stdoutTrim) fail(`runner produced no output for ${config.arm}/${task.task_id}/${repeat}: expected JSON with metrics`);
        try {
          runnerOutput = JSON.parse(stdoutTrim);
        } catch (error) {
          fail(`runner output invalid JSON for ${config.arm}/${task.task_id}/${repeat}: ${error.message}`);
        }
        validateRunnerResult(runnerOutput, `runner output ${config.arm}/${task.task_id}/${repeat}`);
        // Verify artifact exists and is inside bundleDir
        let artifactBytes;
        try {
          const realBundle = fs.realpathSync(bundleDir);
          const realArtifact = fs.realpathSync(artifactAbs);
          const relReal = path.relative(realBundle, realArtifact);
          if (relReal === '..' || relReal.startsWith(`..${path.sep}`) || path.isAbsolute(relReal)) fail(`runner artifact escapes receipt bundle directory for ${config.arm}/${task.task_id}/${repeat}`);
          artifactBytes = fs.readFileSync(realArtifact);
        } catch (error) {
          if (error.message && error.message.includes('escapes receipt bundle')) throw error;
          fail(`runner did not produce artifact for ${config.arm}/${task.task_id}/${repeat} at ${artifactRel}: ${error.message}`);
        }
        const artifact_sha256 = rawSha(artifactBytes);
        // Defensive: validate artifact_ref does not escape via our own construction
        const evidence = { artifact_ref: artifactRel, artifact_sha256, command: commandStr };
        // Quick path-escape check before building receipt
        validateArtifact(evidence, bundleDir);
        const receipt = {
          task_id: task.task_id,
          lane: task.lane,
          arm: config.arm,
          repeat,
          model: config.model,
          reasoning_effort: config.reasoning_effort,
          repo_commit: config.repo.commit,
          clean_initial_tree_sha: config.repo.clean_initial_tree_sha,
          permissions_fingerprint: config.permissions_fingerprint,
          tool_availability_fingerprint: config.tool_availability_fingerprint,
          corpus_sha256: corpusHash,
          config_sha256: config.config_sha256,
          wall_ms,
          input_tokens: runnerOutput.input_tokens,
          output_tokens: runnerOutput.output_tokens,
          context_loaded_tokens: runnerOutput.context_loaded_tokens,
          tool_calls: runnerOutput.tool_calls,
          subagent_calls: runnerOutput.subagent_calls,
          correctness: runnerOutput.correctness,
          regression: runnerOutput.regression,
          unsupported_completion_claim: runnerOutput.unsupported_completion_claim,
          user_corrections: runnerOutput.user_corrections,
          useful_reviewer_findings: runnerOutput.useful_reviewer_findings,
          false_positive_reviewer_findings: runnerOutput.false_positive_reviewer_findings,
          evidence,
        };
        // Validate receipt immediately fail-closed
        const tmpTaskIds = new Map(corpus.tasks.map((t) => [t.task_id, t.lane]));
        const configForReceipt = configs.find((c) => c.value.config_sha256 === receipt.config_sha256).value;
        validateReceipt(receipt, configForReceipt, tmpTaskIds, bundleDir);
        receipts.push(receipt);
      }
    }
  }
  if (!receipts.length) fail('runner produced no receipts: live execution requires at least one task/repeat');
  // Deterministic ordering
  receipts.sort((a, b) => (a.arm === b.arm ? (a.task_id === b.task_id ? a.repeat - b.repeat : a.task_id.localeCompare(b.task_id)) : a.arm.localeCompare(b.arm)));
  // Validate complete matrix before claiming success
  const coverage = matrixCoverage(receipts, configs, corpus);
  try {
    validateCompleteMatrix(coverage);
  } catch (error) {
    // Do not fabricate partial matrix as success; surface the missing keys and do not write a valid receipt set
    // Still write the partial receipts for debugging but mark as incomplete
    const partialPath = receiptsPath;
    fs.writeFileSync(partialPath, JSON.stringify({ receipts, _incomplete: true, _coverage: coverage }, null, 2));
    throw error;
  }
  // Atomic write
  const tmpPath = `${receiptsPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ receipts }, null, 2));
  fs.renameSync(tmpPath, receiptsPath);
  // Re-validate the written file via existing path to guarantee it is consumable by validate/summarize
  validateAll(corpusFile, configFiles, receiptsPath, true);
  return { receiptsPath, bundleDir, receipts, corpusHash, configs: configs.map((c) => c.value), coverage, totalRuns };
}

function args(argv) { const out = { _: [] }; for (let i = 0; i < argv.length; i++) { const item = argv[i]; if (item.startsWith('--')) { const key = item.slice(2).replaceAll('-', '_'); if (key === 'config') out[key] = [...(out[key] ?? []), argv[++i]]; else out[key] = argv[++i]; } else out._.push(item); } return out; }
// D1 production caller: creates the C9 freeze manifest via the canonical
// change-firewall.cjs gate. --proposal FILE supplies a tagged C1
// ChangeProposal (required whenever derived protected paths are non-empty);
// omit it only for a clean released-state no_protected_change freeze.
function runFreeze({ proposalFile }) {
  const proposal = proposalFile ? readJson(path.resolve(proposalFile)) : null;
  return changeFirewall.createFreezeManifest(proposal);
}

function main() {
  const flags = args(process.argv.slice(2));
  const verb = flags._[0];
  if (!['validate', 'summarize', 'run', 'freeze'].includes(verb)) fail('usage: benchmark-workflow.mjs validate|summarize|run|freeze --corpus FILE --config FILE [--config FILE] [--receipts FILE] [--runner FILE --out DIR] [--proposal FILE]');
  if (verb === 'freeze') {
    const manifest = runFreeze({ proposalFile: flags.proposal });
    process.stdout.write(`${JSON.stringify({ status: 'frozen', changeKind: manifest.changeKind, candidateDigest: manifest.candidateDigest, treeDigest: manifest.treeDigest }, null, 2)}\n`);
    return;
  }
  if (verb === 'run') {
    if (!flags.corpus) fail('corpus is required: --corpus FILE (frozen, not example_template)');
    const configs = Array.isArray(flags.config) ? flags.config : (flags.config ? [flags.config] : []);
    if (!configs.length) fail('config is required: --config FILE (frozen) — supply one per arm, at most baseline+treatment');
    if (!flags.runner) fail('runner contract is required: pass --runner FILE with explicit command array (no implicit shell string)');
    if (!flags.out && !flags.receipts) fail('output is required: pass --out DIR (receipts written to <out>/receipts.json) or --receipts FILE');
    const result = runBenchmark({ corpusFile: flags.corpus, configFiles: configs, runnerFile: flags.runner, outDir: flags.out, receiptsFile: flags.receipts });
    process.stdout.write(`${JSON.stringify({ status: 'executed', live_runs: true, receipts: result.receiptsPath, bundle: result.bundleDir, corpus_sha256: result.corpusHash, config_sha256: result.configs.map((c) => c.config_sha256), total_runs: result.totalRuns, coverage: result.coverage }, null, 2)}\n`);
    return;
  }
  const configs = Array.isArray(flags.config) ? flags.config : [flags.config];
  if (!flags.corpus || !configs[0]) fail('corpus and config are required');
  const result = validateAll(flags.corpus, configs, flags.receipts, flags._[0] === 'validate');
  if (flags._[0] === 'summarize') { const receipts = result.receipts; process.stdout.write(`${JSON.stringify(summarize(receipts, result.configs, result.corpus, result.matrix), null, 2)}\n`); } else process.stdout.write(`${JSON.stringify({ status: flags.receipts ? 'valid' : 'valid_no_receipts', corpus_sha256: result.corpusHash, config_sha256: result.configs.map((config) => config.config_sha256) }, null, 2)}\n`); }
try { main(); } catch (error) { process.stderr.write(`benchmark validation failed: ${error.message}\n`); process.exitCode = 2; }
