/** Resolve the optional document-skills bundle for each selected runtime. */

const fs = require('fs');
const path = require('path');
const { PLATFORMS } = require('../lib/context');

function readMetadata(platformKey) {
  const target = path.join(PLATFORMS[platformKey].folder, 'cafekit.json');
  if (!fs.existsSync(target)) return { state: 'absent', target, metadata: null };
  try {
    const metadata = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return { state: 'invalid', target, metadata: null, reason: 'expected a JSON object' };
    }
    return { state: 'valid', target, metadata };
  } catch (error) {
    return { state: 'invalid', target, metadata: null, reason: error.message };
  }
}

function explicitSelection(options) {
  if (options.withDocumentSkills) {
    return { enabled: true, selectionSource: 'cli-opt-in' };
  }
  if (options.withoutDocumentSkills) {
    return { enabled: false, selectionSource: 'cli-opt-out' };
  }
  return null;
}

async function selectDocumentSkills(ctx) {
  const explicit = explicitSelection(ctx.options);
  const unresolvedFresh = [];

  for (const platformKey of ctx.platforms) {
    if (explicit) {
      ctx.documentSkills[platformKey] = { ...explicit };
      continue;
    }

    const metadataResult = readMetadata(platformKey);
    const metadata = metadataResult.metadata;
    if (metadata?.schemaVersion >= 2 && typeof metadata.documentSkills?.enabled === 'boolean') {
      ctx.documentSkills[platformKey] = {
        enabled: metadata.documentSkills.enabled,
        selectionSource: metadata.documentSkills.selectionSource || 'persisted'
      };
    } else if (metadataResult.state === 'valid') {
      ctx.documentSkills[platformKey] = {
        enabled: true,
        selectionSource: 'legacy-upgrade'
      };
    } else if (metadataResult.state === 'invalid') {
      ctx.documentSkills[platformKey] = {
        enabled: true,
        selectionSource: 'metadata-recovery'
      };
      ctx.ui.warn(ctx.t('documentSkillsMetadataRecovery', {
        path: metadataResult.target
      }));
    } else if (fs.existsSync(path.join(PLATFORMS[platformKey].folder, 'cafekit-manifest.json'))) {
      ctx.documentSkills[platformKey] = {
        enabled: true,
        selectionSource: 'legacy-upgrade'
      };
    } else {
      unresolvedFresh.push(platformKey);
    }
  }

  let freshEnabled = false;
  let source = 'default-fresh';
  if (unresolvedFresh.length > 0 && ctx.interactive) {
    const answer = await ctx.ui.confirm(
      { message: ctx.t('documentSkillsConfirm'), initialValue: false },
      false
    );
    if (ctx.ui.isCancel(answer)) {
      ctx.cancelled = true;
      return ctx;
    }
    freshEnabled = Boolean(answer);
    source = 'interactive';
  }

  for (const platformKey of unresolvedFresh) {
    ctx.documentSkills[platformKey] = {
      enabled: freshEnabled,
      selectionSource: source
    };
  }

  return ctx;
}

module.exports = { readMetadata, explicitSelection, selectDocumentSkills };
