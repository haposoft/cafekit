# Skill catalog native routing parity
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-09-01)
- Existing: native frontmatter selection and a fixed workflow chain exist in `packages/spec/src/claude/rules/skill-workflow-routing.md:3-15`; the installed catalog scanner reads `SKILL.md` metadata in `packages/spec/src/claude/scripts/generate-skill-catalog.cjs:39-135`.
- Minimum change: add a CafeKit-native router with taxonomy, chain, and agent-timing contracts; use only live installed capabilities; prove Claude/Codex instruction/projection parity, optional-skill absence, and proportional direct paths. Live-model adherence remains `UNPROVEN`.
- Expansion signals: more than eight delivery files across source, rules, scanner/context, tests, manifest, and guides; one cross-runtime installed-behavior contract.
- User decision: EXPAND — “làm giống hoàn toàn”; parity means AgentKit routing behavior adapted to `hapo:*`, CafeKit gates, installed agents, and optional bundles, not copied branding or absent capabilities.

## Out of scope
- Automatic prompt-scoring hooks or deterministic keyword dispatch.
- AgentKit-only skills, agents, MCP runtimes, marketing workflows, or cross-CLI orchestrators.
- Rewriting metadata that already selects narrowly and correctly.
- Changing the accepted corrupt-metadata recovery policy; Route consumes the post-install inventory as observed.
- Commit, push, release, or modifying `~/Desktop/cafekit-ref`.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Router instructions encode the shortest valid installed route for clear, trivial, explicit, ambiguous, multi-domain, and high-risk requests without expanding user authority. | add, modify | AI/model; runtime/deploy | none/proceed | elevated; reference behavior and current source; live adherence `UNPROVEN` | source mutation tests |
| CP-02 | Claude and Codex installed projections preserve equivalent router semantics without invoking absent, invalid, duplicate, or retired capabilities. | integrate | integration/proof; runtime/deploy | none/proceed | elevated; installer projections and bundle inventory; live adherence `UNPROVEN` | installed and packed tests |
| CP-03 | Guides explain implicit selection, explicit invocation, fallback, chain, and agent timing without claiming deterministic adherence. | modify | CLI/docs; AI/model | none/proceed | routine; published guides | docs static check and web compile |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a user names a skill or presents one obvious low-risk intent, Route instructions shall select that installed skill directly without routing ceremony. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-02 | When a request is ambiguous, multi-step, multi-domain, or elevated/high risk, Route instructions shall classify final deliverable, size, risk, and domains before composing the shortest valid installed chain. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |
| AC-03 | If a capability or agent is absent, ambiguous, invalid, duplicate, or retired, Route instructions and the generated catalog shall omit automatic invocation, use native fallback where safe, and name the gap. | `npm --prefix packages/spec test` |
| AC-04 | Where document skills are not selected, fresh Claude and Codex installs shall preserve router behavior without routing to document skills. | `npm --prefix packages/spec test` |
| AC-05 | Installed Claude and Codex projections shall preserve source router semantics and reject representative semantic weakenings. | `npm --prefix packages/spec test` |
| AC-06 | Repository and web guides shall describe native semantic selection, explicit invocation, progressive disclosure, proportional routing, and nondeterministic limitations accurately. | exact inline content checks plus `pnpm --dir cafekit-web lint && pnpm --dir cafekit-web build` in Tasks 04–05 |
| AC-07 | When the user grants read-only, diagnostic, implementation-only, or local-only authority, Route instructions shall stop before any mutating, external, deploy, publish, commit, or push link not already authorized. | `node packages/spec/scripts/run-skill-self-tests.mjs --static-only` |

## Parity crosswalk
| AK obligation | Decision | CafeKit contract | Negative proof |
|---|---|---|---|
| Proportional direct path | adopt | AC-01; explicit, obvious, and factual requests bypass Route | explicit Test or direct Ask gets reclassified |
| Final-deliverable taxonomy plus size/risk/domains | adapt to CafeKit workflows | AC-02; no marketing or absent AK classes | shorter valid class is ignored or risk averaged down |
| Live installed inventory | adopt with fail-closed catalog | AC-03–AC-05; runtime-bound root, invalid/duplicate diagnostics, retired auto-route exclusion | Codex reads Claude inventory or malformed skill becomes routable |
| Understand → decide → execute → verify → deliver | adopt | Task 01 link entry/exit/owner, artifact passing, collapse/insertion | link advances without output or cheap link cannot collapse |
| Agent timing and delegation contract | adapt to installed CafeKit agents | seven-field brief, disjoint parallel ownership, status handling, missing-agent fallback | absent agent synthesized or `BLOCKED` blindly retried |
| Risk quality gates | adopt | highest-link risk; elevated verification; high independent review and confirmation | high-risk chain skips reviewer/confirmation |
| Authority monotonicity | add for CafeKit safety | AC-07 | review→push, diagnose→fix, or build→deploy without authority |
| Failure detour and stop | adapt, do not replace orchestrator budget | key `(link, owner, normalized cause)`; two same-key chain failures stop; orchestrator's separate task retry remains authoritative | different causes stop early or same cause loops |

## Execution baseline
- Accepted prerequisite: the in-flight optional-skill inventory delta remains owned by its existing work; Route must compose with it and may not reset or overwrite it.
- Baseline Base: `65fd5d0bbfb4700b50339897009e2df9fcb6877a`; worktree Head excluding Specs: `7f7243b7e579b601a3e24da0922b1ff10ce0ce0e9c3dec5971478da3f0bc7a5c`.
- Tracked overlap set: `README.md`, three localized `reference.mdx`, two catalog components, `packages/spec/README.md`, `migration-manifest.json`, both routing rules, `run-skill-self-tests.mjs`, `codex-native.test.js`, and `package-inventory.test.js`; ordered Git-diff SHA-256: `fd0848dde5721fde5221f95494ff1da28644b2d03131323103a81c26ec247637`.
- Untracked overlap: `packages/spec/bin/__tests__/optional-skill-inventory.test.js`; byte SHA-256: `8a8bdb0b6253ba3229c40440af8d552366a45e413a35cc5ef242721c7b3721eb`.
- Before each edit, Develop must reread the current overlapping hunk; any unexpected delta pauses that task rather than cleaning user work.

## Tasks
| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Author native router contract and source proof | AC-01, AC-02, AC-07 | router skill, references, static runner | - | done |
| 02 | Integrate live catalog and rules | AC-02–AC-04 | routing rules, scanner, Codex entrypoint, focused source test | `task-01-author-native-router-contract.md` | done |
| 03 | Prove installed runtime parity | AC-01–AC-05, AC-07 | manifest, installed and packed tests | `task-01-author-native-router-contract.md`, `task-02-integrate-live-catalog-and-rules.md` | done |
| 04 | Document routing behavior | AC-06 | repository/package/localized references | `task-03-prove-native-and-installed-parity.md` | done |
| 05 | Update Skills discovery surfaces | AC-06 | localized Skills pages and catalog visuals | `task-04-document-routing-behavior.md` | done |

## Review log
- Round 1: C2 approved recommended disposition on 2026-09-01; accepted proof ordering, parity ledger, honest live limitation, runtime binding, reachable surfaces, dirty baseline, retired/invalid catalog handling, authority monotonicity, missing-agent proof, and docs surfaces; revised metadata recovery and failure-budget findings.
- Round 2: closure repairs bound Codex reachability, tracked/untracked baseline bytes, serialized shared web output, and strengthened the localized negative oracle. Runtime string replay supplied evidence for the final oracle repair.

| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |
|---|---|---|---|---|---|---|
| F01 | accept | Task 01/02 passed before their probes existed | Task 01/02 Ownership and commands | `specs/SKILL.md:73-81`; Task 03 dependencies | PASS | closed |
| F02 | accept | self-authored contract omitted AK obligations | Parity crosswalk | Task 01–03 acceptance and mutations | PASS | closed |
| F03 | accept | static bytes claimed live routing behavior | CP-01/02 and AC wording | Task 03 Outcome; Task 04 Acceptance | PASS | closed as instruction/projection parity; live `UNPROVEN` |
| F04 | accept | Codex read Claude inventory in combined install | Task 02 runtime-bound fixtures | Task 03 combined-install probe | PASS | closed |
| F05 | accept | dead context helper claimed runtime reachability | Task 02 Codex `AGENTS.md` ownership | Task 02 source edge; Task 03 installed edge | PASS | closed |
| F06 | accept | dirty optional work was overwritten or misattributed | Execution baseline | exact tracked/untracked digest replay | PASS | closed |
| F07 | revise | corrupt metadata forced a new OFF policy | Out-of-scope recovery clause | Task 02/03 post-install inventory proof | PASS | existing recovery contract preserved |
| F08 | accept | modified retired skill became auto-routable | Task 02 retired boundary | Task 03 upgrade counterexample | PASS | closed |
| F09 | accept | limited authority escalated into mutation or delivery | AC-07 and Task 01 authority gate | Task 01/03 negative mutations | PASS | closed |
| F10 | accept | malformed or duplicate metadata became routable | Task 02 strict catalog acceptance | Task 02/03 invalid fixtures | PASS | closed |
| F11 | accept | absent agent was synthesized | Task 03 agent-removal acceptance | installed missing-agent probe | PASS | closed |
| F12 | revise | router stop conflicted with orchestrator retries | parity crosswalk and Task 01 keyed stop | same-key/different-key replay | PASS | budgets remain separate |
| F13 | accept | Skills surfaces omitted Route or overstated determinism | Task 05 and 04-to-05 dependency | runtime regex replay plus Task 05 oracle | PASS | closed |

- Consistency sweep: 6 packet files reread; 13 accepted/revised deltas reconciled; 0 stale dependencies; 0 ownership overlaps; 0 unresolved conflicts; task ownership counts 5/5/4/5/5.
