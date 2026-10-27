'use strict';

/**
 * Plan the edits `migrate` makes to files CafeKit merged into rather than owned:
 * Claude settings, Codex hooks, the instruction-file marker blocks and the root
 * `.gitignore`. Only CafeKit entries go; every user entry and the ignore
 * protection of every kept path stay. It reads files and never writes; when a hook
 * config does not parse it marks the hook scripts of `manifestPlan` kept, so render
 * the manifest plan after calling it.
 */

const fs = require('fs');
const path = require('path');
const { managedRange } = require('./instruction-blocks');
const { managedHandlerScript } = require('../phases/codex-hooks');

const SETTINGS_TEMPLATE = require('../../src/claude/settings/settings.json');
const CODEX_HOOKS_TEMPLATE = require('../../src/codex/hooks.json');

const CLAUDE_START = '<!-- CAFEKIT CLAUDE START -->';
const CLAUDE_END = '<!-- CAFEKIT CLAUDE END -->';
const CORE_START = '<!-- CAFEKIT CORE START -->';
const CORE_END = '<!-- CAFEKIT CORE END -->';
const CODEX_START = '<!-- CAFEKIT CODEX START -->';
const CODEX_END = '<!-- CAFEKIT CODEX END -->';

const GITIGNORE_HEADER = '# CafeKit / Ecosystem';
// The lines ensureGitignore() writes under its header (bin/phases/root-config.js),
// with the older plan patterns it migrates from.
const GITIGNORE_PATTERNS = new Set([
  'specs/_shared/', '.cafekit-backup/', '.cafekit.lock', '.omp/',
  'plans', 'plans/', 'plans/*', 'plans/**', 'plans/**/*', '!plans/*.md',
  '!plans/templates', '!plans/templates/', '!plans/templates/*', '!plans/templates/**', '!plans/templates/**/*',
  '.claude', '.claude/', '.codex', '.codex/', '.agents', '.agents/'
]);
// Only the platform folders can disappear; every other block line always stays.
const FOLDER_OWNER = { '.claude/': 'claude', '.codex/': 'codex', '.agents/': 'codex' };
const REMOVABLE_FOLDERS = { '.claude': '.claude/', '.claude/': '.claude/', '.codex': '.codex/', '.codex/': '.codex/', '.agents': '.agents/', '.agents/': '.agents/' };

const CLAUDE_HOOK_COMMAND = /^node\s+(["']?)(?:\$\{?CLAUDE_PROJECT_DIR\}?\/)?\.claude\/hooks\/([a-z0-9-]+\.cjs)\1$/;
// Any mention of a top-level hook script, used to report handlers left pointing at a removed one.
const HOOK_SCRIPT_MENTION = /\.(claude|codex)[/\\]hooks[/\\]([A-Za-z0-9._-]+\.cjs)/g;
const CODEX_HOOK_SCRIPT = /'([^']*[/\\]\.codex[/\\]hooks[/\\][a-z0-9-]+\.cjs)'\s*$/;

function readOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function templateCommands() {
  const commands = new Set();
  for (const groups of Object.values(SETTINGS_TEMPLATE.hooks || {})) {
    for (const group of groups) for (const handler of group.hooks || []) commands.add(handler.command);
  }
  return commands;
}

/** Drop handlers `isCafekit` claims, then every group, event and hooks key left empty. */
function pruneHandlers(config, isCafekit) {
  const dropped = [];
  const hooks = {};
  for (const [event, groups] of Object.entries(config.hooks || {})) {
    if (!Array.isArray(groups)) {
      hooks[event] = groups;
      continue;
    }
    const kept = [];
    for (const group of groups) {
      if (!group || !Array.isArray(group.hooks)) {
        kept.push(group);
        continue;
      }
      const handlers = group.hooks.filter((handler) => {
        const cafekit = isCafekit(handler);
        if (cafekit) dropped.push(handler);
        return !cafekit;
      });
      if (handlers.length > 0) kept.push({ ...group, hooks: handlers });
    }
    if (kept.length > 0) hooks[event] = kept;
  }
  const next = { ...config };
  if (Object.keys(hooks).length > 0) next.hooks = hooks;
  else delete next.hooks;
  return { config: next, dropped };
}

const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;

function fileAction(rel, before, after, extra = {}) {
  if (after === null) return { path: rel, action: 'remove', before, after: null, ...extra };
  return { path: rel, action: after === before ? 'unchanged' : 'write', before, after, ...extra };
}

function planClaudeSettings(root, removedPaths, keptPaths, reports) {
  const rel = '.claude/settings.json';
  const before = readOrNull(path.join(root, rel));
  if (before === null) return null;
  let config;
  try {
    config = JSON.parse(before);
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('not an object');
  } catch {
    return { path: rel, action: 'unparsed', before, after: before, keepPrefixes: ['.claude/hooks/', '.claude/status.cjs'] };
  }
  const templates = templateCommands();
  const { config: next, dropped } = pruneHandlers(config, (handler) => {
    const command = typeof handler?.command === 'string' ? handler.command.trim() : '';
    if (templates.has(command)) return true;
    const script = command.match(CLAUDE_HOOK_COMMAND);
    return Boolean(script && removedPaths.has(`.claude/hooks/${script[2]}`));
  });
  for (const handler of dropped) {
    const script = String(handler.command).match(CLAUDE_HOOK_COMMAND);
    if (script && keptPaths.has(`.claude/hooks/${script[2]}`)) {
      reports.push(`.claude/hooks/${script[2]} is kept (edited) but no longer registered; the Claude plugin runs its own copy`);
    }
  }
  reportDanglingHandlers(rel, next, removedPaths, reports);
  if (next.statusLine?.command === SETTINGS_TEMPLATE.statusLine.command && removedPaths.has('.claude/status.cjs')) {
    delete next.statusLine;
    reports.push('The CafeKit status line goes with .claude/status.cjs; run `/cf:setup-statusline` to set it up from the plugin');
  }
  const after = Object.keys(next).length === 0 ? null : jsonText(next);
  return fileAction(rel, before, after === jsonText(config) ? before : after, { dropped: dropped.length });
}

/** A handler that stays but still runs a hook script the plan removes would fail on every event. */
function reportDanglingHandlers(rel, config, removedPaths, reports) {
  for (const handler of Object.values(config.hooks || {}).flat().flatMap((group) => (Array.isArray(group?.hooks) ? group.hooks : []))) {
    const text = [handler?.command, handler?.commandWindows].filter((value) => typeof value === 'string').join(' ');
    for (const match of text.matchAll(HOOK_SCRIPT_MENTION)) {
      if (removedPaths.has(`.${match[1]}/hooks/${match[2]}`)) {
        reports.push(`A handler kept in ${rel} still runs .${match[1]}/hooks/${match[2]}, which is removed; edit or delete it: ${handler.command}`);
      }
    }
  }
}

function planCodexHooks(root, removedPaths, keptPaths, reports) {
  const rel = '.codex/hooks.json';
  const before = readOrNull(path.join(root, rel));
  if (before === null) return null;
  let config;
  try {
    config = JSON.parse(before);
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('not an object');
  } catch {
    return { path: rel, action: 'unparsed', before, after: before, keepPrefixes: ['.codex/hooks/'] };
  }
  const { config: next, dropped } = pruneHandlers(config, (handler) => Boolean(managedHandlerScript(handler)));
  if (!next.hooks && next.description === CODEX_HOOKS_TEMPLATE.description) delete next.description;
  for (const handler of dropped) {
    const script = managedHandlerScript(handler);
    if (keptPaths.has(`.codex/hooks/${script}`)) {
      reports.push(`.codex/hooks/${script} is kept (edited) but no longer registered; the Codex plugin runs its own copy`);
    }
  }
  reportDanglingHandlers(rel, next, removedPaths, reports);
  const after = Object.keys(next).length === 0 ? null : jsonText(next);
  const action = fileAction(rel, before, after === jsonText(config) ? before : after, { dropped: dropped.length });
  action.standDown = codexStandDown(root, next, removedPaths);
  if (action.standDown.length > 0) {
    reports.push(`The Codex plugin keeps standing down while these handlers stay in .codex/hooks.json: ${action.standDown.join('; ')}`);
  }
  return action;
}

/**
 * The handlers that would still make the Codex plugin stand down after the plan.
 * Mirrors hasProjectCafekitHooks() in src/codex/hooks/lib/hook-context.cjs, evaluated
 * on the planned contents and on the files that survive the plan.
 */
function codexStandDown(root, config, removedPaths) {
  const commands = Object.values(config?.hooks || {}).flat()
    .flatMap((group) => (Array.isArray(group?.hooks) ? group.hooks : []))
    .map((handler) => String(handler?.command || ''));
  const matched = commands
    .map((command) => ({ command, script: command.match(CODEX_HOOK_SCRIPT)?.[1] }))
    .filter((item) => item.script);
  if (matched.length === 0) return [];
  const expectedDir = path.join(root, '.codex', 'hooks');
  let hooksDir;
  try {
    hooksDir = fs.realpathSync(expectedDir);
  } catch {
    return [];
  }
  const survives = ({ script }) => {
    if (!path.isAbsolute(script) || path.dirname(script) !== expectedDir) return false;
    const rel = path.relative(root, script).split(path.sep).join('/');
    if (removedPaths.has(rel)) return false;
    try {
      const real = fs.realpathSync(script);
      return path.dirname(real) === hooksDir && fs.statSync(real).isFile();
    } catch {
      return false;
    }
  };
  return matched.every(survives) ? matched.map((item) => item.command) : [];
}

/**
 * Remove one marker block, joining what surrounds it with a single blank line in the
 * file's own line ending. Only blank lines are trimmed, so user indentation stays.
 */
function cutRange(content, range) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const before = content.slice(0, range.start).replace(/(?:\r?\n[ \t]*)+$/, '');
  const after = content.slice(range.end).replace(/^[ \t]*(?:\r?\n[ \t]*)*\r?\n/, '').replace(/^[ \t]*$/, '');
  if (!before.trim()) return after;
  if (!after.trim()) return `${before}${eol}`;
  return `${before}${eol}${eol}${after}`;
}

function planAgentsMd(root, blocks, reports) {
  const rel = 'AGENTS.md';
  const before = readOrNull(path.join(root, rel));
  if (before === null) return null;
  let after = before;
  for (const [start, end] of blocks) {
    const range = managedRange(after, start, end);
    if (range === false) return { path: rel, action: 'unparsed', before, after: before, userText: true };
    if (!range) continue;
    if (start === CORE_START && after.slice(range.bodyStart, range.bodyEnd).includes('cafekit:lang')) {
      reports.push('The response-language choice stored in the AGENTS.md CafeKit block goes with the block');
    }
    after = cutRange(after, range);
  }
  const userText = after.trim().length > 0;
  return fileAction(rel, before, userText ? after : null, { userText });
}

function planClaudeMd(root, agents) {
  const rel = 'CLAUDE.md';
  const before = readOrNull(path.join(root, rel));
  if (before === null) return null;
  const range = managedRange(before, CLAUDE_START, CLAUDE_END);
  if (range === false) return { path: rel, action: 'unparsed', before, after: before };
  if (!range) return fileAction(rel, before, before);
  let after = cutRange(before, range);
  // The CafeKit block carried the `@AGENTS.md` import; keep loading the user's AGENTS.md text.
  if (agents?.userText && !/^@AGENTS\.md\s*$/m.test(after)) {
    after = after.trim() ? `@AGENTS.md\n\n${after}` : '@AGENTS.md\n';
  }
  return fileAction(rel, before, after.trim() ? after : null);
}

function planGitignore(root, survivingFolders) {
  const rel = '.gitignore';
  const before = readOrNull(path.join(root, rel));
  if (before === null) return null;
  const lines = before.split('\n');
  const header = lines.findIndex((line) => line.trim() === GITIGNORE_HEADER);
  if (header < 0) return fileAction(rel, before, before);
  const removed = new Set();
  for (let index = header + 1; index < lines.length && GITIGNORE_PATTERNS.has(lines[index].trim()); index++) {
    const folder = REMOVABLE_FOLDERS[lines[index].trim()];
    if (folder && !survivingFolders.has(folder)) removed.add(index);
  }
  const after = lines.filter((_, index) => !removed.has(index)).join('\n');
  return fileAction(rel, before, after, { removedLines: [...removed].map((index) => lines[index].trim()) });
}

function planMergedFiles(projectRoot, manifestPlan) {
  const root = fs.realpathSync(projectRoot);
  const reports = [];
  const refused = fs.existsSync(path.join(root, '.omp', 'cafekit-manifest.json'))
    ? 'omp: an .omp/ install shares the instruction blocks and skill folders; migrate does not change it'
    : null;

  const removedPaths = new Set(manifestPlan.entries.filter((entry) => entry.action === 'remove').map((entry) => entry.path));
  const keptPaths = new Set(manifestPlan.entries.filter((entry) => entry.action === 'keep').map((entry) => entry.path));
  const claudePlanned = manifestPlan.platforms.claude?.status === 'planned';
  const codexPlanned = manifestPlan.platforms.codex?.status === 'planned';

  const files = [];
  const settings = claudePlanned ? planClaudeSettings(root, removedPaths, keptPaths, reports) : null;
  const hooks = codexPlanned ? planCodexHooks(root, removedPaths, keptPaths, reports) : null;
  // CORE is shared by every runtime, so it goes only when no other install still reads it.
  const installed = Object.values(manifestPlan.platforms).filter((platform) => platform.status !== 'absent');
  const blocks = [
    ...(installed.every((platform) => platform.status === 'planned') ? [[CORE_START, CORE_END]] : []),
    ...(codexPlanned ? [[CODEX_START, CODEX_END]] : [])
  ];
  const agents = planAgentsMd(root, blocks, reports);
  const claudeMd = claudePlanned ? planClaudeMd(root, agents) : null;
  files.push(settings, hooks, agents, claudeMd);

  // An unparsable hook config may still register any hook script, so all of them stay.
  for (const unparsed of [settings, hooks].filter((file) => file?.action === 'unparsed')) {
    for (const entry of manifestPlan.entries) {
      if (entry.action === 'remove' && unparsed.keepPrefixes.some((prefix) => entry.path.startsWith(prefix))) {
        Object.assign(entry, { action: 'keep', reason: 'required-by-kept' });
        removedPaths.delete(entry.path);
      }
    }
  }

  const surviving = [
    ...manifestPlan.entries.filter((entry) => entry.action === 'keep').map((entry) => entry.path),
    ...manifestPlan.untracked,
    ...files.filter((file) => file && file.action !== 'remove').map((file) => file.path)
  ];
  // A folder of an install migrate leaves alone (absent, refused, unmanaged) is never gone while it exists.
  const survives = (folder) => (manifestPlan.platforms[FOLDER_OWNER[folder]]?.status === 'planned'
    ? surviving.some((rel) => rel.startsWith(folder))
    : fs.existsSync(path.join(root, folder)));
  const survivingFolders = new Set(Object.values(REMOVABLE_FOLDERS).filter(survives));
  files.push(planGitignore(root, survivingFolders));

  const npxOnly = new Set(manifestPlan.entries.filter((entry) => entry.reason === 'npx-only' && entry.group)
    .map((entry) => entry.group.name.replace(/_/g, '-')));
  if (npxOnly.size > 0) {
    reports.push(`No plugin ships these, so their npx copies stay: ${[...npxOnly].sort().join(', ')}`);
  }
  if (claudePlanned) {
    reports.push('Grok CLI reads hooks from .claude/settings.json; a Grok setup that used this Claude install has no CafeKit hooks afterwards');
  }
  return { refused, files: files.filter(Boolean), reports };
}

function renderMergedPlan(plan) {
  const lines = [];
  if (plan.refused) lines.push(`Refused — ${plan.refused}`);
  for (const file of plan.files) {
    const detail = file.action === 'write' && file.dropped !== undefined ? ` (${file.dropped} CafeKit handlers removed)`
      : file.removedLines?.length ? ` (lines removed: ${file.removedLines.join(', ')})` : '';
    lines.push(`  ${file.action.padEnd(9)} ${file.path}${detail}`);
  }
  if (plan.reports.length > 0) {
    lines.push('', 'The plugins will not take over:');
    for (const report of plan.reports) lines.push(`  - ${report}`);
  }
  return lines.join('\n');
}

module.exports = { planMergedFiles, renderMergedPlan };
