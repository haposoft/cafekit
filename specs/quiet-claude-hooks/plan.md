# Quieter Claude hooks
Specs-Contract: process-first-ready-v1

Packet 2 of 3 in `plans/20261006-hook-cleanup-roadmap.md`. Work context: worktree `../cafekit-chore-remove-usage-hook`, branch `chore/hook-cleanup` from `chore/remove-usage-hook` (c11904f); commands run from `packages/spec/` unless stated.

## Scope decision (GATE-SCOPE — 2026-10-06)
- Existing: `spec-state.cjs` resolves the one active packet in the project and prints its tollgate on every UserPromptSubmit — a full block when the state key changes, a one-line "Tollgate active" otherwise (`src/claude/hooks/spec-state.cjs:166-237`); it already reads the payload session (`:33-38`) and an explicit `featureName` target (`:90`), and has a per-hook state dir (`lib/hook-state-dir.cjs`). `docs-sync.cjs` runs on every Claude SessionStart (`src/claude/settings/settings.json:19`) and the `docs` skill names that SessionStart signal as a trigger (`skills/docs/SKILL.md:128,141`, `references/update-workflow.md:27`, `references/init-workflow.md:113`); it reads stdin but accepts an empty one (`docs-sync.cjs:21-24`). `state.cjs` prints `latest.md` whenever it exists and is fresh (`state.cjs:51-70,234-241`). Codex ships its own copies of all three (`src/codex/hooks/`); omp runs the Claude files through its bridge (`src/omp/extensions/cafekit-bridge.mjs:41,44,46`). Hooks know their runtime folder through `runtimeDirName()` (`lib/runtime-dir.cjs:32-38`).
- Minimum change, Claude only: `spec-state` reports only packets this session touched; `docs-sync` leaves Claude's SessionStart and the `docs` skill runs it on demand; `state` prints its SessionStart block only when it holds something beyond placeholders.
- Expansion signals: about 12 files; one subsystem.
- User decision: KEEP. "Touched" = the session's prompt contains `specs/<packet>`, a `/cf:<command> <packet>` token, or the bare packet slug when it contains `-`, `_` or a digit (a plain one-word slug such as `docs` or `auth` must appear as `specs/<slug>`); or the payload names it as `featureName`; or the session Edit/Write/MultiEdits a file whose real path is inside the real path of `specs/<packet>/`. Claude only: the filter runs only from `.claude/hooks` and only when the raw payload carries a snake_case `session_id` (grok, which also runs `.claude/hooks`, sends `sessionId` and keeps today's behaviour); omp and Codex code is not touched — omp's parity test gets a named divergence list instead.

## Out of scope
- Codex hooks (`src/codex/hooks/*`, `src/codex/hooks.json`), the omp bridge lists, and grok (unchanged because it sends `sessionId`).
- Read as a touch signal (adds a hook on every Read); edits made only through Bash (not seen unless the prompt names the packet).
- `spec-gate` latency; the "Multiple active specs" and other warning lines of `spec-state` (they still print for every session).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Touch set per session in the hook state dir, keyed by a hash of the session id; filter applies only when `runtimeDirName()` is `.claude` and a session id exists | Global "owner" field in the packet; filtering on omp too | No packet schema change; the user scoped this to Claude; without a session id the old behaviour is the safe default | omp and Codex keep calling the same file under `.omp`/`.codex` | A Claude session sees no tollgate for a packet it is working on → widen the touch signals, never drop the filter |
| D-02 | `spec-state.cjs` also handles PostToolUse `Edit\|Write\|MultiEdit`: right after reading the payload it records the touch and exits 0 with no output, before resolving, running git, or touching `tollgate-last.txt`; prompt touches are recorded before resolution (`spec-state.cjs:87`) so a `multiple_active`/`invalid_specs` exit still remembers them; the filter sits before the cache read/write (`:189`) | A separate recorder hook; filtering after the cache | One owner for the touch set; a filtered session must not overwrite the project's single cache slot | PostToolUse payload carries `tool_input.file_path` (`lib/hook-payload.cjs:150-155`) | Touch not recorded, or the next prompt shows only the one-line form → inspect the order of the branches |
| D-03 | Keep `docs-sync.cjs` shipped; drop only its Claude SessionStart registration, pruned on upgrade by `.claude/hooks/docs-sync.cjs`; the `docs` skill runs `echo '{}' \| node .claude/hooks/docs-sync.cjs` itself | Delete the hook; `< /dev/null` | The drift check stays on demand and omp/Codex still use it; the skill text is projected to Codex as `.codex/hooks/docs-sync.cjs`, whose `readPayload` crashes silently on empty stdin (`src/codex/hooks/lib/hook-context.cjs:21-23`) | Both copies print with `{}` on stdin | Empty output on a stale project → fix the skill command |
| D-04 | `state.cjs` prints the SessionStart block only when, after dropping headings, placeholder lines (`(No completed tasks recorded)`, `(All tasks completed)`, `(No file changes detected)`) and timestamp-only `## Agent Result` blocks, any line remains; Claude runtime only | Stop printing entirely | Real prior context (todos, modified files) still helps a resumed session | Those three placeholders and the `- Completed at` line are the only filler `state.cjs` writes | A filler line not covered shows up → add it to the filter |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | On Claude, the tollgate shows only for packets the session touched; omp, Codex, grok and session-less payloads unchanged; omp's parity test names the two deliberate divergences | modify | `spec-state.cjs`, Claude `settings.json`, `omp-bridge.test.js` | none | elevated — every prompt's injected context | source + installed |
| CP-02 | Claude SessionStart runs no `docs-sync`; upgrade prunes it; the `docs` skill tells the model to run it on demand | modify, migrate | `settings.json`, manifest obsolete substrings, `docs` skill text | none | elevated — upgrade path | source + installed |
| CP-03 | Claude SessionStart prints no placeholder-only prior context | modify | `state.cjs` | none | routine | source |
| CP-04 | Changelogs record the change and its Claude-only scope | add | two changelogs | none | routine | source |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | While running from `.claude/hooks` with a session id, when the resolved packet is not in the session's touch set, `spec-state` shall print nothing; when the prompt names it, the payload `featureName` names it, or the session edited a file under it, `spec-state` shall print as before. | task-01 Command |
| AC-02 | While running from `.omp/hooks`, or when the raw payload has no snake_case `session_id` (no id, or grok's `sessionId`), `spec-state` shall print as before regardless of touches; a PostToolUse touch shall print nothing and leave `tollgate-last.txt` unchanged; omp's parity test shall pass with a named divergence list of exactly `PostToolUse: spec-state.cjs` (Claude only) and `SessionStart: docs-sync.cjs` (omp only). | task-01 Command |
| AC-03 | A fresh Claude install shall register no SessionStart `docs-sync`; an upgrade shall remove an existing `.claude/hooks/docs-sync.cjs` SessionStart entry and keep the hook file; the `docs` skill shall instruct running `echo '{}' | node .claude/hooks/docs-sync.cjs`, and that command shall print the drift signal on a stale fixture for both the Claude and the Codex copy. | task-02 Command |
| AC-04 | When `latest.md` holds only headings, placeholders and timestamp-only agent results, Claude SessionStart `state.cjs` shall print nothing; when it holds a completed todo, it shall print the block. | task-03 Command |
| AC-05 | Each changelog's `[Unreleased]` block shall contain a bullet naming `` `spec-state.cjs` ``, `` `docs-sync.cjs` `` and a standalone `` `state.cjs` `` and saying Claude only (`Claude only` / `chỉ Claude`). | task-04 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | `spec-state` reports only touched packets on Claude | P1 | AC-01, AC-02 | `src/claude/hooks/spec-state.cjs`, `src/claude/settings/settings.json`, `src/claude/hooks/__tests__/spec-state-touched.test.js`, `bin/__tests__/omp-bridge.test.js` | - | done |
| 02 | `docs-sync` off Claude SessionStart, on demand from the `docs` skill | P1 | AC-03 | `src/claude/migration-manifest.json`, `src/claude/skills/docs/SKILL.md`, `src/claude/skills/docs/references/update-workflow.md`, `src/claude/skills/docs/references/init-workflow.md`, `bin/__tests__/docs-sync-on-demand.test.js` | task-01-spec-state-touched.md | done |
| 03 | `state` stays silent when it has nothing to say | P2 | AC-04 | `src/claude/hooks/state.cjs`, `src/claude/hooks/__tests__/state.test.js` | task-02-docs-sync-on-demand.md | done |
| 04 | Changelogs | P3 | AC-05 | `CHANGELOG.md`, `../../docs/project-changelog.md` | task-03-state-quiet.md | done |

Tasks 01 and 02 both edit `settings.json` and `omp-bridge.test.js` (02 adds the `docs-sync` divergence) — sequential, one writer at a time.

## Review log
- Round 1 (2026-10-06, one fresh-context reviewer — Fact Checker + Contract Verifier + Failure modes, with reproductions; the second slot scouted packet 3): 10 findings. User: F1 "không cần sửa với omp" → keep omp code, give `omp-bridge.test.js` a named divergence list; F10 "chưa cần cho grok" → filter only on a snake_case `session_id`; F2–F9 accepted (PostToolUse exits before resolve/cache; Codex-safe `echo '{}' |` command; realpath containment; filter before cache; record prompt touches before resolve; strict changelog grep with mktemp; three skill files not four; slug rule). Note: `state.cjs` "Key Files Modified" comes from `git diff`, so the task-03 filter mainly hides the placeholder-only case.

## Completion (GATE-DONE — 2026-10-06)
- User decision: done, commit on the branch ("Xong, commit trên nhánh"), after the four Receipts and the full package run (`[skill-test] PASS: 1622 tests executed`) were shown.
- Accepted limitations as presented: omp, Codex and grok unchanged; edits made only through Bash do not touch a packet unless the prompt names it; `state.cjs` still prints when `git diff` lists modified files; task-02 needed one repair round (self-test allowlist for the on-demand `docs-sync.cjs`).
