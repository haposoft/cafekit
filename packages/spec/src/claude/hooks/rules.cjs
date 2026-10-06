#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * UserPromptSubmit Hook — rules.cjs
 * Implements: https://docs.anthropic.com/en/docs/claude-code/hooks
 *
 * Injects project-specific rules once per session.
 *
 * Exit: 0 always (fail-open)
 */

try {
  const crypto = require('crypto');
  const fs   = require('fs');
  const os   = require('os');
  const path = require('path');

  const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');
  function readRuntime(cwd) {
    try {
      const p = runtimePath(cwd, 'runtime.json');
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
    } catch { return null; }
  }

  /** Reserve one injection slot per session. Returns null on reservation errors. */
  function reserveSession(sessionId) {
    if (!sessionId) return null;
    try {
      const key = crypto.createHash('sha256')
        .update(String(sessionId))
        .digest('hex')
        .slice(0, 16);
      const file = path.join(os.tmpdir(), `cafekit-rules-${key}.json`);
      fs.writeFileSync(file, JSON.stringify({ sessionId: String(sessionId) }), {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600
      });
      return true;
    } catch (error) {
      return error.code === 'EEXIST' ? false : null;
    }
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) process.exit(0);

  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const payload   = normalizeHookPayload(JSON.parse(stdin));
  const sessionId = payload.session_id || null;
  const payloadCwd = typeof payload.cwd === 'string' ? payload.cwd.trim() : '';
  const cwd       = payloadCwd || process.env.PROJECT_ROOT || process.cwd();

  // No session identity or reservation means no injection. Fail open.
  if (reserveSession(sessionId) !== true) process.exit(0);

  const runtime = readRuntime(cwd);
  if (runtime === null) process.exit(0);

  // Language
  const thinkLang   = runtime.locale?.thinkingLanguage || '';
  const respondLang = runtime.locale?.responseLanguage || '';
  const effectThink = thinkLang || (respondLang ? 'en' : '');

  // Paths
  const baseDir   = cwd;
  const plansPath = path.join(baseDir, runtime.paths?.plans || 'plans');
  const docsPath  = path.join(baseDir, runtime.paths?.docs  || 'docs');
  const maxLoc    = runtime.docs?.maxLoc || 800;

  const lines = [];

  const hasThink = effectThink && effectThink !== respondLang;
  if (hasThink || respondLang) {
    lines.push('## Language');
    if (hasThink)    lines.push(`- Thinking: Use ${effectThink} for reasoning.`);
    if (respondLang) lines.push(`- Response: Respond in ${respondLang}.`);
    lines.push('');
  }

  lines.push(
    '## Rules',
    `- Markdown files: Plans → "${plansPath}/" | Docs → "${docsPath}/"`,
    '- **DO NOT** create markdown files outside of those directories unless explicitly asked.',
    `- docs.maxLoc: ${maxLoc} lines max per doc file`
  );

  console.log(lines.join('\n'));
  process.exit(0);

} catch (e) {
  try {
    const fs = require('fs'), p = require('path');
    const d = require('./lib/hook-state-dir.cjs').hookStateDir();
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.appendFileSync(p.join(d, 'hook-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'rules', status: 'crash', error: e.message }) + '\n');
  } catch (_) {}
  process.exit(0);
}
