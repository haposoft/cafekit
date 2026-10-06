'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  getHookContext,
  hookStateDir,
  logCrash,
  readPayload,
  resolveProjectPath
} = require('./lib/hook-context.cjs');

function reservationFile(projectRoot, sessionId) {
  const key = crypto.createHash('sha256')
    .update(String(sessionId || 'unknown'))
    .digest('hex')
    .slice(0, 16);
  return path.join(hookStateDir(projectRoot), `rules-${key}.json`);
}

/** Reserve one injection slot per session. Returns null on reservation errors. */
function reserveSession(projectRoot, sessionId) {
  if (!sessionId) return null;
  try {
    const file = reservationFile(projectRoot, sessionId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
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

/**
 * Body of the output style for `codingLevel`, or null.
 *
 * Codex CLI has no output-style feature, so the style Claude Code would load natively is
 * injected here instead. The rules hook reserves one injection per session, so this costs
 * the same as a host-loaded style rather than repeating every turn.
 */
function readCodingStyle(projectRoot, level) {
  if (!Number.isInteger(level) || level < 0 || level > 5) return null;
  try {
    const dir = path.join(projectRoot, '.codex', 'output-styles');
    const match = fs.readdirSync(dir).find((name) => name.startsWith(`coding-level-${level}-`));
    if (!match) return null;
    const raw = fs.readFileSync(path.join(dir, match), 'utf8');
    // Strip the frontmatter Claude Code reads; Codex only needs the instructions.
    const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
    return body || null;
  } catch {
    return null;
  }
}

function readRuntime(projectRoot) {
  try {
    const file = path.join(projectRoot, '.codex', 'runtime.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  } catch {
    return null;
  }
}

try {
  const payload = readPayload();
  if (!payload) process.exit(0);
  const { projectRoot } = getHookContext(payload);
  if (reserveSession(projectRoot, payload.session_id) !== true) process.exit(0);
  const runtime = readRuntime(projectRoot);
  if (runtime === null) process.exit(0);

  const respondLang = runtime.locale?.responseLanguage || '';
  const thinkLang = runtime.locale?.thinkingLanguage || (respondLang ? 'en' : '');
  const plansPath = resolveProjectPath(projectRoot, runtime.paths?.plans, 'plans');
  const docsPath = resolveProjectPath(projectRoot, runtime.paths?.docs, 'docs');
  const lines = [];

  if ((thinkLang && thinkLang !== respondLang) || respondLang) {
    lines.push('## Language');
    if (thinkLang && thinkLang !== respondLang) {
      lines.push(`- Thinking: Use ${thinkLang} for reasoning.`);
    }
    if (respondLang) lines.push(`- Response: Respond in ${respondLang}.`);
    lines.push('');
  }

  lines.push(
    '## Rules',
    `- Markdown: Plans → "${plansPath}/" | Docs → "${docsPath}/"`,
    '- Do not create markdown outside those directories unless explicitly asked.',
    `- docs.maxLoc: ${runtime.docs?.maxLoc || 800} lines per doc file`
  );

  const style = readCodingStyle(projectRoot, runtime.codingLevel);
  if (style) {
    lines.push('', '## Communication style', style);
  }

  process.stdout.write(`${lines.join('\n')}\n`);
} catch (error) {
  logCrash('rules', error);
}
