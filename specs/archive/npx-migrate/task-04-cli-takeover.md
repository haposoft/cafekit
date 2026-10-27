# Task 04 — CLI subcommand, Codex notice, plugin takes over

Status: done

## Outcome
`npx @haposoft/cafekit migrate` prints the plan, `migrate --apply` applies it, an unknown flag after `migrate` or an unknown positional argument exits 2, and after apply the Codex plugin's gates act in the repository; the Codex stand-down notice names `npx @haposoft/cafekit@latest migrate`.

## Scope
- In:
  - `install.js` dispatches `migrate` before its lock and context (help/version unchanged); `--apply` is its only flag; exit 0 on success or nothing to do, 1 on failure or refusal, 2 on an unknown flag; `--help` lists `migrate`.
  - `parseInstallerArgs` (`packages/spec/bin/lib/context.js:252-289`) rejects an unknown positional argument with exit 2, so a future typo never runs an install.
  - The Codex session notice (`packages/spec/src/codex/hooks/session.cjs:106-109`) adds "or run `npx @haposoft/cafekit@latest migrate`". Rebuild `plugins/cf-codex`; the release constraint in `plan.md` governs when it ships.
- Out: Claude plugin stand-down; any change to the install path beyond rejecting unknown positionals.

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/bin/install.js`
- Modify: `packages/spec/bin/lib/context.js`
- Modify: `packages/spec/src/codex/hooks/session.cjs`
- Modify: `packages/spec/bin/__tests__/codex-plugin-hooks.test.js` (`silent-beside-npx` asserts the command with `@latest`)
- Create: `packages/spec/bin/__tests__/migrate-cli.test.js`
- Regenerate: `plugins/cf-codex/**`

## Steps
1. Wire the subcommand, reject unknown positionals, extend the notice, rebuild.
2. Test in a temp repo with both npx installs (cwd = that repo, temp `HOME`): `node bin/install.js migrate` exits 0 and writes nothing (tree hash); before apply the built Codex plugin's `privacy-block.cjs` with that repo as cwd prints nothing (stand-down); `migrate --apply` exits 0; afterwards the same hook denies `cat .env`; `migrate --bogus` and `node bin/install.js bogus` exit 2; a plain install in another temp repo still succeeds.

## Acceptance
- AC-04: the step 2 probes pass; `silent-beside-npx` sees `npx @haposoft/cafekit@latest migrate`; the full `bin/__tests__` suite stays green. Proof level is source (`node bin/install.js`), not a published `npx`.

## Dependencies
- task-03-apply-rollback.md

## Verification Plan
- Command: `node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/migrate-cli.test.js && node --test packages/spec/bin/__tests__/*.test.js`
- Named probe: `migrate-cli.test.js` (dry-run-default, plugin-stands-down-before, apply-exits-zero, plugin-gates-after-apply, unknown-flag-two, unknown-positional-two, install-unchanged); `codex-plugin-hooks.test.js` (silent-beside-npx).
- Reachability: source — `bin/install.js` as the npm bin, run in a temp repo; plugin hooks from the built tree.
- Oracle: exit codes; tree hash for dry-run; the plugin hook's decision before and after apply.
- Counterexample: CafeKit handlers left in `.codex/hooks.json` → `plugin-gates-after-apply` red; a missing `migrate-cli.test.js` fails the second step of the Command.
- Artifacts: ephemeral temp repos, removed in `after`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/migrate-cli.test.js && node --test packages/spec/bin/__tests__/*.test.js
Exit: 0
Base: 32ef63d6daf052d6bb6e938e73714e8930f70f88
Head: de24c4764f214476925303804e5bc286001c18c47250a2840c6aff615c44be4c
```text
$ node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/migrate-cli.test.js && node --test packages/spec/bin/__tests__/*.test.js
built Codex plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf-codex
✔ dry-run-default: migrate prints the plan, exits 0 and writes nothing (812.292125ms)
✔ plugin-stands-down-before: beside the npx Codex hooks the plugin hook stays silent (116.710792ms)
✔ apply-exits-zero: migrate --apply removes the npx install and exits 0 (583.769833ms)
✔ plugin-gates-after-apply: once the npx hooks are gone the plugin privacy gate acts (116.956459ms)
✔ unknown-flag-two: an unknown flag after migrate exits 2 and writes nothing (118.882625ms)
✔ unknown-positional-two: an unknown positional argument exits 2 before any install (236.48775ms)
✔ platform-refused-exits-one: an install migrate cannot read stops the whole run with exit 1 (845.720292ms)
✔ install-unchanged: a plain install in another repository still succeeds (413.859834ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3529.566708
[… 1598 lines of the full bin/__tests__ run elided; silent-beside-npx is in it …]
✔ silent-beside-npx: with the npx Codex hooks active in the repository, plugin hooks stand down and say so once (1654.483792ms)
ℹ tests 1566
ℹ suites 0
ℹ pass 1566
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 279645.609291
EXIT=0
```

Reachability: source — `bin/install.js` (the npm bin) run with cwd = a temp repo holding real npx 0.18.2 Claude + Codex installs and a temp HOME; the Codex plugin hooks run from a fresh build through their generated launcher. Proof level is source, not a published `npx`.
D-07 closure: before `migrate --apply` the plugin privacy hook prints nothing in that repository (stand-down); after it the same hook denies `cat .env`.
Negative proof: in-place mutations (file restored, sha256 checked) — leaving every CafeKit handler in `.codex/hooks.json` reds `apply-exits-zero` (the plan named `plugin-gates-after-apply`, which stays green because the runtime stand-down check also requires the hook scripts to exist, and they are removed); checking only the omp refusal reds `platform-refused-exits-one`.
Review: code-auditor round 1 FAIL (High: a refused or unmanaged platform still exited 0 with "Removed"), round 2 PASS.
Decision: an installed platform that is `refused` or `unmanaged` stops both the dry-run and `--apply` with exit 1 and no change (recorded in plan.md; for Bro at GATE-DONE). Added probe: `platform-refused-exits-one`.
Limitations: the release constraint (plugin notice ships with or after the npm `migrate`) is not enforced in code — task-05 records it in the changelogs; when a platform is blocked the plan above still lists the other platform's removals before "Nothing was changed"; `Removed N` counts a metadata step even when the file was already gone (unreachable while runtime.json stays).
