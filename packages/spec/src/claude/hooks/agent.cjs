#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * SubagentStart Hook — agent.cjs
 * Implements: https://docs.anthropic.com/en/docs/claude-code/hooks
 *
 * Fires when a subagent (Task tool) is spawned.
 * Injects lightweight context: language, paths, and skill venv guidance.
 *
 * Exit: 0 always (fail-open)
 */

try {
  const fs   = require('fs');
  const path = require('path');

  /** Read <runtime>/runtime.json */
  const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');
  function readRuntime(cwd) {
    try {
      const p = runtimePath(cwd, 'runtime.json');
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
    } catch { return null; }
  }

  // Skills live beside the runtime only on Claude; Codex and omp read `.agents/skills`.
  function skillsDir() { return runtimeDirName() === '.claude' ? '.claude/skills' : '.agents/skills'; }

  /** Resolve Python venv executable path if it exists */
  function resolveVenv(cwd) {
    const candidates = [
      path.join(cwd, skillsDir(), '.venv', 'bin', 'python3'),
      path.join(cwd, skillsDir(), '.venv', 'Scripts', 'python.exe'),
    ];
    return candidates.find(p => fs.existsSync(p)) || null;
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) process.exit(0);

  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const payload    = normalizeHookPayload(JSON.parse(stdin));
  // Use payload.cwd for monorepo support — subagent may run in a different dir
  const payloadCwd = typeof payload.cwd === 'string' ? payload.cwd.trim() : '';
  const agentCwd   = payloadCwd || process.env.PROJECT_ROOT || process.cwd();
  const runtime    = readRuntime(agentCwd);
  if (runtime === null) process.exit(0);

  // Language config from runtime.json
  const thinkLang    = runtime.locale?.thinkingLanguage || '';
  const respondLang  = runtime.locale?.responseLanguage || '';
  // Default thinking to 'en' when only response language is set
  const effectThink  = thinkLang || (respondLang ? 'en' : '');

  // Resolve paths from env (set by session.cjs) or runtime defaults
  const baseDir    = agentCwd;
  const plansPath  = path.join(baseDir, runtime.paths?.plans || 'plans');
  const docsPath   = path.join(baseDir, runtime.paths?.docs  || 'docs');

  // Build context block
  const lines = [];

  // Language section (only if configured)
  const hasThink = effectThink && effectThink !== respondLang;
  if (hasThink || respondLang) {
    lines.push('## Language');
    if (hasThink)   lines.push(`- Thinking: Use ${effectThink} for reasoning.`);
    if (respondLang) lines.push(`- Response: Respond in ${respondLang}.`);
    lines.push('');
  }

  // Python venv (optional — if <skills>/.venv exists)
  const venv = resolveVenv(agentCwd);

  lines.push('## Rules');
  lines.push(`- Plans → ${plansPath}/ | Docs → ${docsPath}/`);
  if (venv) {
    lines.push(`- Python in ${skillsDir()}/: use \`${venv}\``);
    lines.push('- Never use global pip install');
  }

  // Output in Claude Code SubagentStart required format
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStart',
      additionalContext: lines.join('\n')
    }
  }));

  process.exit(0);

} catch (e) {
  try {
    const fs = require('fs'), p = require('path');
    const d = require('./lib/hook-state-dir.cjs').hookStateDir();
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.appendFileSync(p.join(d, 'hook-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'agent', status: 'crash', error: e.message }) + '\n');
  } catch (_) {}
  process.exit(0);
}
