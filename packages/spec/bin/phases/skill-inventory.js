/** Ownership-aware removal for retired and deselected skill directories. */

const fs = require('fs');
const path = require('path');
const { PLATFORMS } = require('../lib/context');
const { hashFile } = require('../lib/manifest');

function listTreeEntries(root) {
  const entries = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      entries.push({ target, entry });
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(target);
    }
  };
  visit(root);
  return entries;
}

function classifySkillTree(ctx, platformKey, skillName) {
  const platform = PLATFORMS[platformKey];
  const tracker = ctx.trackers[platformKey];
  const target = path.join(platform.skillsDir, skillName);
  if (!fs.existsSync(target)) return { target, removable: false, absent: true };
  if (!fs.lstatSync(target).isDirectory()) {
    return { target, removable: false, absent: false };
  }

  const entries = listTreeEntries(target);
  const ownership = ctx.ownership?.[platform.folder]?.files || {};
  const unsafe = entries.some(({ target: item, entry }) => {
    if (!entry.isFile() || entry.isSymbolicLink()) return !entry.isDirectory();
    const key = tracker.keyFor(item);
    return ownership[key]?.sha256 !== hashFile(item);
  });
  return { target, removable: entries.length > 0 && !unsafe, absent: false };
}

function removeSkill(ctx, platformKey, skillName) {
  const tracker = ctx.trackers[platformKey];
  const classified = classifySkillTree(ctx, platformKey, skillName);
  if (classified.absent) return;

  if (!classified.removable) {
    ctx.ui.warn(`Preserved user-owned skill: ${classified.target}`);
    ctx.results.preserved++;
    ctx.results.preservedFiles.push(classified.target);
    return;
  }

  const prefix = `${tracker.keyFor(classified.target).replace(/\/$/, '')}/`;
  if (!ctx.dryRun) {
    fs.rmSync(classified.target, { recursive: true, force: true });
    tracker.prunePrefix(prefix);
  }
  ctx.ui.detail(`  ↻ ${ctx.dryRun ? '[dry-run] ' : ''}Removed skill: ${classified.target}`);
  ctx.results.updated++;
}

function reconcileSkillInventory(ctx, platformKey) {
  const retired = ctx.manifest?.obsolete?.skills || [];
  for (const skillName of retired) removeSkill(ctx, platformKey, skillName);

  if (!ctx.documentSkills?.[platformKey]?.enabled) {
    const optional = ctx.manifest?.skills?.bundles?.documentSkills || [];
    for (const skillName of optional) removeSkill(ctx, platformKey, skillName);
  }
}

module.exports = { listTreeEntries, classifySkillTree, removeSkill, reconcileSkillInventory };
