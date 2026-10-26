'use strict';

/**
 * Claude Code plugin options for the hooks.
 *
 * The plugin's userConfig values reach hooks as CLAUDE_PLUGIN_OPTION_<KEY> and are
 * injected into model context verbatim, so each one is reduced to a single short
 * line: no control, bidi, or zero-width characters or line breaks that could open a
 * new section or disguise the text, and
 * at most 64 characters so the core stays inside the host's context budget.
 */

const fs = require('fs');
const path = require('path');

const MAX_OPTION_LENGTH = 64;

/**
 * True when the hook runs from the Claude Code plugin rather than an npx install.
 * The variable alone is not enough: an npx hook can inherit it from a parent process,
 * so this file must really live under that plugin root.
 */
function isPlugin() {
  const declared = process.env.CLAUDE_PLUGIN_ROOT;
  if (!declared) return false;
  try {
    return fs.realpathSync(declared) === fs.realpathSync(path.resolve(__dirname, '..', '..'));
  } catch {
    return false;
  }
}

/** One short plain line: no control, bidi, or zero-width characters; at most 64 characters. */
function sanitizeLine(raw) {
  if (typeof raw !== 'string') return '';
  return [...raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]+/g, ' ').replace(/\s+/g, ' ').trim()]
    .slice(0, MAX_OPTION_LENGTH)
    .join('')
    .trim();
}

/** Sanitized option value, or '' when unset. `key` is the userConfig key, e.g. `response_language`. */
function pluginOption(key) {
  return sanitizeLine(process.env[`CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`]);
}

module.exports = { MAX_OPTION_LENGTH, isPlugin, pluginOption, sanitizeLine };
