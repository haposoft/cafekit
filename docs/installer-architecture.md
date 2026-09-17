# Installer Architecture

How `@haposoft/cafekit` (`packages/spec/`) installs itself into a target project.
Entry point: `bin/install.js` (bin name `cafekit`).

## Design

A thin orchestrator runs a sequence of **phase handlers**. Each phase receives and
returns the run context (`ctx`) and guards on `ctx.cancelled`. Heavy logic lives in
`bin/lib/` (reusable) and `bin/phases/` (one concern each).

```
bin/install.js              orchestrator: lock → snapshot → phases (try/catch rollback) → release
bin/lib/
  context.js                PLATFORMS registry, INSTALL_COMMAND, migration-manifest loader,
                            arg parsing, results factory, buildContext()
  ui.js                     terminal UI (clack when interactive TTY; plain logs otherwise),
                            ctx.ui — intro/outro/spinner/note + select/text/confirm
  manifest.js               SHA-256 ownership: read / classify / tracker (cafekit-manifest.json)
  managed-writer.js         ownership-aware single-file + tree writer (core of selective update)
  backup.js                 snapshot / restore / prune  (.cafekit-backup/<runId>/)
  lock.js                   acquire / release / stale-PID reclaim  (.cafekit.lock)
  copy-utils.js             copyRecursive / isTextAsset / isGeneratedArtifact /
                            normalizeSourcePaths / readJsonFile  (existing)
  instruction-blocks.js     shared CORE block upsert/migrate + Addressing-section
                            extract/preserve primitives
  codex-install.js          Codex path/tool/skill transforms + managed AGENTS block
  codex-frontmatter.js      minimal agent frontmatter reader for TOML conversion
  path-safety.js            reject managed targets that traverse project symlinks
bin/phases/
  select-platform.js        detect platforms, prompt, legacy warning
  copy-payload.js           skills / agents / references / scripts / commands
  claude-runtime.js         ROUTING, runtime files, obsolete cleanup, CLAUDE.md,
                            AGENTS core + wrappers, rules (Addressing-preserving)
  claude-settings.js        settings.json merge + obsolete-hook pruning
  codex-runtime.js          native hooks/rules, split-root ignores, managed AGENTS block
  omp-runtime.js            Oh My Pi: Claude gate scripts + omp overlay, runtime.json, bridge extension; no skill payload
  write-metadata.js         cafekit.json version metadata + ownership manifest write
  root-config.js            root .gitignore patterns
  post-install.js           Gemini API key, language + managed-block
                            addressing for Claude and Codex
  skills-setup.js           opt-in: venv+pip, skill npm, Chromium; detect+guide system tools
  summary.js / report.js    summary output + per-action reporting helper
bin/lib/
  skill-deps.js             cross-platform setup primitives (venv/pip/npm/chromium/detect)
```

## Run sequence

1. **Lock** — acquire `.cafekit.lock`; refuse if a live PID owns it, reclaim if stale.
2. **Context** — parse args (`--force-overwrite`/`--upgrade`, `--dry-run`, `--with-skills-deps`,
   `--with-document-skills`/`--without-document-skills`), load the
   migration manifest, init results counters.
3. **Select platforms** — honor `--platform`, otherwise restore installed/detected
   `.claude/` and `.codex/` runtimes or prompt.
4. **Snapshot** — back up each platform's declared targets plus root `.gitignore`
   (skipped in dry-run). Claude snapshots `.claude/`, `CLAUDE.md`, and `AGENTS.md`;
   Codex snapshots `.codex/`, `.agents/`, and `AGENTS.md`.
5. **Per platform** — read ownership baseline, start a tracker, then: copy payload → Claude, Codex, or omp runtime → write that runtime's managed instruction block → write metadata + manifest. Before this loop, the installer runs **`ensureSharedAgentsMdCore`** once for every selected runtime, installing/refreshing the shared `src/common/AGENTS.md` CORE block (`<!-- CAFEKIT CORE START/END -->`) in root `AGENTS.md`; the Codex writer appends only its runtime-specific managed block.

   The Claude-specific per-platform sequence is:
   - copyClaudeRuntimeFiles (ROUTING, rules, scripts, references)
   - removeObsoleteClaudeRuntimeFiles
   - mergeClaudeSettings
   - **ensureSharedAgentsMdCore** — installs/refreshes the shared `src/common/AGENTS.md` core exactly once in root `AGENTS.md`; the Codex writer appends only its runtime-specific managed block
   - copyClaudeMdFile — writes `CLAUDE.md` with `@AGENTS.md` import and Claude-specific runtime guidance
   - copyRulesDirectory
6. **Root config** — ensure `.gitignore` patterns (incl. `.claude/`, `.codex/`,
   `.omp/`, `.agents/`, `.cafekit-backup/`, `.cafekit.lock`).
7. **Post-install** — runtime locale, language and managed-block addressing for Claude and Codex.
8. **Skills setup** — opt-in: Python venv, pip deps, skill npm, Chromium; detect system tools.
9. **Summary**; prune old backups. On any throw: **restore snapshot** and exit 1.

## Oh My Pi (omp)

`--platform omp` installs CafeKit for the Oh My Pi coding agent. omp discovers `.claude/skills` and `.agents/skills` on its own (`skills.enableClaudeProject` and `skills.enableAgentsProject` default to true), so the installer copies no skill payload for it and `PLATFORMS.omp.capabilities.skills` is false. What omp lacks is CafeKit's enforcement chain, which `omp-runtime.js` provisions under `.omp/`:

- `.omp/hooks/` — the Claude gate scripts, written from the migration manifest's `runtime.files` list (the same set that reaches `.claude/hooks/`; a directory walk would also ship `hooks/__tests__/`), with `src/omp/hooks/` written over them. That overlay is one file: `privacy-block.cjs`, which denies where Claude would ask, because omp's `tool_call` result has only `block` and `reason` and an ask there would be dropped and the access allowed. It is the only difference that is a contract rather than a spelling — omp's lowercase tool names (`bash`, `read`, `write`) are handled by the shared payload reader, so the scaffold guard and the tool-name table left the overlay. The overlay file is the current Claude file plus those edits; `bin/__tests__/omp-hooks.test.js` re-derives it from the Claude source and fails on a byte of drift in either direction, and on a second file.
- `.omp/runtime.json` and `.omp/runtime.schema.json` — the hooks' configuration, read from the folder the hook lives in (see Hook portability). It ships no statusline keys, `usage.enabled: false` because `usage.cjs` reads Claude Code's credential file, and `codingLevel: 1` like Codex; no omp hook consumes `codingLevel` yet, since the style injection lives in the Codex rules hook. Without this file `rules.cjs` exits silently and an omp-only project never sees the rules.
- `.omp/extensions/cafekit-bridge.mjs` — the extension omp auto-loads. It shapes each omp event into the Claude-shaped payload the scripts read, runs them as child processes with an 8000 ms budget (omp itself substitutes a reasonless block at 30000 ms), and translates all three denial mechanisms back into omp's contract. It mints a session id per load because omp's `input` payload carries none, and honours `stop_hook_active` on `session_stop` so a blocked turn cannot loop.

Carried: every hook registered for SessionStart, PreCompact, UserPromptSubmit, PreToolUse, PostToolUse, and Stop. Not carried: `agent.cjs` (SubagentStart) and `semantic-review-authority.cjs` (SubagentStop), because omp has no subagent lifecycle events; `state.cjs` likewise does not run at SubagentStop. `.omp/` is added to the root ignore rules as part of the install, since omp executes every file under `.omp/extensions/` and a committed copy would run on clone before any gate could act.

The bridge's dispatch table mirrors `src/claude/settings/settings.json` and `bin/__tests__/omp-bridge.test.js` fails if the two drift. The install is verified against the real omp extension contract read from the installed binary; the tests do not launch omp, which needs provider credentials.

## Hook portability

The gate hooks under `src/claude/hooks/` run unchanged under `.claude/`, `.omp/`, and any future dotted platform folder because they derive their runtime directory from their own location. `src/claude/hooks/lib/runtime-dir.cjs` resolves two levels up from the hook file and returns that folder's basename when it starts with a dot; when the hook runs from this repository's source tree (`packages/spec/src/<platform>/hooks/`) it returns the dotted form of `<platform>`, and anything else falls back to `.claude`, the pre-helper behaviour. A dotted basename wins over the source-tree check, because an install can sit under a path that contains `/packages/spec/src/`. Every project-runtime read (`runtime.json`, `scripts/`, `rules/`, session and gate state) and every model-facing path in hook advice goes through this helper, so a hook installed under `.omp/` reads `.omp/runtime.json` and tells the model to run `node .omp/scripts/…`. Installed-root detection derives the same way, so on omp the `__dirname`-derived project root wins over `PROJECT_ROOT` and `payload.cwd` exactly as it always has on Claude.

Skill paths are the one deliberate exception: they come from the platform registry (`PLATFORMS[*].skillsRef`), not the runtime directory, because omp reads `.agents/skills` and has no `.omp/skills`. `agent.cjs` mirrors that mapping.

Two groups of `.claude` literals stay by design. Thirteen `~/.claude/` sites (`usage.cjs`, `state.cjs`, `lib/counter.cjs`, `lib/context.cjs`) read Claude Code's own files in the user's home directory and are kept as Claude Code behaviour; omp and other platforms have no equivalent, and `src/omp/runtime.json` turns the reachable one (`usage`) off. Twenty dead-code lines in `lib/context.cjs` and `lib/detect.cjs`, which nothing imports, are left in place rather than ported. `bin/__tests__/runtime-dir.test.js` copies the whole hook tree under a throwaway `.omp/` and checks that `rules.cjs`, `inspect-block.cjs`, `privacy-block.cjs`, and `spec-gate.cjs` all answer from `.omp/runtime.json` while no `.claude` path exists. `src/omp/hooks/` is an overlay of one file on top of that portable set, described above. The second seam is the envelope: `lib/hook-payload.cjs` translates a foreign host's key spellings and tool names into the shape the hooks read, which is what let the omp overlay shrink.

The shipped hook set is the explicit `runtime.files` list in `src/claude/migration-manifest.json`, so a new hook library must be added there or a packed install ships hooks whose `require` fails; `bin/__tests__/package-inventory.test.js` runs the packed install and catches the omission. `provenance.cjs` excludes `.omp/hooks/.logs`, `.omp/.logs`, and `.omp/runtime.json` from the worktree digest like their `.claude` and `.codex` counterparts.

## Grok CLI

Grok CLI needs no CafeKit payload of its own. Its Claude-compatibility layer already reads `<cwd>/.claude/skills`, `.claude/rules`, `CLAUDE*.md`, `~/.claude.json` for MCP servers, and the hooks in `.claude/settings.json`, and every `[compat.claude]` cell defaults to on. `--platform grok` therefore installs the Claude runtime and creates nothing under `.grok/`; `.grok` is deliberately not a detection marker, because detected platforms are unioned with saved ones on a reinstall.

Two things make the gates actually work there.

- **The envelope.** Grok sends camelCase keys (`toolName`, `stopHookActive`, `sessionId`) and its own tool names (`run_terminal_command`, `read_file`, `search_replace`, `write`). `lib/hook-payload.cjs` normalizes grok's camelCase envelope into the Claude shape inside each hook, so `.claude/settings.json` needs no grok-specific edits and one hook file serves every host. Before it existed, `privacy-block.cjs` read an undefined `tool_name`, extracted no paths, and allowed the call: the gate looked installed and was open.
- **The trust step.** Project hooks are silently skipped until the folder is trusted with `grok --trust` or `/hooks-trust`. The installer prints that once, because nothing in the output would otherwise reveal that the gates are inert. `CLAUDE_PROJECT_DIR` is set by grok for every hook as an alias of `GROK_WORKSPACE_ROOT`, so the hooks resolve the project root the way they always have.

**What grok can carry is narrower than Claude.** It has four control-flow channels: a `PreToolUse` deny, a `UserPromptSubmit` block, a `Stop`/`SubagentStop` block, and exit 2. Every other event is passive, and an allowing `UserPromptSubmit` hook's stdout is discarded rather than added as context. So the gates work and the reminders do not: `rules.cjs`, `spec-state.cjs`, `session.cjs`, `docs-sync.cjs`, `state.cjs`, and the allowing path of `secret-output-guardrail.cjs` are normalized for one code path but never reach the model under grok. Grok also fails open on any hook timeout, crash, or malformed output, where the omp bridge fails closed.

Denials carry their reason as a JSON `permissionDecision: "deny"` on stdout, which grok honours regardless of exit code, with the same text on stderr and exit 2 retained. Grok takes only the first stderr line, so a multi-line reason such as the scaffold guard's command would otherwise arrive truncated to its headline.

`usage.cjs` is deliberately not routed through the reader. It reads the Claude Code OAuth token from the macOS Keychain and calls `api.anthropic.com`, and its prompt flag lowers the fetch interval from 300 s to 60 s, so normalizing its payload would make a non-Claude runtime touch Claude credentials five times as often for output grok discards.

Three contract details are `[UNVERIFIED]`, because settling them costs a live grok session, and no test depends on any of them: whether a `"*"` matcher matches, since grok documents matchers as regular expressions and CafeKit uses `"*"` for `SubagentStart` and `PreCompact`; the input key `grep` and `list_dir` use for their pattern, which is what `inspect-block.cjs` gates on; and grok's spelling for `prompt`, `source`, and `trigger`, where the reader accepts the Claude key and its camelCase twin so either shape works. Each is settled by dumping a real envelope from a hook registered in a throwaway repository. Turning off `[compat.claude] hooks` is not supported: CafeKit registers no `.grok/hooks/*.json`, so a user who disables that scanner gets no gates.

## Orca (onorca.dev)

Orca runs Claude Code, Codex, Grok, or omp inside a pane it manages, across projects and worktrees on the same machine. It is a host the agents run inside, not a runtime CafeKit installs into: there is no `PLATFORMS` entry, no `.orca/` folder, and no network call at install time. What ships is a `cf:orca` skill through the existing skill pipeline (`src/claude/skills/orca/SKILL.md`, in `skills.required`) plus one line at SessionStart, replacing a per-machine setup (Orca's own skills copied under a user's home directory) that a user tried and then removed because it followed the machine rather than the project.

The skill never vendors Orca's guide text; it reads `orca skills get orca-cli` or `orca skills get orchestration` at use time instead, because the guide's own wording changes between CLI versions — between two releases observed two days apart, the `orca-cli` guide kept its 221 lines but changed its opening paragraph. `--references` lists a topic's sub-references and `--reference <name>` prints one; `orca skills list` is the fallback for the other topics.

**Delivery matrix** — what each host receives from the install:

| Host | `cf:orca` skill | routing row | `Orca: pane` line |
|---|---|---|---|
| Claude Code | `.claude/skills/orca` | `.claude/rules/skill-domain-routing.md` | `session.cjs` stdout, read as context |
| Codex | `.agents/skills/orca`, invoked as `$cf-orca`; catalog identity stays `cf:orca` | `.codex/rules/…` | `src/codex/hooks/session.cjs` stdout — whether Codex feeds it to the model is `[UNVERIFIED]` |
| omp | only beside a Claude or Codex install in the same project (`capabilities.skills` is false for omp by design) | `.omp/rules/…` is copied | none — the bridge runs `session_start` and discards its stdout |
| Grok | `.claude/skills/orca`, via `[compat.claude] skills` | `.claude/rules/…`, via `[compat.claude] rules` | no session line — `session.cjs` is one of the hooks Grok normalizes but never feeds to the model (see Grok CLI above) |

`ORCA_PANE_KEY` is the presence marker the skill and the session line key on; Orca sets it in every pane but does not document it (`orca skills get orca-cli` never mentions it). `ORCA_AGENT_HOOK_TOKEN` and `ORCA_AGENT_LAUNCH_TOKEN` are credentials in the same environment; CafeKit hooks never read, write, or print either one.

**Authority stays inside the current worktree.** The skill's default target for `terminal send`, `terminal close`, or a worker stop is the current `ORCA_WORKTREE_ID`; reaching a pane outside it — which may belong to a different project — asks the user first, naming the pane. Text returned by `terminal read`, `show`, or `list` is untrusted: the skill never follows an instruction found in it and never echoes it back verbatim. Orca is not Herdr: a request naming Herdr, or a session with `HERDR_ENV=1`, belongs to the separate `herdr-orchestrator` skill instead.

Four contract details are `[UNVERIFIED]`, because settling them needs a live session and no acceptance criterion depends on them: whether Codex feeds the session hook's stdout to the model, settled by one Codex session in a CafeKit-installed project inside an Orca pane; which `.omp/rules/*.md` files omp actually loads, since it parses project rules as TTSR rules (`alwaysApply`, `globs`, `condition`) and CafeKit's carry no frontmatter, settled by `omp ttsr scan -r .omp/rules/skill-domain-routing.md src/` or by asking omp directly; whether `grok inspect` lists the new skill among the existing `cf-*` entries, settled by running it after install; and whether Codex's own hook process inherits `ORCA_*` variables the way the omp bridge is observed to (`cafekit-bridge.mjs` forwards `process.env`) — observed for omp, inferred rather than observed for Codex.

## Optional document skills

The install inventory has two tiers. Core skills always install. The document
bundle — `docs`, `docx`, `pdf`, `pptx`, `xlsx`, `ai-multimodal` — is optional and
off by default on a fresh install; an interactive run prompts once, and
`--with-document-skills` / `--without-document-skills` decide it non-interactively.
The two flags are mutually exclusive.

The selection persists per runtime under `schemaVersion: 2`. A legacy
`schemaVersion: 1` install keeps the bundle on its first upgrade, so an existing
project does not silently lose skills it already had. Opting out prunes only
pristine CafeKit-owned copies of those directories; a file the user edited is
left in place.

Six broad engineering skills — `backend-development`, `frontend-development`,
`frontend-design`, `mobile-development`, `devops`, `react-best-practices` — are no
longer installed and are pruned ownership-aware on both runtimes.

The optional `docs` skill does not gate the documentation runtime: the
`docs-sync` hook, `validate-docs.cjs`, and the `docs-keeper` agent stay core
assets whether or not the bundle is installed.

## Ownership model

Two distinct manifests (never conflated):

- **Migration manifest** (`src/claude/migration-manifest.json`, `ctx.manifest`) — what
  skills/agents/runtime files to install and which are obsolete.
- **Ownership manifest** (`<folder>/cafekit-manifest.json`, `ctx.ownership`) — SHA-256 of
  every file CafeKit wrote, used to classify on re-install.

### Payload mapping and self-tests

The implementation agent payload is `agents/implementer.md`; the legacy
`god-developer.md` name is not used. The migration manifest and Codex `AGENT_NAMES`
use the same `implementer` name so every runtime resolves the same
implementation role.

The installer copies payload files and transforms paths, syntax, and command
mappings for each target runtime. Installer self-tests exercise the transformed
output and assert that agent mappings stay aligned.

`managed-writer` compares three hashes — disk, recorded baseline, incoming payload:

| State | Condition | Default action | With `--force-overwrite` |
|---|---|---|---|
| absent | not on disk | write | write |
| pristine | disk == baseline | write if payload differs, else skip | same |
| user-modified | disk != baseline | **preserve** (report) | overwrite (snapshot keeps copy) |
| user-created | on disk, not in baseline | **preserve** | overwrite |

A file written earlier in the same run (e.g. spec templates copied by the `specs/`
tree, then revisited by the template-sync loop) is treated as pristine via the
tracker's in-run record, avoiding false "user-created" classification.

Claude keeps its ownership manifest inside one runtime root.
Codex uses one tracker with `recordRoot: "."` and only allows keys under
`.codex/` or `.agents/`; root `AGENTS.md` is managed separately as a marked
block so project instructions remain byte-preserved.

By default the installer gitignores the runtime folders (`.claude/`, `.codex/`,
`.agents/`)
at project root — reinstall with `npx @haposoft/cafekit` on each machine. The
ownership manifest therefore lives only on disk as a local re-install baseline.
If a team deliberately force-adds and commits the runtime folder, they should
also commit the ownership manifest so teammates share the baseline; otherwise
their first install would treat those files as user-created and never update them.

A second layer lives inside the runtime: `.claude/.gitignore` or Codex's
`.codex/.gitignore` + `.agents/.gitignore`. These ignore secrets, skill dependencies, session state,
and logs so partial un-ignores and force-adds stay safer.

## Native Codex layout

`npx @haposoft/cafekit --platform codex` installs:

```text
.agents/skills/             native skills (`$cf-*`, discoverable via `/skills`)
.codex/agents/*.toml        auto-discovered snake_case custom agents
.codex/hooks.json           project lifecycle registration
.codex/hooks/               native event handlers and state/privacy libraries
.codex/{rules,scripts,references}/
.codex/{runtime,cafekit}.json
AGENTS.md                    shared CafeKit CORE block (once) plus the runtime-specific Codex block, all marker-managed
```

Codex uses root `AGENTS.md` as its native project instruction surface, and Claude imports that file through `CLAUDE.md`. In combined installs, the shared CORE block (`<!-- CAFEKIT CORE START/END -->`) remains runtime-neutral while the Codex managed markers preserve ownership and user bytes.

**Combined-install boundary (fail-safe by ownership, not filesystem isolation):**
- `CORE` is runtime-neutral by contract: it contains no runtime-specific tool names, paths, or commands (`Codex`, `.codex`, `$cf-`, `/cf:` are forbidden in CORE — enforced by installer tests).
- Each runtime owns exactly one additional managed block (Codex: `<!-- CAFEKIT CODEX START/END -->`). The block header states an explicit ignore contract: non-owners must ignore that block and consume only `CORE` plus their native block. If ownership cannot be determined, the file is treated as `CORE`-only (fail-safe).
- Markers are not a filesystem isolation boundary — they are an ownership/ignore contract. Tests assert no cross-runtime directive leakage (e.g., Codex block not treated as Claude instructions, and `CORE` stays neutral). Do not claim cross-runtime instruction isolation until a native alternate entrypoint is proven for the affected runtime.

The installer does not create `.codex/config.toml` or change user-global trust.

Codex loads project agents/hooks after the repository is trusted; users review
hook definitions with `/hooks`. It uses Codex's native status/usage UI, not the
Claude statusline.

Codex payload conversion is scoped by asset type. Markdown/text instructions
map Claude paths, skill syntax, tools, and agent examples to native Codex
equivalents. Executable source files receive path/label rewrites only, preventing
keywords such as Python `prompt=` or `description=` from being corrupted.

## Completion gate identity

Two Stop hooks ask about the project's Specs packets, and each first has to answer
"which feature is this turn about?". They ask different questions, so they narrow an
ambiguous scan differently.

- **The Stop gate asks which packet still has unfinished work.** Any layout qualifies:
  a repository of legacy `spec.json` packets narrows exactly the way a process-first one
  does. If more than one packet still has work, the ambiguity stands. If every packet is
  finished and every one of them is process-first, the gate audits the whole set instead;
  a legacy packet never reaches that branch, because it exits before the semantic-digest,
  `FLASH_UNVERIFIED`, feature-receipt, and completion-policy layers.
- **Closeout approval asks which packet is claiming closeout.** A packet is claiming
  closeout when `isDurableCloseout` is true for it. One such packet resolves; none means
  nothing is in flight and the hook stays silent; several keep the ambiguity and name
  only those. A repository holding exactly one packet resolves it whatever its status,
  because approval is claimed against a finished spec and a lone packet still
  mid-execution must remain visible to the hook.

Before this, both hooks decided identity by raw candidate count. A project that had
simply accumulated finished features was blocked on every turn, and because identity is
decided first, the gate never reached receipt validation at all: a genuinely missing
receipt was answered with an identity complaint instead.

### Naming the feature

When more than one packet is genuinely in play, record the one being worked on:

```json
// specs/_shared/active-feature.json
{ "featureName": "user-auth" }
```

Both Stop hooks read it on both runtimes. **A target supplied by the host always wins**:
the file is consulted only where a host payload named no feature, so it can never
redirect a hook that already knows its feature. An absent, blank, malformed, or
symlinked file is ignored rather than treated as a malformed target, so a project holding
a stray file is never blocked by the escape hatch itself. The value is otherwise treated
exactly like a host-supplied feature name and still faces the resolver's containment,
existence, and JSON checks. `specs/_shared/` is already in the generated ignore rules.
The approval prompt names the feature it is asking approval for, so a closeout cannot be
approved without the user seeing which one it is.

Nothing writes this file automatically; writing it belongs to whatever starts a task, not
to a hook.

### What this deliberately does not do

- **A receipt is not proof that its command ran.** Base and Head cost one command to
  produce and no verification run, so the gate detects drift between a receipt and the
  tree, not invention. GATE-DONE is where a human weighs the evidence.
- **A receipt is bound to live `Base`/`Head` only while its own task file has a copy in
  `HEAD` that it no longer matches.** Committed-and-unchanged and never-committed both
  validate on structure alone, and work elsewhere in the tree never reopens a receipt.
  Two conditions were removed for the same reason — each fired on every valid receipt.
  Reopening on a dirty tree carried no information, because `Base` is the last commit
  touching anything outside the specs root, so every finished receipt records an older
  `Base` by construction: measured here at 52 of 52. Binding an uncommitted task file
  made committing `specs/` a requirement the tool never stated and that a project
  gitignoring its specs root cannot meet, and it failed such a project's receipts
  permanently after its first source edit. Editing a committed task file is still
  caught, and every structural check — status, `PASS`, `Exit: 0`, a command matching the
  Verification Plan, non-empty output — runs in all cases.
- **Whoever can write files in the repository can influence which packet the gate
  inspects.** That was already true by editing a `Status:` line, renaming a directory, or
  adding a packet; the file makes it explicit and leaves a trace in the working tree
  instead of being invisible. An environment variable was rejected for the same reason
  the gate refuses a worker-writable runtime flag as an authorization.
- **Two packets genuinely claiming closeout still block** until the file names one.

## Safety properties

- **Rollback** — destructive steps (obsolete removal, settings prune) are covered by the
  pre-run snapshot; a failure restores platform folders and root files.
- **Concurrency** — the lock prevents two installs racing on the same project.
- **Dry-run** — every write/delete/`mkdir`/manifest write is guarded.
- **Path safety** — managed writes and snapshots reject symlink traversal outside
  the intended project paths.
- **Permissions** — POSIX execute bits from payload scripts are preserved without
  replacing destination read/write bits.
- **Selective refresh** — re-running the same version updates pristine payload
  files and preserves user modifications; only explicit `--force-overwrite`
  resets them.
- **Managed Addressing survives reinstall** — Claude and Codex block
  upserts carry over the exact saved `## Addressing (Context Overflow Indicator)`
  section from the existing managed block when a newer template drops it, so the
  user's address is not lost; only reads the managed body, never user-owned or
  shared-CORE content.
- **Generated-artifact filtering** — `.coverage`, `__pycache__`, and `.pyc`/`.pyo`
  are never copied as runtime payload, in `copyRecursive` and `copyManagedTree`.
- **Source-path tripwire** — install self-tests assert no installed payload under
  `.claude` or `.codex` leaks a `packages/spec/src/` source path,
  covering standalone and combined installs; direct text plugin files are also
  byte-normalized.
- **Codex privacy/state** — sensitive approval is one-use and bound to the exact
  session/tool/canonical path set. State, locks, resume context, and archives are
  isolated by hashed session ID. Hooks remain guardrails: hosted or specialized
  tools may not enter the local hook path.

## Known follow-ups

- The ownership manifest can grow large (deep skill trees → thousands of entries) and is
  not pruned when files become obsolete.
