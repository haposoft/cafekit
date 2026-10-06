# Task: Slim-flow batch (audit §3.6) — cut prose fat, keep every enforcement tooth

> **STATUS: DONE — VERIFIED 2026-07-20** (delegated to grok; every Evidence command
> re-run independently by orchestrator). Shipped as **PR #71** (7 concern-scoped
> commits, branch `feat/slim-flow`, MERGEABLE/CLEAN).
>
> Receipt: line counts 410/24/29/151/54 (all ≤ targets) · shout-grep 0+0 ·
> alias sweep = 2 code-compat sites only · spec-gate diff = comment-only ·
> mjs = additions-only · contract WARN proven both directions on fixtures
> (initial miss was orchestrator's own path error — ran installed `.claude/` copy
> instead of payload; corrected) · suite PASS 155 = 152 + 3 ratchets.

> Self-contained brief for a fresh-context agent. Date: 2026-07-20.
> FOUNDATION: repo `cafekit` (pnpm monorepo), branch `feat/slim-flow` (created from
> `dev` HEAD = merge of PR #69). Working tree CLEAN. Baseline: `cd packages/spec &&
> npm test` passes (confirm the printed count FIRST — expected 152 — and record it).
> Do NOT commit/push/stash. Do NOT touch anything under `specs/` (spec workspaces).

## Context

CafeKit's enforcement has migrated from prose to machinery (validators, hooks). The
prose never slimmed down to match: rules are restated 3+ times, two files still shout
in ALL-CAPS, three heading aliases haunt six consumers. This batch cuts the fat.
Governing principle (from the 2026-07 audit + field test): *what the validator/hook
enforces needs ONE pointer sentence, not a restatement; what only prose enforces must
be pinned by a self-test assertion or it will silently rot.*

House rule for this task: **self-test assertions are the referee.** Before cutting any
file, `grep -n "<that file's path>" packages/spec/scripts/run-skill-self-tests.mjs`
and list every `content.includes(...)` phrase asserted against it — those exact
phrases MUST survive somewhere sensible in the file. Never edit an assertion to make
a cut pass. Run `npm test` after every scope item; any red = restore the phrase.

## Scope (6 items, ordered)

### 1. Diet `packages/spec/src/claude/skills/specs/SKILL.md`: 662 → ≤450 lines

CUT (deduplicate to ONE occurrence + pointer):
- Validator-enforced restatements that appear in Hard Output Contract AND Step 8.5
  AND the Pre-Finalization Checklist "Machine-enforced" group (task naming, forbidden
  artifacts, timestamps-not-reused, registry sync, coverage, placeholder gate,
  validation-gate). Keep the Step 8.5 "Machine-enforced" list as the single canonical
  occurrence; elsewhere replace with one line: "Deterministic validator enforces the
  structural rules — see Step 8.5."
- The `spec.json Update Rules (MANDATORY)` section duplicates approvals/timestamps
  text already in Default Behavior + Step 8.5 — keep the fields table essence once.
- `Quality Standards` section: compress each subsection to ≤3 bullets.
- Subcommands table vs Default Behavior dispatch list: keep the table, cut prose dupes.

MUST PRESERVE EXACTLY (do not reword):
- All asserted phrases found via the referee grep (e.g. "Init is never a stop point").
- Frontmatter, the Dispatch order list, Creation Mode Gate table, the Workflow
  Diagram (mermaid), every Step's operative logic, the DoCT table, scaffold mandate
  wording, `--validate` Guardrails, Step 9/9b verbatim output blocks, contract-marker
  instructions.

### 2. Slim the last shouting banners (mechanics untouched)

- `packages/spec/src/claude/hooks/docs-sync.cjs`: rewrite BOTH banner blocks (missing
  docs / sync required) to ≤6 compact English lines each — no ALL-CAPS words, no
  "URGENT"/"BẮT BUỘC"/"CẤM", max one emoji. Keep exit codes, `.sync_hash` mechanics,
  git command, and fail-open behavior byte-identical. Model: the slim state-change
  block in `hooks/spec-state.cjs`.
- `packages/spec/src/opencode/plugins/docs-sync.ts`: same treatment for its banner
  strings (mechanics untouched).

### 3. Routing rules → ambiguous-cases only

- `packages/spec/src/claude/rules/skill-workflow-routing.md` (95) → ≤30 lines:
  keep the one-line core chain, the delegate row (`/hapo:delegate` MUST survive),
  and an "ambiguous cases" table ONLY for: debug-vs-hotfix, question-vs-research,
  question-vs-brainstorm, specs-vs-brainstorm. Everything else: one line — "Claude
  Code selects skills from frontmatter descriptions; trust it for clear intents."
- `packages/spec/src/claude/rules/skill-domain-routing.md` (88) → ≤30 lines: collapse
  the decision trees into one compact table (domain → skill), keep the "read the
  selected SKILL.md before acting" note.
- Filenames MUST NOT change (CLAUDE.md + rules.cjs reference them by path).

### 4. Thin `inspect` internal mode (no skill removed)

`packages/spec/src/claude/skills/inspect/SKILL.md` (222) → ≤170: the internal mode is
a wrapper around the native `Explore` agent — compress its orchestration prose to
"dispatch native Explore agents with breadth medium/very-thorough + the Scope Gate
below", keeping intact: Scope Gate (NO_SCAN rules), SCALE formula, external-Gemini
mode, Inspect Report output contract. `references/internal-inspection.md` (173) →
≤60 lines with the same preservation rule. Do NOT delete any file or the `sync` skill.

### 5. One Evidence heading (prose advertises one; code keeps legacy read-compat)

Canonical heading: `## Evidence`. In PROSE/TEMPLATES stop advertising the aliases
(`Task Test Plan & Verification Evidence`, `Verification & Evidence`) — replace each
advertisement with "`## Evidence` (legacy heading aliases still parse)". Files to
sweep (grep to find exact spots): specs SKILL, `skills/specs/templates/task.md`
footer note, `skills/develop/SKILL.md`, `skills/sync/SKILL.md` +
`skills/sync/references/sync-protocols.md`, `skills/develop/references/quality-gate.md`,
`rules/state-sync.md`, `src/claude/CLAUDE.md`. CODE stays compatible: do NOT touch
the alias regexes in `hooks/spec-gate.cjs` or `scripts/validate-spec-output.cjs`
except adding a one-line comment `// legacy heading aliases: read-compat only, no
longer advertised` where the alias list lives.

### 6. Contract markers: mandatory wording + validator nudge (field-test incentive fix)

- specs SKILL Step 6: change the contract-marker sentence from "prefer this" to a
  MUST for cross-layer specs: "Any spec whose tasks span both backend and frontend
  surfaces MUST declare shared data shapes as named contract blocks."
- `packages/spec/scripts/validate-spec-output.cjs`: add a **WARNING (never an
  error/exit-code change)** when a spec has ≥5 task files AND `design.md` contains
  zero `<!-- contract:` markers: `[WARN] design.md declares no contract blocks; specs
  spanning BE/FE must declare shared shapes (<!-- contract:NAME -->)`. Follow the
  existing warning style in that script.

### 7. Ratchets + changelogs

- Add self-test assertions (house `{label, file, assert}` pattern):
  a. specs SKILL stays lean: `content.split("\n").length <= 470`
  b. docs-sync.cjs has no shouting: `!content.includes("URGENT") && !content.includes("BẮT BUỘC")`
  c. workflow routing keeps delegate + ambiguity table: includes `/hapo:delegate` and `debug`
- `packages/spec/CHANGELOG.md` + `docs/project-changelog.md` under `[Unreleased]` →
  `### Changed`: one bullet describing the slim batch (SKILL diet numbers, banners,
  routing, Evidence heading canonicalization, contract-marker mandate + validator warn).

## Constraints

- Do NOT touch: `specs/` dir, installer `bin/`, other hooks, agents, OpenCode files
  except `plugins/docs-sync.ts`, any skill not named above.
- Never weaken/delete an existing assertion; never change validator exit codes.
- Surgical edits; keep each file's existing heading style and tone.
- No `git commit/push/stash`.

## Completion Criteria

1. Line counts: specs SKILL ≤450; workflow-routing ≤30; domain-routing ≤30; inspect
   SKILL ≤170; internal-inspection.md ≤60.
2. Zero "URGENT"/"BẮT BUỘC"/"CẤM" in `docs-sync.cjs` and `docs-sync.ts`; mechanics
   diffs are string-only.
3. Grep for `Task Test Plan & Verification Evidence` across `src/claude` returns ONLY
   code-compat sites (spec-gate.cjs, validate-spec-output.cjs) + the single
   "legacy aliases still parse" notes.
4. Validator warns (not fails) on a ≥5-task spec without contract markers — prove
   with a temp fixture dir you create under /tmp (not in the repo).
5. Full suite passes: baseline count + 3 new assertions, zero weakened.
6. `git status` shows only the files named in Scope + changelogs.

## Evidence required

```bash
wc -l packages/spec/src/claude/skills/specs/SKILL.md packages/spec/src/claude/rules/skill-workflow-routing.md packages/spec/src/claude/rules/skill-domain-routing.md packages/spec/src/claude/skills/inspect/SKILL.md packages/spec/src/claude/skills/inspect/references/internal-inspection.md
grep -cE "URGENT|BẮT BUỘC|CẤM" packages/spec/src/claude/hooks/docs-sync.cjs packages/spec/src/opencode/plugins/docs-sync.ts   # expect 0 each
grep -rn "Task Test Plan" packages/spec/src/claude --include="*.md" --include="*.cjs" | head
cd packages/spec && npm test    # PASS, count = baseline + 3
git status --short
```
