#!/usr/bin/env node
'use strict';

/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * UserPromptSubmit hook — secret-output-guardrail.cjs (Codex)
 *
 * Mirror of the Claude hook. The privacy hook gates whether a sensitive file may be
 * read; nothing gated whether an approved value may then be printed into the
 * transcript, where it survives compaction and is replayed on every later turn.
 *
 * Reads the prompt and never echoes it: no prompt text and no matched value is
 * written out, so the guardrail cannot itself become the leak. Fail-open.
 */

const { logCrash, readPayload } = require('./lib/hook-context.cjs');
const { REMINDER, containsSecretKeyword } = require('./lib/secret-keywords.cjs');

try {
  const payload = readPayload();
  if (!payload) process.exit(0);

  const prompt = String(payload.prompt || payload.user_prompt || '');
  if (!containsSecretKeyword(prompt)) process.exit(0);

  process.stdout.write(`${REMINDER}\n`);
} catch (error) {
  logCrash('secret-output-guardrail', error);
}
