/**
 * CafeKit installer shared context + constants.
 *
 * Holds the platform registry, version constants, migration-manifest loader,
 * platform helper functions, CLI arg parsing, and the run-context factory.
 * Phase handlers import what they need from here so each phase stays focused.
 *
 * The context object (`ctx`) is threaded through every phase: `(ctx) => ctx`.
 * Phases mutate `ctx.results` counters and may set `ctx.cancelled` to stop the
 * pipeline early.
 */

const fs = require('fs');
const path = require('path');
const packageJson = require('../../package.json');
const { isInteractive, createUI } = require('./ui');
const { resolveLang, createTranslator } = require('./i18n');
const { normalizeSourcePaths } = require('./copy-utils');

const INSTALL_COMMAND = `npx ${packageJson.name}@${packageJson.version}`;

// ═══════════════════════════════════════════════════════════
// MIGRATION MANIFEST
// ═══════════════════════════════════════════════════════════

function validateManifestV2(manifest) {
  if (!manifest || manifest.version !== 2) return false;
  if (!manifest.runtime?.files || !Array.isArray(manifest.runtime.files)) return false;
  if (!manifest.settings?.template) return false;
  if (!Array.isArray(manifest.skills?.required)) return false;
  if (!Array.isArray(manifest.skills?.bundles?.documentSkills)) return false;
  if (!Array.isArray(manifest.obsolete?.skills)) return false;
  return true;
}

function loadClaudeMigrationManifest() {
  const manifestPath = path.join(__dirname, '../../src/claude/migration-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (!validateManifestV2(manifest)) {
      console.error('✗ Invalid manifest v2 schema - missing required fields');
      console.error('  Expected: version=2, runtime.files[], settings.template');
      process.exit(1);
    }

    return manifest;
  } catch (error) {
    console.warn(`⚠ Failed to parse Claude migration manifest: ${error.message}`);
    return null;
  }
}

const DEPENDENCY_TEMPLATES = {
  commands: {
    claude: {},
    codex: {}
  },
  agents: {
    claude: {},
    codex: {}
  }
};

// ═══════════════════════════════════════════════════════════
// PLATFORM REGISTRY - Add new platforms here
// ═══════════════════════════════════════════════════════════
const PLATFORMS = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    description: 'Anthropic\'s Claude Code CLI',
    folder: '.claude',
    commandsDir: '.claude/commands',
    skillsDir: '.claude/skills',
    agentsDir: '.claude/agents',
    skillsRef: '.claude/skills',
    commandPrefix: '/',
    sourceDir: 'claude',       // Maps to src/claude/
    sourceSubdir: 'commands',  // Source subfolder within src/claude/
    backupTargets: ['.claude', 'CLAUDE.md', 'AGENTS.md'],
    capabilities: {
      skills: true,
      agents: true,
      references: true,
      scripts: true,
      rules: true,
      commands: true
    }
  },
  codex: {
    id: 'codex',
    name: 'Codex CLI',
    description: 'OpenAI Codex CLI',
    folder: '.codex',
    detectFiles: ['.codex'],
    commandsDir: null,
    skillsDir: '.agents/skills',
    agentsDir: '.codex/agents',
    skillsRef: '.agents/skills',
    commandPrefix: '$',
    sourceDir: 'claude',
    sourceSubdir: null,
    backupTargets: ['.codex', '.agents', 'AGENTS.md'],
    ownership: {
      recordRoot: '.',
      allowedRoots: ['.codex', '.agents']
    },
    capabilities: {
      skills: true,
      agents: true,
      references: true,
      scripts: true,
      rules: true,
      commands: false
    }
  },
  omp: {
    id: 'omp',
    name: 'Oh My Pi',
    description: 'Oh My Pi coding agent',
    folder: '.omp',
    detectFiles: ['.omp'],
    commandsDir: null,
    // omp discovers .claude/skills and .agents/skills itself, so CafeKit copies
    // no skill payload for it. See specs/omp-runtime-support/plan.md.
    skillsDir: '.agents/skills',
    agentsDir: null,
    skillsRef: '.agents/skills',
    commandPrefix: '$',
    sourceDir: 'claude',
    sourceSubdir: null,
    backupTargets: ['.omp', 'AGENTS.md'],
    ownership: {
      recordRoot: '.',
      allowedRoots: ['.omp']
    },
    capabilities: {
      skills: false,
      agents: false,
      references: true,
      scripts: true,
      rules: true,
      commands: false
    }
  }
  // Add new platforms here:
  // cursor: {
  //   id: 'cursor',
  //   name: 'Cursor',
  //   description: 'Cursor IDE',
  //   folder: '.cursor',
  //   commandsDir: '.cursor/commands',
  //   sourceDir: 'cursor',
  //   sourceSubdir: 'commands'
  // }
};

/**
 * Hosts that run another platform's install rather than one of their own.
 *
 * Grok CLI discovers `.claude/skills`, `.claude/rules`, `CLAUDE*.md` and the hooks in
 * `.claude/settings.json` through its own Claude-compatibility layer, and the gate hooks
 * normalize its envelope, so `--platform grok` provisions the Claude runtime. There is no
 * `.grok/` payload and deliberately no detection marker: a repository that merely holds
 * `.grok/` has not asked for a CafeKit install.
 */
const PLATFORM_ALIASES = Object.freeze({
  grok: 'claude'
});

/** Resolve host aliases and drop duplicates, preserving the requested order. */
function resolvePlatformAliases(keys = []) {
  const resolved = keys.map((key) => PLATFORM_ALIASES[key] || key);
  return { platforms: [...new Set(resolved)], aliased: keys.some((key) => Boolean(PLATFORM_ALIASES[key])) };
}

// ═══════════════════════════════════════════════════════════
// DETECTION + PLATFORM HELPERS
// ═══════════════════════════════════════════════════════════

function detectPlatforms() {
  const detected = [];

  for (const [key, config] of Object.entries(PLATFORMS)) {
    const markers = Array.isArray(config.detectFiles) ? config.detectFiles : [config.folder];
    if (markers.some(marker => fs.existsSync(marker))) {
      detected.push(key);
    }
  }

  return detected;
}

function formatPlatformList() {
  return Object.entries(PLATFORMS)
    .map(([key, config], index) => {
      return `${index + 1}) ${config.name} (${config.folder}/)\n   ${config.description}`;
    })
    .join('\n');
}

function getPlatformKeys() {
  return Object.keys(PLATFORMS);
}

function hasPlatformCapability(platformKey, capability) {
  return Boolean(PLATFORMS[platformKey]?.capabilities?.[capability]);
}

function getRuntimeSupportTargetDir(platformKey, subdir) {
  return path.join(PLATFORMS[platformKey].folder, subdir);
}


function getCopyOptions(platformKey, baseOptions = {}) {
  if (platformKey === 'codex') {
    // Lazy require avoids coupling the shared registry to a runtime adapter
    // during module initialization.
    return require('./codex-install').getCodexCopyOptions(baseOptions);
  }
  if (platformKey !== 'claude') return baseOptions;
  return {
    ...baseOptions,
    transform: (content, sourcePath) => normalizeSourcePaths(
      typeof baseOptions.transform === 'function'
        ? baseOptions.transform(content, sourcePath)
        : content,
      { runtimeRoot: '.claude', skillsRoot: '.claude/skills' }
    )
  };
}

// ═══════════════════════════════════════════════════════════
// CLI ARGS + RUN CONTEXT
// ═══════════════════════════════════════════════════════════

/**
 * Parse installer CLI flags.
 *  --upgrade / -u / --force / -f / --force-overwrite → forceOverwrite:true
 *      (overwrite user-modified managed files, backing up the user copy first)
 *  --dry-run                                         → dryRun:true
 *
 * `upgrade` is kept as an alias of `forceOverwrite` for backward compatibility
 * with existing docs and muscle memory.
 */
function parseInstallerArgs(argv) {
  const args = {
    forceOverwrite: false,
    dryRun: false,
    yes: false,
    withSkillsDeps: false,
    withDocumentSkills: false,
    withoutDocumentSkills: false,
    platforms: []
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--upgrade' || arg === '-u' || arg === '--force' || arg === '-f' || arg === '--force-overwrite') {
      args.forceOverwrite = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--yes' || arg === '-y') {
      args.yes = true;
    } else if (arg === '--with-skills-deps') {
      args.withSkillsDeps = true;
    } else if (arg === '--with-document-skills') {
      args.withDocumentSkills = true;
    } else if (arg === '--without-document-skills') {
      args.withoutDocumentSkills = true;
    } else if (arg === '--platform') {
      args.platforms.push(...String(argv[++i] || '').split(',').filter(Boolean));
    } else if (arg.startsWith('--platform=')) {
      args.platforms.push(...arg.slice('--platform='.length).split(',').filter(Boolean));
    } else if (arg === '--lang') {
      args.lang = argv[++i];
    } else if (arg.startsWith('--lang=')) {
      args.lang = arg.slice('--lang='.length);
    }
  }

  if (args.withDocumentSkills && args.withoutDocumentSkills) {
    throw new Error('--with-document-skills and --without-document-skills cannot be used together');
  }

  // Back-compat alias used throughout the phases.
  args.upgrade = args.forceOverwrite;
  return args;
}

/**
 * Fresh results counters for a run.
 *  copied/updated/skipped/...: legacy counters (preserved for summary parity)
 *  preserved: user-modified/user-created files left untouched
 *  unchanged: files identical to payload, skipped by selective merge
 *  preservedFiles: paths reported in the summary
 */
function createResults() {
  return {
    copied: 0,
    updated: 0,
    skipped: 0,
    unchanged: 0,
    preserved: 0,
    installedSkills: 0,
    dependencyChecks: 0,
    installedDependencies: 0,
    missingDependencies: 0,
    errors: 0,
    targets: [],
    preservedFiles: []
  };
}

/**
 * Build the run context threaded through all phases.
 *
 * @param {string[]} argv     process.argv
 * @param {string}   runId    unique id for this run (timestamp-based)
 */
function buildContext(argv, runId) {
  const options = parseInstallerArgs(argv);
  // Interactive only on a real TTY and not when --yes/CI forces non-interactive.
  const interactive = isInteractive() && !options.yes;
  // Language: --lang wins; otherwise English for installer UI only (an interactive
  // prompt or saved runtime locale may change both values).
  const lang = options.lang ? resolveLang(options.lang) : 'en';
  // A missing locale means "follow the user's language". Never persist the UI
  // fallback as an AI response-language override on fresh installs/upgrades.
  const locale = options.lang ? options.lang : null;
  return {
    argv,
    runId,
    options,
    dryRun: options.dryRun,
    interactive,
    ui: createUI(interactive),
    lang,        // UI language (one of SUPPORTED)
    locale,      // AI response language label (may be freeform, e.g. "Korean")
    t: createTranslator(lang),
    /** Update UI lang + AI locale. rawLabel is the freeform label when user picks "Other". */
    setLang(code, rawLabel) {
      this.lang = resolveLang(code);
      this.locale = rawLabel || LANGUAGE_LABELS[this.lang] || this.lang;
      this.t = createTranslator(this.lang);
    },
    manifest: loadClaudeMigrationManifest(),  // migration manifest (skills/agents/runtime lists)
    platforms: [],
    results: createResults(),
    trackers: {},    // platformKey → ownership tracker, set per platform
    ownership: {},   // platformFolder → ownership manifest read at run start
    documentSkills: {}, // platformKey → persisted optional-bundle selection
    cancelled: false
  };
}

module.exports = {
  packageJson,
  INSTALL_COMMAND,
  DEPENDENCY_TEMPLATES,
  PLATFORMS,
  PLATFORM_ALIASES,
  resolvePlatformAliases,
  validateManifestV2,
  loadClaudeMigrationManifest,
  detectPlatforms,
  formatPlatformList,
  getPlatformKeys,
  hasPlatformCapability,
  getRuntimeSupportTargetDir,
  getCopyOptions,
  parseInstallerArgs,
  createResults,
  buildContext
};
