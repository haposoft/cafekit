#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * Point the user's Claude Code statusLine at the CafeKit plugin launcher.
 *
 *   node setup-statusline.cjs [--settings <path>]   default: ~/.claude/settings.json
 *
 * A plugin cannot ship a statusLine, and its root moves on every update, so the
 * plugin-context hook keeps a stable launcher in the plugin data directory and
 * records that directory in ~/.claude/cafekit-plugin-data. This script only sets
 * statusLine when it is absent or already points at that launcher; any other
 * statusLine is left byte-identical. Exit 1 when nothing could be written safely.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const POINTER = path.join(os.homedir(), '.claude', 'cafekit-plugin-data');

function fail(message) {
  console.error(`setup-statusline: ${message}`);
  process.exit(1);
}

function settingsPath(argv) {
  const index = argv.indexOf('--settings');
  const file = index >= 0 ? argv[index + 1] : path.join(os.homedir(), '.claude', 'settings.json');
  if (!file) fail('--settings needs a path');
  // Dotfile setups symlink settings.json; write the target so the link survives.
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

function main() {
  let dataDir;
  try {
    dataDir = fs.readFileSync(POINTER, 'utf8').trim();
  } catch {
    fail(`no CafeKit plugin session has run yet (missing ${POINTER}); start a new Claude Code session and retry`);
  }
  const launcher = path.join(dataDir, 'status.cjs');
  if (!path.isAbsolute(dataDir) || !fs.existsSync(launcher)) fail(`launcher not found at ${launcher}; start a new Claude Code session and retry`);

  const file = settingsPath(process.argv.slice(2));
  let settings = {};
  if (fs.existsSync(file)) {
    try {
      settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      fail(`${file} is not valid JSON (${error.message}); fix it, then retry`);
    }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) fail(`${file} does not hold a JSON object`);
  }

  const command = `node ${JSON.stringify(launcher)}`;
  // Only an absent statusLine or exactly CafeKit's own command may be replaced;
  // anything else, even one that merely mentions the launcher, belongs to the user.
  const ownCommands = new Set([command, `node ${launcher}`]);
  if (settings.statusLine !== undefined && !ownCommands.has(settings.statusLine?.command)) {
    console.log(`${file} already has a statusLine (${JSON.stringify(settings.statusLine)}); left unchanged. Remove it first to use the CafeKit statusline.`);
    return;
  }

  settings.statusLine = { type: 'command', command, padding: 0 };
  // settings.json may hold API keys in `env`; keep the user's permissions (e.g. 0600).
  let mode = 0o644;
  try { mode = fs.statSync(file).mode & 0o777; } catch { /* new file */ }
  const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temp, `${JSON.stringify(settings, null, 2)}\n`, { mode });
    fs.chmodSync(temp, mode);
    fs.renameSync(temp, file);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch { /* nothing to clean */ }
    fail(`could not write ${file} (${error.message})`);
  }
  console.log(`statusLine now runs the CafeKit statusline: ${file}`);
}

main();
