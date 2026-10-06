# Adaptive research evidence and bounded optimization loop
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-08-31)
- Existing: `hapo-research` provides multi-source research and ranked recommendations,
  but its skill, researcher agent, and report template disagree about depth,
  persistence, delegation fallback, and claim provenance. CafeKit has no bounded
  iterative optimization engine.
- Minimum change: make Research adaptive and evidence-addressable; add one explicit
  `hapo-loop` engine with fail-closed metric, guard, isolation, and stop contracts.
- Expansion evidence: packaging, native projection, routing, tests, and operator
  docs require four sequential tasks, while retaining only the two requested
  product outcomes.
- User decision: **KEEP and learn** — keep CafeKit Research, learn the useful
  autoresearch loop semantics without copying unsafe Git behavior.

## Out of scope
- `hapo-autoresearch`; AK Predict/Scenario/Security/Deep-SWE ports; subjective or
  missing-metric loops; live success, performance, or cost claims.
- `eval`, `git reset --hard`, force push, deploy, publish, primary-branch commit,
  silent merge/cherry-pick, weakening tests/guards, or unrelated recovery.
- Legacy Specs migration, hook changes, release, version bump, commit, or push.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Research selects proportional depth and makes material claims traceable. | modify, refactor | AI/model, integration/proof, shared Research agent/template consumers | none — C1/C2 fixed depth, fallback, evidence, and persistence boundaries | medium — shared consumer compatibility and semantic mutation evidence required | source + installed |
| CP-02 | Loop exposes a bounded optimization instruction contract without silently risking the primary worktree. | add, integrate | API/CLI, AI/model, async/state, filesystem/security, integration/proof | none — C2 selected cooperative trusted-command safety and base-bound patch handoff | high — command/path, dirty state, metric noise, process-tree, cleanup, and artifact failure probes required | source + installed instruction contract; live-agent adherence `[UNPROVEN]` |
| CP-03 | Claude/Codex packaging, routing, and docs preserve the two public contracts. | modify, integrate | runtime packaging, native projection, routing, docs, legacy template consumers | none — C2 retained existing headings and added full consumer proof | medium — disposable installs, semantic mutations, package consumers, lint and site compile | installed |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When Research receives a decision, it shall choose Quick, Standard, or Deep depth from decision risk; use repository evidence for local fit; and use current external sources only for material external claims. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-02 | For every material claim, Research shall bind a URL or repository anchor, authority, date/version, applicability, and `confirmed|inferred|unresolved`; Deep shall perform a contradiction/gap round and return a winner, tradeoffs, and limitations for comparative decisions. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-03 | If delegation is unavailable, unauthorized, or not useful, Research shall continue sequentially without lowering evidence requirements; it shall persist a report only for an active Spec or explicit durable-report request, otherwise answer in chat. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-04 | Before Loop mutates anything, it shall freeze Goal, canonical isolated Scope, pinned base OID and dirty-state decision, finite numeric Metric grammar/unit/direction/samples/aggregation/noise/minimum-delta formula, reproducible Baseline, distinct immutable Guard for code mutation, budget, stop conditions, unique run identity, and exact cleanup/handoff consent. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-05 | During Loop, each iteration shall start from pinned base plus accepted-best patch in a unique detached worktree, make one attributable change, run cooperative trusted commands as screened argv from the canonical loop root without shell evaluation or external Git targeting, fingerprint oracle side effects, and accept only a current-best improvement clearing noise and minimum delta while the distinct Guard passes on identical bytes. | `npm --prefix packages/spec test` |
| AC-06 | If source/baseline/oracle/scope/environment drifts, a process tree fails or times out, ownership is uncertain, or restoration cannot be proven, Loop shall stop, quiesce descendants, clean only its owned disposable path when safe, otherwise retain exact residue and report `BLOCKED`; it shall never reset-hard, edit Metric/Guard/tests, mutate/commit/push/merge the primary branch, or claim protection from malicious executables without an OS sandbox. | `npm --prefix packages/spec test` |
| AC-07 | When CafeKit packs and installs Claude/Codex projections, public names, native vocabulary, routing, references, and safety semantics for Research and Loop shall remain equivalent and mutation-tested. | `npm --prefix packages/spec test` |
| AC-08 | Operator docs shall distinguish Research from explicit-only Loop, explain inputs/outputs and handoff, and make no guarantee of improvement. | `npm --prefix packages/spec test && pnpm --dir cafekit-web lint && pnpm --dir cafekit-web build` |

## Tasks
| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Strengthen adaptive Research contract | CP-01; AC-01–03 | Research source, agent, template, static checker | none | done |
| 02 | Add safe bounded Loop engine | CP-02; AC-04–06 | Loop source, references, static checker | task-01-strengthen-adaptive-research-contract.md | done |
| 03 | Prove packaging, routing, and installed parity | CP-03; AC-05–07 | manifest, routing, package/native tests | task-01-strengthen-adaptive-research-contract.md; task-02-add-safe-bounded-loop-engine.md | done |
| 04 | Document operator-facing usage | CP-03; AC-08 | repository/package/web guides and package docs probe | task-03-prove-packaging-routing-and-installed-parity.md | done |

## Review log
- C1 accepted on 2026-08-31.
- C2 accepted on 2026-08-31: nine findings repaired coverage schema,
  cooperative command containment, dirty detached-worktree lifecycle,
  deterministic Metric/Guard semantics, oracle drift, process-tree timeout,
  honest proof levels, base-bound patch handoff, legacy consumer proof, and
  project changelog ownership. Live-agent adherence remains `[UNPROVEN]`.
- C3 accepted on 2026-08-31: the user confirmed the implemented scope and
  stated limitations are sufficient to close this feature.
