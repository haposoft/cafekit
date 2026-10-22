#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * UserPromptSubmit Hook — secret-output-guardrail.cjs
 * Implements: https://docs.anthropic.com/en/docs/claude-code/hooks
 *
 * The privacy hook gates whether a sensitive file may be read. Nothing gated what
 * happens after that approval, so an approved read could still put a raw key into
 * the transcript — where it survives compaction, is written to disk, and is replayed
 * to the model on every later turn. This injects a reminder when the prompt itself is
 * about credential handling.
 *
 * It reads the prompt and never echoes it: no prompt text and no matched value is
 * written out, so the guardrail cannot itself become the leak.
 *
 * Exit: 0 always (fail-open)
 */

try {
  const fs = require('fs');
  const { REMINDER, containsSecretKeyword } = require('./lib/secret-keywords.cjs');

  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) process.exit(0);

  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const payload = normalizeHookPayload(JSON.parse(stdin));
  const prompt = String(payload.prompt || payload.user_prompt || '');
  if (!containsSecretKeyword(prompt)) process.exit(0);

  console.log(REMINDER);
  process.exit(0);

} catch (e) {
  try {
    const fs = require('fs'), p = require('path');
    const d = require('./lib/hook-state-dir.cjs').hookStateDir();
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.appendFileSync(p.join(d, 'hook-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'secret-output-guardrail', status: 'crash', error: e.message }) + '\n');
  } catch (_) {}
  process.exit(0);
}
