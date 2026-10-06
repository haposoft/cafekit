'use strict';

// D12 semantic-firewall test reachability invariant (owner R0-01). Sole
// discovery authority for `*.semantic-firewall.test.js` basenames under
// bin/__tests__: sorted basenames, no other module re-implements this scan.

const fs = require('node:fs');

const SUFFIX = '.semantic-firewall.test.js';

function discoverSemanticFirewallTests(testsDir) {
  let entries;
  try {
    entries = fs.readdirSync(testsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(SUFFIX))
    .map((entry) => entry.name)
    .sort();
}

// Verifies every requested basename was actually discovered under testsDir.
// Whether "not executed" or "fails" is left to the caller (run-skill-self-tests.mjs
// runs each required basename in isolation and applies its own NO_TESTS/FAIL rules);
// this function only proves discoverability, the first of the three D12 failure modes.
function assertRequiredSemanticTests(testsDir, requiredBasenames) {
  const discovered = discoverSemanticFirewallTests(testsDir);
  const discoveredSet = new Set(discovered);
  const missing = requiredBasenames.filter((basename) => !discoveredSet.has(basename));
  return { ok: missing.length === 0, discovered, missing };
}

module.exports = { SUFFIX, discoverSemanticFirewallTests, assertRequiredSemanticTests };
