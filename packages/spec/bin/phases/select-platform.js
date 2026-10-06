/**
 * Phase: language + platform selection.
 *
 * Language is chosen first (interactive) so the rest of the installer renders in
 * it; non-interactive uses --lang or English. Then platforms are auto-detected
 * or prompted. Sets ctx.platforms, or ctx.cancelled if the user backs out.
 */

const fs = require('fs');
const path = require('path');
const {
  PLATFORMS,
  detectPlatforms,
  getPlatformKeys,
  resolvePlatformAliases
} = require('../lib/context');
const { SUPPORTED, LANGUAGE_LABELS, OTHER_LABEL } = require('../lib/i18n');

const OTHER = '__other__';

/**
 * Read saved locale label from .claude/runtime.json (written by post-install).
 * Returns the freeform label string (e.g. "Tiếng Việt") or null.
 */
function getInstalledLocale(platformKeys = getPlatformKeys()) {
  for (const key of platformKeys) {
    const runtimeJson = path.join(process.cwd(), PLATFORMS[key].folder, 'runtime.json');
    if (!fs.existsSync(runtimeJson)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(runtimeJson, 'utf8'));
      if (data && data.locale && typeof data.locale.responseLanguage === 'string') {
        return data.locale.responseLanguage;
      }
    } catch { /* try the next installed runtime */ }
  }
  return null;
}

/** First step: pick the installer/UI language (interactive only). */
/**
 * Resolve host aliases on the requested platform list, once, before anything reads it.
 *
 * selectLanguage() filters this list through PLATFORMS to decide which installed runtime
 * to take a saved locale from, so an unresolved alias would empty that list and fall back
 * to scanning every platform folder — `--platform grok` in a project that also has
 * `.codex/` would then silently take Codex's language.
 */
function applyPlatformAliases(ctx) {
  const requested = ctx.options.platforms || [];
  if (requested.length === 0) return ctx;
  const { platforms, aliased } = resolvePlatformAliases(requested);
  ctx.options.platforms = platforms;
  ctx.aliasedHost = aliased;
  return ctx;
}

async function selectLanguage(ctx) {
  applyPlatformAliases(ctx);
  // Restore the saved locale BEFORE the interactivity check: a non-interactive
  // upgrade (--yes) must not forget the configured language. Skipping this left
  // ctx at the 'en' default, and patchRuntimeLocale then clobbered the user's
  // responseLanguage on every upgrade.
  if (!ctx.options.lang) {
    const requested = (ctx.options.platforms || []).filter((key) => PLATFORMS[key]);
    const savedLocale = getInstalledLocale(requested.length ? requested : getPlatformKeys());
    if (savedLocale) {
      const code = Object.keys(LANGUAGE_LABELS).find((k) => LANGUAGE_LABELS[k] === savedLocale) || 'en';
      ctx.setLang(code, savedLocale); // updates ctx.t to the saved language
      if (ctx.interactive) ctx.ui.info(ctx.t('langKept', { lang: savedLocale }));
      return ctx;
    }
  }

  if (!ctx.interactive || ctx.options.lang) return ctx;

  const options = [
    ...SUPPORTED.map((code) => ({ value: code, label: LANGUAGE_LABELS[code] })),
    { value: OTHER, label: OTHER_LABEL.en + ' / その他 / Ngôn ngữ khác' }
  ];

  const r = await ctx.ui.select(
    { message: 'Select language · 言語を選択 · Chọn ngôn ngữ', options },
    ctx.lang
  );
  if (ctx.ui.isCancel(r)) return ctx;

  if (r === OTHER) {
    // User types their language name — UI stays English, AI responds in that language.
    const typed = await ctx.ui.text(
      { message: 'Enter your language (e.g. Korean, French, Spanish…)', placeholder: 'Language name in English' },
      ''
    );
    if (!ctx.ui.isCancel(typed) && typed && typed.trim()) {
      ctx.setLang('en', typed.trim()); // UI = English, locale = user's label
    }
  } else {
    ctx.setLang(r, LANGUAGE_LABELS[r]);
  }

  return ctx;
}

/** clack select: which platform(s) to install for. */
async function promptPlatformSelection(ctx) {
  const options = [
    ...getPlatformKeys().map((key) => ({
      value: [key],
      label: PLATFORMS[key].name,
      hint: `${PLATFORMS[key].folder}/`
    })),
    { value: getPlatformKeys(), label: ctx.t('allPlatforms') }
  ];
  const r = await ctx.ui.select({ message: ctx.t('selectPlatform'), options }, []);
  if (ctx.ui.isCancel(r)) return [];
  return r;
}

/** clack confirm: install for all detected platforms? */
async function confirmAllDetected(ctx, detected) {
  const names = detected.map((key) => PLATFORMS[key].name).join(', ');
  const r = await ctx.ui.confirm(
    { message: ctx.t('confirmAllDetected', { names }), initialValue: true },
    true
  );
  if (ctx.ui.isCancel(r)) return false;
  return r;
}

function platformNames(platforms) {
  return platforms.map((key) => PLATFORMS[key].name).join(', ');
}

function reportInstallMode(ctx) {
  if (ctx.options.forceOverwrite) {
    ctx.ui.info(ctx.t('modeForce'));
  } else if (ctx.dryRun) {
    ctx.ui.info(ctx.t('modeDryRun'));
  } else {
    ctx.ui.info(ctx.t('modeInstall'));
  }
}

function cancelSelection(ctx) {
  ctx.ui.outro(ctx.t('cancelled'));
  ctx.cancelled = true;
  return [];
}

async function promptAddMorePlatforms(ctx, savedPlatforms) {
  const allKeys = getPlatformKeys();
  const available = allKeys.filter((key) => !savedPlatforms.includes(key));
  if (available.length === 0) return false;

  const r = await ctx.ui.confirm(
    { message: ctx.t('addPlatformsPrompt', { names: platformNames(savedPlatforms) }), initialValue: false },
    false
  );
  if (ctx.ui.isCancel(r)) return false;
  return r;
}

async function promptPlatforms(ctx) {
  const platforms = await promptPlatformSelection(ctx);
  return platforms.length > 0 ? platforms : cancelSelection(ctx);
}

/**
 * Resolve ctx.platforms via detection + prompts. Sets ctx.cancelled on backout.
 * If cafekit.json exists (prior install), reads platform from it to skip prompt.
 * Note: ctx.isUpdate is set later by checkVersions and cannot be used here.
 */
async function resolvePlatforms(ctx) {
  const requested = [...new Set((ctx.options.platforms || []).map((key) => key.trim()).filter(Boolean))];
  if (requested.length > 0) {
    const unknown = requested.filter((key) => !PLATFORMS[key]);
    if (unknown.length > 0) {
      throw new Error(`Unknown platform: ${unknown.join(', ')}. Expected: ${getPlatformKeys().join(', ')}`);
    }
    ctx.platforms = requested;
    ctx.ui.info(ctx.t('installingFor', {
      names: platformNames(requested)
    }));
    if (ctx.aliasedHost) ctx.ui.info(ctx.t('grokCompatNotice'));
    reportInstallMode(ctx);
    return ctx;
  }

  // Skip platform prompt when a prior install is detected via cafekit.json
  const savedPlatforms = getInstalledPlatforms();
  if (savedPlatforms.length > 0) {
    let platforms = [...new Set([...savedPlatforms, ...detectPlatforms()])];
    if (ctx.interactive && platforms.some((key) => !savedPlatforms.includes(key))) {
      const proceed = await confirmAllDetected(ctx, platforms);
      if (!proceed) {
        platforms = await promptPlatforms(ctx);
        if (ctx.cancelled) return ctx;
      }
    } else if (ctx.interactive) {
      // No newly detected platforms, but user might want to ADD more platforms
      const wantAdd = await promptAddMorePlatforms(ctx, savedPlatforms);
      if (wantAdd) {
        const added = await promptPlatformSelection(ctx);
        if (ctx.cancelled) return ctx;
        if (added.length > 0) {
          platforms = [...new Set([...platforms, ...added])];
        }
      }
    }
    ctx.platforms = platforms;
    ctx.ui.info(ctx.t('platformKept', { names: platformNames(platforms) }));

    reportInstallMode(ctx);
    return ctx;
  }

  let platforms = detectPlatforms();

  if (platforms.length === 0) {
    if (ctx.interactive) {
      platforms = await promptPlatforms(ctx);
      if (ctx.cancelled) return ctx;
    } else {
      platforms = ['claude'];
      ctx.ui.info('No platform detected; defaulting to Claude Code (.claude/).');
    }
  } else if (platforms.length > 1 && ctx.interactive) {
    const proceed = await confirmAllDetected(ctx, platforms);
    if (!proceed) {
      platforms = await promptPlatforms(ctx);
      if (ctx.cancelled) return ctx;
    }
  }

  ctx.platforms = platforms;

  ctx.ui.info(ctx.t('installingFor', { names: platformNames(platforms) }));

  reportInstallMode(ctx);

  return ctx;
}

/**
 * Get the installed platform from cafekit.json files.
 * Returns the platform key (e.g. 'claude', 'codex') or null.
 */
function getInstalledPlatforms() {
  const installed = [];
  for (const key of getPlatformKeys()) {
    const metadataPath = path.join(process.cwd(), PLATFORMS[key].folder, 'cafekit.json');
    if (!fs.existsSync(metadataPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const platformKey = data.platform && PLATFORMS[data.platform] ? data.platform : key;
      if (!installed.includes(platformKey)) installed.push(platformKey);
    } catch { /* ignore */ }
  }
  return installed;
}

function getInstalledPlatform() {
  return getInstalledPlatforms()[0] || null;
}

module.exports = {
  selectLanguage,
  applyPlatformAliases,
  promptPlatformSelection,
  resolvePlatforms,
  getInstalledPlatform,
  getInstalledPlatforms
};
