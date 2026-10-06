/**
 * Skill dependency setup primitives (cross-platform, no sudo).
 *
 * Provides the building blocks the skills-setup phase uses to provision the
 * parts that a plain file-copy install can't: a Python venv + pip requirements,
 * skill-local npm installs, and the Puppeteer Chromium binary. System binaries
 * and global npm tools are NOT auto-installed here — they are detected and the
 * phase prints guidance.
 *
 * All commands run via spawnSync (blocking is fine for a CLI). Detection is
 * silent; install callers decide how to surface progress/failures.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const isWindows = process.platform === 'win32';

/**
 * npm and npx are `.cmd` launchers on Windows, so Node cannot spawn them
 * directly without a command interpreter. Keep the shell boundary explicit;
 * all arguments passed here are installer-owned constants.
 */
function resolvePackageCommand(command, args, platform = process.platform, env = process.env) {
  if (platform !== 'win32') return { command, args };
  return {
    command: env.ComSpec || env.COMSPEC || 'cmd.exe',
    args: ['/d', '/s', '/c', `${command}.cmd`, ...args]
  };
}

/** Run a command synchronously, return { ok, stdout, stderr, status }. Never throws. */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return {
    ok: !r.error && r.status === 0,
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || ''
  };
}

/**
 * Run a command asynchronously — keeps the event loop alive so spinners can animate.
 * Returns a Promise<{ ok, stdout, stderr, status }>. Never rejects.
 */
function runAsync(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'pipe', ...opts });
    let stdout = '';
    let stderr = '';
    if (child.stdout) child.stdout.on('data', (d) => { stdout += d.toString(); });
    if (child.stderr) child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        status: code,
        stdout,
        stderr
      });
    });
    child.on('error', (err) => {
      resolve({
        ok: false,
        status: null,
        stdout,
        stderr: stderr || err.message,
        errorCode: err.code || ''
      });
    });
  });
}

/** Return one actionable line without flooding the installer UI with npm output. */
function commandFailureReason(result) {
  const lines = `${result.stderr || ''}\n${result.stdout || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.find((line) => (
    /\bE[A-Z0-9_]{2,}\b/.test(line) || /\bnpm error code\b/i.test(line)
  ))
    || lines.find((line) => /^npm error\b/i.test(line))
    || lines.at(-1)
    || result.errorCode
    || `exit ${result.status ?? 'unknown'}`;
}

/** Is a command available on PATH? */
function hasCmd(name) {
  const probe = isWindows ? run('where', [name]) : run('which', [name]);
  return probe.ok;
}

/** Find a usable Python launcher ('python3' or 'python'), or null. */
function findPython() {
  for (const cmd of ['python3', 'python']) {
    if (hasCmd(cmd) && run(cmd, ['--version']).ok) return cmd;
  }
  return null;
}

function venvDir(skillsDir) {
  return path.join(skillsDir, '.venv');
}

/** Path to the venv's python interpreter (OS-specific). */
function venvPython(skillsDir) {
  return isWindows
    ? path.join(venvDir(skillsDir), 'Scripts', 'python.exe')
    : path.join(venvDir(skillsDir), 'bin', 'python3');
}

function venvValid(skillsDir) {
  return fs.existsSync(venvPython(skillsDir));
}

/** Create the venv (idempotent: skips if already valid). Async — keeps spinner alive. */
async function createVenv(skillsDir, py) {
  if (venvValid(skillsDir)) return true;
  fs.mkdirSync(skillsDir, { recursive: true });
  const r = await runAsync(py, ['-m', 'venv', venvDir(skillsDir)]);
  return r.ok;
}

/** Upgrade pip inside the venv (best-effort). Async — keeps spinner alive. */
async function pipUpgrade(skillsDir) {
  const r = await runAsync(venvPython(skillsDir), ['-m', 'pip', 'install', '--upgrade', 'pip', '--prefer-binary']);
  return r.ok;
}

/** Install or upgrade pip requirements in the venv. Async — keeps spinner alive. */
async function pipInstall(skillsDir, requirementsPath, upgrade = false) {
  const args = ['-m', 'pip', 'install', '-r', requirementsPath, '--prefer-binary'];
  if (upgrade) args.push('--upgrade');
  const r = await runAsync(venvPython(skillsDir), args);
  return r.ok;
}

/** `npm install` (fresh) or `npm update` (existing) in a skill scripts dir. */
async function npmInstall(dir, upgrade = false, extraEnv = {}) {
  const args = upgrade ? ['update', '--no-audit', '--no-fund'] : ['install', '--no-audit', '--no-fund'];
  const env = { ...process.env, ...extraEnv };
  const npm = resolvePackageCommand('npm', args);
  return runAsync(npm.command, npm.args, { cwd: dir, env });
}

/**
 * Download the Puppeteer Chromium browser for chrome-devtools.
 * Prefer puppeteer's own install script (cache-aware, same as its postinstall);
 * fall back to the bundled @puppeteer/browsers CLI.
 *
 * Non-interactive (default): async — keeps spinner alive during download.
 * Interactive: sync with stdio inherit — native progress bar renders in TTY.
 */
async function installChromium(scriptsDir, interactive = false) {
  // Absolute path so it resolves regardless of the child process cwd.
  const installMjs = path.resolve(scriptsDir, 'node_modules', 'puppeteer', 'install.mjs');
  if (fs.existsSync(installMjs)) {
    if (interactive) {
      return run('node', [installMjs], { cwd: scriptsDir, stdio: 'inherit' }).ok;
    }
    const r = await runAsync('node', [installMjs], { cwd: scriptsDir });
    return r.ok;
  }
  const npx = resolvePackageCommand('npx', ['--yes', '@puppeteer/browsers', 'install', 'chrome']);
  if (interactive) {
    return run(npx.command, npx.args, { cwd: scriptsDir, stdio: 'inherit' }).ok;
  }
  const r = await runAsync(npx.command, npx.args, { cwd: scriptsDir });
  return r.ok;
}

/** Does a skill scripts dir declare a given npm dependency? */
function pkgHasDep(scriptsDir, name) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(scriptsDir, 'package.json'), 'utf8'));
    return Boolean((pkg.dependencies && pkg.dependencies[name]) || (pkg.devDependencies && pkg.devDependencies[name]));
  } catch {
    return false;
  }
}

/** Download the Playwright Chromium browser (for the pptx html2pptx workflow). Async — keeps spinner alive. */
async function installPlaywrightBrowser(scriptsDir) {
  const npx = resolvePackageCommand('npx', ['--yes', 'playwright', 'install', 'chromium']);
  const r = await runAsync(npx.command, npx.args, { cwd: scriptsDir });
  return r.ok;
}

/**
 * Detect system Chrome/Chromium installation (cross-platform).
 * Returns the executable path if found, undefined otherwise.
 * Supports macOS, Windows, Linux (including snap + PATH fallback).
 */
function detectSystemChrome() {
  const candidates = (() => {
    switch (process.platform) {
      case 'darwin':
        return [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ];
      case 'win32': {
        const pf = process.env.PROGRAMFILES;
        const pf86 = process.env['PROGRAMFILES(X86)'];
        const local = process.env.LOCALAPPDATA;
        return [
          pf && `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
          pf86 && `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
          local && `${local}\\Google\\Chrome\\Application\\chrome.exe`,
        ].filter(Boolean);
      }
      default: // Linux & others
        return [
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          '/snap/bin/chromium',
        ];
    }
  })();

  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch { /* skip */ }
  }

  // Linux: last resort — check PATH
  if (process.platform === 'linux') {
    for (const cmd of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
      const r = run(isWindows ? 'where' : 'which', [cmd]);
      if (r.ok && r.stdout.trim()) return r.stdout.trim();
    }
  }

  return undefined;
}

/**
 * List installed skills that ship a runnable scripts/requirements.txt
 * (excludes the tests/ requirements). Returns [{ skill, file }].
 * Always returned regardless of whether venv already exists (caller decides upgrade vs fresh).
 */
function collectRequirements(skillsDir) {
  const out = [];
  if (!fs.existsSync(skillsDir)) return out;
  for (const skill of fs.readdirSync(skillsDir)) {
    const file = path.join(skillsDir, skill, 'scripts', 'requirements.txt');
    if (fs.existsSync(file)) out.push({ skill, file });
  }
  return out;
}

/**
 * List installed skills with a scripts/package.json.
 * Returns [{ skill, dir, hasNodeModules }] — always, so caller can upgrade existing installs.
 */
function collectSkillPackages(skillsDir) {
  const out = [];
  if (!fs.existsSync(skillsDir)) return out;
  for (const skill of fs.readdirSync(skillsDir)) {
    const dir = path.join(skillsDir, skill, 'scripts');
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      out.push({ skill, dir, hasNodeModules: fs.existsSync(path.join(dir, 'node_modules')) });
    }
  }
  return out;
}

/** External binaries some skills shell out to — detected, never auto-installed. */
const SYSTEM_TOOLS = [
  { cmd: 'ffmpeg', skills: ['ai-multimodal'], why: 'ai-multimodal (audio/video)', brew: 'brew install ffmpeg', apt: 'sudo apt install ffmpeg', win: 'winget install ffmpeg' },
  { cmd: 'pdftotext', skills: ['pdf'], why: 'pdf (text extraction, poppler)', brew: 'brew install poppler', apt: 'sudo apt install poppler-utils', win: 'choco install poppler' },
  { cmd: 'rsvg-convert', skills: ['generate-graph'], why: 'generate-graph (PNG export, librsvg)', brew: 'brew install librsvg', apt: 'sudo apt install librsvg2-bin', win: 'choco install rsvg-convert' },
  { cmd: 'tesseract', skills: ['pdf', 'ai-multimodal'], why: 'pdf/ai-multimodal (OCR)', brew: 'brew install tesseract', apt: 'sudo apt install tesseract-ocr', win: 'choco install tesseract' }
];

/** Global npm CLIs some skills expect — detected, never auto-installed. */
const GLOBAL_NPM = [
  { cmd: 'agent-browser', pkg: 'agent-browser', skills: ['agent-browser'], why: 'agent-browser skill' }
];

/** Per-OS install hint for a SYSTEM_TOOLS entry. */
function systemHint(tool) {
  if (process.platform === 'darwin') return tool.brew;
  if (process.platform === 'win32') return tool.win;
  return tool.apt;
}

module.exports = {
  isWindows,
  resolvePackageCommand,
  commandFailureReason,
  hasCmd,
  findPython,
  venvDir,
  venvPython,
  venvValid,
  createVenv,
  pipUpgrade,
  pipInstall,
  npmInstall,
  installChromium,
  detectSystemChrome,
  collectRequirements,
  collectSkillPackages,
  pkgHasDep,
  installPlaywrightBrowser,
  SYSTEM_TOOLS,
  GLOBAL_NPM,
  systemHint
};
