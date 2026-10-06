#!/usr/bin/env node

/**
 * CafeKit Installer (orchestrator)
 *
 * Thin coordinator that runs the install as a sequence of phase handlers. Each
 * phase receives and returns the run context (`ctx`). Heavy logic lives in
 * bin/phases/* and bin/lib/*. Terminal UX is rendered via ctx.ui (clack in an
 * interactive TTY; plain logs when piped/CI/--yes).
 *
 * Safety features:
 *  - Process lock (lib/lock)       — refuses to run concurrently.
 *  - Pre-run snapshot (lib/backup) — rolls back on a mid-install crash.
 *  - Ownership manifest (lib/manifest) — selective update; preserves user edits.
 *  - --dry-run                     — preview only, no filesystem changes.
 */

const { spawnSync } = require('child_process');
const { buildContext, PLATFORMS, packageJson } = require('./lib/context');
const lock = require('./lib/lock');
const backup = require('./lib/backup');
const manifestLib = require('./lib/manifest');

const { selectLanguage, resolvePlatforms } = require('./phases/select-platform');
const { selectDocumentSkills } = require('./phases/select-skill-bundles');
const { copyPlatformFiles } = require('./phases/copy-payload');
const {
  copyRoutingFile,
  copyClaudeRuntimeFiles,
  removeObsoleteClaudeRuntimeFiles,
  copyClaudeMdFile,
  ensureSharedAgentsMdCore,
  copyRulesDirectory,
  copyOutputStylesDirectory,
  removeObsoleteAgents
} = require('./phases/claude-runtime');
const { reconcileSkillInventory } = require('./phases/skill-inventory');
const { mergeClaudeSettings } = require('./phases/claude-settings');
const { installCodexRuntime } = require('./phases/codex-runtime');
const { installOmpRuntime } = require('./phases/omp-runtime');
const { writePlatformVersionMetadata } = require('./phases/write-metadata');
const { checkVersions } = require('./lib/version-check');
const { ensureGitignore } = require('./phases/root-config');
const { runPostInstall } = require('./phases/post-install');
const { setupSkillDeps } = require('./phases/skills-setup');
const { printSummary } = require('./phases/summary');

/** Install a single platform: payload + runtime + metadata, under one spinner. */
function installPlatform(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];

  // Read ownership baseline + start a fresh tracker for this platform.
  ctx.ownership[platform.folder] = manifestLib.read(platform.folder);
  ctx.trackers[platformKey] = manifestLib.createTracker(
    platform.folder,
    packageJson.version,
    platform.ownership
  );

  const before = { copied: ctx.results.copied, updated: ctx.results.updated, skills: ctx.results.installedSkills };
  ctx.ui.startSpinner(ctx.t('installingPlatform', { name: platform.name }));

  copyPlatformFiles(ctx, platformKey);
  reconcileSkillInventory(ctx, platformKey);
  removeObsoleteAgents(ctx, platformKey);

  if (platformKey === 'claude') {
    copyRoutingFile(ctx, platformKey);
    copyClaudeRuntimeFiles(ctx, platformKey);
    removeObsoleteClaudeRuntimeFiles(ctx, platformKey);
    mergeClaudeSettings(ctx, platformKey);
    copyClaudeMdFile(ctx, platformKey);
    copyRulesDirectory(ctx, platformKey);
    copyOutputStylesDirectory(ctx, platformKey);
  }

  if (platformKey === 'codex') {
    installCodexRuntime(ctx, platformKey);
  }

  if (platformKey === 'omp') {
    installOmpRuntime(ctx, platformKey);
  }

  writePlatformVersionMetadata(ctx, platformKey);

  const wrote = (ctx.results.copied - before.copied) + (ctx.results.updated - before.updated);
  const skills = ctx.results.installedSkills - before.skills;
  ctx.ui.stopSpinner(ctx.t(ctx.dryRun ? 'platformDryInstalled' : 'platformInstalled', {
    name: platform.name, files: wrote, skills
  }));

  ctx.results.targets.push(platform.commandsDir || platform.skillsDir || platform.folder);
}

function printHelp() {
  console.log(`CafeKit installer (cafekit) v${packageJson.version}

Usage: npx @haposoft/cafekit [options]

Installs CafeKit skills, agents, rules and runtime into the current project
for Claude Code and/or Codex CLI. Re-runs are selective: managed files are updated,
your edits are preserved.

Options:
  --platform <id[,id]> Select claude or codex explicitly
  --dry-run            Preview changes; write nothing
  --force-overwrite    Overwrite user-modified managed files (backup kept)
  -u, --upgrade, -f, --force   Alias of --force-overwrite
  --with-skills-deps   Install skill dependencies (Python venv + pip, npm,
                       Chromium/Playwright). Otherwise prompted interactively.
                       Otherwise prompted interactively.
  --with-document-skills     Install docs/DOCX/PDF/PPTX/XLSX/multimodal skills
  --without-document-skills  Skip or remove CafeKit-owned document skills
  -y, --yes            Non-interactive: skip prompts, use defaults (CI)
  -h, --help           Show this help
  -v, --version        Print version

Docs: https://github.com/haposoft/cafekit`);
}

async function main() {
  // Info flags short-circuit before any side effects.
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(packageJson.version);
    process.exit(0);
  }

  // ── Concurrency guard (before context; plain output) ────
  const got = lock.acquire();
  if (!got.acquired) {
    console.error(`✗ Another CafeKit install is in progress (pid ${got.pid}, since ${got.since}).`);
    console.error('  If that process is gone, delete .cafekit.lock and retry.');
    process.exit(1);
  }

  let ctx;
  let exitCode = 0;

  try {
    ctx = buildContext(process.argv, `${Date.now()}`);
    ctx.ui.intro(`${ctx.ui.pc.bgCyan(ctx.ui.pc.black(' CafeKit '))}${ctx.ui.pc.gray(' Installer')} v${packageJson.version}\n  ${ctx.ui.pc.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}\n  ${ctx.ui.pc.blue('📦 ' + (ctx.t ? ctx.t('introDesc') : 'AI-native development workflow'))}`);
    if (got.reclaimed) ctx.ui.info(ctx.t('reclaimed'));

    await selectLanguage(ctx);
    await resolvePlatforms(ctx);
    if (ctx.cancelled) { lock.release(); process.exit(0); }

    // Version check: same → selective refresh, downgrade → confirm, upgrade → picker
    await checkVersions(ctx);
    if (ctx.cancelled) { lock.release(); process.exit(0); }

    // User picked a different version from the picker — re-exec that version
    if (ctx.reexec) {
      lock.release();
      ctx.ui.info(ctx.t('versionReexec', { v: ctx.reexec }));
      // Forward original flags; add --force-overwrite so the re-exec'd installer
      // skips the version picker and proceeds directly with installation.
      const origFlags = process.argv.slice(2).filter(
        (f) => f !== '--force-overwrite' && f !== '-f' && f !== '-u' && f !== '--upgrade'
      );
      const result = spawnSync(
        'npx',
        ['-y', `@haposoft/cafekit@${ctx.reexec}`, '--force-overwrite', ...origFlags],
        { stdio: 'inherit', shell: process.platform === 'win32' }
      );
      process.exit(result.status ?? 1);
    }

    await selectDocumentSkills(ctx);
    if (ctx.cancelled) { lock.release(); process.exit(0); }

    // ── Pre-run snapshot for rollback ─────────────────────
    // Capture platform folders AND the root files the pipeline mutates
    // (CLAUDE.md, .gitignore) so a mid-run failure rolls back cleanly.
    if (!ctx.dryRun) {
      const targets = ctx.platforms.flatMap((key) => (
        PLATFORMS[key].backupTargets || [PLATFORMS[key].folder]
      ));
      ctx.backupDir = backup.snapshot([...targets, '.gitignore'], ctx.runId);
    }

    ensureSharedAgentsMdCore(ctx);
    for (const platformKey of ctx.platforms) {
      installPlatform(ctx, platformKey);
    }

    ensureGitignore(ctx);
    await runPostInstall(ctx);
    await setupSkillDeps(ctx);

    // Phase handlers may report recoverable-looking errors through counters
    // instead of throwing. Treat them as transactional failure so the snapshot
    // is restored before any success summary or backup pruning occurs.
    if (ctx.results.errors > 0) {
      throw new Error(`Installer reported ${ctx.results.errors} error${ctx.results.errors === 1 ? '' : 's'}`);
    }

    printSummary(ctx);

    if (!ctx.dryRun) backup.prune(3);

    exitCode = 0;
  } catch (error) {
    const log = ctx && ctx.ui ? ctx.ui : { error: (m) => console.error(m) };
    const t = ctx ? ctx.t : (k) => k;
    log.error(t('installFailed', { reason: error.message }));
    if (ctx && ctx.backupDir && !ctx.dryRun) {
      try {
        backup.restore(ctx.backupDir);
        log.error(t('rolledBack'));
      } catch (restoreError) {
        log.error(t('rollbackFailed', { reason: restoreError.message, dir: ctx.backupDir }));
      }
    }
    exitCode = 1;
  } finally {
    lock.release();
  }

  process.exit(exitCode);
}

main();
