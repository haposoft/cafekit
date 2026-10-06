/**
 * Phase helper: Claude settings.json merge + obsolete-hook pruning.
 *
 * settings.json is merged (not a verbatim payload copy), so it stays outside
 * the ownership model: managed statusLine/hooks are merged into the user's
 * existing settings, and obsolete hook registrations are pruned. Honors dry-run.
 */

const fs = require('fs');
const path = require('path');
const { PLATFORMS } = require('../lib/context');

const SRC_CLAUDE = path.join(__dirname, '../../src/claude');

/**
 * Remove obsolete hook entries from a settings object whose command matches any
 * manifest-listed substring (e.g. a retired router hook). Returns a possibly
 * new settings object.
 */
function pruneObsoleteSettingsHooks(settings, ctx) {
  const obsoleteSubstrings = ctx.manifest?.obsolete?.settingsHookCommandSubstrings || [];

  if (!settings.hooks || obsoleteSubstrings.length === 0) {
    return settings;
  }

  let removedCount = 0;
  const prunedHooks = {};

  Object.entries(settings.hooks).forEach(([eventName, matcherEntries]) => {
    if (!Array.isArray(matcherEntries)) {
      prunedHooks[eventName] = matcherEntries;
      return;
    }

    const prunedEntries = [];
    matcherEntries.forEach((entry) => {
      if (!Array.isArray(entry?.hooks)) {
        prunedEntries.push(entry);
        return;
      }
      const remainingHooks = entry.hooks.filter((hook) => {
        const command = hook?.command || '';
        const isObsolete = obsoleteSubstrings.some((substring) => command.includes(substring));
        if (isObsolete) removedCount++;
        return !isObsolete;
      });
      if (remainingHooks.length > 0) {
        prunedEntries.push({ ...entry, hooks: remainingHooks });
      }
    });

    if (prunedEntries.length > 0) {
      prunedHooks[eventName] = prunedEntries;
    }
  });

  if (removedCount > 0) {
    ctx.ui.detail(`  ↻ ${ctx.dryRun ? '[dry-run] ' : ''}Settings: removed ${removedCount} obsolete hook(s)`);
    ctx.results.updated++;
    return { ...settings, hooks: prunedHooks };
  }

  return settings;
}

/**
 * Merge CafeKit-managed statusLine + hooks into .claude/settings.json,
 * preserving user-owned entries. Claude only.
 */
function mergeClaudeSettings(ctx, platformKey) {
  if (platformKey !== 'claude') return;

  const manifest = ctx.manifest;
  if (!manifest?.settings?.template) return;

  const templatePath = path.join(SRC_CLAUDE, manifest.settings.template);
  const targetPath = path.join(PLATFORMS.claude.folder, 'settings.json');

  if (!fs.existsSync(templatePath)) {
    ctx.ui.warn(`Settings template not found: ${manifest.settings.template}`);
    return;
  }

  const managedSettings = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  let existingSettings = {};
  if (fs.existsSync(targetPath)) {
    // A malformed user settings.json must not abort the whole install: skip the
    // settings merge (never overwrite the user's file blind) and tell them why.
    try {
      existingSettings = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    } catch (e) {
      ctx.ui.warn(`Settings: ${targetPath} is not valid JSON (${e.message}). ` +
        'Skipping settings merge — fix the file and re-run the installer.');
      ctx.results.errors++;
      return;
    }
  }

  const mergedSettings = pruneObsoleteSettingsHooks({ ...existingSettings }, ctx);

  // statusLine: adopt managed value if upgrading, missing, or CafeKit-owned.
  if (managedSettings.statusLine) {
    const existingCommand = existingSettings.statusLine?.command || '';
    const isCafeKitOwned = existingCommand.includes('status.cjs') || existingCommand.includes('statusline.cjs');
    if (ctx.options.forceOverwrite || !existingSettings.statusLine || isCafeKitOwned) {
      mergedSettings.statusLine = managedSettings.statusLine;
      ctx.ui.detail(`  ✓ ${ctx.dryRun ? '[dry-run] ' : ''}Settings: statusLine merged`);
    }
  }

  // outputStyle: a reader preference, not CafeKit functionality. Seed it once when
  // the user has none, and never replace a choice they made — not even under
  // --force-overwrite, which exists to repair managed files, not to reset taste.
  if (managedSettings.outputStyle && !existingSettings.outputStyle) {
    mergedSettings.outputStyle = managedSettings.outputStyle;
    ctx.ui.detail(`  ✓ ${ctx.dryRun ? '[dry-run] ' : ''}Settings: outputStyle seeded (${managedSettings.outputStyle})`);
  }

  // hooks: merge managed hooks per command (not per entry). An entry is keyed
  // by its matcher; commands missing from the matching entry are appended, so
  // a new command added to an existing matcher entry is not swallowed on
  // upgrade (the old dedupe only looked at each entry's FIRST command).
  if (managedSettings.hooks) {
    mergedSettings.hooks = mergedSettings.hooks || {};
    Object.keys(managedSettings.hooks).forEach((eventName) => {
      const managedHooks = managedSettings.hooks[eventName];
      const existingHooks = mergedSettings.hooks[eventName] || [];
      const mergedHooks = [...existingHooks];

      // Commands already registered anywhere under this event (any matcher):
      // a user may have moved a hook to another entry — never re-add it.
      const eventCommands = new Set(
        mergedHooks.flatMap((entry) => (entry?.hooks || []).map((h) => h?.command)).filter(Boolean)
      );

      managedHooks.forEach((managedHook) => {
        const managedMatcher = managedHook.matcher || '';
        const managedCommands = (managedHook.hooks || [])
          .filter((h) => h?.command && !eventCommands.has(h.command));
        if (managedCommands.length === 0) return;

        const target = mergedHooks.find((entry) =>
          (entry?.matcher || '') === managedMatcher && Array.isArray(entry?.hooks));

        if (!target) {
          mergedHooks.push({ ...managedHook, hooks: managedCommands });
          managedCommands.forEach((h) => eventCommands.add(h.command));
          ctx.ui.detail(`  ✓ ${ctx.dryRun ? '[dry-run] ' : ''}Settings: hook ${eventName} merged`);
          return;
        }

        managedCommands.forEach((hook) => {
          target.hooks.push(hook);
          eventCommands.add(hook.command);
        });
        ctx.ui.detail(`  ✓ ${ctx.dryRun ? '[dry-run] ' : ''}Settings: hook ${eventName} merged (+${managedCommands.length} command${managedCommands.length > 1 ? 's' : ''})`);
      });

      mergedSettings.hooks[eventName] = mergedHooks;
    });
  }

  if (!ctx.dryRun) {
    fs.writeFileSync(targetPath, JSON.stringify(mergedSettings, null, 2), 'utf8');
  }
}

module.exports = { pruneObsoleteSettingsHooks, mergeClaudeSettings };
