# Oh My Pi (omp) runtime support
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-09-08)
- Existing: `bin/lib/context.js:73` holds the `PLATFORMS` registry with an "Add new platforms here" stub at `:123`. `bin/install.js:66,76` branches phases per `platformKey`. `src/claude/settings/settings.json` registers **15** hook scripts; two further `.cjs` files under `src/claude/hooks/` are libraries, not gates. `src/codex/hooks/` is the working precedent for a forked runtime: 16 hook scripts plus 8 libraries, with three shared libraries materialized from the Claude source at `bin/phases/codex-runtime.js:81,88,95`.
- Minimum change: register omp as a platform, fork the hook tree the way Codex already does, and add one bridge extension that maps omp lifecycle events onto the forked hooks.
- Expansion signals: above the eight-file threshold and now a forked tree. One subsystem only; grok and pi stay in separate packets.
- User decision: KEEP — deliver the bridge with gate coverage (C1, 2026-09-08). C2 chose the forked-tree architecture over a translate-everything bridge (2026-09-08).

## Verified runtime contract
Read from `/opt/homebrew/Cellar/omp/18.1.11/bin/omp` on 2026-09-08. Each row was confirmed by reading the binary, not inferred.
| Fact | Consequence |
|---|---|
| `emitToolCall` returns `{ block: true, reason }`; on handler timeout or throw omp itself substitutes `{ block: true, reason: "Extension … timed out after <ms>" }` | omp fails **closed** at `tool_call`. A bridge cannot fail open there even if it tries. |
| `extensionHandlers.toolCallTimeoutMs` defaults to 30000 | The bridge needs its own budget below 30000 ms or omp blocks first with a useless reason. |
| `emitSessionStop({ …, session_id, session_file, stop_hook_active, … })` | `stop_hook_active` is real and host-owned; `spec-gate.cjs:82` can rely on it. |
| `session_stop` result reads `decision`, `reason`, `additionalContext`, `continue` | The Stop gate's existing block shape maps directly. |
| `input` payload is `{ type, text, images, source }` | **No `session_id`, no `cwd`.** `rules.cjs:57` exits when session id is absent. |
| Tool registry names are lowercase: `bash`, `read`, `edit`, `grep` | `privacy-block.cjs:182` compares `toolName === 'Bash'` exactly and would never match. |
| `skills.enableClaudeProject` and `skills.enableAgentsProject` default true | Skills already reach omp; no skill payload is copied. |

## Denial mechanisms actually in use
No hook emits a block reason on stderr. Verified across `src/claude/hooks/`.
| Mechanism | Hooks | Where |
|---|---|---|
| `{"decision":"block","reason":R}` on stdout, exit 0 | `spec-gate.cjs`, `completion-authority.cjs` | `spec-gate.cjs:57` |
| `hookSpecificOutput.permissionDecision: "ask"` on stdout, exit 0 | `privacy-block.cjs` | `privacy-block.cjs:191-198`, catch-all `:239-245` |
| exit 2 with the reason on **stdout** | `inspect-block.cjs`, `task-scaffold-guard.cjs` | `inspect-block.cjs:91-96` |

## Out of scope
- grok and pi; each gets its own packet.
- Any change to `src/claude/hooks/`. The omp fork carries omp-specific contract changes, exactly as `src/codex/hooks/` does.
- Claude Code plugin packaging, deferred by the user on 2026-09-03.
- Copying skills or rules content, since omp discovers both already.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | `--platform omp` installs a complete omp runtime | add platform entry, add install phase, add ignore rule | `bin/lib/context.js`, `bin/install.js`, `bin/phases/omp-runtime.js`, `bin/phases/root-config.js` | settled | elevated — installed behavior | source + installed |
| CP-02 | The forked hooks speak omp's vocabulary | fork tree, change verdict and tool-name handling | `src/omp/hooks/` | settled by C2 | elevated — a wrong verdict silently disables a gate | source + installed |
| CP-03 | The bridge maps omp events onto the forked hooks | add bridge module | `src/omp/extensions/` | settled | elevated — enforcement correctness | source + installed |
| CP-04 | A blocked turn can still be approved and closed | map the approve path | `src/omp/hooks/`, bridge | settled | elevated — an unmapped approve path deadlocks every session | source |
| CP-05 | Docs state omp's real coverage and its gaps | modify docs | `docs/installer-architecture.md`, changelogs | settled | routine | source |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the installer runs with `--platform omp`, it shall create `.omp/hooks/`, `.omp/extensions/`, and `.omp/cafekit.json` recording `platform: "omp"`. | `node --test bin/__tests__/omp-runtime.test.js` |
| AC-02 | When the installer runs with a non-omp platform, it shall not create `.omp/`. | `node --test bin/__tests__/omp-runtime.test.js` |
| AC-03 | When the installer provisions omp, it shall add `.omp/` to the project ignore rules, because `.omp/extensions/` is auto-executed by omp. | `node --test bin/__tests__/omp-runtime.test.js` |
| AC-04 | When a forked hook receives a lowercase omp tool name, it shall apply the same rule it applies to the Claude name, for at least `bash`, `read`, `edit`, `write`, `grep`. | `node --test bin/__tests__/omp-hooks.test.js` |
| AC-05 | When the forked privacy hook would ask under Claude, it shall deny under omp, since omp's `tool_call` contract has no ask state. | `node --test bin/__tests__/omp-hooks.test.js` |
| AC-06 | When a forked hook cannot evaluate an access safely, it shall deny rather than allow. | `node --test bin/__tests__/omp-hooks.test.js` |
| AC-07 | When the bridge dispatches a hook, it shall pass a Claude-shaped payload carrying a stable session identifier derived from omp's session, so session-scoped hooks do not silently no-op. | `node --test bin/__tests__/omp-bridge.test.js` |
| AC-08 | When a dispatched hook denies through any of the three mechanisms in this plan, the bridge shall return omp's block shape carrying the hook's own reason text. | `node --test bin/__tests__/omp-bridge.test.js` |
| AC-09 | When a dispatched hook exceeds the bridge's own timeout budget, the bridge shall return a block naming the hook, before omp's 30000 ms cut-off produces a reasonless block. | `node --test bin/__tests__/omp-bridge.test.js` |
| AC-10 | When `session_stop` arrives with `stop_hook_active` true, the bridge shall return without dispatching the gate. | `node --test bin/__tests__/omp-bridge.test.js` |
| AC-11 | When the user submits the approval phrase that the completion gate demanded, the bridge shall route it to the hook's approve path so the session can close. | `node --test bin/__tests__/omp-bridge.test.js` |
| AC-12 | When operator documentation lists platforms, it shall name omp, name the hooks it carries, and name the registered hooks it does not carry. | `node scripts/run-skill-self-tests.mjs` |
| AC-13 | When the installer runs with `--platform omp`, it shall ship `.omp/scripts/` so the Stop-time gates can load `workflow-policy.cjs`, `spec-receipt.cjs`, and their siblings; the installed `spec-gate.cjs` shall no longer answer `Completion gate unavailable`. | `node --test bin/__tests__/omp-runtime.test.js` |

## Tasks
| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Register omp as an install target | AC-01, AC-02, AC-03 | `bin/lib/context.js`, `bin/install.js`, `bin/phases/omp-runtime.js`, `bin/phases/root-config.js` | - | done |
| 02 | Fork the hook tree for omp's vocabulary | AC-04, AC-05, AC-06 | `src/omp/hooks/` | task-01-register-omp-platform.md | done |
| 03 | Bridge omp events onto the forked hooks | AC-07, AC-08, AC-09, AC-10, AC-11 | `src/omp/extensions/cafekit-bridge.mjs` | task-02-fork-omp-hooks.md | done |
| 04 | Document omp coverage and its gaps | AC-12 | `docs/installer-architecture.md`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`, `packages/spec/scripts/run-skill-self-tests.mjs` | task-03-bridge-omp-events.md | done |
| 05 | Ship the shared scripts so the Stop gate runs on omp | AC-13 | `bin/phases/copy-payload.js`, `bin/__tests__/omp-runtime.test.js` | task-01-register-omp-platform.md | done |

## Review log
- Round 1 (2026-09-08): two fresh-context reviewers, both FAIL. 15 deduplicated findings. Accepted 13 as defects and rewrote the acceptance layer: AC-04 previously named two denial mechanisms where three exist and put the reason on stderr where every hook writes stdout; AC-05 mandated fail-open where omp itself fails closed at `tool_call`; task 01 installed no hooks at all; lowercase omp tool names, the missing session id on `input`, and the unmapped approve path were all absent from the plan. Corrected the hook count from seventeen to fifteen registered plus two libraries, and narrowed the coverage claim. Rejected nothing. One reviewer flagged `stop_hook_active` as unverified; the other verified it in the binary and the flag was wrong — the field is real and AC-10 stands. C2 decision: fork the hook tree following the Codex precedent.
- Round 2 (2026-09-08, during execution): task 01 AC-01 required `.omp/extensions/` to contain the bridge file, which task 03 owns. Narrowed to the directory. This is the ownership conflict round 1 raised and the first rewrite only half-fixed.
- Round 2 correction: tasks 02-04 were authored `blocked` on their dependencies alone. The status matrix reserves `blocked` for an open decision, an accepted finding, or `UNKNOWN` reachability; the resolver queues dependencies itself. Promoted to `pending`.
- C3 (2026-09-08): user accepted completion at 4/4 with three recorded limitations — the bridge is verified against the omp contract read from the installed binary but was not exercised in a live omp session; the fork still hardcodes `.claude/` paths, so on an omp-only install `rules.cjs` finds no runtime config and injects nothing while the security and Stop gates are unaffected; and no subagent gates exist because omp has no subagent events. The `.claude/` coupling is the same open decision first raised for grok and now applies to omp as well.
- Reopened (2026-09-08, after C3): the round 1 review of `runtime-dir-portability` produced new evidence. `bin/phases/copy-payload.js:159` copies `scripts/` only inside `if (hasPlatformCapability(platformKey, 'agents'))`; omp has `agents: false, scripts: true`, so no omp install has ever received `.omp/scripts/`. Every Stop-time gate requires `../scripts/*.cjs`, so the installed `spec-gate.cjs` answers `Completion gate unavailable` and the bridge turns that into a block on every `session_stop`. Verified by installing into a temp project and running the installed hook. The C3 note that the Stop gate was unaffected was wrong. Task 05 ships the scripts; the user reopened under `review-audit-self-decision.md` on this new evidence.
- C3 again (2026-09-08): user re-accepted completion at 5/5 after the reopen. The Stop gate now loads its scripts on an installed omp (task 05, AC-13). Remaining limitations: no live omp session has exercised the bridge, and `rules.cjs` stays silent until `.omp/runtime.json` ships, which `runtime-dir-portability` task 03 owns.
