# Changelog

All notable changes to @haposoft/cafekit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **`cf:specs` is described by the request that should open it.** Measured with the new `evals/` suite (`claude plugin eval`, with and without the skill, three runs each): with the skill loaded and visible, sonnet did not invoke it in 3 of 3 runs and opus in 1 of 1 when asked to add Google login "right now" — both went straight to implementation, and opus settled architecture decisions on the user's behalf, the outcome the C1 gate exists to prevent. The description now opens with what a user says (add, build, implement, or change a capability), gives examples, states that being in a hurry is not a reason to skip a one-turn scope question, and says it never writes code; the skip clause is kept verbatim. After: the skill is invoked in 10 of 12 positive runs across both models (0 of 4 before), stops at C1 in 7 of 12 by the judge (0 of 7 before), and never fires on 24 negative runs. Measured limit: opus still judges "export customers to CSV" routine and skips the skill in 2 of 3 runs; sonnet does not.

### Fixed

- **A hand-typed provenance pair was told to add lines it already had.** The completion gate now says the `Base:`/`Head:` lines are present but are not the pair this runtime derives, and names the expected shapes, so the fix is to re-derive.

## [0.16.7] - 2026-09-16

### Fixed

- **A Receipt whose fields were written as list items failed four checks at once**: every other section of a task file writes its fields that way — the Verification Plan's own `- Command:` sits a few lines above the Receipt — so continuing that house style inside the Receipt was the natural mistake, and the only section that forbade it was the Receipt. The field matchers now accept an optional leading `-`, `*`, or `+`. The receipt body is cut to its own `## Receipt` section, so this cannot pick up the Verification Plan's fields.

- **Every receipt failure was answered with the same sentence**: "write a runtime-bound `## Receipt`" is the wrong instruction whenever the Receipt is present and one field simply could not be read, which is exactly what the case above produced. The block now names what to change — a missing `Verification: PASS` line, a `Command:` that does not match the Verification Plan, a non-zero exit, an empty output fence, absent `Base:`/`Head:` — on both runtimes, from one shared mapping.

## [0.16.6] - 2026-09-16

### Fixed

- **Committing `specs/` was an unstated requirement, and impossible for a project that gitignores it**: an uncommitted task file was kept bound to live `Base`/`Head`, so such a project had every receipt fail permanently after its first source edit. Reported from a project blocked on its first message of a session with nothing changed, still blocked after 0.16.5.

  A receipt is now bound to live `Base`/`Head` only while its own task file has a copy in `HEAD` that its current bytes no longer match. Committed-and-unchanged and never-committed both validate on structure alone: the first still matches its baseline, the second has none to drift from. Editing a committed task file is still caught. Every structural check — status, `Verification: PASS`, `Exit: 0`, a command matching the Verification Plan, non-empty output, no placeholders — runs in all cases, so an uncommitted packet is still checked, just not against `Base`/`Head`.

  This continues 0.16.5, which removed the whole-tree condition for the same reason: each check fired on every valid receipt and so carried no signal. Four more cases that pinned the old contract were rewritten with that reasoning rather than relaxed — `32`, `38`, `39` in `spec-gate.test.js` and the Codex receipt-state case — and `50. an uncommitted task file is still checked, only not against Base and Head` was added to prove the structural checks did not go with it.

## [0.16.5] - 2026-09-16

### Fixed

- **One uncommitted file blocked every turn, in any project holding finished Specs packets**: `receiptBindingMode` reopened *every* done receipt in the repository whenever anything outside the specs root was uncommitted, and a reopened receipt is compared against live `Base`/`Head`. `Base` is the last commit touching anything outside the specs root, so a receipt written before any later commit records an older `Base` **by construction** — measured at 52 of 52 done receipts on this repository. The condition therefore failed all of them at once, every time, and could not tell a tampered receipt from an untouched one. Reported from a project where the user was blocked on their first message of a session, having changed nothing.

  This reverses the C1 decision recorded in `specs/receipt-freshness-policy/plan.md`, which kept the whole-tree condition. The measurement above is the new evidence: a check that fires on 100% of valid data carries no signal. Two cases that pinned the old contract were updated with that reasoning rather than relaxed — `47. completed-set branch accepts committed receipts and blocks an edited one` in `spec-gate.test.js`, and step 4 of the Codex receipt-mode case in `codex-hooks.test.js`.

## [0.16.4] - 2026-09-15

### Fixed

- **Both Stop hooks blocked every turn in a project with several Specs packets, and the completion gate never checked a single receipt** ([#79](https://github.com/haposoft/cafekit/issues/79)): each hook decided "which feature is this turn about?" by raw candidate count, so a repository that had simply accumulated finished features was permanently ambiguous, and the only advice offered — provide an explicit feature target — named something nothing in the product wrote. The more serious half is that identity is decided first: with several packets, a genuinely missing verification receipt was answered with `multiple active specs detected` instead, so the gate's receipt revalidation never ran at all. Reproduced both halves before fixing, and measured after: the same project now reports the receipt violation, against the named feature.

  Each hook now narrows by the question it actually asks. The Stop gate resolves the packet that still has unfinished work, whatever layout it uses, so a repository of legacy `spec.json` packets narrows exactly the way a process-first one already did; the bulk-audit branch keeps its own process-first guard, because it exits before the semantic-digest, `FLASH_UNVERIFIED`, feature-receipt, and completion-policy layers. Closeout approval counts only packets actually claiming closeout. **A project with exactly one packet resolves it whatever its status, unchanged** — that also holds for a lone packet still mid-execution, which the closeout rule alone would have dropped. Codex reaches the same answers through the shared resolver instead of its own candidate count.

  When more than one packet is genuinely in play, `specs/_shared/active-feature.json` (`{"featureName": "..."}`) names the one being worked on, and both Stop hooks on both runtimes resolve it. A target supplied by the host always wins, so the file can never redirect a hook that already knows its feature; an absent, blank, malformed, or symlinked file is ignored rather than turned into an error that blocks. Both approval prompts now name the feature being approved. **Two packets genuinely claiming closeout still block until the file names one.**

  Receipts in packets the gate did not resolve are still not revalidated, and that is a known gap rather than a design choice: `receiptBindingMode` rebinds every receipt in the repository whenever the tree outside the specs root is dirty, so auditing historical packets produces a `provenance` failure for each of them the moment one unrelated file is uncommitted. Measured at scale on this repository during development: seventeen finished packets carrying fifty done tasks with valid committed receipts all failed `provenance` at once because two unrelated source files were uncommitted, and all fifty passed again after a commit. Changing what receipt binding means is left to its own packet.

- **Legacy `task_registry` entries written as `completed` were read as unfinished** ([#79](https://github.com/haposoft/cafekit/issues/79)): narrowing accepted only `done`, so a repository upgraded from an older release kept every historical packet competing and the block above survived the fix meant to clear it. Measured on the reported shape — seventeen historical packets plus one active — `completed` still produced eighteen candidates while `done` resolved. `normalizeLegacyWorkflowCandidate` now reads `done`, `completed`, and `complete`, matching how `spec-final-state.cjs` already reads spec status. Process-first packets keep the strict `pending`/`in_progress`/`paused`/`blocked`/`done` set, so a `completed` task there stays malformed rather than silently finished.

## [0.16.3] - 2026-09-14

### Fixed

- **Codex hooks exited 127 when the host was launched from the macOS GUI** (2026-09-14): the launcher ran `node` by name, and `node` is resolved through PATH. A host started from the Finder or from an app such as Orca hands its children the minimal `/usr/bin:/bin:/usr/sbin:/sbin`, which holds no Homebrew, nvm, fnm, or Volta install, so the shell answered `command not found` and the hook never started — exit 127, distinct from the exit 1 that 0.16.2 fixed. Each launcher now carries a PATH floor: the directory of the Node.js that ran the install, then `/usr/local/bin` and `/opt/homebrew/bin`. The floor is appended rather than prepended, so a version manager's current Node still wins in a normal terminal and these are consulted only when PATH offers no Node at all; a directory that does not exist costs nothing. A reinstall rebinds launchers written by 0.16.2 as well as the pre-0.16.2 Git form, since the merge would otherwise treat them as the user's placement and keep them forever. A hook the user wrote is never rewritten, even when it uses the same shape.

  Claude Code carries the same pattern in `.claude/settings.json` and is **not** fixed here. Its merge keys on the whole command string rather than on the script name, so changing the format would append a second copy of every hook in existing projects instead of replacing them. It has not been observed failing, because Claude Code is normally started from a terminal that already has Node on PATH.

## [0.16.2] - 2026-09-14

### Added

- **Orca (onorca.dev) runtime awareness** (2026-09-13): a `cf:orca` skill now ships with the install itself, instead of living in a per-machine setup a user tried and then removed because it followed the machine rather than the project. The skill detects `ORCA_PANE_KEY`, routes phrases such as "pane Orca" or "spawn codex vào worktree" to Orca's own `orca skills get orca-cli`/`orchestration` guides read live rather than vendored (the guide's wording changes between CLI versions), and defaults any `terminal send`, `terminal close`, or worker stop to the current `ORCA_WORKTREE_ID` — its core safety property — asking the user first, naming the pane, before reaching outside it. `session.cjs` for Claude Code and Codex ends its SessionStart line with `Orca: pane` when the variable is set and never prints `ORCA_AGENT_HOOK_TOKEN` or `ORCA_AGENT_LAUNCH_TOKEN`, the two credentials Orca sets in the same environment. omp receives the skill only beside a Claude or Codex install in the same project and no session line, since its bridge discards `session_start` stdout; Grok receives the skill through its Claude-compatibility layer but likewise no session line, since Grok never feeds that hook's stdout to the model.

### Fixed

- **Codex hooks never ran outside a Git repository, or in a project nested inside one** (2026-09-14): every launcher in `.codex/hooks.json` resolved its own root with `$(git rev-parse --show-toplevel)`. Outside a repository that command prints nothing, so the launcher became `node "/.codex/hooks/<script>.cjs"`; for a project inside a larger repository it returned the *outer* root, so the launcher pointed at another directory's `.codex`. Both cases pointed at a path that does not exist, so Codex started every hook, every hook died, and the privacy, secret-output, scaffold, and completion gates were silently absent while the install looked healthy. The installed path is known at install time and is now written into the command directly, single-quoted so a project path may contain `$`, a backtick, or a space. A reinstall also repairs launchers an older installer wrote, because the merge treats an already-registered script as the user's placement and would otherwise keep the broken command forever; only the exact byte pattern CafeKit itself emitted is rewritten, and a hook the user added is left alone. Windows launchers already carried the absolute path and are unchanged. Claude Code was never affected: it uses `$CLAUDE_PROJECT_DIR`, which the host sets. Renaming or moving the project directory now requires a reinstall for the same reason Windows always has, which a reinstall reports and repairs.

## [0.16.1] - 2026-09-09

### Added

- **Oh My Pi (omp) platform** (2026-09-08): `--platform omp` installs CafeKit's enforcement chain for the Oh My Pi coding agent. omp already discovers `.claude/skills` and `.agents/skills`, so no skill payload is copied; the installer provisions `.omp/hooks/` — the Claude gate scripts with a one-file overlay that denies where the privacy hook would ask and denies what it cannot evaluate, omp's lowercase tool names being handled by the shared payload reader — `.omp/runtime.json` with its schema, and `.omp/extensions/cafekit-bridge.mjs`, which omp auto-loads to dispatch its lifecycle events onto those scripts with an 8000 ms budget below omp's own 30000 ms cut-off. Every hook registered for SessionStart, PreCompact, UserPromptSubmit, PreToolUse, PostToolUse, and Stop is carried; `agent.cjs` and `semantic-review-authority.cjs` are not, because omp has no subagent events. `.omp/` joins the generated ignore rules because omp executes everything under `.omp/extensions/`.

### Changed

- **Portable gate hooks** (2026-09-08): the hooks under `src/claude/hooks/` derive their runtime directory from their own location through `lib/runtime-dir.cjs` instead of a literal `.claude`, so the same files run unchanged under `.omp/` and read `.omp/runtime.json`, `.omp/scripts/`, and `.omp/rules/`. Advice printed to the model names the directory the hook lives in, and skill paths still come from the platform registry because omp reads `.agents/skills`. Under `.claude/` every path and string is byte-identical to before. Thirteen `~/.claude/` reads of Claude Code's own files stay as Claude Code behaviour, and the unimported `lib/context.cjs` and `lib/detect.cjs` are left in place. The omp hook fork shrank to an overlay of the files that genuinely differ; the installer writes the Claude set from the migration manifest and the overlay over it, so a Claude hook fix reaches omp in the same run. An omp-only project now ships `.omp/runtime.json` (`codingLevel: 1`, `usage.enabled: false`, no statusline keys) beside the schema, so its rules hook injects rules instead of exiting silently, and provenance ignores `.omp/` runtime state like its `.claude/` and `.codex/` counterparts.

### Fixed

- **Gates were silently open under Grok CLI** (2026-09-08): grok loads `.claude/settings.json` hooks through its Claude-compatibility layer, on by default, but sends a camelCase envelope with its own tool names. Every gate read an undefined `tool_name`, so `privacy-block.cjs` extracted no paths and never asked, the Stop gate lost its loop guard, the approval hook ran its stop path on every user prompt, and the two exit-2 denials reached the model with no reason at all. A shared `hooks/lib/hook-payload.cjs` now normalizes any supported envelope inside each hook, denials carry a JSON reason grok honours regardless of exit code, and `--platform grok` installs the Claude runtime with a one-line reminder that project hooks stay inert until `grok --trust`. What grok cannot carry is documented rather than papered over: it has four control-flow channels, so the context-injecting hooks are normalized for one code path but never reach the model, and `usage.cjs` is left unrouted because it reads Claude Code credentials.

### Removed

- **rtk token-saver install phase**: the installer no longer offers or installs the rtk binary and its Claude Code hook. The `--with-rtk` flag is gone, along with the interactive prompt, the phase, and its localized strings. Unknown flags are ignored, so an old script still passing `--with-rtk` keeps working; anyone who wants rtk installs it themselves. Projects where a previous CafeKit run registered the rtk hook keep it — the installer never owned that hook's removal.

## [0.16.0] - 2026-09-04

### Breaking

- **Public skill prefix renamed to `cf`**: skills are invoked as `cf:<name>` in Claude Code and `cf-<name>` in Codex CLI. The `hapo` prefix is gone with no alias.
- **Repair skill renamed to `fix`**: `hapo:hotfix` became `cf:fix` (`cf-fix` on Codex). No old-command alias. The `hotfix` payload directory name is unchanged so upgrades stay clean.

### Changed

- **Secret output guardrail** (2026-09-04): a new UserPromptSubmit hook on both runtimes injects a reminder when the prompt is about credential handling. The privacy hook already gates whether a sensitive file may be read, but nothing gated what happened after that approval, so an approved read could still put a raw key into the transcript — where it is written to disk, survives compaction, and is replayed to the model on every later turn. The reminder separates permission to read from permission to print. It reads the prompt and echoes neither the prompt nor any matched value, so the guardrail cannot itself become the leak, and it fails open on malformed input.
- **Coding levels on both runtimes, junior by default** (2026-09-04): a fresh Claude install seeds `outputStyle` with the junior level, and Codex gets the same six styles through a new `codingLevel` key in `runtime.json`. Codex CLI has no output-style feature, so its rules hook reads the matching file and injects it under `## Communication style`; that hook reserves one injection per session, so the cost matches a host-loaded style rather than repeating each turn. Frontmatter is stripped before injection, an absent or out-of-range level injects nothing, and the seeded `outputStyle` is never replaced once the user has chosen one — not even under `--force-overwrite`, which repairs managed files rather than resetting taste.
- **Coding-level output styles** (2026-09-03): six output styles ported from AgentKit install into `.claude/output-styles/`, letting the reader pick how much explanation an answer carries — from ELI5 through to a terse expert mode. Each keeps the base coding instructions, so a style changes how answers are written and never what the agent is allowed to do. Claude Code only: Codex CLI has no output-style surface, and a Codex install ships none.
- **Public skill prefix renamed to `cf`** (2026-09-03): every skill is now invoked as `cf:<name>` in Claude Code and `cf-<name>` in Codex CLI, replacing the `hapo` prefix. This is a breaking public invocation rename with no old-prefix alias, matching how the repair skill was renamed earlier; skill payload directories keep their existing names so upgrades stay clean. Past changelog entries, specification packets, and plans keep the prefix they were written with, because they record what happened at the time.
- **Self-documenting runtime configuration** (2026-09-03): `runtime.json` now ships a `$schema` reference and a `runtime.schema.json` installed beside it on both platforms, so an editor offers completion and inline documentation for every setting. Each key carries a description derived from the code that reads it, `spec.completion_gate` is documented as a block rather than a switch, and the two keys nothing honours — the `hooks` toggle map and `develop` — are marked deprecated instead of implying they work. Tests fail if a shipped key is undescribed, a described statusline mode or layout section does not exist in the renderer, or either runtime stops pointing at the schema.
- **Codex hooks.json entry ownership** (2026-09-03): `.codex/hooks.json` is merged per hook script instead of copied verbatim, matching how `.claude/settings.json` has always been handled. A user-added hook no longer turns the whole file into a user-modified artifact, so a reinstall stops preserving retired CafeKit hooks and `--force-overwrite` no longer erases the user's. Matching on the script basename rather than the full command keeps a hook the user moved to another matcher from being registered twice. A malformed `hooks.json` is reported and left untouched rather than overwritten, and the file now stays outside the ownership manifest.
- **Strategist counsel agent** (2026-09-03): a new advisory-only `strategist` agent pinned to the strongest model returns full counsel in a single reply, with no interview and no session model switch. A host without that tier substitutes the newest Opus it does allow. The subagent coordination rule points repeated failures and high-stakes design forks at it, and states that counsel is not execution proof: it cannot close a task, satisfy a Verification Plan, or stand in for a Receipt.
- **Compaction state anchors** (2026-09-03): a PreCompact hook records the branch, HEAD, dirty-file count, and in-flight task state before the context is compacted, and the next session start reads them back beside the existing authorization warning. Only facts the runtime can re-derive are recorded; nothing captured is proof of work or an authorization, and the hook fails open, recording unavailable facts as null rather than guessing.
- **Statusline configurable layout** (2026-09-02): an optional `statuslineLayout` value shaped as one list of lines, each naming ordered section ids, selects and orders the `model`, `context`, `quota`, `directory`, `git`, `plan`, `cost`, and `changes` sections; render modes only slice the line count and unknown ids are ignored. The quota area shows the five-hour and weekly windows with reset countdowns while the usage cache is fresh, and cost is layout-gated and disabled by default. With the key absent and no fresh cache or cost data, rendered output is byte-identical to the previous implementation.
- **Review precedence and process hygiene rules** (2026-09-02): new `review-audit-self-decision.md` and `process-management.md` rules cover when an audit may reverse a verified or user decision, and how long-running processes are tracked, reused, and stopped. Claude auto-loads project rules and Codex does not, so the Codex instruction template carries an explicit pointer to them.
- **Shared verdict surface** (2026-09-01): the code-auditor and deployer agents report the same `PASS`, `PASS_WITH_WARNINGS`, `FAIL`, `BLOCKED` verdicts as the rest of the review chain.
- **Adaptive Docs workflow** (2026-09-01): documentation work runs through a Post-Task Docs Checkpoint that accepts a `none`, `minor`, or `major` handoff from Develop and Sync, with an escape path so a `major` checkpoint without a docs root cannot silently initialize one. A Delegation Gate governs reader splitting at four sites.
- **Native skill routing and optional document bundle** (2026-09-01): skill selection uses the runtime's own semantic matching against a generated live catalog instead of a prompt-scoring hook, and the routing rules state that selection is not deterministic. Fresh installs ship the core skills and offer `docs`, `docx`, `pdf`, `pptx`, `xlsx`, and `ai-multimodal` as one opt-in bundle through the interactive installer or `--with-document-skills`; `--without-document-skills` removes only pristine CafeKit-owned copies.
- Added adaptive `hapo:research` / `hapo-research` evidence contracts and an explicit-only `hapo:loop` / `hapo-loop` bounded numeric optimization workflow. Loop uses detached-worktree experiments, fail-closed Metric/Guard and cleanup rules, and returns only a base-bound patch handoff; live-agent adherence remains unproven.
- **Skill-agent-hook relationship integrity** (2026-08-31): implementer, scout, code-auditor, docs-keeper, and deployer follow the process-first `plan.md` plus flat task and inline Receipt contract, with the legacy adapter isolated. Public documentation uses `ask`, `scout`, and `fix`, and names Claude Code and Codex CLI as the current targets.
- Renamed the public repair skill to `hapo:fix` for Claude and `hapo-fix` for Codex. This is a breaking public invocation rename with no old-command alias; the physical `hotfix` payload directory remains only for installer ownership and clean upgrades.
- Added proportional repair framing, evidence-gated Incident/deep research-brainstorm-plan routing, and progressively disclosed CI/test/type/UI/log proof overlays without adding ceremony to deterministic Quick/local fixes.
- Added semantic mutation and packed-install parity coverage for the public rename, bounded repair frame, deep decision route, specialized proof overlays, and scout-before-diagnosis ordering.
- **Adaptive-depth Debug workflow** (2026-08-29): routine failures stay lightweight while production, multi-component, intermittent, data/security, environment, and concurrency incidents escalate into correlated timelines, explicit hypothesis elimination, and recurrence-prevention handoff. Debug remains diagnostic-only.
- **Public Ask and Scout skills** (2026-08-28): renamed the question-answering surface to `hapo:ask` and the discovery surface to `hapo:scout`, keeping the internal `question` and `inspect` payload paths for compatible upgrades. Scout uses a focused local fast path and delegates only when permission, runtime support, and independent scopes are all present.
- **Adaptive deep design for Brainstorm** (2026-08-28): Brainstorm reaches a bounded decision contract and pressure-tests a material architecture choice only when the decision is still open.
- **Plan-native Test proof handoff** (2026-08-27): Test executes the smallest adequate real proof and returns one canonical handoff without writing task state.
- **Plan-native Develop execution** (2026-08-26): Develop selects the first dependency-ready task in plan order and continues sequentially until a real blocker or the completion gate.
- **Proportional Brainstorm routing** (2026-08-25): Brainstorm scales its own depth to the decision instead of running one fixed ceremony.

### Fixed

- **Hook state written into the source tree** (2026-09-02): Claude and Codex hooks resolve their own state directory, so a run from `packages/spec/src` writes crash logs and gate caches to a temp directory instead of the source tree. An untracked `.logs/` under `src/` changed the worktree digest that receipt provenance binds to and made the completion gate report every done task as stale. One shared helper per runtime replaces fourteen copies of the old path expression, and a final self-test fails when any suite leaves hook state under `src/`.

## [0.16.0-rc.8] - 2026-08-25

### Changed

- **Specs implementation readiness**: process-first packets now declare an explicit queue-ready contract, keep unversioned packets in compatibility mode, and require adversarial review findings, exact task dependencies, and canonical inline proof before implementation handoff.
- **Installed runtime parity**: Claude and Codex state hooks share receipt-aware dependency eligibility, proof-sensitive cache identities, and the same migration guidance for older flat packets.

### Fixed

- **Dependency resolution**: unique legacy `Task NN` references remain readable, while ambiguous references, missing dependencies, duplicate edges, self-dependencies, and multi-task cycles fail closed.
- **Receipt proof boundaries**: fenced examples cannot become task status, dependencies, contract markers, or canonical Receipt fields. Command output requires a non-empty, correctly closed Markdown fence; explicit failure and nonzero-exit evidence inside output still blocks completion.
- **Specs dogfood artifacts**: refreshed the timing benchmark packet under the stricter readiness contract and repaired archive successor citations without inventing execution proof.

### Validation

- `npm test` executes 753 tests: 752 pass, 0 fail, and 1 expected opt-in live Codex host skip.
- Focused Claude completion-gate tests pass 48/48; focused Codex hook tests pass 36/36.

## [0.16.0-rc.7] - 2026-08-20

### Removed

- **OpenCode support**: removed the OpenCode install path, the `src/opencode` plugin runtime, the `@opencode-ai/plugin` dependency, and OpenCode-specific installer branches, tests, and docs. The last release supporting OpenCode is 0.16.x. Historical changelog entries below are kept as-is; a legacy `.opencode/` folder on user machines is left untouched (still gitignored).

### Changed

- **Specs process-first v3**: new Specs work now produces a flat `specs/<feature>/plan.md` plus `task-NN-<slug>.md` packet, with C1/C2/C3 human decisions and inline canonical Receipts. Existing `spec.json`, nested task, and separate-receipt packets remain available only through the legacy compatibility adapter.
- **Develop and Sync handoff**: implementation consumes one unblocked flat task at a time, while status and proof synchronization update the task's single `Status:` field and final inline `## Receipt` without inventing execution evidence.
- **Runtime ownership boundary**: Claude Code and Codex CLI consume the shared CORE plus only their native managed block; the Codex template is installed verbatim so its foreign-runtime ignore clause retains the correct actor.

### Fixed

- **Process-v3 Stop proof binding**: Claude and Codex require each inline Receipt command to match the task's exact Verification Plan command. Completed history no longer masks the sole unfinished packet, and an all-completed packet set is revalidated without a permanent ambiguity lock.
- **Claude upgrade pruning**: the migration manifest removes all 15 retired Specs helper files from Claude installs. Fresh Codex installs are exact; Codex refresh still cannot prune obsolete skill paths and retains this documented limitation.

## [0.16.0-rc.2] - 2026-08-08

### Changed

- **Lane-aware security guidance**: security verification is proportional to the Direct, Standard, or Critical lane and is required only when a task touches logging/redaction or filesystem write boundaries.
- **Redaction invariants**: exact-boundary matching preserves safe identifiers and credential-free public URLs; quoted `Bearer`/`Basic` values retain surrounding quotes and delimiters; redaction markers are idempotent.
- **Filesystem write invariants**: guidance now requires lexical plus canonical containment, traversal/symlink rejection, same-directory atomic rename with cleanup, no outside-root mutation on rejection, and canonical `realpath` returns.

### Validation

- `npm test` passes 304 tests.
- Docs validation reports no broken relative links; release guidance remains under the 800-line documentation limit.

## [0.16.0-rc.1] - 2026-08-07

### Added

- **Addressing opt-in and reinstall preservation**: addressing remains user-configurable and is preserved across reinstall when no new choice is made.
- **Tier-aware `hapo:develop` gates**: Light, Standard, and Deep execution tiers now define who runs checks and the feature ship point.
- **Unified review verdicts**: review payloads use `PASS | FAIL | BLOCKED`; BLOCKED stops without blind retries.
- **Git staged-secret scanner**: added-lines-only parsing maps source lines and redacts secret values.

### Changed

- **Slim always-on instructions**: made `AGENTS.md` the shared instruction surface, reduced Claude/Codex/OpenCode templates to project gotchas plus runtime-specific guidance, and added `Commands`, `Do not touch`, and `Slow or expensive` scaffolding stubs.
- **Canonical instruction install**: root `AGENTS.md` stores one shared `src/common/AGENTS.md` core block for Claude, Codex, and OpenCode installs; each runtime keeps its own managed block and user content is preserved.
- **Runtime agent rename**: `god-developer` → `implementer`; existing users with modified or untracked old files keep them and receive a warning, while pristine managed files are pruned.
- **Flash state semantics**: `--flash` stores `implemented_unverified` as `status: "in_progress"` with `FLASH_UNVERIFIED`; `/hapo:test` must prove a task before it can become `done` or unblock dependents.
- **Review and installer safety**: malformed managed markers roll back transactionally, and locale overrides are opt-in or restored from saved runtime state.
- **Git skill guidance**: tracked secrets are stopped for rotation and user decision; untracked secrets receive `.gitignore` guidance instead of automatic index removal.
- **Trimmed dynamic reminders**: kept only configured language, plans/docs paths, and `docs.maxLoc` in prompt hooks; trimmed Claude subagent context to paths, language, and skill venv guidance.

### Fixed

- **Instruction hook safety**: Claude, Codex, and OpenCode rules hooks now inject nothing and exit 0 when their runtime configuration is missing, malformed, or unreadable. Claude subagent paths now prefer payload `cwd` over stale `PROJECT_ROOT`.
- **OpenCode instruction localization**: OpenCode managed instructions now receive `--lang` and addressing updates using OpenCode-specific markers.
- **Runtime gotchas**: Claude, Codex, and OpenCode installed instructions now document project-local skill paths, macOS/Linux and Windows Python venv commands, and the rule to edit project-local skills instead of global `~/.claude/skills`.
- **Combined instruction installs**: root `AGENTS.md` now stores shared core once with a dedicated marker; Codex and OpenCode blocks remain runtime-specific and idempotent across repeated installs.
- **Shipped-output self-tests**: installer fixtures now verify all three runtimes, missing-runtime silence, language localization, managed markers, evidence contracts, and combined-install idempotence.

## [0.15.2] - 2026-07-29

### Fixed
- **Codex hooks on native Windows**: every `commandWindows` now uses a `cmd.exe`-safe Node launcher bound at install time to the project's canonical `.codex/hooks` path. It needs neither Git nor POSIX `$()` substitution, works from nested session directories, and cannot be redirected to an untrusted nested hook tree. This removes the repeated `SessionStart`, `UserPromptSubmit`, and `PreToolUse` exit-code-1 failures before their hook scripts start.
- **Skill dependency setup on native Windows**: npm and npx `.cmd` launchers now run through `%ComSpec%` for skill-local installs plus Puppeteer/Playwright browser setup. Installer failures also include the actionable npm or spawn error code instead of referring to a log that was never written.
- **Node 18 installer compatibility**: pinned the last CommonJS-compatible `@clack/prompts` line so the installer matches its declared Node `>=18` runtime contract.

## [0.15.1] - 2026-07-29

### Changed
- **Release metadata**: bumped `@haposoft/cafekit` to `0.15.1` after validating the published `0.15.0` Claude Code and Codex CLI install surfaces. This version-only change does not alter installer or runtime behavior.

## [0.15.0] - 2026-07-29

### Added
- **Native Codex CLI runtime**: `--platform codex` installs Codex-native skills in `.agents/skills/`, auto-discovered custom agents in `.codex/agents/*.toml`, lifecycle hooks, rules, scripts, references, runtime metadata, and a managed CafeKit block in root `AGENTS.md`. Skills use `$hapo-*`/`/skills`; no `.codex/config.toml` or global trust mutation is required.
- **Codex lifecycle guardrails**: native `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, and `Stop` handlers port routing, spec/task enforcement, docs reminders, state recovery, inspect limits, and privacy protection.

### Changed
- Installer platform registry now supports Claude Code, Codex CLI, and OpenCode together. Codex uses split managed roots (`.codex/` + `.agents/`), root `AGENTS.md` block coexistence, platform-prioritized locale restore, symlink-safe backup/write paths, and source executable-bit preservation.
- Same-version installs now run a selective refresh instead of exiting or implicitly enabling force overwrite. User-modified files remain intact unless `--force-overwrite` is explicitly supplied.

### Fixed
- Codex privacy approval is one-time and atomically bound to the session, tool, and exact canonical sensitive-path set. Native `apply_patch` input variants and move destinations are covered without treating harmless prose that mentions `.env` as access.
- Codex session state, locks, resume context, and archives are isolated by a SHA-256 namespace per session. Malformed or duplicated CafeKit markers in `AGENTS.md` fail safely without consuming project-owned bytes.

### Validation
- Full package self-tests, clean-install/package checks, and real Codex CLI 0.145 smoke tests passed for native skill discovery, custom-agent delegation, lifecycle hooks, and sensitive-file blocking.

## [0.14.2] - 2026-07-29

### Added
- **Parallel Wave Mode for `hapo:develop`** (opt-in `--parallel [N]`): independent spec tasks run concurrently — waves computed from `task_registry.dependencies` with a single-writer-per-file rule (cap 3 default / 5 max), one implementation worker per task in an isolated git worktree, the unchanged Stage A+B quality gate running inside each worktree before merge, spike-verified `git cherry-pick` merge-back with explicit worktree cleanup, a post-merge integration check gating each wave, and orchestrator-only spec-state writes. Sequential default untouched; sequential fallback when isolation is unavailable; escape hatch `"develop": { "parallel": false }` in `.claude/runtime.json`. New operating procedure: `skills/develop/references/parallel-waves.md`.

### Fixed
- **Claude installer safety**: project-root `CLAUDE.md` is now managed as an idempotent marked block instead of a whole owned file, preserving project instructions during install and upgrade. Transaction snapshots record absent targets too, so failed fresh installs remove partial artifacts and reported phase errors trigger rollback.
- **Claude privacy hook contract**: sensitive direct and Bash access now returns Claude Code's native `permissionDecision: "ask"` response. Resolved symlink targets take precedence over exempt-looking aliases, and the inspect hook no longer duplicates `.env` policy.
- **Spec completion receipts**: new tasks use `Verification: PENDING`; completion requires `Verification: PASS` or a compatible successful legacy receipt, while explicit failures, non-zero exit codes, invalid timestamps, and fence-only evidence are rejected. Cache transitions now preserve reopened-task gating.
- **Session state changed files**: Stop snapshots merge tracked modifications with untracked, non-ignored files before applying the display cap.
- **Installer preserves configured locale on non-interactive upgrade**: `selectLanguage` returned before restoring the saved locale when run with `--yes`, so every upgrade reset `locale.responseLanguage` to `en` (reproduced on 0.14.0 and 0.14.1). Saved-locale restore now runs regardless of interactivity, plus a hardening guard in `patchRuntimeLocale` never downgrades a configured label when the run made no explicit language choice. Covered by a live installer regression fixture proven to fail on the unpatched code.
- **Statusline context bar on 1M-context models**: the autocompact reserve was a hard-coded 45000 tokens (22.5% of a 200k window); it is now proportional (`0.225 × context_window_size` from the payload), so 1M windows are no longer treated as 200k. 200k behavior unchanged.

### Changed
- **Slim-flow batch (audit §3.6)**: diet `hapo:specs` SKILL (~662→≤450 lines) by collapsing validator restatements to Step 8.5 pointers; slim `docs-sync` banners (cjs + OpenCode ts) to compact English (no ALL-CAPS/URGENT); routing rules reduced to ambiguous-cases-only tables; thin `inspect` internal-mode prose; canonicalize task evidence heading to `## Evidence` (legacy aliases still parse in hooks/validator only); contract markers MUST for BE/FE specs + validator WARN when ≥5 tasks lack `<!-- contract: -->` blocks.
- **`spec` toggles unified and documented**: `runtime.json` template now lists `spec.{scaffold_guard, completion_gate, tollgate}`; the Claude `spec-state.cjs` reminder honors `spec.tollgate: false` (same key the OpenCode plugin already used). Dead `skills.research.useGemini` key removed from the template and config defaults (the research skill uses native WebSearch). `paths.plans` documented.
- **`usage.cjs` marked experimental**: the OAuth usage endpoint is undocumented and may break without notice; header now states the degradation contract (`status:"unavailable"`, statusline hides the segment) and the disable switch.
- Legacy `Task`-tool prose modernized to the `Agent` tool in develop/test/hotfix skill text (deliberate backward-compat notes in `CLAUDE.md` and `subagent-patterns.md` kept). `inspector` and `debugger` agents now carry `memory: user` like `researcher`.

### Removed
- **Legacy `archive-command/` tree** (1,680 lines, 12 files): the pre-skill command-based spec workflow, superseded since the skills migration and never installed by the manifest. Vestigial `sourceSubdir` reference and its self-test assertion cleaned.

### Added
- **Self-test: settings/manifest hook consistency check** — every `hooks/*.cjs` registered in the settings template must exist in the payload and in `migration-manifest.json` `runtime.files`, and vice versa (schema-drift tripwire; 11 hooks verified).

## [0.14.1] - 2026-07-17

### Fixed
- **Restored `hapo:delegate` on the release line**: the skill shipped in 0.13.4 (published from its feature branch) but was absent from 0.14.0 (published from `dev` before the branch merged). 0.14.1 includes the delegate skill, its Codex/Grok references, routing entries, and the installer dual-layer gitignore hardening from the same branch (PR #68). No new functionality vs 0.13.4 + 0.14.0 combined.

## [0.14.0] - 2026-07-17

### Added
- **`spec-gate.cjs` (Stop completion gate)**: blocks turn end when *newly-done* tasks lack a verification receipt in their task markdown (`Status: done`, Evidence section with real proof — no `{{...}}` placeholders — plus non-empty `task_registry[].completed_at`). Loop-safe via `stop_hook_active`; first run (no cache) seeds history without blocking so legacy specs adopt cleanly. Escape hatch: `"spec": { "completion_gate": false }` in `.claude/runtime.json` (missing key keeps the gate ON). Registered first on the existing `Stop` hooks list (before `state.cjs`). Follow-up idea: a dedicated `TaskCompleted` event is not used here — its output contract is unverified on the target Claude Code version.
- **OpenCode `task-scaffold-guard.ts` plugin**: ports Claude `task-scaffold-guard.cjs` — hard-blocks `write` and `apply_patch` creating `specs/<feature>/tasks/task-*.md`, forcing generation via `spec-scaffold.cjs` then Edit-fill. Also gates `edit` on a **non-existent** task file: OpenCode's `edit` can create files (unlike Claude's Edit — smoke-verified on opencode 1.17.15), so edit-creation is blocked while stub-filling stays allowed. Safety valves: runtime escape hatch (functional but **not advertised in the block message** — a smoke test proved the model reads the advertised override and disables the guard itself), fail-open if the scaffold script is missing, actionable block message. Auto-discovered by the OpenCode installer.
- **OpenCode `spec-state.ts` plugin**: ports Claude `spec-state.cjs` tollgate via `chat.message` — injects state-sync reminder (fingerprint gate: one-line when unchanged, full URGENT block when phase/done-total changes). Injected parts are schema-complete (`id`/`sessionID`/`messageID`) — a bare `{type,text}` part crashes the whole user turn ("invalid user part before save"). Disable with `"spec": { "tollgate": false }` in `.opencode/runtime.json`. End-to-end verified on opencode 1.17.15 (tollgate text reaches the model).

### Removed
- **`generate-graph` and `impact-analysis` skills** (unused) plus the orphaned `scripts/browser-tool.cjs`. All routing rules, OpenCode command wrappers, manifest entries, and self-test expectations cleaned; "blast radius / side effects" intent now routes to `hapo:inspect`. Existing installs are cleaned automatically on upgrade via new `obsolete.runtimeFiles` entries.

### Fixed
- **Claude `task-scaffold-guard.cjs`**: block message no longer advertises the `runtime.json` override (same self-disarm vector proven in the OpenCode smoke test — the model flips the flag instead of scaffolding). The escape hatch remains functional for humans.
- **OpenCode compaction banner / AGENTS.md**: no longer instruct the unavailable Claude `AskUserQuestion` tool; map to OpenCode built-in `question` (and `TodoWrite` → `todowrite`, `Task` → agent/subtask flow).
- **specs SKILL**: `--validate` dispatch said "MUST NOT execute Steps 1-8" while jumping to Step 8 — corrected to 1-7.
- **ui-ux-designer agent**: `search.py` invocations used the dev-monorepo path; now use the installed `.claude/skills/` path via the skills venv.
- **Model IDs unified on the `gemma-4-31b-it` family** across ai-multimodal, frontend-design, and inspect (SKILL bodies, references, `.env.example`, script defaults). The release-era runtime configuration was the single source of truth; previously three sources disagreed.
- **Installer i18n**: unsupported `--lang` codes now fall back to English (previously Japanese).
- **Installer settings merge**: managed hooks merge per command keyed by matcher entry — a command added to an existing matcher is appended on upgrade (the old dedupe judged the whole entry duplicate by its first command). Malformed user `settings.json` no longer aborts the install; the merge is skipped with a warning.
- **`validate-docs.cjs`** exits 1 on broken relative links (previously always exit 0).
- **`validate-spec-output.cjs`** verifies every `<!-- contract:NAME -->` tagged block in a task, not just the first fenced block. Multi-contract tasks must tag each copy (untagged → error); tagged-but-undeclared blocks warn; single-contract legacy format unchanged. Covered by a new self-test fixture (138 tests total).
- **Document skills attribution**: `pdf`/`pptx`/`docx`/`xlsx` frontmatter `metadata.author` now credits `Anthropic, PBC — adapted by Haposoft` (the bundled `LICENSE.txt` files are Anthropic's; the field previously claimed haposoft).
- **OpenCode session plugin**: the compact-recovery banner instructed the Claude-only `AskUserQuestion` tool, which `AGENTS.md` declares unavailable in OpenCode — it now tells the agent to ask the user directly in chat.
- **frontend-design skill**: frontmatter pointed at a non-existent `LICENSE.txt`; corrected to `license: MIT` (no Anthropic-derived content found in the skill folder).

### Changed
- **`spec-state.cjs` tollgate reminder slimmed**: state-change path is now a compact English block (≤7 lines: feature, phase, task counts, next unblocked task, sync/validate rule, Stop-gate note). Removed the red ALL-CAPS / bilingual MANDATORY wall (`URGENT`, `BẮT BUỘC`, `CẤM`). One-line unchanged-fingerprint path is unchanged. Completion enforcement moved to `spec-gate.cjs` on Stop.
- Installer obsolete mechanism removes directories recursively and prunes ownership-manifest entries by prefix (`tracker.prunePrefix`), enabling skill-level cleanup on upgrade.

## [0.13.4] - 2026-07-15

### Added
- **`hapo:delegate` skill**: dispatch a scoped implementation task from Claude Code to an external agent CLI (**Codex** or **Grok**). Covers file-based task briefs, non-interactive dispatch, minimum permissions, background monitoring/resume, and **independent verification** of the returned work (agent claims are not evidence).
- Codex / Grok reference guides under `skills/delegate/references/` with verified CLI flags and pitfalls.
- Workflow routing: assign/offload intents map to `/hapo:delegate` in `skill-workflow-routing.md`.
- `migration-manifest.json`: `delegate` added to required skills so the installer ships it.

### Changed — Installer gitignore (runtime out of git by default)
- **Root `.gitignore`**: `ensureGitignore` now also adds `.claude/` and `.opencode/` so the local CafeKit payload is not committed. Reinstall with `npx @haposoft/cafekit` on each machine. Existing equivalent forms (`.claude` without trailing slash) are treated as already present.
- **In-folder `.claude/.gitignore` / `.opencode/.gitignore`**: expanded template (`src/claude/gitignore`) with layered ignores for secrets, skill venvs/`node_modules`, session state, hook/plugin logs, and update cache — defense in depth for force-adds and partial un-ignores.

### Docs
- Audit note: `docs/audit-cafekit-vs-claude-code-2026-07.md` (full package inventory vs Claude Code practices as of v0.13.2).
- Installer architecture + package README document the dual-layer gitignore policy.

## [0.13.3] - 2026-06-22

### Added
- **Validator placeholder gate (`validate-spec-output.cjs`)**: a task file that still carries an unfilled `{{...}}` scaffold placeholder now hard-fails (previously a prompt-only DoCT rule); a leftover `.../` path fragment warns. Fill-side complement to the scaffold-guard hook — it proves every scaffolded stub was actually completed, closing the "stub created but not filled" gap.

### Changed
- Self-tests realigned to the Specs-v2 `SKILL.md` wording (`validate guardrail`, `init-is-never-a-stop-point`): the invariants are unchanged, only the asserted phrasing.
- `skills/specs/SKILL.md` Step 7: dropped the misleading "scaffold cuts output tokens" claim — scaffold enforces process discipline, not a token cut.

## [0.13.2] - 2026-06-21

### Added — Enforce scaffold on task creation
- **`task-scaffold-guard.cjs` (PreToolUse hook)**: hard-blocks any `Write` whose path matches `specs/<feature>/tasks/task-*.md`, so task files can only be created via `spec-scaffold.cjs` and then `Edit`-filled. Closes the dodge where the model hand-`Write`s task files and bypasses the (previously opt-in) scaffold step. Narrow scope: only the `Write` tool on a task-file path is blocked; `Edit`/`MultiEdit` and `Write` to any other file are untouched, and the scaffold script (writing via Node fs through Bash) is never blocked.
- **Three safety valves**: fail-open when `spec-scaffold.cjs` is absent (a hook shipped without its script must not deadlock task creation); actionable block message carrying the exact scaffold command; escape hatch via `"spec": { "scaffold_guard": false }` in `.claude/runtime.json`.

### Changed
- `settings/settings.json`: registered the guard under a dedicated `Write` matcher in `PreToolUse` (separate entry so the settings-merge dedupe does not swallow it).
- `migration-manifest.json`: declared `hooks/task-scaffold-guard.cjs` in `runtime.files` so the installer ships it alongside `spec-scaffold.cjs`.
- `skills/specs/SKILL.md` Step 7: scaffold is now stated as **mandatory** (raw `Write` to a task file is blocked), not a suggestion.

### Notes
- Enforces *process discipline* (every spec goes through scaffold; `task_files`/`task_registry` stay consistent), not a large token cut — task content is still emitted via `Edit`.

## [0.13.1] - 2026-06-21

### Added — Specs v2 (quality + grounding + output-cost)
- **Layer 2 grounding (`spec-ground.cjs`)**: deterministic check that greps the real work tree to verify every `Related Files` path a task cites (Modify/Delete/Read) exists, or is Created earlier in the spec. Active-grep, not opt-in. Wired into Step 8.5 + `--validate`. `--root` for monorepo specs.
- **Spec scaffolding (`spec-scaffold.cjs`)**: generates spec.json + doc templates + task stubs so the model Edit-fills placeholders instead of hand-Writing whole files (cuts the dominant output-token cost). `--tasks-only` merges into an existing spec without overwriting filled tasks.
- **Execution Tier (Light/Standard/Deep)**: auto-scales research/discovery/review depth so small specs skip full-pipeline overhead; recorded in `design_context.execution_tier`. Quality floor never skips.
- **Evidence-gated red-team**: findings without a concrete task/section citation are auto-rejected.
- **Definition of a Complete Task (DoCT)**: explicit quality bar mapping each completeness element to its enforcing mechanism.
- **Frontend Fidelity Rule**: FE tasks with a provided visual reference must reproduce it faithfully (concrete hex/font/spacing/verbatim text + `match <reference>` constraint). Conditional — brownfield reuse unaffected.
- **Complexity Smell Check (by numbers)**: quantitative YAGNI tripwires (>8 files / >2 services / >12 tasks → challenge; >15 → split).

### Changed
- **Literal `R{N}.{M}` is the default requirement format** (template + Step 5), waking per-criterion coverage that was previously dodged via bare numbered lists.

### Notes
- All new validator/grounding checks are opt-in/progressive or active-grep — legacy specs are unaffected and continue to pass. Spec structure (spec.json + requirements/design/research/tasks) unchanged.

## [0.13.0] - 2026-06-18

### Changed
- **`hapo:specs` pipeline streamlined to 9 steps.** Removed the Task Hydration step (old Step 8): it created session-scoped Claude Tasks that died with the session and were re-derived from task files anyway, while `hapo:develop` reads task files directly. Task files + `spec.json.task_registry` remain the single source of truth.
- **Lower per-turn context cost.** The `spec-state` tollgate hook now emits its full block only when spec state changes (phase or done/total tasks); unchanged turns get a one-line reminder.
- **Leaner skill body.** De-duplicated `SKILL.md` finalization/checklist rules already enforced by the validator, and merged `rules/tasks-parallel-analysis.md` into `rules/tasks-generation.md` (one fewer rule file). No behavior change.

### Added
- **Deterministic validator hardening** (`validate-spec-output.cjs`):
  - Fails when `timestamps.requirements_done` / `design_done` / `tasks_done` reuse `timestamps.init`.
  - Verifies acceptance-criterion coverage at sub-level (e.g. `R3.4`), not just the requirement group — opt-in when `requirements.md` uses explicit `R{N}.{M}` literals.
  - Detects cross-layer contract drift: a `<!-- contract:NAME -->` block in `design.md` must be copied verbatim by every task declaring `Contracts: NAME`; divergent copies or unknown names fail. Opt-in via markers; documented in `templates/design.md`.

### Notes
- All new validator checks are opt-in / progressive — specs in the legacy format are unaffected and continue to pass.

## [0.11.11] - 2026-06-08

### Changed
- `hapo:specs` entry/dispatch redesign. The flag surface is now exactly four: `--auto`, `--validate`, `--status`, `--archive`. The bare verbs `status` / `archive` / `resume` and `--validate` remain as silent back-compat aliases.
- Default behavior of `/hapo:specs <description>` changed: instead of always running end-to-end, it now uses **Interactive State Discovery** (detect unfinished specs → continue vs create) and asks a **Creation Mode** before running.
- Spec artifacts are now **canonical in English** regardless of the session response language (`spec.json.language` defaults to `en`; `ears-format.md` and the runtime `CLAUDE.md` updated accordingly).

### Added
- **Creation Mode Gate** for `hapo:specs`: choose how far a run goes — `Auto (→ Tasks)`, `Stop after Design`, or `Step by step`. Early stops emit a Paused Block and leave `ready_for_implementation = false`; re-running `/hapo:specs` resumes from `current_phase`.
- `--auto` flag: non-interactive run that creates (or resumes an unfinished spec) and goes end-to-end to Tasks with auto-approval.
- `hapo:develop` auto-trigger now calls `/hapo:specs <feature> --auto` so mid-implementation spec creation stays non-interactive.
- **Translation mirror**: when the configured language (`.claude/settings.json` → `language`) is not English, an interactive run offers a reference-only duplicate of the spec under `specs/<feature>/i18n/<lang>/`, kept in sync with the English canonical (`spec.json.translation`, `references/translation-mirror.md`). The mirror is never validated and never a source of truth.

### Notes
- The 10-step pipeline, deterministic validator, templates structure, and `spec.json` task contract are unchanged — this release changes how the pipeline is invoked, where it can stop, and the canonical language (plus an optional translated mirror).

## [0.9.7] - 2026-06-01

### Changed
- The generated addressing section in `CLAUDE.md` is now written in English (heading `## Addressing (Context Overflow Indicator)` and an English instruction); only the address term itself stays as the user entered it.
- The section matcher keys off the shared `Context Overflow Indicator` marker, so reinstalling over an older Vietnamese section replaces it in place without duplicating.

## [0.9.6] - 2026-06-01

### Fixed
- Addressing configuration now writes to the project-root `CLAUDE.md` instead of the non-existent `.claude/CLAUDE.md`, so the term entered during install (`đại ca`, etc.) is actually applied.
- Shortened the generated addressing section to a single-line instruction; `docs/addressing.md` updated to reference the correct `CLAUDE.md` location.

## [0.9.5] - 2026-05-31

### Added
- Addressing (xưng hô) configuration as a context-overflow indicator:
  - Installer asks a single question for how the AI should address the user (e.g. `boss`, `sir`, `anh`, `đại ca`), writing the rule directly into the runtime `CLAUDE.md`. Leaving it blank skips the section entirely.
  - When the model stops addressing the user as configured mid-session, it signals that the context window has likely been compacted/truncated and suggests `/clear`.
  - Input is validated to letters and spaces; invalid entries are skipped.
- `docs/addressing.md` documents the feature, configuration, and overflow-detection behavior.

## [0.9.3] - 2026-05-29

### Added
- Added `hapo:specs` planning decision frameworks:
  - `ask-user-question-gates.md` defines when specs must pause for user-owned decisions and when evidence/research should answer instead.
  - `phase-decision-matrix.md` guides implementation slices/task clusters such as R0 foundation, risk spikes, vertical slices, integration gates, and verification gates.
  - `task-scoring-rubric.md` scores candidate tasks for priority, split/merge, spike needs, dependencies, parallel eligibility, and evidence depth.

### Changed
- `hapo:specs` now loads the decision frameworks during description analysis, scope inquiry, design, task breakdown, and validation review.
- `tasks-generation.md` now requires pre-generation decision gates before writing `tasks/task-R*.md` files.

## [0.9.2] - 2026-05-28

### Fixed
- `hooks/state.cjs` no longer emits "Agent Result: unknown" sections (skipped at `SubagentStop` when `agent_type` is missing or `unknown`) and caps retained agent sections at 3 most recent. Also limits `Key Files Modified` to top 5 entries. Reduces SessionStart payload re-injection across resume/compact events.

## [0.9.1] - 2026-05-27

### Added
- Added `hapo:question` / OpenCode `/question` as the standard evidence-backed Q&A skill for source code, docs, specs, config, dependencies, and external technical knowledge.
- OpenCode installs now ship CafeKit runtime plugins under `.opencode/plugins/`:
  - `privacy-block.ts` — blocks reads of `.env`, key, credential, and token files via `tool.execute.before`; mirrors the Claude `privacy-block.cjs` JSON-marker UX so assistants prompt the user before retrying via `bash cat`.
  - `inspect-block.ts` — blocks reads/globs that target heavy dirs (`node_modules`, `.next`, `dist`, …) and excessively broad glob patterns; allows approved build/package-manager commands.
  - `docs-sync.ts` — on `session.created`, writes a banner to `.opencode/session-banner.md` when source code exists without `docs/` or when `docs/.sync_hash` is stale.
  - `session.ts` — writes project type / package manager / framework / git branch banner; emits the compaction warning on `session.compacted`.
  - `state.ts` — loads `.opencode/session-state/latest.md` on `session.created`, refreshes on `tool.execute.after` for state-shaping tools (`todowrite`, `task*`), and archives on `session.idle`.
- Installer now writes `.opencode/package.json` with `@opencode-ai/plugin ^1.15.11`; OpenCode runs `bun install` automatically at startup.

### Changed
- Standardized the temporary `qs` skill surface back to `question` across Claude Code, OpenCode, package docs, and cafekit-web docs.
- `normalizeOpenCodeBody` now rewrites `hooks/.logs/` → `plugins/.logs/` so the OpenCode `.gitignore` ignores plugin log output rather than the legacy hook log path.

### Gaps (documented, intentionally unported)
- `rules.cjs`, `agent.cjs`, `spec-state.cjs`, and the prompt half of `usage.cjs` remain Claude-only — OpenCode has no equivalent for `UserPromptSubmit` / `SubagentStart`. Equivalent guidance lives in `AGENTS.md` + `.opencode/rules/*` (skill workflow + domain routing) so OpenCode users still get the routing and spec-drift reminders, just statically rather than via a runtime hook.
- The Claude statusline (`status.cjs`) remains Claude-only.

## [0.9.0] - 2026-05-26

### Changed (breaking)
- OpenCode installs are now self-contained under `.opencode/`. Skills, rules, scripts, references, `runtime.json`, and `.gitignore` previously written to `.claude/` are now installed to `.opencode/skills`, `.opencode/rules`, `.opencode/scripts`, `.opencode/references`, `.opencode/runtime.json`, and `.opencode/.gitignore`.
- Text assets copied into `.opencode/` are rewritten on copy so internal references and Windows path variants point at the OpenCode runtime layout (`CLAUDE.md` → `AGENTS.md`, quoted `.claude` literals → `.opencode`).
- Installer now prints a warning when an existing `.claude/` directory is detected during an OpenCode-only install so users can clean up the legacy layout manually.

### Fixed
- OpenCode skill installs now strip the Claude-only `hapo:` prefix from `SKILL.md` `name` frontmatter so skills satisfy OpenCode's strict `^[a-z0-9]+(-[a-z0-9]+)*$` validation and match the containing directory name.

### Migration
- Existing OpenCode users upgrading from 0.8.17 may safely delete the legacy `.claude/` directory after re-running the installer; the OpenCode runtime no longer reads from it.
- Combined installs (Claude + OpenCode) continue to write both `.claude/` and `.opencode/` as independent self-contained runtimes.

## [0.8.17] - 2026-05-26

### Changed
- Replaced the secondary installer platform option from Antigravity to OpenCode.
- OpenCode installs now write `.opencode/commands`, converted `.opencode/agents`, root `AGENTS.md`, merged `opencode.json`, shared `.claude/skills`, `.claude/rules`, and `.claude/scripts`.
- OpenCode commands now use prefix-free command names, bind to matching CafeKit agents with `agent`/`subtask`, and use OpenCode `permission` frontmatter for skill/task access.
- OpenCode setup now supports project-local model configuration through `OPENCODE_MODEL`, `OPENCODE_DEFAULT_MODEL`, or installer input.

### Removed
- Removed the legacy Antigravity source bundle from packaged install assets.

## [0.8.16] - 2026-05-25

### Changed
- Replaced the automatic scoring-based `skill-router` hook with Research-style workflow/domain routing rules and a generated skill catalog script.
- Installer upgrades now remove obsolete `skill-router` runtime files and settings hooks from existing projects.

### Removed
- Removed `hooks/skill-router.cjs` and `hooks/lib/skill-router-routes.cjs` from the Claude runtime bundle.

## [0.8.15] - 2026-05-23

### Added
- Added `hapo:docs` for project documentation workflows, including `reconstruct` mode for source-backed as-is system documentation with evidence, confidence, and unknown tracking.
- Expanded `hapo:docs` normal-docs workflow into detailed `init`, `update`, and `summarize` phases with source scouting, docs reading, size checks, docs validation, and runtime docs-root support.
- Added reconstruct templates, a self-contained `overview.html` review dashboard, source snapshot/review metadata, and a deterministic as-is bundle validator.
- Added skill-router coverage for project docs, legacy/as-is documentation, and source-code-to-docs prompts in Vietnamese, English, and Japanese.

### Changed
- Switched explicit `hapo:docs` mode selection to flag forms such as `--init`, `--update`, `--summarize`, and `--reconstruct`.

## [0.8.13] - 2026-05-22

### Changed
- Unified CafeKit runtime configuration on `.claude/runtime.json` for Claude Code projects.
- `hapo:skill-router`, statusline rendering, docs sync, and usage tracking now read project runtime settings consistently from the installed runtime bundle.

### Fixed
- `hapo:skill-router` now respects `hooks.skill-router` from `.claude/runtime.json`.
- `docs-sync` now honors `paths.docs`, `usage` resolves runtime config from hook `cwd`, and `statuslineColors` now actually controls statusline color output.

## [0.8.11] - 2026-05-19

### Changed
- Hardened `hapo:specs` task validation so generated tasks must keep the full CafeKit task shape: `Context`, `Constraints`, `Related Files`, `Completion Criteria`, `Evidence`, runtime reachability proof, and `Risk Assessment`.
- Prevented complex specs with 5+ tasks from becoming implementation-ready until `/hapo:specs --validate` completes Red Team + Validate and persists validation state.
- Installed `.claude/.gitignore` from the Claude runtime bundle so generated session state, hook logs, caches, local env files, and skill dependencies stay out of commits.

## [0.8.10] - 2026-05-19

### Added
- Added installed CafeKit version tracking in `.claude/cafekit.json` / `.agent/cafekit.json`, including current version, previous version, install timestamps, platform metadata, and reproducible `npx @haposoft/cafekit@<version>` install command.

### Changed
- Strengthened `hapo:specs --validate` so deterministic validator failure blocks PASS, `ready_for_implementation`, and `/hapo:develop` handoff.

## [0.8.9] - 2026-05-19

### Added
- Added a deterministic `validate-spec-output.cjs` validator for generated `hapo:specs` artifacts. It blocks boolean `scope_lock`, stale `tasks` arrays, stale or incomplete `task_registry`, missing `research.md` evidence summaries, all-`R0` feature task sets, and task files without evidence.
- Added self-test fixtures that prove a compact valid spec passes and a triage-dashboard-like invalid spec fails.

### Changed
- Simplified the task template toward the v0.7.29 super-admin style: `Context`, `Steps`, `Requirements`, `Related Files`, `Completion Criteria`, `Evidence`, and `Risk Assessment`.
- Relaxed task grouping so task IDs follow implementation flow while requirement coverage remains explicit in each task, avoiding over-fragmentation by requirement number.
- Updated specs, develop, test, and review guidance to treat `Evidence` as the primary task proof section while still accepting `Task Test Plan & Verification Evidence` and legacy `Verification & Evidence`.
- Added task-level test type guidance so unit, component, integration, E2E/UI, visual, accessibility, smoke, regression, performance, and security checks are applied only when the task risk/surface requires them.

## [0.8.8] - 2026-05-18

### Changed
- `hapo:specs` now requires runtime reachability proof for task outputs and final integration coverage for UI/app/runtime workflows.
- `hapo:develop` now performs task-aware source scouting for every task and runs a final integration scout before reporting completion.
- `hapo:develop` quality gate now separates spec compliance review from code quality review, with scope drift and orphaned runtime artifacts treated as blocking failures.
- `hapo:test` now supports spec-aware feature verification via `/hapo:test <feature>` or `/hapo:test specs/<feature>`.

### Fixed
- `hapo:specs --validate` handoff text now consistently points to `/hapo:develop <feature>` instead of legacy approve/spec aliases.

## [0.8.7] - 2026-05-18

### Fixed
- Hardened the `hapo:specs` output contract to keep generated specs on `spec.json` / `spec-state.json` and CafeKit task filename conventions.
- Strengthened self-tests around spec artifact names and legacy output redirects.

## [0.8.6] - 2026-05-18

### Fixed
- `hapo:specs <feature-description>` now explicitly continues past Init into requirements, design, tasks, and finalization.
- Legacy `spec-init` output now redirects to `/hapo:specs resume <feature>`.
- Skill self-tests now cover the init-continuation and legacy-command redirect semantics.

## [0.8.5] - 2026-05-18

### Fixed
- `hapo:specs --validate` now explicitly forbids stale `/sdd:execute-spec` handoff text and keeps the approved next step on `/hapo:develop <feature>`.
- Validation now treats non-CafeKit task filenames such as `tasks/R0-1-...` as invalid and requires `tasks/task-R0-01-...` style task paths.
- Removed the remaining `/sdd:spec-requirements` marker from the requirements template.

## [0.8.4] - 2026-05-18

### Fixed
- `hapo:specs` now explicitly locks its completion handoff to `/hapo:develop <feature>` and forbids legacy `/work` or `/code` next-step suggestions.
- `spec-maker` now reinforces the same CafeKit-native handoff when reporting generated specs.
- Skill self-tests now include static semantic checks for the `hapo:specs` implementation handoff.

## [0.8.3] - 2026-05-18

### Changed
- Claude Code subagent guidance now uses the current `Agent` invocation shape while retaining legacy `Task` compatibility notes.
- `spec-maker` now reads installed `.claude/skills/...` paths directly and avoids nested subagent orchestration from inside a subagent.
- Research, develop, test, hotfix, and inspect workflow references now distinguish subagent invocation, task-list tracking, and Bash command execution more clearly.

### Fixed
- Agent `tools:` allowlists no longer include unsupported tool names or nested subagent declarations.
- `hapo:research` now uses `Agent` for researcher delegation and reserves `TaskCreate` for task tracking.
- `hapo:inspect` now points runtime configuration at `.claude/runtime.json` in installed projects.
- State hooks now listen for current `Agent` tool usage in addition to legacy task/state tools.

## [0.8.1] - 2026-05-18

### Changed
- `hapo:specs` now uses an evidence-first gate before requirements: targeted codebase scout for existing-code changes and current external research for fast-moving or third-party decisions.
- `research.md` now records codebase evidence, external/current research, selected decisions, rejected alternatives, and downstream task/test implications.

## [0.8.0] - 2026-05-17

### Added
- `hapo:brainstorm` now runs as a scout-first pre-spec workflow for unclear ideas, architectural choices, and scope gates.
- `brainstormer` now acts as a specialist advisory agent for architecture pressure-testing inside the brainstorm workflow.
- Skill self-tests now run bundled Chrome DevTools and PDF script tests through `pnpm test`.
- `hapo:git finish` guidance documents verified branch closeout options.
- Hook protocol guidance documents privacy-block handling without expanding the main Claude runtime rules.

### Changed
- `hapo:specs` now routes unclear ideas and unresolved architecture decisions to `hapo:brainstorm` before creating spec artifacts.
- Specs, develop, test, review, and sync workflows now use `Task Test Plan & Verification Evidence` for task-level proof.
- Claude runtime rules were simplified around scout-first work, fresh verification, root-cause analysis, and concise reporting.
- Public docs now surface `hapo:brainstorm` in command references and quickstarts.

### Fixed
- Web docs lint and build issues around image usage, hooks, unused imports, and dependency overrides.

## [0.7.29] - 2026-05-05

### Fixed
- `hapo:develop` now invokes the bundled `inspector` agent instead of the non-existent `inspect` agent during codebase scouting.

## [0.7.25] - 2026-04-16

### Changed
- `hapo:specs` now maintains `task_registry` machine-state in `spec.json` alongside `task_files`
- `hapo:specs --validate` now requires a reconciliation audit before marking validation complete or enabling implementation readiness
- task hydration, sync, develop, and the active-spec hook now understand requirement-driven `task-R*.md` files and shared per-task machine state

### Fixed
- provider drift such as stale `Claude API` / `Haiku` wording is now treated as a validation failure outside `research.md`
- delete-data specs now require a single canonical deletion/retention policy instead of mixed task-level interpretations
- legacy `task-01` / `task-02` references were removed from Claude Code-facing protocols and docs

## [0.7.23] - 2026-04-15

### Added
- **hapo:generate-graph** bundled into the Claude Code skill catalog for technical SVG/PNG diagram generation

### Changed
- Claude Code is now the primary documented release surface for CafeKit
- `hapo:specs` protocol tightened around canonical state, task inventory integrity, contract locking, and implementation readiness gates
- `hapo:develop` quality gate tightened around completion criteria, verification evidence, and task-aware definition-of-done

### Fixed
- Claude installer now syncs `task.md` instead of expecting the removed `tasks.md` template
- Claude manifest no longer references the removed `code` skill
- bundled `generate-graph` metadata and docs now point to CafeKit instead of upstream install instructions

## [0.5.6] - 2026-03-26

### Added
- **hapo:inspector 2-phase approach** - Intelligent scope handling for broad requests
  - Phase 1: Structure Scout discovers actual project layout before division
  - Phase 2: Parallel Explore agents based on scout findings
  - Auto-merge small scopes (<10 files), auto-split large scopes (>100 files)
  - AskUserQuestion fallback for ambiguous structures
  - Enhanced report format with Patterns section and Suggested Next Steps

### Changed
- hapo:inspector no longer rejects broad scopes - auto-divides intelligently instead

## [0.5.5] - 2026-03-26

### Fixed
- Added missing `os` module import for API key configuration

## [0.5.4] - 2026-03-26

### Fixed
- Gemini API key prompt now writes directly to `~/.gemini/.env` file
- Prevents launching Gemini CLI in interactive mode during installation

## [0.5.3] - 2026-03-26

### Changed
- Published version (skipped due to local testing)

## [0.5.2] - 2026-03-26

### Fixed
- Corrected Gemini CLI package name from `@google/generative-ai-cli` to `@google/gemini-cli`

## [0.5.1] - 2026-03-26

### Fixed
- Gemini CLI installation prompt now waits for user input (missing `await`)
- Updated references from `hapo:inspect` to `hapo:inspector` in installer messages

## [0.5.0] - 2026-03-26

### Added
- **hapo:inspector skill** - Fast codebase discovery using parallel agents
  - Dual-mode support: internal (Explore agents) and external (Gemini CLI)
  - SCALE-based routing (1-10 agents based on file count)
  - Preflight scope gate to prevent broad scans
  - Built-in no-scan lists for security
  - 3-minute timeout per agent with skip-on-timeout
  - Task registration for ≥3 agents
  - 500-line file chunking strategy
- **Gemini CLI auto-install** - Interactive setup during cafekit installation
  - Prompts user to install gemini-cli
  - API key configuration during setup
  - Fallback to internal mode if skipped
- **runtime.json configuration** - Centralized config for external tools
  - Auto-installed to `.claude/runtime.json`
  - Gemini model configuration
  - Extensible for future external tools

### Changed
- **BREAKING:** Buid `hapo:inspector` for hapo-cafekit
- Updated all downstream references in agents, commands, and skills

### Fixed
- Config path now uses `.claude/runtime.json` instead of project root

## [0.4.0] - 2026-03-25

### Added
- **Claude Code Statusline Support** - Enhanced statusline with real-time session context
  - Context usage tracking (tokens, percentage)
  - Session timer
  - Git status (branch, dirty state)
  - Active agents count
  - Todo items tracking
- **Runtime Bundle System** - 12 runtime files with short renamed paths (copyright-safe)
  - `status.cjs` - Main statusline renderer
  - `hooks/session.cjs` - Session initialization
  - `hooks/agent.cjs` - Subagent context injection
  - `hooks/usage.cjs` - Usage tracking
  - `hooks/lib/*.cjs` - Shared utilities (color, parser, git, config, counter, detect, context)
- **Smart Settings Merge** - Preserves user config during install/upgrade
  - Automatic settings.json merge without overwriting user settings
  - Hook deduplication by command identity
  - Safe to re-run installer
- **Manifest v2 Schema** - Runtime files array with validation
  - Schema validation on load
  - Fails fast on invalid manifest structure

### Changed
- **Installer Modes** - Idempotent by default with upgrade option
  - Install mode: Skip existing files (default)
  - Upgrade mode: Refresh managed files (`--upgrade` or `--force`)
- **README Documentation** - Added comprehensive statusline feature documentation

### Fixed
- Task ID tracking in transcript parser (High Priority #3)
- Hook deduplication now checks all hooks in array, not just first (High Priority #1)
- Manifest v2 schema validation prevents invalid installations (High Priority #4)

### Security
- 4,613 LOC code reviewed
- 0 critical security issues
- Path traversal prevention
- Command injection protection
- Null byte blocking

## [0.3.12] - 2026-03-24

### Changed
- Version bump for hapo skills release

## [0.3.1] - 2026-03-13

### Changed
- **Renamed package** from `@haposoft/cafekit-spec` to `@haposoft/cafekit`
- Deprecated the old `@haposoft/cafekit-spec` package
- Updated repository and homepage URLs to point to the official `haposoft` organization

## [0.2.2] - 2026-02-25

### Changed
- Added `scope_lock` contract to spec initialization metadata
- Updated spec lifecycle commands to enforce scope lock
- Reduced default expansion in `/spec-design`
- Clarified steering usage in requirements phase
- Added task-generation guardrail for requirement ID mapping
- Added installer sync for specs template files

### Fixed
- Regression guard for installer CLI upgrade mode

## [0.1.7] - 2026-02-24

### Changed
- Unified workflow naming around hyphens for Antigravity workflows
- Replaced `spec-impl` with `code - test - review` in primary flow
- Installer ensures dependency templates for code/test/review commands
- Updated docs workflow naming to `/docs-init` and `/docs-update` for Antigravity

## [0.1.5] - 2026-02-11

### Added
- **Documentation workflow for Antigravity** - New `/docs-init` and `/docs-update` workflows
- **GEMINI.md rule file** - Auto-installs `.agent/rules/GEMINI.md` with system rules
- **Full Antigravity support** - Documentation commands now work on both platforms
- **AGENTS.md auto-generation** - Created automatically when running docs commands

## [0.1.2] - 2026-02-04

### Changed
- **Multi-platform support** - Renamed from "Claude Code only" to "AI coding assistants"
- Updated documentation to reflect dual-platform support (Claude Code + Antigravity)
- Improved platform detection and installation UX
- Added platform compatibility matrix

## [0.1.1] - 2026-02-03

### Added
- Dual-platform installer supporting both Claude Code and Antigravity
- Auto-detection of existing `.claude/` and `.agent/` configurations
- Interactive platform selection when no configuration detected

## [0.1.0] - 2026-02-02

### Added
- Initial release of CafeKit workflow
- Initial spec workflow foundation
- Zero-config installation via npx
- Idempotent file copying (safe to re-run)
- Comprehensive documentation

---

[0.8.0]: https://github.com/haposoft/cafekit/compare/v0.7.29...v0.8.0
[0.7.29]: https://github.com/haposoft/cafekit/compare/v0.7.28...v0.7.29
[0.7.23]: https://github.com/haposoft/cafekit/compare/v0.5.6...v0.7.23
[0.4.0]: https://github.com/haposoft/cafekit/compare/v0.3.12...v0.4.0
[0.3.12]: https://github.com/haposoft/cafekit/compare/v0.3.1...v0.3.12
[0.3.1]: https://github.com/haposoft/cafekit/compare/v0.2.2...v0.3.1
[0.2.2]: https://github.com/haposoft/cafekit/compare/v0.1.7...v0.2.2
[0.1.7]: https://github.com/haposoft/cafekit/compare/v0.1.5...v0.1.7
[0.1.5]: https://github.com/haposoft/cafekit/compare/v0.1.2...v0.1.5
[0.1.2]: https://github.com/haposoft/cafekit/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/haposoft/cafekit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/haposoft/cafekit/releases/tag/v0.1.0
