#!/usr/bin/env node

// Build the Codex CLI plugin `cf` from packages/spec/src.
//
//   node build-codex-plugin.mjs                 write <repo>/plugins/cf-codex and .agents/plugins/marketplace.json
//   node build-codex-plugin.mjs --out <dir>     write <dir>
//   node build-codex-plugin.mjs --check <dir>   exit 1 when <dir> differs from a fresh build
//
// Content goes through the same Codex transforms as the npx installer. Codex does
// not substitute any variable in skill text and does not put a plugin bin/ on PATH,
// so Markdown names plugin files as {CAFEKIT_ROOT}/<path> and scripts as
// {cafekit:<name>}; the plugin's SessionStart hook defines both with absolute,
// quoted commands.

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { PLUGIN_NAME, inScopeSkills, inScopeAgents, clearOutput, diffTrees } from "./build-claude-plugin.mjs";

const require = createRequire(import.meta.url);
const { getCodexCopyOptions, convertCodexAgentContent, codexAgentName } = require("../bin/lib/codex-install.js");
const { isTextAsset, isGeneratedArtifact } = require("../bin/lib/copy-utils.js");
const { isExplicitOnlySkill, CODEX_POLICY_FILE, CODEX_EXPLICIT_ONLY_POLICY } = require("../bin/phases/copy-payload.js");
const { codexRuntimeLayout } = require("../bin/phases/codex-runtime.js");
const { pluginHookCommands, pluginHooksConfig } = require("../bin/phases/codex-hooks.js");

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const source = join(packageRoot, "src");
const codexBody = getCodexCopyOptions().transform;
export const ROOT_TOKEN = "{CAFEKIT_ROOT}";
export const CODEX_ONLY_SKILLS = ["setup-agents"];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeFile(path, data, mode) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  if (mode !== undefined) chmodSync(path, mode);
}

// After the installer transform, Markdown names install paths (.codex/…, .agents/skills/…).
// In the plugin those files live under the plugin root; agents are installed per user.
function toPluginPaths(text) {
  return text
    .replace(/\bnode\s+(?<![\w~/])\.codex[/\\]scripts[/\\]([A-Za-z0-9-]+)\.cjs/g, (_, name) => `{cafekit:${name}}`)
    .replace(/(?<![\w~/])\.codex[/\\]scripts[/\\]([A-Za-z0-9-]+)\.cjs/g, (_, name) => `{cafekit:${name}}`)
    .replace(/(?<![\w~/])\.codex[/\\](references|scripts|rules|hooks|output-styles)[/\\]/g, (_, dir) => `${ROOT_TOKEN}/${dir}/`)
    .replace(/(?<![\w~/])\.agents[/\\]skills[/\\]/g, `${ROOT_TOKEN}/skills/`)
    .replace(/(?<![\w~/])\.codex\/agents\//g, "~/.codex/agents/");
}

function copyTree(fromDir, toDir) {
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (isGeneratedArtifact(entry.name)) continue;
    const from = join(fromDir, entry.name);
    const to = join(toDir, entry.name === "gitignore" ? ".gitignore" : entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
      continue;
    }
    if (!entry.isFile()) throw new Error(`Unsupported entry in plugin source: ${from}`);
    const mode = statSync(from).mode & 0o777;
    if (!isTextAsset(from)) {
      writeFile(to, readFileSync(from), mode);
      continue;
    }
    let text = codexBody(readFileSync(from, "utf8"), from);
    if (from.endsWith(".md")) text = toPluginPaths(text);
    writeFile(to, text, mode);
  }
}

/** Script names the Markdown runs as `{cafekit:<name>}`. */
export function scriptCommands(tree) {
  const names = new Set();
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name.endsWith(".md")) {
        for (const [, name] of readFileSync(path, "utf8").matchAll(/\{cafekit:([A-Za-z0-9-]+)\}/g)) names.add(name);
      }
    }
  };
  visit(tree);
  return [...names].sort();
}

// Register plugin/hooks/plugin-context.cjs on every SessionStart, compact included,
// with the same launcher shape as the runtime hooks.
function withPluginContext(config) {
  const launchers = pluginHookCommands("plugin-context.cjs");
  const command = launchers.command.replace("/hooks/plugin-context.cjs", "/plugin/hooks/plugin-context.cjs");
  const commandWindows = launchers.commandWindows.replace("'hooks','plugin-context.cjs'", "'plugin','hooks','plugin-context.cjs'");
  if (command === launchers.command || commandWindows === launchers.commandWindows) throw new Error("Unexpected Codex plugin launcher shape");
  const group = { matcher: "startup|resume|clear|compact", hooks: [{ type: "command", command, commandWindows }] };
  return { ...config, hooks: { ...config.hooks, SessionStart: [...(config.hooks.SessionStart || []), group] } };
}

const DESCRIPTION ="CafeKit for Codex CLI: process-first specs, develop, test and review skills with runtime gates.";

export function marketplace() {
  return {
    name: "cafekit",
    interface: { displayName: "CafeKit" },
    plugins: [{
      name: PLUGIN_NAME,
      source: { source: "local", path: "./plugins/cf-codex" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Developer Tools",
      description: DESCRIPTION,
    }],
  };
}

export function build(outDir) {
  const pkg = readJson(join(packageRoot, "package.json"));
  clearOutput(outDir, PLUGIN_NAME, ".codex-plugin");
  mkdirSync(outDir, { recursive: true });

  for (const skill of inScopeSkills()) {
    const skillSource = join(source, "claude/skills", skill);
    copyTree(skillSource, join(outDir, "skills", skill));
    if (isExplicitOnlySkill(skillSource)) writeFile(join(outDir, "skills", skill, CODEX_POLICY_FILE), CODEX_EXPLICIT_ONLY_POLICY);
  }
  // Codex-only skills, written Codex-native in their source.
  for (const skill of CODEX_ONLY_SKILLS) {
    const skillSource = join(source, "codex/plugin/skills", skill);
    copyTree(skillSource, join(outDir, "skills", skill));
    if (isExplicitOnlySkill(skillSource)) writeFile(join(outDir, "skills", skill, CODEX_POLICY_FILE), CODEX_EXPLICIT_ONLY_POLICY);
  }
  copyTree(join(source, "claude/references"), join(outDir, "references"));
  copyTree(join(source, "claude/scripts"), join(outDir, "scripts"));
  writeFile(join(outDir, "scripts/setup-agents.cjs"), readFileSync(join(source, "codex/scripts/setup-agents.cjs")), 0o755);

  // Codex loads no agents from a plugin; setup-agents copies these into the user's
  // agents directory and replaces only files whose marker hash still matches.
  for (const agent of inScopeAgents()) {
    const body = convertCodexAgentContent(readFileSync(join(source, "claude/agents", `${agent}.md`), "utf8"), `${agent}.md`);
    const digest = createHash("sha256").update(body).digest("hex");
    writeFile(join(outDir, "agents", `${codexAgentName(agent)}.toml`), `# CafeKit agent: plugin=${PLUGIN_NAME} version=${pkg.version} sha256=${digest}\n${body}`);
  }

  // The same runtime files and bytes an npx Codex install receives.
  for (const entry of codexRuntimeLayout()) {
    const mode = statSync(entry.src).mode & 0o777;
    const bytes = entry.transform === "codex-body" ? codexBody(readFileSync(entry.src, "utf8"), entry.src) : readFileSync(entry.src);
    writeFile(join(outDir, entry.dest), bytes, mode);
  }
  // The plugin-only core lives beside the runtime, so hooks/ stays byte-equal to npx.
  writeFile(join(outDir, "plugin/core.md"), readFileSync(join(source, "codex/plugin/core.md")));
  writeFile(join(outDir, "plugin/hooks/plugin-context.cjs"), readFileSync(join(source, "codex/plugin/hooks/plugin-context.cjs")), 0o755);
  writeFile(join(outDir, "plugin/script-commands.json"), `${JSON.stringify(scriptCommands(outDir))}\n`);
  const template = readJson(join(source, "codex/hooks.json"));
  writeFile(join(outDir, "hooks/hooks.json"), `${JSON.stringify(withPluginContext(pluginHooksConfig(template)), null, 2)}\n`);

  const manifest = {
    name: PLUGIN_NAME,
    version: pkg.version,
    description: DESCRIPTION,
    author: { name: "Haposoft", email: "nghialt@haposoft.com", url: "https://github.com/haposoft/cafekit" },
    homepage: pkg.homepage,
    repository: "https://github.com/haposoft/cafekit",
    license: pkg.license,
    keywords: ["specs", "workflow", "hooks"],
    interface: {
      displayName: "CafeKit",
      shortDescription: "Process-first specs, develop, test and review workflows with runtime gates",
      developerName: "Haposoft",
      category: "Developer Tools",
    },
  };
  writeFile(join(outDir, ".codex-plugin/plugin.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return outDir;
}

function main(argv) {
  const flag = argv[0];
  if (flag === "--check") {
    const target = resolve(argv[1] || join(repoRoot, "plugins/cf-codex"));
    const fresh = mkdtempSync(join(tmpdir(), "cafekit-codex-plugin-check-"));
    try {
      const differences = diffTrees(build(join(fresh, "cf-codex")), target);
      if (target === join(repoRoot, "plugins/cf-codex")) {
        let committed = null;
        try { committed = readFileSync(join(repoRoot, ".agents/plugins/marketplace.json"), "utf8"); } catch { /* missing */ }
        if (committed !== `${JSON.stringify(marketplace(), null, 2)}\n`) differences.push("changed .agents/plugins/marketplace.json");
      }
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
  const outDir = flag === "--out" ? resolve(argv[1]) : join(repoRoot, "plugins/cf-codex");
  build(outDir);
  if (flag !== "--out") writeFile(join(repoRoot, ".agents/plugins/marketplace.json"), `${JSON.stringify(marketplace(), null, 2)}\n`);
  console.log(`built Codex plugin ${PLUGIN_NAME} into ${outDir}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
