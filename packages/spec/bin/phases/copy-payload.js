/**
 * Phase: copy payload (skills, agents, references, scripts, commands).
 *
 * Ported from the original copyPlatformFiles(), but every write goes through
 * the ownership-aware writer so re-runs update pristine files and preserve
 * user-modified ones instead of blindly skipping/overwriting.
 */

const fs = require('fs');
const path = require('path');
const {
  PLATFORMS,
  DEPENDENCY_TEMPLATES,
  hasPlatformCapability,
  getRuntimeSupportTargetDir,
  getCopyOptions
} = require('../lib/context');
const { writeManagedFile, copyManagedTree } = require('../lib/managed-writer');
const { report, treeAction } = require('./report');
const {
  codexAgentName,
  convertCodexAgentContent
} = require('../lib/codex-install');

const SRC = path.join(__dirname, '../../src');

/**
 * Spec command files installed for a platform. Claude ships spec-* commands.
 */
function getPlatformSpecFiles(platformKey, ctx) {
  if (platformKey === 'claude') {
    const manifestCommands = ctx.manifest?.commands?.core;
    if (Array.isArray(manifestCommands)) {
      return manifestCommands;
    }
    return [
      'spec-init.md',
      'spec-requirements.md',
      'spec-design.md',
      'spec-validate.md',
      'spec-tasks.md',
      'spec-status.md',
      'code.md',
      'test.md',
      'docs.md'
    ];
  }
  return [];
}

/** DEPENDENCY_TEMPLATES is empty by default; kept for parity/extensibility. */
function ensureWorkflowDependencies(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  const tracker = ctx.trackers[platformKey];
  if (!platform.commandsDir) return;
  const commandTemplates = DEPENDENCY_TEMPLATES.commands[platformKey] || {};
  Object.entries(commandTemplates).forEach(([fileName, content]) => {
    if (!content) return;
    const dest = path.join(platform.commandsDir, fileName);
    if (!ctx.dryRun) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content, 'utf8');
      tracker.record(dest);
    }
    report(ctx, 'created', `dependency: ${fileName}`);
  });
}

function copyPlatformFiles(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  const tracker = ctx.trackers[platformKey];
  const platformFolder = platform.folder;

  const bodyTransform = getCopyOptions(platformKey, {}).transform;

  const skillsSourceDir = path.join(SRC, 'claude/skills');
  const agentsSourceDir = path.join(SRC, platform.sourceDir, 'agents');

  if (!ctx.dryRun) {
    if (platform.skillsDir) fs.mkdirSync(platform.skillsDir, { recursive: true });
    if (platform.agentsDir) fs.mkdirSync(platform.agentsDir, { recursive: true });
  }

  // ── Skills ──────────────────────────────────────────────
  if (hasPlatformCapability(platformKey, 'skills') && fs.existsSync(skillsSourceDir)) {
    const specSkillSource = path.join(skillsSourceDir, 'specs');
    const specSkillDest = path.join(platform.skillsDir, 'specs');

    if (fs.existsSync(specSkillSource)) {
      const agg = copyManagedTree({
        src: specSkillSource, dest: specSkillDest, platformFolder, ctx, tracker, transform: bodyTransform
      });
      ctx.results.installedSkills++;
      report(ctx, treeAction(agg), 'Skill: specs');
    }

    // Keep spec templates in sync (Claude command runtime reads these).
    if (platformKey === 'claude' || platformKey === 'codex') {
      const legacyInitTemplate = path.join(platform.skillsDir, 'specs', 'templates', 'init.json');
      if (platformKey === 'claude' && fs.existsSync(legacyInitTemplate)) {
        if (!ctx.dryRun) fs.rmSync(legacyInitTemplate, { force: true });
        ctx.ui.detail(`  ↻ ${ctx.dryRun ? '[dry-run] ' : ''}Removed legacy template: ${legacyInitTemplate}`);
        ctx.results.updated++;
      }

      const specTemplates = [
        'spec-state.json',
        'requirements-init.md',
        'requirements.md',
        'design.md',
        'research.md',
        'task.md'
      ];

      specTemplates.forEach((fileName) => {
        const src = path.join(specSkillSource, 'templates', fileName);
        const dest = path.join(platform.skillsDir, 'specs', 'templates', fileName);
        const { action } = writeManagedFile({
          src,
          dest,
          platformFolder,
          ctx,
          tracker,
          transform: bodyTransform
        });
        report(ctx, action, `template: ${fileName}`);
      });
    }

    // Core skills plus the optional document bundle selected for this runtime.
    let requiredSkills = [];
    if (hasPlatformCapability(platformKey, 'skills')) {
      requiredSkills = ctx.manifest?.skills?.required || [];
      if (ctx.documentSkills?.[platformKey]?.enabled) {
        requiredSkills = [
          ...requiredSkills,
          ...(ctx.manifest?.skills?.bundles?.documentSkills || [])
        ];
      }
    }
    [...new Set(requiredSkills)]
      .filter((skillName) => skillName !== 'specs')
      .forEach((skillName) => {
        const skillSource = path.join(skillsSourceDir, skillName);
        const skillDest = path.join(platform.skillsDir, skillName);
        if (fs.existsSync(skillSource)) {
          const agg = copyManagedTree({
            src: skillSource, dest: skillDest, platformFolder, ctx, tracker, transform: bodyTransform
          });
          ctx.results.installedSkills++;
          report(ctx, treeAction(agg), `Skill: ${skillName}`);
        } else {
          report(ctx, 'missing', `skill: ${skillName}`);
        }
      });
  }

  // ── Agents + references + scripts ───────────────────────
  if (hasPlatformCapability(platformKey, 'agents')) {
    if (fs.existsSync(agentsSourceDir)) {
      const requiredAgents = ctx.manifest?.agents?.required || [
        'tester.md', 'code-reviewer.md', 'fullstack-developer.md', 'debugger.md'
      ];
      let agentTransform;
      if (platformKey === 'codex') {
        agentTransform = (content, src) => convertCodexAgentContent(content, path.basename(src));
      }

      requiredAgents.forEach((fileName) => {
        const src = path.join(agentsSourceDir, fileName);
        const destName = platformKey === 'codex'
          ? `${codexAgentName(fileName)}.toml`
          : fileName;
        const dest = path.join(platform.agentsDir, destName);
        const { action } = writeManagedFile({
          src, dest, platformFolder, ctx, tracker, transform: agentTransform
        });
        report(ctx, action, `agent: ${fileName}`);
      });

      const refsSource = path.join(SRC, platform.sourceDir, 'references');
      if (fs.existsSync(refsSource)) {
        const refsDest = getRuntimeSupportTargetDir(platformKey, 'references');
        const agg = copyManagedTree({
          src: refsSource, dest: refsDest, platformFolder, ctx, tracker, transform: bodyTransform
        });
        report(ctx, treeAction(agg), 'Agent reference manuals');
      }
    } else {
      report(ctx, 'missing', `agents: ${platform.agentsDir}`);
    }
  }

  // ── Scripts ─────────────────────────────────────────────
  // Gated on its own capability. This block used to sit inside the agents guard,
  // so a platform with agents: false and scripts: true (omp) never received
  // .omp/scripts/, and every Stop-time gate that requires ../scripts/*.cjs answered
  // "Completion gate unavailable" on each session_stop.
  if (hasPlatformCapability(platformKey, 'scripts')) {
    const scriptsSourceDir = path.join(SRC, 'claude/scripts');
    if (fs.existsSync(scriptsSourceDir)) {
      const scriptsDest = getRuntimeSupportTargetDir(platformKey, 'scripts');
      const agg = copyManagedTree({
        src: scriptsSourceDir, dest: scriptsDest, platformFolder, ctx, tracker, transform: bodyTransform
      });
      report(ctx, treeAction(agg), 'Native scripts');
    }
  }

  ensureWorkflowDependencies(ctx, platformKey);

  // ── Commands ────────────────────────────────────────────
  if (!hasPlatformCapability(platformKey, 'commands') || !platform.commandsDir) {
    return ctx;
  }

  const sourceSubdir = platform.sourceSubdir || 'commands';
  const commandsSourceDir = path.join(SRC, platform.sourceDir, sourceSubdir);
  const specFiles = getPlatformSpecFiles(platformKey, ctx);

  specFiles.forEach((file) => {
    const src = path.join(commandsSourceDir, file);
    const dest = path.join(platform.commandsDir, file);
    if (!fs.existsSync(src)) {
      ctx.ui.error(`Source file not found: ${file}`);
      ctx.results.errors++;
      return;
    }
    const cmdTransform = (content, s) => {
      return content.replace(/\{\{SKILLS_DIR\}\}/g, platform.skillsRef);
    };
    const { action } = writeManagedFile({
      src, dest, platformFolder, ctx, tracker, transform: cmdTransform
    });
    report(ctx, action, file);
  });

  return ctx;
}

module.exports = { copyPlatformFiles, getPlatformSpecFiles };
