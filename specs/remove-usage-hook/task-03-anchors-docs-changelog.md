# Task 03 — self-tests, package docs and changelogs no longer describe a usage hook

Status: done

## Outcome
The self-test suite passes with anchors that match the new docs, the package README and installer architecture doc stop describing a usage cache or shipped `usage.cjs`, and both changelogs record the removal with its limits.

## Scope
- In: `scripts/run-skill-self-tests.mjs` — delete the block `usage hook reads runtime config from hook cwd` (`:5530-5537`), drop `USAGE_CACHE_TTL_MS = 300000` from the statusline anchor (`:5547`, keep `seven_day` only if `status.cjs` still contains it), update `:5371` and `:5411` to the rewritten doc sentences. `packages/spec/README.md:150-154,166-167` — quota comes from `rate_limits`; drop "usage cache". `docs/installer-architecture.md:79` (omp `usage.enabled: false` reason), `:92` (recount the `~/.claude/` sites and the dead-code lines in `lib/context.cjs`, drop "the reachable one (`usage`)"), `:109` (one sentence: the usage hook was removed; the statusline reads `rate_limits`). Changelogs: a block under the existing `## [Unreleased]` in each (English / Vietnamese).
- Out: historical changelog entries; the July audit doc; `cafekit-web` (task-04).

## Coverage
- CP-03

## Ownership
- Modify: `scripts/run-skill-self-tests.mjs`, `README.md`, `../../docs/installer-architecture.md`, `CHANGELOG.md`, `../../docs/project-changelog.md`

## Steps
1. Run the Verification Plan Command and expect failure.
2. Edit the docs, then make each self-test anchor quote the new sentence verbatim (recount with `grep -c` before writing a number).
3. Changelog content: `usage.cjs` removed from Claude and omp; it read the Claude Code OAuth token from the macOS Keychain and called an undocumented endpoint; upgrades delete `.claude/hooks/usage.cjs` and `.omp/hooks/usage.cjs` even when edited and drop the two `.claude/settings.json` entries; entries in `settings.local.json` or `~/.claude/settings.json` must be removed by hand; the statusline reads only `rate_limits`, so no quota shows before a session's first API response or on a Claude Code too old to send it, and API-key/Bedrock/Vertex sessions are unchanged; `usage` in `runtime.json` is kept but deprecated; `context.cjs` no longer reads the cache.
4. Run the Command.

## Acceptance
- AC-05: the full self-test run passes; each changelog's `[Unreleased]` block names `usage.cjs`; README and the architecture doc mention no usage cache.

## Dependencies
- task-02-statusline-payload-quota.md

## Verification Plan
- Command: `! grep -n "usage\.cjs\|USAGE_CACHE_TTL_MS" scripts/run-skill-self-tests.mjs && ! tr '\n' ' ' < README.md | grep -q "usage *cache" && ! grep -n "usage\.cjs. reads\|reachable one (.usage.)\|deliberately not routed" ../../docs/installer-architecture.md && awk '/^## \[Unreleased\]/{f=1;next}/^## \[/{f=0}f' CHANGELOG.md | grep -q "usage\.cjs" && awk '/^## \[Unreleased\]/{f=1;next}/^## \[/{f=0}f' ../../docs/project-changelog.md | grep -q "usage\.cjs" && node scripts/run-skill-self-tests.mjs 2>&1 | tee /dev/stderr | grep -q '^\[skill-test\] PASS'`
- Named probe: the self-test runner's final line `[skill-test] PASS: N tests executed`; the anchors at `:5371`, `:5411`, `:5547`; the two `[Unreleased]`-scoped greps.
- Reachability: source — full package suite, no network.
- Oracle: exit 0 and `[skill-test] PASS`.
- Counterexample: a changelog entry written outside `[Unreleased]` fails its `awk | grep`; an anchor left quoting the old doc sentence fails the runner; README still saying "usage cache", even split across a wrapped line as at `README.md:166-167`, fails the joined-text `grep`.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `! grep -n "usage\.cjs\|USAGE_CACHE_TTL_MS" scripts/run-skill-self-tests.mjs && ! tr '\n' ' ' < README.md | grep -q "usage *cache" && ! grep -n "usage\.cjs. reads\|reachable one (.usage.)\|deliberately not routed" ../../docs/installer-architecture.md && awk '/^## \[Unreleased\]/{f=1;next}/^## \[/{f=0}f' CHANGELOG.md | grep -q "usage\.cjs" && awk '/^## \[Unreleased\]/{f=1;next}/^## \[/{f=0}f' ../../docs/project-changelog.md | grep -q "usage\.cjs" && node scripts/run-skill-self-tests.mjs 2>&1 | tee /dev/stderr | grep -q '^\[skill-test\] PASS'`
Exit: 0
Base: 9f8138238923b1f01cb0be84ce9f13a1c6063522
Head: cc678c7d2710be083a40a949cc86f56c2ec4d1e97df8271909ae23ef96a526e3
```text
$ (packages/spec) <Command above>   # tail; EXIT=0
[skill-test] PASS: 1607 tests executed
```
Pre-change run exited 1 at the first guard (`run-skill-self-tests.mjs` still named `usage.cjs`). Deviation inside owned scope: the "Thirteen `~/.claude/` sites" and "Twenty dead-code lines" counts could not be reproduced by any counting rule tried (`'.claude'` literals, `homedir` lines, both), so `docs/installer-architecture.md:92` now names the files instead of a number and the `:5411` anchor quotes the new sentence.
