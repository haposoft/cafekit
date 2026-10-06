/**
 * Phase: root project configuration (.gitignore).
 *
 * Ensures the root .gitignore carries CafeKit-managed patterns:
 *  - workflow dirs (plans, shared research)
 *  - install safety artifacts (backup, lock)
 *  - runtime folders (.claude/, .codex/, .agents/) — reinstall via
 *    `npx @haposoft/cafekit`; do not commit the local payload
 *
 * Layered with the in-folder `.claude/.gitignore` /
 * runtime `.gitignore` templates (secrets, skill deps, session
 * state) so force-adds and partial un-ignores stay safe.
 *
 * Honors dry-run.
 */

const fs = require('fs');
const path = require('path');

/** True if `lines` already carries `pattern` with or without a trailing slash. */
function hasPattern(lines, pattern) {
  const bare = pattern.replace(/\/$/, '');
  const withSlash = bare + '/';
  return lines.includes(pattern) || lines.includes(bare) || lines.includes(withSlash);
}

const PLAN_PATTERNS = new Set([
  'plans',
  'plans/',
  'plans/*',
  'plans/**',
  'plans/**/*',
  '!plans/*.md',
  '!plans/templates',
  '!plans/templates/',
  '!plans/templates/*',
  '!plans/templates/**',
  '!plans/templates/**/*'
]);

function isManagedPattern(line, patterns) {
  return patterns.has(line.trim());
}

function isTrivia(line) {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

function migrateManagedPlanPatterns(lines, header, patterns) {
  const headerIndex = lines.findIndex((line) => line.trim() === header);
  if (headerIndex < 0) return false;

  const managedPatterns = new Set([...patterns, ...PLAN_PATTERNS]);
  const blockStart = headerIndex + 1;
  let blockEnd = blockStart;
  let pendingTriviaStart = null;
  let sawManagedPattern = false;

  for (let index = blockStart; index < lines.length; index++) {
    if (isManagedPattern(lines[index], managedPatterns)) {
      sawManagedPattern = true;
      pendingTriviaStart = null;
      blockEnd = index + 1;
      continue;
    }
    if (isTrivia(lines[index])) {
      if (pendingTriviaStart === null) pendingTriviaStart = index;
      continue;
    }
    blockEnd = pendingTriviaStart ?? index;
    break;
  }

  if (!sawManagedPattern) return false;
  if (blockEnd === blockStart && pendingTriviaStart !== null) return false;

  const block = lines.slice(blockStart, blockEnd);
  const existingPlanPatterns = block
    .filter((line) => PLAN_PATTERNS.has(line.trim()))
    .map((line) => line.trim());
  const canonicalPlanPatterns = patterns.slice(1, 5);
  if (
    existingPlanPatterns.length === canonicalPlanPatterns.length &&
    existingPlanPatterns.every((pattern, index) => pattern === canonicalPlanPatterns[index])
  ) {
    return false;
  }

  const firstPlanIndex = block.findIndex((line) => PLAN_PATTERNS.has(line.trim()));
  if (firstPlanIndex < 0) return false;

  const withoutPlans = block.filter((line) => !PLAN_PATTERNS.has(line.trim()));
  withoutPlans.splice(firstPlanIndex, 0, ...canonicalPlanPatterns);
  lines.splice(blockStart, block.length, ...withoutPlans);
  return true;
}

function ensureGitignore(ctx) {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const header = '# CafeKit / Ecosystem';
  const patterns = [
    'specs/_shared/',
    'plans/*',
    '!plans/*.md',
    '!plans/templates/',
    '!plans/templates/**',
    '.cafekit-backup/',
    '.cafekit.lock',
    // Local runtime payload — reinstall with npx; keep out of git
    '.claude/',
    '.codex/',
    // omp auto-executes every file in .omp/extensions/, so a committed copy
    // would run arbitrary code on clone. Keep it out of git like the rest.
    '.omp/',
    '.agents/'
  ];
  const prefix = ctx.dryRun ? '[dry-run] ' : '';

  if (!fs.existsSync(gitignorePath)) {
    const content = ['# Git Ignore', '', header, ...patterns, ''].join('\n');
    if (!ctx.dryRun) fs.writeFileSync(gitignorePath, content, 'utf8');
    ctx.ui.detail(`  ✓ ${prefix}.gitignore created at root`);
    ctx.results.copied++;
    return;
  }

  const content = fs.readFileSync(gitignorePath, 'utf8');
  const lines = content.split('\n');
  const migrated = migrateManagedPlanPatterns(lines, header, patterns);
  const normalizedLines = lines.map((line) => line.trim());
  const missing = patterns.filter((p) => !hasPattern(normalizedLines, p));

  if (migrated || missing.length > 0) {
    let newContent = lines.join('\n');
    if (missing.length > 0) {
      if (!newContent.endsWith('\n')) newContent += '\n';
      if (!content.includes(header)) newContent += `\n${header}\n`;
      newContent += missing.join('\n') + '\n';
    }
    if (!ctx.dryRun) fs.writeFileSync(gitignorePath, newContent, 'utf8');
    const details = migrated ? 'normalized managed plans patterns' : `added ${missing.join(', ')}`;
    ctx.ui.detail(`  ↻ ${prefix}.gitignore updated: ${details}`);
    ctx.results.updated++;
  } else {
    ctx.ui.detail(`  → ${prefix}.gitignore already up to date`);
    ctx.results.skipped++;
  }
}

module.exports = { ensureGitignore, hasPattern };
