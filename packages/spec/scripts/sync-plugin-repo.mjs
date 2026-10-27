#!/usr/bin/env node

// Copy the released plugins into the thin marketplace repository haposoft/cafekit-plugins.
//
//   node sync-plugin-repo.mjs <checkout of cafekit-plugins>
//
// The cafekit repository is too large for a marketplace clone (Codex clones every branch
// and tag), so users add the thin repository instead. This script only writes files; the
// release step commits them, tags v<version> and pushes. It refuses when a plugin tree is
// stale or its version differs from package.json, so a tag always matches the npm release.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const { version } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

const COPIED = [
  ".claude-plugin/marketplace.json",
  ".agents/plugins/marketplace.json",
  "plugins/cf",
  "plugins/cf-codex",
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const target = process.argv[2] ? resolve(process.argv[2]) : null;
if (!target || !existsSync(join(target, ".git"))) fail("pass a git checkout of haposoft/cafekit-plugins");
if (resolve(target) === repoRoot) fail("the target is the cafekit repository itself");

for (const script of ["build-claude-plugin.mjs", "build-codex-plugin.mjs"]) {
  try {
    execFileSync(process.execPath, [join(packageRoot, "scripts", script), "--check"], { stdio: "pipe" });
  } catch (error) {
    fail(`${script} --check: ${String(error.stdout || error.message).trim()}`);
  }
}
for (const manifest of ["plugins/cf/.claude-plugin/plugin.json", "plugins/cf-codex/.codex-plugin/plugin.json"]) {
  const found = JSON.parse(readFileSync(join(repoRoot, manifest), "utf8")).version;
  if (found !== version) fail(`${manifest} is ${found}, package.json is ${version}`);
}

for (const rel of COPIED) {
  rmSync(join(target, rel), { recursive: true, force: true });
  mkdirSync(dirname(join(target, rel)), { recursive: true });
  cpSync(join(repoRoot, rel), join(target, rel), { recursive: true, verbatimSymlinks: true });
}

writeFileSync(join(target, "README.md"), `# CafeKit plugins

Release builds of the CafeKit plugins for Claude Code and Codex CLI, version ${version}.
Source, issues and changelog: https://github.com/haposoft/cafekit

## Claude Code

\`\`\`bash
claude plugin marketplace add haposoft/cafekit-plugins
claude plugin install cf@cafekit
\`\`\`

## Codex CLI

\`\`\`bash
codex plugin marketplace add haposoft/cafekit-plugins
codex plugin add cf@cafekit
\`\`\`

Then run \`$cf-setup-agents\` once in Codex to install the CafeKit agents.

To pin a release on Codex, add the tag: \`codex plugin marketplace add haposoft/cafekit-plugins@v${version}\`.

## Moving from the npx install

In a repository that still has the npx install, run
\`npx @haposoft/cafekit@latest migrate\` to preview its removal, then add \`--apply\`.

This repository is generated from haposoft/cafekit by
\`packages/spec/scripts/sync-plugin-repo.mjs\`; change the source there, not here.
`);

console.log(`synced CafeKit plugins ${version} into ${target}`);
console.log(`next: git -C ${target} add -A && git -C ${target} commit -m "release: ${version}" && git -C ${target} tag v${version} && git -C ${target} push origin HEAD --tags`);
