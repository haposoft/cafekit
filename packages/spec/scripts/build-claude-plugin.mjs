#!/usr/bin/env node

// Build the Claude Code plugin `cf` from packages/spec/src/claude.
//
//   node build-claude-plugin.mjs                 write <repo>/plugins/cf
//   node build-claude-plugin.mjs --out <dir>     write <dir>
//   node build-claude-plugin.mjs --check <dir>   exit 1 when <dir> differs from a fresh build
//
// The npx installer keeps reading the same sources, so every plugin-only change
// (paths, agent names, hooks.json) happens here as a build transform.

import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { EXCLUDED_SKILLS, EXCLUDED_AGENTS, pluginSkills, pluginAgents } from "../bin/lib/plugin-inventory.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const source = join(packageRoot, "src/claude");

export const PLUGIN_NAME = "cf";
export { EXCLUDED_SKILLS, EXCLUDED_AGENTS };
const COPIED_DIRS = ["output-styles", "hooks", "scripts", "references", "rules"];
const COPIED_FILES = ["status.cjs", "runtime.schema.json"];
const SKIPPED_NAMES = new Set(["__tests__", ".logs", "node_modules", "__pycache__", ".venv", ".DS_Store"]);
const RUNTIME_DIRS = "skills|references|scripts|rules";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export const inScopeSkills = pluginSkills;
export const inScopeAgents = pluginAgents;

function writeFile(path, data, mode) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  if (mode !== undefined) chmodSync(path, mode);
}

// Claude Code substitutes ${CLAUDE_PLUGIN_ROOT} in skill, command and agent bodies
// but not in files they point to (references, rules), and the Bash tool does not
// see the variable at all. Those files reach scripts through bin/ instead.
// plugin/core.md is substituted by the plugin-context hook before injection.
export function substitutesPluginRoot(relPath) {
  return /^skills\/[^/]+\/SKILL\.md$/.test(relPath) || /^(agents|commands)\/[^/]+\.md$/.test(relPath)
    || relPath === "plugin/core.md";
}

function transformMarkdown(text, relPath, agents, bins) {
  let out = text;
  for (const agent of agents) {
    out = out
      .replaceAll(`\`${agent}\``, `\`${PLUGIN_NAME}:${agent}\``)
      .replace(new RegExp(`(subagent_type["']?\\s*[:=]\\s*["']?)${agent}\\b`, "g"), `$1${PLUGIN_NAME}:${agent}`);
  }
  const pathPattern = new RegExp(`\\.claude[/\\\\](${RUNTIME_DIRS})[/\\\\]`, "g");
  if (substitutesPluginRoot(relPath)) {
    return out.replace(pathPattern, (_, dir) => `\${CLAUDE_PLUGIN_ROOT}/${dir}/`);
  }
  out = out.replace(/node \.claude[/\\]scripts[/\\]([A-Za-z0-9-]+)\.cjs/g, (_, name) => {
    bins.add(name);
    return `cafekit-${name}`;
  });
  const leftover = out.match(pathPattern);
  if (leftover) throw new Error(`${relPath}: no plugin form for ${leftover.join(", ")}`);
  return out;
}

function copyTree(fromDir, toDir, relBase, context) {
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (SKIPPED_NAMES.has(entry.name)) continue;
    const from = join(fromDir, entry.name);
    const to = join(toDir, entry.name);
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      copyTree(from, to, relPath, context);
      continue;
    }
    if (!entry.isFile()) throw new Error(`Unsupported entry in plugin source: ${from}`);
    const mode = statSync(from).mode & 0o777;
    if (entry.name.endsWith(".md")) {
      writeFile(to, transformMarkdown(readFileSync(from, "utf8"), relPath, context.agents, context.bins), mode);
    } else {
      writeFile(to, readFileSync(from), mode);
    }
  }
}

function buildHooks() {
  const settings = readJson(join(source, "settings/settings.json"));
  const hooks = JSON.parse(
    JSON.stringify(settings.hooks).replaceAll("$CLAUDE_PROJECT_DIR/.claude/hooks/", "${CLAUDE_PLUGIN_ROOT}/hooks/")
  );
  // The plugin has no CLAUDE.md or rules loading, so it injects the core itself.
  hooks.SessionStart = [
    ...(hooks.SessionStart || []),
    {
      matcher: "startup|resume|clear|compact",
      hooks: [{ type: "command", command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/plugin-context.cjs"' }],
    },
  ];
  return { hooks };
}

// The build wipes its output first, so refuse any directory that is neither
// empty nor a previous cf build: a mistyped --out must not delete a project.
export function clearOutput(outDir, pluginName = PLUGIN_NAME, manifestDir = ".claude-plugin") {
  let entries;
  try {
    entries = readdirSync(outDir);
  } catch {
    return;
  }
  if (entries.length === 0) return;
  let previous = null;
  try {
    previous = readJson(join(outDir, manifestDir, "plugin.json"));
  } catch {
    // not a plugin tree
  }
  if (previous?.name !== pluginName) throw new Error(`Refusing to replace ${outDir}: it is not empty and not a ${pluginName} plugin build`);
  rmSync(outDir, { recursive: true, force: true });
}

export function build(outDir) {
  const pkg = readJson(join(packageRoot, "package.json"));
  const agents = inScopeAgents();
  const context = { agents, bins: new Set() };
  clearOutput(outDir);
  mkdirSync(outDir, { recursive: true });

  for (const skill of inScopeSkills()) {
    copyTree(join(source, "skills", skill), join(outDir, "skills", skill), `skills/${skill}`, context);
  }
  for (const agent of agents) {
    const relPath = `agents/${agent}.md`;
    writeFile(join(outDir, relPath), transformMarkdown(readFileSync(join(source, relPath), "utf8"), relPath, agents, context.bins));
  }
  for (const dir of COPIED_DIRS) copyTree(join(source, dir), join(outDir, dir), dir, context);
  for (const file of COPIED_FILES) writeFile(join(outDir, file), readFileSync(join(source, file)));
  copyTree(join(source, "plugin/commands"), join(outDir, "commands"), "commands", context);
  const corePath = "plugin/core.md";
  writeFile(join(outDir, corePath), transformMarkdown(readFileSync(join(source, corePath), "utf8"), corePath, agents, context.bins));

  writeFile(join(outDir, "hooks/hooks.json"), `${JSON.stringify(buildHooks(), null, 2)}\n`);
  for (const name of [...context.bins].sort()) {
    writeFile(join(outDir, "bin", `cafekit-${name}`), `#!/bin/sh\nexec node "$(dirname "$0")/../scripts/${name}.cjs" "$@"\n`, 0o755);
  }
  const manifest = {
    name: PLUGIN_NAME,
    displayName: "CafeKit",
    version: pkg.version,
    description: pkg.description,
    author: { name: "Haposoft", email: "nghialt@haposoft.com" },
    homepage: pkg.homepage,
    repository: "https://github.com/haposoft/cafekit",
    license: pkg.license,
    // Read by hooks as CLAUDE_PLUGIN_OPTION_<KEY>; a project .claude/runtime.json still wins.
    userConfig: {
      response_language: {
        type: "string",
        title: "Response language",
        description: "Language CafeKit asks Claude to answer in, such as English or Tiếng Việt. Empty follows the user.",
      },
      address: {
        type: "string",
        title: "How Claude addresses you",
        description: "A short name Claude uses for you; when Claude stops using it, the context was compacted. Empty disables it.",
      },
    },
  };
  writeFile(join(outDir, ".claude-plugin/plugin.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return outDir;
}

export function writeMarketplace() {
  const pkg = readJson(join(packageRoot, "package.json"));
  const marketplace = {
    name: "cafekit",
    owner: { name: "Haposoft", email: "nghialt@haposoft.com" },
    description: "CafeKit workflows for Claude Code: specs, develop, test, review and their runtime gates.",
    plugins: [{ name: PLUGIN_NAME, source: "./plugins/cf", description: pkg.description }],
  };
  writeFile(join(repoRoot, ".claude-plugin/marketplace.json"), `${JSON.stringify(marketplace, null, 2)}\n`);
}

function listFiles(root, base = root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? listFiles(path, base) : [relative(base, path)];
  }).sort();
}

export function diffTrees(expectedDir, actualDir) {
  const expected = listFiles(expectedDir);
  let actual;
  try {
    actual = listFiles(actualDir);
  } catch {
    return [`missing directory ${actualDir}`];
  }
  const differences = [];
  for (const file of new Set([...expected, ...actual])) {
    if (!expected.includes(file)) differences.push(`unexpected ${file}`);
    else if (!actual.includes(file)) differences.push(`missing ${file}`);
    else if (!readFileSync(join(expectedDir, file)).equals(readFileSync(join(actualDir, file)))) differences.push(`changed ${file}`);
  }
  return differences;
}

function main(argv) {
  const flag = argv[0];
  if (flag === "--check") {
    const target = resolve(argv[1] || join(repoRoot, "plugins/cf"));
    const fresh = mkdtempSync(join(tmpdir(), "cafekit-plugin-check-"));
    try {
      const differences = diffTrees(build(fresh), target);
      if (differences.length) {
        console.error(`plugin tree is stale (${differences.length} difference(s)):`);
        for (const line of differences.slice(0, 20)) console.error(`  ${line}`);
        process.exitCode = 1;
        return;
      }
      console.log(`plugin tree matches a fresh build: ${target}`);
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
    return;
  }
  const outDir = flag === "--out" ? resolve(argv[1]) : join(repoRoot, "plugins/cf");
  build(outDir);
  if (flag !== "--out") writeMarketplace();
  console.log(`built plugin ${PLUGIN_NAME} into ${outDir}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
