/**
 * Phase: skill dependency setup (opt-in, safe cross-platform).
 *
 * Provisions the parts a file-copy install can't:
 *  - Python venv at <skillsDir>/.venv + pip install each skill's requirements
 *  - skill-local `npm install` (scripts/package.json without node_modules)
 *  - Puppeteer Chromium binary (chrome-devtools)
 *  - Playwright browser binary (pptx html2pptx)
 *
 * System binaries (ffmpeg, poppler, librsvg, tesseract) and global npm CLIs are
 * NOT auto-installed — they are detected and printed as guidance. All steps are
 * non-fatal: a failure never breaks the install.
 *
 * Runs only when opted in: `--with-skills-deps`, or an interactive confirm.
 */

const fs = require('fs');
const path = require('path');
const { PLATFORMS } = require('../lib/context');
const dep = require('../lib/skill-deps');

async function shouldRun(ctx) {
  if (ctx.dryRun) return false;
  if (ctx.options.withSkillsDeps) return true;
  if (!ctx.interactive) return false;
  const yes = await ctx.ui.confirm(
    { message: ctx.t('skillDepsConfirm'), initialValue: false },
    false
  );
  return yes === true;
}

/** Provision or upgrade Python venv + pip requirements for a platform's skills. */
async function setupPython(ctx, skillsDir) {
  const reqs = dep.collectRequirements(skillsDir);
  if (reqs.length === 0) return;

  const py = dep.findPython();
  if (!py) {
    ctx.ui.warn(ctx.t('venvNoHost'));
    return;
  }

  const alreadyExists = dep.venvValid(skillsDir);
  ctx.ui.startSpinner(ctx.t('venvCreating'));
  const venvOk = await dep.createVenv(skillsDir, py);
  if (!venvOk) {
    ctx.ui.stopSpinner(ctx.t('venvFailed'));
    ctx.ui.warn(ctx.t('venvFailed'));
    return;
  }
  await dep.pipUpgrade(skillsDir);
  ctx.ui.stopSpinner(`${ctx.t('venvReady')} (${dep.venvDir(skillsDir)})`);

  // Upgrade packages if venv already existed (update run), install fresh otherwise.
  const upgrade = alreadyExists;
  for (const { skill, file } of reqs) {
    ctx.ui.startSpinner(ctx.t(upgrade ? 'pipInstalling' : 'pipInstalling', { skill }));
    const ok = await dep.pipInstall(skillsDir, file, upgrade);
    if (ok) {
      ctx.ui.stopSpinner(ctx.t('pipInstalled', { skill }));
    } else {
      ctx.ui.stopSpinner(ctx.t('pipFailed', { skill, cmd: `"${dep.venvPython(skillsDir)}" -m pip install -r "${file}"` }));
    }
  }
}

/** Run skill-local npm installs/upgrades + browser binaries for a platform's skills. */
async function setupNode(ctx, skillsDir) {
  // Detect system Chrome before npm install — skip ~300MB Chromium download if found
  const chromeScripts = path.join(skillsDir, 'chrome-devtools', 'scripts');
  const hasChromePkg = fs.existsSync(path.join(chromeScripts, 'package.json'));
  const systemChrome = hasChromePkg ? dep.detectSystemChrome() : null;

  for (const { skill, dir, hasNodeModules } of dep.collectSkillPackages(skillsDir)) {
    ctx.ui.startSpinner(ctx.t('npmInstalling', { skill }));

    // chrome-devtools: skip puppeteer postinstall Chromium download if system Chrome exists
    const extraEnv = (skill === 'chrome-devtools' && systemChrome)
      ? { PUPPETEER_SKIP_DOWNLOAD: 'true' }
      : {};
    const result = await dep.npmInstall(dir, hasNodeModules, extraEnv);

    if (result.ok) {
      ctx.ui.stopSpinner(ctx.t('npmInstalled', { skill }));
    } else {
      ctx.ui.stopSpinner(ctx.t('npmFailed', {
        skill,
        dir,
        error: dep.commandFailureReason(result)
      }));
      continue;
    }

    // Skills using Playwright (e.g. pptx) also need a browser binary.
    if (dep.pkgHasDep(dir, 'playwright')) {
      ctx.ui.startSpinner(ctx.t('playwrightInstalling', { skill }));
      const pw = await dep.installPlaywrightBrowser(dir);
      ctx.ui.stopSpinner(pw ? ctx.t('playwrightReady', { skill }) : ctx.t('playwrightSkipped', { skill }));
    }
  }

  // Chromium for chrome-devtools (puppeteer-based, ~300MB).
  // Uses stdio:inherit for native progress bar when downloading (TTY-only).
  if (hasChromePkg) {
    if (systemChrome) {
      ctx.ui.info(ctx.t('chromiumSystemChromeFound', { path: systemChrome }));
    } else {
      ctx.ui.info(ctx.t('chromiumInstalling'));
      const ok = await dep.installChromium(chromeScripts, true);
      ctx.ui.info(ok ? '✓ ' + ctx.t('chromiumReady') : ctx.t('chromiumSkipped'));
    }
  }
}

/** Detect (don't install) system binaries + global npm CLIs and print guidance. */
function guideManual(ctx) {
  const installed = new Set();
  for (const key of ctx.platforms) {
    const skillsDir = PLATFORMS[key].skillsDir;
    if (!fs.existsSync(skillsDir)) continue;
    for (const name of fs.readdirSync(skillsDir)) installed.add(name);
  }
  const applies = (item) => (item.skills || []).some((skill) => installed.has(skill));
  const missingTools = dep.SYSTEM_TOOLS.filter((t) => applies(t) && !dep.hasCmd(t.cmd));
  const missingNpm   = dep.GLOBAL_NPM.filter((g) => applies(g) && !dep.hasCmd(g.cmd));
  if (missingTools.length === 0 && missingNpm.length === 0) return;

  const lines = [];
  for (const t of missingTools) lines.push(`${t.cmd}  — ${t.why}\n   ${dep.systemHint(t)}`);
  for (const g of missingNpm)   lines.push(`${g.cmd}  — ${g.why}\n   npm install -g ${g.pkg}`);
  ctx.ui.note(lines.join('\n'), ctx.t('optionalToolsTitle'));
}

async function setupSkillDeps(ctx) {
  if (!(await shouldRun(ctx))) {
    if (!ctx.dryRun) ctx.ui.info(ctx.t('skillsSkipped'));
    return ctx;
  }

  for (const key of ctx.platforms) {
    await setupPython(ctx, PLATFORMS[key].skillsDir);
    await setupNode(ctx, PLATFORMS[key].skillsDir);
  }

  guideManual(ctx);
  return ctx;
}

module.exports = { setupSkillDeps };
