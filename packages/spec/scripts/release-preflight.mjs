#!/usr/bin/env node
// D1 production caller: verify (never create or self-heal) the current C9
// freeze against the current C10 authority and C15 ledger before a pack or
// publish proceeds. Real callers: prepack, prepublishOnly (wired in
// package.json), and any operator running this directly before a release.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const changeFirewall = require('../src/claude/scripts/change-firewall.cjs');

// R1.3 (design.md Errors and Recovery: "Caller base override | exit 2 | no
// accept"): this CLI takes no arguments at all -- any argv is by definition
// an attempted override of something this tool never configures per-call.
// Checked before any filesystem read or mutation.
function assertNoCliArgs() {
  if (process.argv.length > 2) {
    throw new Error(`release-preflight accepts no CLI arguments; received: ${process.argv.slice(2).join(' ')}`);
  }
}

function main() {
  assertNoCliArgs();
  const freeze = changeFirewall.verifyFreezeManifest();
  process.stdout.write(`${JSON.stringify({
    status: 'preflight_ok',
    changeKind: freeze.changeKind,
    candidateDigest: freeze.candidateDigest,
    treeDigest: freeze.treeDigest,
    packageVersion: freeze.packageVersion,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`release preflight failed: ${error.message}\n`);
  process.exitCode = 2;
}
