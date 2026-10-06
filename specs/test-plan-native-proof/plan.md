# Test plan-native proof ownership
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-08-27)
- Existing: `hapo-test` already owns canonical execution proof, blast-radius
  selection, reachability checks, UI modes, and Base/Head evidence
  (`.agents/skills/test/SKILL.md:13-110`).
- Minimum change: adapt Test plus its installed runner/review consumers to flat
  process-first packets, controller-owned inline Receipts, a fail-closed proof
  handoff, canonical verdicts, mutation-safe history, safe authenticated UI, and
  concise human-readable reporting.
- Expansion evidence: C2 proved `test-runner` and `code-review` still consume the
  legacy contract; the accepted scope is 10 canonical files in two work groups.
- User decision: **KEEP** — initial approval and accepted C2 expansion on
  2026-08-27.

## Out of scope
- Develop/Specs/hook/provenance/parser behavior, legacy packet migration, new
  browser tooling or public modes, release, version bump, commit, push, or
  measured speed/live-host claims.
- Removing legacy v2.1 support, mandatory full-suite testing, automatic fixes,
  auto-installing project tooling, or handling real credentials in prompts.

## Coverage profile
| ID | Outcome | Surfaces | Proof level | Required proof |
|---|---|---|---|---|
| CP-01 | Test routes current flat packets and returns controller-consumable proof without state writes. | Test skill, execution strategy | source | static mutation contract |
| CP-02 | Valid legacy packets keep separate receipts; malformed or mixed packets fail closed. | Test skill, failure triage | source | static negative contract |
| CP-03 | Verdict aggregation and persistent-write boundaries are deterministic and fail closed. | Test skill, memory, runner | source + behavioral | static mutation + disposable fixture |
| CP-04 | Authenticated UI proof is origin/identity/consent bound and safely redacted; review consumes the same proof. | execution strategy, runner, review | source + behavioral | consumer contract tests |
| CP-05 | Claude/Codex installs and guidance preserve CP-01–CP-04. | installer projections, guide | installed | disposable native installs |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When Test receives a process-first feature or flat task, its source contract shall read current packet bytes, require the exact Verification Plan, select the smallest adequate proof, and return a typed handoff without writing Status or Receipt; live adherence remains `[UNVERIFIED]`. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-02 | When valid legacy markers exist, Test shall preserve the v2.1 separate-receipt path; malformed, symlinked, or mixed legacy/process state shall return `BLOCKED` without migration. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-03 | If any required proof branch is duplicate, zero-test, skipped, nonzero, stale, contradictory, missing, unknown, or warning-level, Test shall normalize through the canonical four-verdict lattice and never close work. | `npm --prefix packages/spec test` |
| AC-04 | While proof executes, Test shall keep its own persistent memory/report/auth state byte-for-byte unchanged, isolate and clean only Test-owned temporary files, and surface project-command drift separately from runtime Head. | `npm --prefix packages/spec test` |
| AC-05 | Where authenticated UI proof is required, the Test source contract shall require an approved profile bound to confirmed origin/identity/action scope, block unsafe redirects or destructive production actions, redact secret/PII surfaces, and return `BLOCKED` when safe proof is impossible. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-06 | When CafeKit installs Test for Claude and Codex, disposable projections and usage guidance shall preserve AC-01–AC-05, legacy isolation, references, and existing invocation modes without timing claims. | `npm --prefix packages/spec test` |

## Tasks
| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Author plan-native Test contract | CP-01/02 + CP-03/04 source; AC-01/02/05 | Test skill + three references + static checker | none | done |
| 02 | Align consumers, prove parity, document handoff | CP-03–CP-05; AC-03–AC-06 | runner/review + behavioral/native tests + guide | task-01-author-plan-native-test-contract.md | done |

## Review log
- Round 1: C2-01–C2-08 accepted on 2026-08-27; coverage and proof levels,
  consumer parity, payload lattice, auth/redaction, persistent-write safety,
  task proof ownership, and legacy precedence added. C1 reopened and KEEP retained
  for the evidence-backed 10-file scope.
- Round 2: exact closure replay repaired residual payload and malformed-flat
  cases; runtime contract assertions passed with exit 0. Consistency sweep:
  3 files reread / 8 accepted deltas / 0 stale references / 0 conflicts.
- **C3: ACCEPTED by the user on 2026-08-27.** Completion covers the verified
  `test-plan-native-proof` scope above; live-host/model adherence and real
  authenticated-site E2E remain explicitly unverified.

| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |
|---|---|---|---|---|---|---|
| C2-01 | accepted | C2-open tasks selectable | task statuses + plan table | final consistency assertion | C2 gate closed before pending | PASS |
| C2-02 | accepted | static text promoted to live | coverage profile + Task 01 proof levels | fresh closure replay | live remains `[UNVERIFIED]` | PASS |
| C2-03 | accepted | incomplete/ambiguous proof payload passes | Task 01 exact payload/branch lattice | runtime contract assertion | malformed keys/types/digest/branches block | PASS |
| C2-04 | accepted | runner/review/Develop handoff diverges | Task 02 consumer ownership/reachability | fresh closure replay | strict superset contract retained | PASS |
| C2-05 | accepted | profile or proof leaks auth/PII | Task 01 auth/redaction boundary | fresh closure replay | unsafe origin/action/output blocks | PASS |
| C2-06 | accepted | ignored memory mutation escapes Head | Task 01/02 persistent-write boundary | fresh closure replay | memory bytes and ignored drift observed | PASS |
| C2-07 | accepted | static Task 01 closes behavioral work | task CP/AC split + final rerun | fresh closure replay | behavioral proof stays in Task 02 | PASS |
| C2-08 | accepted | orphan/malformed/mixed packet misroutes | Task 01 routing truth table | runtime contract assertion | every marker combination is explicit | PASS |
