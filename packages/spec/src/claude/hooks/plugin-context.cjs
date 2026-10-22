#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * SessionStart Hook — plugin-context.cjs (Claude Code plugin only)
 *
 * A plugin cannot ship CLAUDE.md or rules files as always-on context, so this
 * hook injects the CafeKit core instructions as SessionStart additionalContext.
 * The host caps that text at 10,000 characters; plugin/core.md is sized for it
 * and points to the detailed rules files by absolute path.
 *
 * Registered only in the plugin's hooks.json; the npx install never runs it.
 * Exit: 0 always (fail-open)
 */

try {
  const fs = require('fs');
  const path = require('path');

  const os = require('os');

  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) process.exit(0);

  function writeAtomic(file, text) {
    const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temp, text);
    fs.renameSync(temp, file);
  }

  // A user statusLine cannot use ${CLAUDE_PLUGIN_ROOT}, which moves on every
  // update, so keep a stable launcher in the data directory pointing at the
  // current version, and record where it is for /cf:setup-statusline.
  function writeStatuslineLauncher(root) {
    const data = process.env.CLAUDE_PLUGIN_DATA;
    if (!data || !path.isAbsolute(data)) return;
    try {
      const target = JSON.stringify(path.join(root, 'status.cjs'));
      writeAtomic(path.join(data, 'status.cjs'), [
        '#!/usr/bin/env node',
        '// Written by the CafeKit plugin at session start; runs the installed version\'s statusline.',
        '// A removed or replaced version prints nothing; a broken one still reports its error.',
        `if (!require('fs').existsSync(${target})) process.exit(0);`,
        `require(${target});`,
        '',
      ].join('\n'));
      writeAtomic(path.join(os.homedir(), '.claude', 'cafekit-plugin-data'), `${data}\n`);
    } catch { /* the statusline is optional; never fail the session for it */ }
  }

  try { fs.readFileSync(0, 'utf8'); } catch { /* the payload is not needed */ }

  let core = fs.readFileSync(path.join(__dirname, '..', 'plugin', 'core.md'), 'utf8')
    // A function replacement keeps `$&`-style sequences in the path literal.
    .replaceAll('${CLAUDE_PLUGIN_ROOT}', () => pluginRoot);

  // The npx install writes this section into CLAUDE.md; the plugin takes it from its option.
  const address = require('./lib/plugin-options.cjs').pluginOption('address');
  if (address) {
    core += `\n## Addressing (Context Overflow Indicator)\n\nAlways address the user as ${JSON.stringify(address)} throughout the conversation. If you stop doing so, the context has been compacted or truncated; tell the user to consider \`/clear\`.\n`;
  }

  writeStatuslineLauncher(pluginRoot);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: core },
  }));
  process.exit(0);
} catch (e) {
  try {
    const fs = require('fs');
    const p = require('path');
    const d = require('./lib/hook-state-dir.cjs').hookStateDir();
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.appendFileSync(p.join(d, 'hook-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'plugin-context', status: 'crash', error: e.message }) + '\n');
  } catch (_) { /* logging must not fail the session */ }
  process.exit(0);
}
