/**
 * Phase: post-install runtime configuration.
 *
 * Addressing config. Interactive prompts use ctx.ui (clack);
 * in non-interactive/dry-run they are skipped via fallbacks so spawned/CI runs
 * never hang.
 *
 * Note: CafeKit no longer prompts for a Gemini API key. The upstream gemini-cli
 * was removed, and the key now serves only the ai-multimodal skill — which
 * documents it in its own `.env.example`. Users set GEMINI_API_KEY there when
 * (and only if) they use that skill.
 */

const fs = require('fs');
const path = require('path');
const { PLATFORMS } = require('../lib/context');
const { LANGUAGE_LABELS } = require('../lib/i18n');
const { transformManagedCodexContent } = require('../lib/codex-install');
const { transformManagedClaudeContent } = require('./claude-runtime');
const { transformManagedCoreContent } = require('../lib/instruction-blocks');
const ASSISTANT_NAMES = {
  claude: 'Claude Code',
  codex: 'Codex CLI'
};
const LANGUAGE_LABEL_BY_CODE = {
  vi: 'Vietnamese',
  ja: 'Japanese',
  en: 'English'
};

function readManagedBody(filePath, transformManagedContent) {
  const content = fs.readFileSync(filePath, 'utf8');
  let body = '';
  transformManagedContent(content, (managed) => {
    body = managed;
    return managed;
  });
  return body;
}

function instructionTargets(ctx) {
  const targets = {
    claude: {
      file: path.join(process.cwd(), 'CLAUDE.md'),
      transform: transformManagedClaudeContent
    },
    codex: {
      file: path.join(process.cwd(), 'AGENTS.md'),
      transform: transformManagedCodexContent
    },
  };
  return Object.keys(targets)
    .filter((key) => ctx.platforms.includes(key))
    .map((key) => ({ key, ...targets[key] }));
}

function updateInstructionTarget(target, updateManaged) {
  if (!fs.existsSync(target.file)) return false;
  const content = fs.readFileSync(target.file, 'utf8');
  const next = target.transform(content, updateManaged);
  if (next === content) return false;
  fs.writeFileSync(target.file, next, 'utf8');
  return true;
}

function trackerOwnsPath(tracker, filePath) {
  if (!tracker?.keyFor) return false;
  const trackedKey = tracker.keyFor(filePath);
  return tracker.recorded(trackedKey) !== null;
}

/** Write `"language"` field into .claude/settings.json so it's visible at a glance. */
function patchSettingsLanguage(ctx) {
  if (!ctx.platforms.includes('claude')) return;
  const settingsPath = path.join(process.cwd(), '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return;

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return;
  }

  // Use locale (freeform label) so "Korean" shows correctly, not just "en".
  const label = ctx.locale;
  if (!label) return;
  settings.language = label;
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

/**
 * Patch the "## Language Consistency" section in the shared AGENTS.md core
 * block so every installed platform uses the chosen response language.
 */
function patchLanguageSection(ctx) {
  // No explicit/saved locale means follow the user's language; do not inject an
  // English override into the shared core block.
  const locale = ctx.locale;
  if (!locale || locale === 'en' || locale === 'English') return;

  // Use locale directly when set (e.g. "Korean"), or map from lang code.
  const label = locale in LANGUAGE_LABEL_BY_CODE ? LANGUAGE_LABEL_BY_CODE[locale] : locale;
  const newSection = `## Language Consistency <!-- cafekit:lang -->

Always respond in **${label}**. Technical terms, code identifiers, and file paths may remain in English, but explanations, comments directed at the user, and structured output must be in ${label}.

`;
  const markerRe = /## Language Consistency <!-- cafekit:lang -->[\s\S]*?(?=\n##|\n*$)/;
  const genericRe = /## Language Consistency\n[\s\S]*?(?=\n##|\n*$)/;
  const target = path.join(process.cwd(), 'AGENTS.md');

  updateInstructionTarget(
    {
      file: target,
      transform: transformManagedCoreContent
    },
    (managed) => {
      if (markerRe.test(managed)) return managed.replace(markerRe, newSection);
      if (genericRe.test(managed)) return managed.replace(genericRe, newSection);
      return `${managed.trimEnd()}\n\n${newSection}\n`;
    }
  );
}

function patchRuntimeLocale(ctx) {
  for (const key of ctx.platforms) {
    const rtPath = path.join(PLATFORMS[key].folder, 'runtime.json');
    if (!fs.existsSync(rtPath)) continue;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(rtPath, 'utf8'));
    } catch {
      continue;
    }
    data.locale = data.locale || {};
    // Use locale (freeform label) so custom languages propagate to the AI hook.
    // A null locale intentionally leaves the runtime's current value untouched.
    const locale = ctx.locale;
    if (!locale) continue;
    if (data.locale.responseLanguage === locale) continue;
    // Hardening: never downgrade an existing configured label to a bare default
    // code when this run never made an explicit language choice (ctx.locale
    // empty). Protects user config on any code path that skips selectLanguage.
    if (!ctx.locale && data.locale.responseLanguage) continue;
    data.locale.responseLanguage = locale;
    fs.writeFileSync(rtPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    // A preserved user-created/user-modified runtime was deliberately not
    // recorded by managed-writer. Updating its explicit locale must not turn
    // the whole user file into a pristine CafeKit ownership baseline.
    const tracker = ctx.trackers[key];
    if (trackerOwnsPath(tracker, rtPath)) tracker.record(rtPath);
  }
}

/** Human assistant name for the active platform(s). */
function assistantName(platformKey) {
  return ASSISTANT_NAMES[platformKey] || platformKey;
}

function configureAddressing(ctx, userAddress) {
  let found = false;
  for (const target of instructionTargets(ctx)) {
    if (!fs.existsSync(target.file)) continue;
    found = true;
    const name = assistantName(target.key);
    const addressingSection = `## Addressing (Context Overflow Indicator)

${name} always addresses the user as "${userAddress}" throughout the conversation. If it stops doing so, it is a sign the context has been compacted/truncated — tell the user to consider \`/clear\`.`;

    const regex = /##[^\n]*Context Overflow Indicator[^\n]*[\s\S]*?(?=\n##|\n*$)/;
    const changed = updateInstructionTarget(target, (managed) => (
      regex.test(managed)
        ? managed.replace(regex, addressingSection)
        : `${managed.endsWith('\n') ? managed : `${managed}\n`}\n${addressingSection}\n`
    ));
    if (changed) {
      ctx.ui.success(ctx.t('addressingSet', { name, addr: userAddress }));
    }
  }
  if (!found) ctx.ui.warn('Project instruction file not found; skipped addressing');
}

async function setupAddressing(ctx) {
  if (!ctx.platforms.some((key) => key === 'claude' || key === 'codex')) return;

  let existingName = null;
  for (const target of instructionTargets(ctx)) {
    if (!fs.existsSync(target.file)) continue;
    const content = readManagedBody(target.file, target.transform);
    const match = content.match(/##[^\n]*Context Overflow Indicator[^\n]*[\s\S]*?always addresses the user as "([^"]+)"/);
    if (match) {
      existingName = match[1];
      break;
    }
  }

  // For updates: ask if user wants to keep the existing name
  if (existingName && ctx.isUpdate) {
    const options = [
      { value: 'keep', label: ctx.t('keepAddressingOption', { addr: existingName }) || `Giữ "${existingName}"` },
      { value: 'change', label: ctx.t('changeAddressingOption') || 'Đổi tên mới' }
    ];

    const choice = await ctx.ui.select({
      message: ctx.t('addressingUpdatePrompt') || `Bạn đang dùng "${existingName}" để xưng hô. Muốn đổi không?`,
      options
    });

    if (ctx.ui.isCancel(choice)) return;
    if (choice === 'keep') return;
    // If 'change', continue to ask for new name
  }

  const answer = await ctx.ui.text(
    { message: ctx.t('addressingQuestion'), placeholder: ctx.t('addressingPlaceholder') },
    ''
  );
  if (ctx.ui.isCancel(answer)) return;
  const userAddress = (answer || '').trim();
  if (!userAddress) return;

  // Allow letters from any script (incl. Japanese) + spaces; reject digits/symbols.
  if (/[^\p{L}\s]/u.test(userAddress)) {
    ctx.ui.warn(ctx.t('addressingInvalid'));
    return;
  }
  configureAddressing(ctx, userAddress);
}

/** Run the post-install configuration sequence. */
async function runPostInstall(ctx) {
  if (ctx.dryRun) {
    ctx.ui.info('[dry-run] Skipping addressing setup');
    return ctx;
  }


  await setupAddressing(ctx);

  // Patch Language Consistency section in the shared AGENTS.md core block.
  patchLanguageSection(ctx);

  // Persist chosen language into each platform's runtime.json (records in tracker).
  patchRuntimeLocale(ctx);

  // Write "language" field into .claude/settings.json for visibility.
  patchSettingsLanguage(ctx);

  // Flush touched platform trackers. Root CLAUDE.md is block-managed and must
  // never regain a whole-file ownership record.
  for (const key of ctx.platforms) {
    if (ctx.trackers[key]) ctx.trackers[key].write();
  }
  return ctx;
}

module.exports = { configureAddressing, patchRuntimeLocale, runPostInstall };
