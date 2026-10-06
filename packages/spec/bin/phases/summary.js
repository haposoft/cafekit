/**
 * Phase: final summary report.
 *
 * Renders install stats (incl. selective-merge counters) + next steps through
 * ctx.ui, so it appears as a framed clack note/outro when interactive and as
 * plain text otherwise.
 */

const fs = require('fs');
const path = require('path');
const { PLATFORMS, packageJson } = require('../lib/context');

/** Installed skills that ship a .env.example (i.e. need API keys configured). */
function skillsNeedingKeys(platforms) {
  const found = new Set();
  for (const key of platforms) {
    const skillsDir = PLATFORMS[key].skillsDir;
    if (!fs.existsSync(skillsDir)) continue;
    for (const skill of fs.readdirSync(skillsDir)) {
      if (fs.existsSync(path.join(skillsDir, skill, '.env.example'))) found.add(skill);
    }
  }
  return [...found].sort();
}

function printSummary(ctx) {
  const { results, platforms, options, ui, t } = ctx;
  const pad = (s) => `${s}:`.padEnd(16, ' ');

  const stats = [
    `${pad(t('labelCopied'))}${results.copied}`,
    `${pad(t('labelUpdated'))}${results.updated}`,
    `${pad(t('labelUnchanged'))}${results.unchanged}`,
    `${pad(t('labelPreserved'))}${results.preserved}`,
    `${pad(t('labelSkills'))}${results.installedSkills > 0 ? t('yes') : t('no')}`,
    `${pad(t('labelVersion'))}${packageJson.version}`,
    results.missingDependencies > 0 ? `${pad(t('labelMissing'))}${results.missingDependencies}` : null,
    results.errors > 0 ? `${pad(t('labelErrors'))}${results.errors}` : null
  ].filter(Boolean).join('\n');

  ui.note(stats, ctx.dryRun ? t('summaryDryTitle') : t('summaryTitle'));

  if (results.preserved > 0) {
    const list = results.preservedFiles.slice(0, 8).map((f) => `  ⊘ ${f}`).join('\n');
    const more = results.preservedFiles.length > 8 ? `\n  ... +${results.preservedFiles.length - 8}` : '';
    ui.warn(`${t('preservedNote', { n: results.preserved })}\n${list}${more}`);
  }

  if (ctx.dryRun) {
    ui.outro(t('dryRunOnly'));
    return;
  }

  const lines = [];
  for (const key of platforms) {
    const messageKey = {
      claude: 'nsClaude',
      codex: 'nsCodex'
    }[key];
    if (messageKey) lines.push(t(messageKey));
  }
  const keySkills = skillsNeedingKeys(platforms);
  if (keySkills.length > 0) {
    lines.push(t('nsKeys', { skills: keySkills.join(', ') }));
  }
  if (!options.forceOverwrite) {
    lines.push(t('nsForce'));
  }
  ui.note(lines.join('\n'), t('nextStepsTitle'));

  ui.outro(t('outroDone'));
}

module.exports = { printSummary };
