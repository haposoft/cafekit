'use strict';

const { spawnSync } = require('node:child_process');

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
const PLACEHOLDER = /^(?:$|(?:your|my|replace|change|set)[-_ ]?(?:value|secret|key|token|password)?$|(?:changeme|change-me|example|sample|dummy|placeholder|test|testing|fake|xxx+|<[^>]+>|\.{3,}|\*{3,}))/i;
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
  if (STRONG_SENSITIVE_NAMES.has(normalized)
    || /(?:^|_)(?:api_key|password|passwd|private_key|client_secret|access_token|auth_token|credential|credentials)(?:_|$)/i.test(normalized)) {
    return 'strong';
  }
  if (GENERIC_SENSITIVE_NAMES.has(normalized)
    || /(?:^|_)(?:secret|token|key|auth)(?:_|$)/i.test(normalized)) {
    return 'generic';
  }
  return null;
}

function identifierIsSensitive(name) {
  return sensitivityLevel(name) !== null;
}

function stripValue(value) {
  return String(value || '').trim().replace(/^(['"`])([\s\S]*)\1$/, '$2').replace(/[;,]$/, '');
}

function valueLooksSecret(value, level = 'generic') {
  const clean = stripValue(value);
  if (!clean || PLACEHOLDER.test(clean) || ENV_REFERENCE.test(clean) || FUNCTION_REFERENCE.test(clean)) return false;
  if (PUBLIC_URL_SIGNAL.test(clean) && !CREDENTIAL_URL_SIGNAL.test(clean)) return false;
  if (PEM_SIGNAL.test(clean) || CREDENTIAL_URL_SIGNAL.test(clean) || BASIC_AUTH_SIGNAL.test(clean)) return true;
  if (level === 'strong') return clean.length >= 4 && !SAFE_LITERAL.test(clean);
  return VALUE_SIGNAL.test(clean) || (clean.length >= 20 && /[A-Za-z]/.test(clean) && /\d/.test(clean));
}

function parseAssignments(text) {
  const assignments = [];
  let match;
  while ((match = ASSIGNMENT.exec(text)) !== null) {
    const name = match[1].replace(/^["']|["']$/g, '');
    const value = match[2] ?? match[3] ?? match[4] ?? match[5] ?? '';
    assignments.push({ name, value, level: sensitivityLevel(name) });
  }
  return assignments;
}

function inspectAssignment(assignment, file, sourceLine, findings) {
  const specializedValue = PEM_SIGNAL.test(assignment.value)
    || CREDENTIAL_URL_SIGNAL.test(assignment.value)
    || BASIC_AUTH_SIGNAL.test(assignment.value);
  if ((assignment.level && valueLooksSecret(assignment.value, assignment.level)) || (!assignment.level && specializedValue)) {
    findings.push({ file, sourceLine, name: assignment.name });
  }
}

function parseDiff(diff) {
  const findings = [];
  let file = null;
  let sourceLine = 0;
  let pending = null;

  const flushPending = () => {
    if (!pending) return;
    if (valueLooksSecret(pending.value, pending.level)) {
      findings.push({ file: pending.file, sourceLine: pending.sourceLine, name: pending.name });
    }
    pending = null;
  };

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      flushPending();
      file = line.slice(6);
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      flushPending();
      sourceLine = Number(hunk[1]);
      continue;
    }
    if (!file || sourceLine < 1) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const text = line.slice(1);
      const assignments = parseAssignments(text);
      const first = assignments[0];
      const indented = /^\s+/.test(text);
      if (pending && (!indented || first)) flushPending();

      if (first) {
        for (const assignment of assignments) inspectAssignment(assignment, file, sourceLine, findings);
        if (first.level && (!first.value || /^(?:\||>|\{|\[)$/.test(first.value))) {
          pending = {
            file,
            sourceLine,
            name: first.name,
            level: first.level,
            value: ''
          };
        }
      } else if (pending && indented) {
        pending.value += `\n${text.trim()}`;
      } else if (pending && (PEM_SIGNAL.test(text) || BASIC_AUTH_SIGNAL.test(text))) {
        pending.value += `\n${text.trim()}`;
      }
      sourceLine++;
    } else if (!line.startsWith('-') && !line.startsWith('\\')) {
      flushPending();
      sourceLine++;
    } else if (line.startsWith('-')) {
      flushPending();
    }
  }
  flushPending();
  return findings;
}

function main() {
  const result = spawnSync(
    'git',
    ['diff', '--cached', '--unified=0', '--no-color', '--diff-filter=ACMR', '--'],
    { encoding: 'utf8' }
  );
  if (result.error || result.status !== 0) {
    process.stderr.write(`Unable to read staged diff: ${result.error?.message || result.stderr || 'git diff failed'}\n`);
    return 2;
  }

  const findings = parseDiff(result.stdout);
  const unique = new Map(findings.map((finding) => [
    `${finding.file}:${finding.sourceLine}:${finding.name}`,
    finding
  ]));
  for (const finding of unique.values()) {
    process.stdout.write(
      `Blocked: possible secret \`${finding.name}\` at ${finding.file}:${finding.sourceLine}. Value not shown.\n`
    );
  }
  if (unique.size === 0) process.stdout.write('No staged secrets found.\n');
  return unique.size > 0 ? 1 : 0;
}

if (require.main === module) process.exit(main());
module.exports = { parseDiff, identifierIsSensitive, valueLooksSecret };
