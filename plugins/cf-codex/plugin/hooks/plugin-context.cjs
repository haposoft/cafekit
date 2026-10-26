#!/usr/bin/env node
'use strict';

/**
 * SessionStart hook for the Codex plugin only.
 *
 * A plugin cannot ship AGENTS.md, and Codex substitutes no variable in skill text, so
 * this hook injects the CafeKit core as additionalContext and defines the names the
 * plugin's Markdown uses for its own files: {CAFEKIT_ROOT} and one absolute command
 * for every {cafekit:<name>} the build recorded.
 *
 * Registered only in the plugin's hooks.json; the npx install never receives it.
 * Exit: 0 always (fail-open).
 */

const fs = require('fs');
const path = require('path');
const { pluginRoot, resolveProjectRoot, logCrash } = require('../../hooks/lib/hook-context.cjs');

const ROOT_TOKEN = '{CAFEKIT_ROOT}';

// POSIX single quotes keep spaces, `$`, backticks and `"` in the path literal.
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function commandsSection(root, names) {
  const lines = [
    '## CafeKit plugin paths and commands',
    '',
    `- \`${ROOT_TOKEN}\` in CafeKit skills, references and rules means \`${root}\`.`,
    '- Where they say to run `{cafekit:<name>}`, run the command listed here with the arguments they give:',
    ...names.map((name) => `  - \`{cafekit:${name}}\`: \`node ${shellQuote(path.join(root, 'scripts', `${name}.cjs`))}\``),
    '',
    '',
  ];
  return lines.join('\n');
}

try {
  const root = pluginRoot();
  if (!root) process.exit(0);
  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { /* the cwd falls back to the process */ }
  // Beside an npx install the plugin stands down; the session hook already says so.
  resolveProjectRoot(payload);

  const pluginDir = path.join(root, 'plugin');
  const names = JSON.parse(fs.readFileSync(path.join(pluginDir, 'script-commands.json'), 'utf8'));
  // A function replacement keeps `$&`-style sequences in the path literal.
  const core = fs.readFileSync(path.join(pluginDir, 'core.md'), 'utf8').replaceAll(ROOT_TOKEN, () => root);
  // The table follows the marker line, so a longer root can never push it past the cap.
  const split = core.indexOf('\n\n') + 2;
  const text = core.slice(0, split) + commandsSection(root, names) + core.slice(split);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text },
  }));
  process.exit(0);
} catch (error) {
  logCrash('plugin-context', error);
  process.exit(0);
}
