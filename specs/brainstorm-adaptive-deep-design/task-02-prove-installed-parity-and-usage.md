# Task 02 — Prove installed parity and document usage

Status: done

## Outcome
Claude and Codex installations preserve adaptive-deep Brainstorm semantics, and published guidance explains the modes without overstating proof or authority.

## Coverage
- CP-03: installed visual/advice authority and redaction parity.
- CP-05: source, packed/installed Claude, packed/installed Codex, and guide parity.

## Scope
- In: installed semantic parity, packed negative mutations, and concise usage.
- Out: release/version bump, live host/model run, timing comparison, generated visual artifact, or downstream feature implementation.

## Ownership
- Modify: `packages/spec/bin/__tests__/codex-native.test.js`
- Modify: `packages/spec/bin/__tests__/package-inventory.test.js`
- Modify: `docs/specs-usage-guide.md`
- Modify: `packages/spec/README.md`
- Read: `packages/spec/src/claude/migration-manifest.json`

## Acceptance
- Disposable Claude/Codex installs retain Direct precedence, deterministic Standard/Deep routing, exact flags, relevant-only lenses, separated evidence semantics, fresh decision brief, and optional visual/advice authority.
- A reusable mutation matrix exercises both runtimes. Every mandatory group is nonempty and requires exact owning-issue detection; missing or wrong detection fails the outer suite without mutating canonical source bytes.
- Repository and package guides document the leading control segment; combinable, single-use exact `--deep`, `--visual`, and `--advice` flags; unknown/duplicate handling; the `--` terminator; and a literal-flag example such as `-- --dry-run`. They also state default proportional behavior, Direct precedence, authority/redaction boundaries, and that output is neither live proof nor Specs/Develop approval or execution authority.

## Dependencies
- task-01-author-adaptive-depth-contract.md

## Verification Plan
- Command: `npm --prefix packages/spec test`
- Named probes:
  - `Codex installed Brainstorm skill reference and agent preserve proportional routing parity`
  - `packed Claude and Codex installs preserve adaptive Specs, spec-maker, and proportional Brainstorm`
  - `packed Claude and Codex reject adaptive Brainstorm semantic weakenings`
  - `repository and package guides document adaptive Brainstorm usage`
- Mutation groups: Direct/depth/leading-control routing; lens trigger/skip; evidence semantics; numeric estimates; decision freshness; visual/advice redaction, fallback, consent, and non-authority. Each group has at least one Claude and one Codex mutation.
- Oracle: the green package harness asserts the exact expected issue for every isolated installed mutation. Clean fixtures pass with no issues; absent/wrong detection fails the outer suite nonzero; the full suite runs more than zero tests and exits 0.
- Counterexample: installed text that makes `--visual` persist automatically or turns adviser output into approval must fail for both Claude and Codex.
- Reachability: tests read disposable `.claude/skills/brainstorm`, `.claude/agents/brainstormer.md`, `.agents/skills/brainstorm`, and `.codex/agents/brainstormer.toml` projections plus both published guides.
- Cleanup: disposable fixtures are removed; canonical source bytes stay intact.

## Receipt

Verification: PASS
Command: npm --prefix packages/spec test
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
$ npm --prefix packages/spec test
✔ Codex installed Brainstorm skill reference and agent preserve proportional routing parity
✔ packed Claude and Codex installs preserve adaptive Specs, spec-maker, and proportional Brainstorm
✔ packed Claude and Codex reject adaptive Brainstorm semantic weakenings
✔ repository and package guides document adaptive Brainstorm usage
✔ hook behavioral tests: tests=199 pass=199 fail=0
[skill-test] PASS: 1167 tests executed
Aggregate: pass=1166 fail=0 skipped=1; Exit: 0
Reachability: packed installs exercised disposable .claude/.codex/.agents projections and both published guides.
Negative proof: exact issue-set assertions covered 10 nonempty groups across Claude and Codex, including flag grammar, fallback, consent, redaction, and non-authority.
Cleanup: eight canonical SHA-256 values and git status were identical before and after the final single-process command.
Review: PASS — installed parity, mutation safety, semantic coverage, guide contract, correctness, security, and scope.
```
