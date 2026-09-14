/**
 * Phase helper: Codex hooks.json merge.
 *
 * `.codex/hooks.json` is a shared configuration file, not a CafeKit payload. It was
 * previously copied verbatim, which made a single user-added hook turn the whole file
 * into a user-modified artifact: a normal install then preserved CafeKit's stale hooks,
 * and `--force-overwrite` destroyed the user's. Merging per command removes that choice.
 *
 * This mirrors how `.claude/settings.json` is handled, so hooks.json likewise stays
 * outside the ownership model: CafeKit owns its own entries, the user owns theirs, and
 * neither erases the other. Honors dry-run.
 */

const fs = require('fs');
const path = require('path');
const { PLATFORMS } = require('../lib/context');

const CODEX_SRC = path.join(__dirname, '../../src/codex');
const HOOK_COMMAND_TEMPLATE = /^node "\.codex\/hooks\/([a-z0-9-]+\.cjs)"$/;
// What an installer before 0.16.2 wrote for POSIX. Kept only to recognize and repair it.
const LEGACY_GIT_COMMAND = /^node "\$\(git rev-parse --show-toplevel\)\/\.codex\/hooks\/([a-z0-9-]+\.cjs)"$/;

/** The hook script a command runs, which is stable across installs and platforms. */
function hookScript(command) {
  if (typeof command !== 'string') return null;
  const match = command.match(/[/\\]hooks[/\\]([a-z0-9-]+\.cjs)/i);
  return match ? match[1] : null;
}

/** Single quotes suppress every shell expansion, so only a literal quote needs escaping. */
function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function hookPathFor(script, projectRoot) {
  return path.join(fs.realpathSync(projectRoot), '.codex', 'hooks', script);
}

/**
 * The POSIX launcher carries the installed path literally.
 *
 * It used to resolve its own root with `$(git rev-parse --show-toplevel)`, which returns
 * nothing outside a repository and the *outer* root for a project nested inside one. Both
 * cases produced a path that does not exist, so Codex started every hook, every hook died,
 * and the gates were silently absent. The path is known at install time, so it is written
 * directly. The literal `/hooks/<script>.cjs` segment must survive, because hookScript()
 * reads it as the identity that lets a reinstall recognize CafeKit's own entries.
 */
function posixHookCommand(script, projectRoot) {
  return `node ${shellQuote(hookPathFor(script, projectRoot))}`;
}

/**
 * Absolute Windows paths cannot be quoted safely inside the Codex command string, so that
 * side travels base64url and is decoded by the launcher.
 */
function windowsHookCommand(script, projectRoot) {
  const encoded = Buffer.from(hookPathFor(script, projectRoot), 'utf8').toString('base64url');
  return 'node -e "process.argv[1]=Buffer.from(process.argv[1],\'base64url\').toString(\'utf8\');require(\'module\').runMain()" ' + encoded;
}

/** Rewrite a managed template handler into absolute launchers for both platforms. */
function materializeHookCommands(handler, projectRoot) {
  const next = { ...handler };
  for (const [field, build] of [['command', posixHookCommand], ['commandWindows', windowsHookCommand]]) {
    if (typeof handler[field] !== 'string') continue;
    const match = handler[field].match(HOOK_COMMAND_TEMPLATE);
    if (!match) throw new Error(`Unsupported Codex hook ${field}: ${handler[field]}`);
    next[field] = build(match[1], projectRoot);
  }
  return next;
}

/**
 * Repair launchers an older installer wrote. A reinstall treats an already-registered
 * script as the user's placement and leaves it alone, so without this pass every existing
 * project would keep its broken git-derived command forever. Only the exact byte pattern
 * CafeKit itself emitted is rewritten; anything else stays untouched.
 */
function repairLegacyCodexLaunchers(config, projectRoot) {
  if (!config.hooks) return { config, repaired: 0 };
  let repaired = 0;
  const hooks = {};
  for (const [eventName, groups] of Object.entries(config.hooks)) {
    if (!Array.isArray(groups)) { hooks[eventName] = groups; continue; }
    hooks[eventName] = groups.map((group) => {
      if (!Array.isArray(group?.hooks)) return group;
      return {
        ...group,
        hooks: group.hooks.map((handler) => {
          const legacy = typeof handler?.command === 'string' && handler.command.match(LEGACY_GIT_COMMAND);
          const template = typeof handler?.commandWindows === 'string'
            && handler.commandWindows.match(HOOK_COMMAND_TEMPLATE);
          if (!legacy && !template) return handler;
          const next = { ...handler };
          if (legacy) next.command = posixHookCommand(legacy[1], projectRoot);
          if (template) next.commandWindows = windowsHookCommand(template[1], projectRoot);
          repaired += 1;
          return next;
        }),
      };
    });
  }
  return { config: repaired > 0 ? { ...config, hooks } : config, repaired };
}

/** Drop CafeKit hooks the manifest has retired, leaving foreign entries untouched. */
function pruneObsoleteCodexHooks(config, ctx) {
  const obsolete = ctx.manifest?.obsolete?.settingsHookCommandSubstrings || [];
  if (!config.hooks || obsolete.length === 0) return { config, removed: 0 };

  let removed = 0;
  const pruned = {};
  for (const [eventName, groups] of Object.entries(config.hooks)) {
    if (!Array.isArray(groups)) { pruned[eventName] = groups; continue; }
    const keptGroups = [];
    for (const group of groups) {
      if (!Array.isArray(group?.hooks)) { keptGroups.push(group); continue; }
      const keptHooks = group.hooks.filter((handler) => {
        const command = handler?.command || '';
        const isObsolete = obsolete.some((substring) => command.includes(substring));
        if (isObsolete) removed += 1;
        return !isObsolete;
      });
      if (keptHooks.length > 0) keptGroups.push({ ...group, hooks: keptHooks });
    }
    if (keptGroups.length > 0) pruned[eventName] = keptGroups;
  }
  return { config: removed > 0 ? { ...config, hooks: pruned } : config, removed };
}

/**
 * Merge CafeKit-managed Codex hooks into the project's hooks.json, preserving every
 * entry CafeKit did not author. Codex only.
 */
function mergeCodexHooks(ctx, platformKey, projectRoot = process.cwd()) {
  if (platformKey !== 'codex') return;

  const templatePath = path.join(CODEX_SRC, 'hooks.json');
  if (!fs.existsSync(templatePath)) {
    ctx.ui.warn('Codex hooks template not found: src/codex/hooks.json');
    return;
  }
  const managed = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const targetPath = path.join(PLATFORMS.codex.folder, 'hooks.json');

  let existing = {};
  if (fs.existsSync(targetPath)) {
    // A malformed hooks.json must not abort the install and must never be
    // overwritten blind: skip the merge and say why.
    try {
      existing = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    } catch (error) {
      ctx.ui.warn(`Codex hooks: ${targetPath} is not valid JSON (${error.message}). `
        + 'Skipping the hooks merge — fix the file and re-run the installer.');
      ctx.results.errors++;
      return;
    }
  }

  const { config: pruned, removed } = pruneObsoleteCodexHooks({ ...existing }, ctx);
  if (removed > 0) {
    ctx.ui.detail(`  ↻ ${ctx.dryRun ? '[dry-run] ' : ''}Codex hooks: removed ${removed} obsolete hook(s)`);
    ctx.results.updated++;
  }

  const { config: base, repaired } = repairLegacyCodexLaunchers(pruned, projectRoot);
  if (repaired > 0) {
    ctx.ui.detail(`  ↻ ${ctx.dryRun ? '[dry-run] ' : ''}Codex hooks: repaired ${repaired} launcher(s) that resolved their path through Git`);
    ctx.results.updated++;
  }

  const merged = { ...base };
  if (typeof managed.description === 'string' && typeof merged.description !== 'string') {
    merged.description = managed.description;
  }
  merged.hooks = { ...(base.hooks || {}) };

  let added = 0;
  for (const [eventName, managedGroups] of Object.entries(managed.hooks || {})) {
    const groups = Array.isArray(merged.hooks[eventName]) ? [...merged.hooks[eventName]] : [];
    // A script already registered anywhere under this event stays where the user put
    // it. Matching on the script rather than the whole command survives the path
    // differences between installs and platforms.
    const registered = new Set(
      groups.flatMap((group) => (group?.hooks || []).map((handler) => hookScript(handler?.command))).filter(Boolean),
    );

    for (const managedGroup of managedGroups) {
      const wanted = (managedGroup.hooks || [])
        .filter((handler) => {
          const script = hookScript(handler?.command);
          return script && !registered.has(script);
        })
        .map((handler) => materializeHookCommands(handler, projectRoot));
      if (wanted.length === 0) continue;

      const matcher = managedGroup.matcher || '';
      const target = groups.find((group) => (group?.matcher || '') === matcher && Array.isArray(group?.hooks));
      if (target) {
        target.hooks = [...target.hooks, ...wanted];
      } else {
        groups.push({ ...managedGroup, hooks: wanted });
      }
      for (const handler of wanted) registered.add(hookScript(handler.command));
      added += wanted.length;
      ctx.ui.detail(`  ✓ ${ctx.dryRun ? '[dry-run] ' : ''}Codex hooks: ${eventName} merged (+${wanted.length})`);
    }

    merged.hooks[eventName] = groups;
  }

  if (added === 0 && removed === 0) {
    ctx.ui.detail(`  → ${ctx.dryRun ? '[dry-run] ' : ''}Codex hooks: already registered`);
    ctx.results.unchanged++;
  }

  if (!ctx.dryRun) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  }
}

module.exports = {
  mergeCodexHooks,
  pruneObsoleteCodexHooks,
  repairLegacyCodexLaunchers,
  hookScript,
};
