'use strict';

const fs = require('fs');
const path = require('path');
const {
  pluginRoot,
  resolveProjectRoot,
  logCrash,
  readPayload,
  resolveProjectPath
} = require('./lib/hook-context.cjs');
const { reserveSession } = require('./lib/rules-reservation.cjs');

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
    // The plugin ships the styles in its own tree; an npx install copies them into .codex.
    const dir = pluginRoot() ? path.join(pluginRoot(), 'output-styles') : path.join(projectRoot, '.codex', 'output-styles');
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
  const projectRoot = resolveProjectRoot(payload);
  // An npx install always writes runtime.json; under the plugin it is optional.
  const runtime = readRuntime(projectRoot) || (pluginRoot() ? {} : null);
  if (runtime === null) process.exit(0);
  if (reserveSession(projectRoot, payload.session_id) !== true) process.exit(0);

  // Under the plugin a cloned repository's runtime.json reaches model context, so its
  // locale strings are reduced to one short plain line; npx keeps them as written.
  const clean = pluginRoot() ? require('./lib/plugin-options.cjs').sanitizeLine : (value) => value;
  const respondLang = clean(runtime.locale?.responseLanguage || '');
  const thinkLang = clean(runtime.locale?.thinkingLanguage || '') || (respondLang ? 'en' : '');
  const plansPath = resolveProjectPath(projectRoot, runtime.paths?.plans, 'plans');
  const docsPath = resolveProjectPath(projectRoot, runtime.paths?.docs, 'docs');
  const specsPath = resolveProjectPath(projectRoot, runtime.paths?.specs, 'specs');
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
    `- Markdown: Specs → "${specsPath}/" | Plans → "${plansPath}/" | Docs → "${docsPath}/"`,
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
