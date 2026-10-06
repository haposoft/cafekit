# Specs session timing benchmark

> Archived before implementation after C1 scope changed to Specs output quality.

## Scope decision (C1 — 2026-08-20)
- Existing: B1 already measures runner wall time but has no live human-gated run (`docs/benchmark-workflow.md:3-5,130-159`; `packages/spec/scripts/benchmark-workflow.mjs:432-446`).
- Existing: runtime scripts are copied to both Claude and Codex (`packages/spec/bin/phases/copy-payload.js:187-193`), and both runtime roots already ignore `session-state/` (`packages/spec/src/claude/gitignore:20-24`; `packages/spec/src/codex/gitignore:8-11`).
- Minimum change: add an explicit local recorder for Specs gate events and a report that separates authoring work, human wait, and later C3 timing; reuse B1 wall-time/provenance conventions without changing its receipt matrix.
- Expansion signals: automatic hook instrumentation would cross both runtimes, privacy/state lifetimes, and more than eight files.
- User decision: KEEP — opt-in recorder, no hidden telemetry.
- Dogfood clock: C1 opened `2026-08-20T12:00:22+07:00`; KEEP received `2026-08-20T12:04:11+07:00`.

## Out of scope
- Always-on hooks, network telemetry, model/API invocation, or transcript/prompt capture.
- Changes to B1 corpus/config/receipt schemas or baseline-versus-treatment quality claims.
- Automatic C3 completion; execution and the human C3 decision remain separate.
- The pre-existing local edit to `docs/.sync_hash`.

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When an operator runs `start --run <safe-id> --feature <slug>`, the recorder shall exclusively create `<runtime>/session-state/specs-timing/<safe-id>.json`, print that identity, and refuse collisions. | `node --test packages/spec/bin/__tests__/specs-timing.test.js` |
| AC-02 | When `mark --run <safe-id> --event <event>` receives the next valid lifecycle event, exactly one concurrent writer shall append it under a live-owner lock and atomically preserve all prior events. | `node --test packages/spec/bin/__tests__/specs-timing.test.js` |
| AC-03 | When `report --run <safe-id>` is called, the recorder shall calculate named durations from specified event endpoints using a monotonic source, preserve UTC wall timestamps for audit, and return a reasoned `unavailable` for missing or anomalous phases. | `node --test packages/spec/bin/__tests__/specs-timing.test.js` |
| AC-04 | If runtime containment, symlink safety, identifiers, event order, duplicate events, clocks, locks, or stored JSON are invalid, the recorder shall exit nonzero without changing the last valid artifact. | `node --test packages/spec/bin/__tests__/specs-timing.test.js` |
| AC-05 | The artifact shall conform to a closed content-minimized schema containing only safe run/runtime/version identity, a credential-free commit identity, a feature digest, clock metadata, and lifecycle events. | `node --test packages/spec/bin/__tests__/specs-timing.test.js` |
| AC-06 | When CafeKit is packed and installed for Claude and Codex, each installed timing command shall execute from its native path and the full package suite shall pass. | `pnpm -C packages/spec test` |

## Tasks
| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Implement the fail-closed timing recorder and focused state-machine tests | AC-01–AC-05 | `packages/spec/src/claude/scripts/specs-timing.cjs`, `packages/spec/bin/__tests__/specs-timing.test.js` | - | pending |
| 02 | Wire opt-in usage into Specs, installed-package coverage, and user guidance | AC-06 | `packages/spec/src/claude/skills/specs/SKILL.md`, `packages/spec/bin/__tests__/package-inventory.test.js`, `docs/specs-usage-guide.md` | 01 | pending |

## Review log
- Round 1 C2 opened `2026-08-20T12:16:45+07:00`; user accepted F1 state boundary, F2 time/privacy contract, and F3 installed-runtime proof at `2026-08-20T12:18:07+07:00`.
- Consistency sweep: reread 3/3 packet files; reconciled CLI/storage, concurrency/containment, clock/schema, installed proof, and all AC/task/command mappings; stale references 0; conflicts 0.
