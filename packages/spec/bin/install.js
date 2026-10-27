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
const fs = require('fs');
const { buildContext, parseInstallerArgs, PLATFORMS, packageJson } = require('./lib/context');
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

function preflightTrackedRootFiles(ctx) {
  const files = ['AGENTS.md'];
  if (ctx.platforms.includes('claude')) files.push('CLAUDE.md');
  for (const file of files) {
    try {
      fs.lstatSync(file);
      continue;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const result = spawnSync('git', ['ls-files', '-v', '--error-unmatch', '--', file], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 3000, shell: false,
    });
    if (!result.error && result.status === 0) {
      if (result.stdout[0]?.toUpperCase() === 'S') continue;
      throw new Error(`${file} is tracked by git but missing from the working tree; restore it with \`git checkout -- ${file}\`, or \`git rm ${file}\` if the deletion is intended, then rerun the installer.`);
    }
    if (!result.error && (result.status === 1 || /not a git repository/i.test(result.stderr || ''))) continue;
    ctx.ui.warn(`Could not confirm git state for ${file}; installing a fresh copy.`);
  }
}

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
       npx @haposoft/cafekit@latest migrate [--apply]

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

Commands:
  migrate              Preview removing this repository's npx install so the
                       CafeKit Claude Code and Codex plugins take over; edited
                       files and runtime.json stay. Writes nothing.
  migrate --apply      Remove it, with a backup in .cafekit-backup/ that is
                       restored if anything fails.

Docs: https://github.com/haposoft/cafekit`);
}

async function main() {
  // Info flags short-circuit before any side effects.
  const argv = process.argv.slice(2);
  if (argv[0] === 'migrate') {
    process.exit(await runMigrate(argv.slice(1)));
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(packageJson.version);
    process.exit(0);
  }

  // Reject a mistyped argument before the lock and before anything is written.
  try {
    parseInstallerArgs(process.argv);
  } catch (error) {
    console.error(`✗ ${error.message}`);
    console.error('  Run npx @haposoft/cafekit --help for the options.');
    process.exit(error.exitCode || 1);
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

    preflightTrackedRootFiles(ctx);

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

function printMigrateHelp(stream = console.log) {
  stream(`Usage: npx @haposoft/cafekit@latest migrate [--apply]

Removes this repository's CafeKit npx install so the Claude Code and Codex
plugins take over. Without --apply it only prints the plan.

Removed: installed files that still match their install hash and have a plugin
equivalent, CafeKit hook entries, and the CafeKit instruction blocks.
Kept: edited files, runtime.json, files you added, skills no plugin ships yet,
and every user entry in settings.json, hooks.json, AGENTS.md and CLAUDE.md.
A repository with an .omp/ install is refused.`);
}

/** `migrate [--apply]`: returns the exit code (0 done or nothing to do, 1 failed or refused, 2 bad usage). */
async function runMigrate(args) {
  let apply = false;
  for (const arg of args) {
    if (arg === '--apply') apply = true;
    else if (arg === '--help' || arg === '-h') {
      printMigrateHelp();
      return 0;
    } else {
      console.error(`✗ Unknown argument for migrate: ${arg}`);
      printMigrateHelp(console.error);
      return 2;
    }
  }

  const { planMigration, planSteps, applyMigration } = require('./lib/migrate-apply');
  const { renderManifestPlan } = require('./lib/migrate-plan');
  const { renderMergedPlan } = require('./lib/migrate-merged');
  const root = process.cwd();
  let plan;
  try {
    plan = planMigration(root);
  } catch (error) {
    console.error(`✗ migrate could not read this repository: ${error.message}`);
    return 1;
  }
  const steps = planSteps(plan);
  console.log(`CafeKit migrate — ${apply ? 'apply' : 'dry run (nothing is written)'}\n`);
  // The merged-file planner may mark hook scripts kept, so the manifest plan renders after it.
  const manifestText = renderManifestPlan(plan.manifest);
  if (manifestText) console.log(manifestText);
  const mergedText = renderMergedPlan(plan.merged);
  if (mergedText) console.log(`\nMerged files:\n${mergedText}`);

  // An install migrate cannot read (refused) or does not manage (unmanaged) would be left
  // behind while the rest goes, so nothing is changed until it is fixed.
  const blocked = Object.values(plan.manifest.platforms).filter((platform) => ['refused', 'unmanaged'].includes(platform.status));
  if (plan.merged.refused || blocked.length > 0) {
    if (plan.merged.refused) console.error(`\n✗ Refused: ${plan.merged.refused}`);
    for (const platform of blocked) console.error(`\n✗ ${platform.name} cannot be migrated: ${platform.reason}`);
    console.error('  Nothing was changed. Fix or remove that install by hand, then run migrate again.');
    return 1;
  }
  if (steps.length === 0) {
    console.log('\nNothing to migrate: no CafeKit npx file here is planned for removal.');
    return 0;
  }
  if (!apply) {
    console.log(`\n${steps.length} changes planned. Folders left empty are removed too.`);
    console.log('Run `npx @haposoft/cafekit@latest migrate --apply` to apply them, with a backup.');
    return 0;
  }

  const result = await applyMigration(root, { plan });
  if (result.ok) {
    console.log(`\n✓ Removed ${result.removed} files and rewrote ${result.written}. Backup: ${result.backupDir}`);
    console.log('  Install the plugins if you have not: see the CafeKit README.');
    return 0;
  }
  console.error(`\n✗ migrate stopped (${result.reason}): ${result.message}`);
  if (result.backupDir) console.error(`  Backup: ${result.backupDir}`);
  for (const step of result.manualSteps || []) console.error(`  ${step}`);
  return 1;
}

main();
