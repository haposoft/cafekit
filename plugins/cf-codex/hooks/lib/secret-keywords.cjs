/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * Secret-output guardrail keyword matcher.
 *
 * These patterns detect prompts about credential handling. They are deliberately
 * separate from the privacy hooks: those gate whether a sensitive file may be READ,
 * while this list drives a soft reminder about whether a value may be PRINTED.
 * Approval for the first is not approval for the second.
 */

const SECRET_KEYWORD_PATTERNS = [
  /\.env(?:\b|$)/i,
  /(?:^|[^A-Za-z0-9])credentials?(?:$|[^A-Za-z0-9])/i,
  /(?:^|[^A-Za-z0-9])secrets?(?:$|[^A-Za-z0-9])/i,
  /(?:^|[^A-Za-z0-9])api[\s_-]*keys?(?:$|[^A-Za-z0-9])/i,
  /(?:^|[^A-Za-z0-9])access[\s_-]*keys?(?:$|[^A-Za-z0-9])/i,
  /(?:^|[^A-Za-z0-9])tokens?(?:$|[^A-Za-z0-9])/i,
  /(?:^|[^A-Za-z0-9])bearer(?:$|[^A-Za-z0-9])/i,
  /(?:^|[^A-Za-z0-9])jwts?(?:$|[^A-Za-z0-9])/i,
  /(?:^|[^A-Za-z0-9])private[\s_-]*keys?(?:$|[^A-Za-z0-9])/i,
  /(?:^|[^A-Za-z0-9])oauth(?:[\s_-]+client)?[\s_-]*secrets?(?:$|[^A-Za-z0-9])/i,
  /(?:^|[^A-Za-z0-9])client[\s_-]*secrets?(?:$|[^A-Za-z0-9])/i,
  /(?:^|[^A-Za-z0-9])cloud[\s_-]*keys?(?:$|[^A-Za-z0-9])/i,
  /(?:^|[^A-Za-z0-9])env[\s_-]+files?(?:$|[^A-Za-z0-9])/i,
];

/** The reminder text. It names no value and quotes no prompt. */
const REMINDER = [
  '## Secret handling',
  '- Do not print raw credentials, API keys, tokens, JWTs, private keys, or secret values into the conversation.',
  '- Use [redacted], variable names, counts, or high-level status instead.',
  '- Approval to read a sensitive file or command output does not grant permission to print raw values.',
  '- If a value is needed for a machine action, pass it through a non-echoing path and report only success or failure.',
].join('\n');

function containsSecretKeyword(prompt) {
  if (typeof prompt !== 'string' || prompt.trim() === '') return false;
  return SECRET_KEYWORD_PATTERNS.some((pattern) => pattern.test(prompt));
}

module.exports = { SECRET_KEYWORD_PATTERNS, REMINDER, containsSecretKeyword };
