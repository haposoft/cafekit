# Task: Audit batch 1.5 — attribution, OpenCode banner contradiction, frontend-design license

> **STATUS: DONE — VERIFIED 2026-07-17** (delegated to grok 0.2.102, session dispatched
> from Claude Code; verified independently by orchestrator).
>
> Verification receipt:
> - [x] #10 — 4 skills' `metadata.author` = `"Anthropic, PBC — adapted by Haposoft"` (grep by orchestrator)
> - [x] #11 — `AskUserQuestion`: 0 hits in `opencode/plugins/`; AGENTS.md:85 mention kept (correct)
> - [x] #13 — `frontend-design` `license: MIT`; provenance grep "anthropic" = 0 hits (decision rule case 2)
> - [x] Changelogs — `[Unreleased]` → `### Fixed` in both `packages/spec/CHANGELOG.md` + `docs/project-changelog.md`
> - [x] `npm test` in `packages/spec`: **PASS, 138 tests** (run by orchestrator, not agent claim)
> - [x] Scope clean — 8 in-scope files only; 3 pre-existing modified files byte-identical to pre-dispatch stash snapshot
>
> Notes: grok wrote to the main tree despite `--worktree` (known pitfall); grok ran
> `npm install` inside `packages/spec` (npm-layout node_modules + gitignored
> package-lock.json) — run root `pnpm install` later to restore pnpm symlinks.
>
> COMMITTED 2026-07-17: pushed to PR #67 branch `fix/audit-batch-1`
> (`8c2921eb..d247f0a`, 4 concern-scoped commits: 2e9446b attribution /
> ef0e5b3 opencode banner / 3d36da8 frontend-design license / d247f0a changelogs)
> via temp git worktree; `npm test` re-run ON the PR branch combination = PASS 138.
> Local `feat/delegate-skill` tree reverted to pre-dispatch state (in-scope files
> now live only in the PR). Backup snapshot `stash@{0}` can be dropped.

> Self-contained brief for a fresh-context agent. Date: 2026-07-17.
> FOUNDATION: repo `cafekit` (monorepo, pnpm), branch `feat/delegate-skill`, based on `dev`
> after PR #66 (audit batch 1) was merged. The working tree has 3 uncommitted files
> unrelated to this task: `.gitignore`, `CLAUDE.md`,
> `packages/spec/src/claude/skills/delegate/references/codex-delegation.md`.
> You MUST NOT revert, stash, or modify these 3 files.
> Test suite status at dispatch: `npm test` inside `packages/spec/` passes (138 tests).

## Context

CafeKit (`packages/spec/`, npm `@haposoft/cafekit`) is a workflow bundle installed into
Claude Code / OpenCode projects. A full-package audit
(`docs/audit-cafekit-vs-claude-code-2026-07.md`, §3.3) listed 14 fixes; PR #66 shipped 9.
This task closes 3 leftovers (audit items #10, #11, #13). All are metadata/text edits —
no logic changes.

## Scope

### 1. Item #10 — restore Anthropic attribution on the 4 document skills

The four skills below are adapted from Anthropic stock skills (each folder's
`LICENSE.txt` opens with "© 2025 Anthropic, PBC"), but their frontmatter claims
`author: haposoft`:

- `packages/spec/src/claude/skills/pdf/SKILL.md`
- `packages/spec/src/claude/skills/pptx/SKILL.md`
- `packages/spec/src/claude/skills/docx/SKILL.md`
- `packages/spec/src/claude/skills/xlsx/SKILL.md`

In each file's frontmatter `metadata:` block, change exactly one line:

```yaml
# before
  author: haposoft
# after
  author: "Anthropic, PBC — adapted by Haposoft"
```

Do NOT touch the `license:` line, `LICENSE.txt` files, or any other frontmatter field.

### 2. Item #11 — remove the AskUserQuestion contradiction in the OpenCode session plugin

`packages/spec/src/opencode/AGENTS.md` line 85 correctly states `AskUserQuestion` is a
Claude-only tool unavailable in OpenCode ("...use OpenCode's agent/subtask flow, a concise
markdown checklist, or ask the user directly"). But
`packages/spec/src/opencode/plugins/session.ts`, function `handleSessionCompacted`
(around lines 153-162), instructs the agent to use that unavailable tool.

Replace the `lines` array content so the banner keeps the same safety intent but tells
the agent to ask directly in chat. Exact replacement:

```ts
// before
  const lines = [
    "🚨 SESSION COMPRESSED — VERIFY PENDING AUTHORIZATIONS:",
    "Any pending confirmations requested via AskUserQuestion might have been lost.",
    "Do not proceed without explicitly asking the user again to ensure safety.",
    'Use AskUserQuestion: "The chat context was compressed. Do I still have permission to proceed?"',
  ];
// after
  const lines = [
    "🚨 SESSION COMPRESSED — VERIFY PENDING AUTHORIZATIONS:",
    "Any pending confirmations you previously requested might have been lost.",
    "Do not proceed without explicitly asking the user again to ensure safety.",
    'Ask the user directly in chat: "The chat context was compressed. Do I still have permission to proceed?"',
  ];
```

No other edits in `session.ts` or any other plugin.

### 3. Item #13 — fix the dangling license reference in frontend-design

`packages/spec/src/claude/skills/frontend-design/SKILL.md` frontmatter says
`license: Complete terms in LICENSE.txt`, but the folder
(`packages/spec/src/claude/skills/frontend-design/`) contains no `LICENSE.txt`
(only `SKILL.md` + `references/`).

Decision rule (follow strictly):
1. Run `grep -ri "anthropic" packages/spec/src/claude/skills/frontend-design/`.
2. If **zero** hits: this is a Haposoft-authored skill — change the line to
   `license: MIT` (same pattern as
   `packages/spec/src/claude/skills/mobile-development/SKILL.md`).
3. If **any** hit: provenance is uncertain — do NOT guess a license. Leave the file
   unchanged and report this item as BLOCKED with the grep output in your final report.

### 4. Changelogs

Add entries under `## [Unreleased]` → `### Fixed` in BOTH:
- `packages/spec/CHANGELOG.md`
- `docs/project-changelog.md`

One concise bullet covering: document-skill attribution restored to Anthropic; OpenCode
compact banner no longer instructs an unavailable tool; frontend-design license line
fixed (or note it was left pending, per the decision rule outcome).

## Constraints

- Do NOT modify: `.gitignore`, `CLAUDE.md`, anything under
  `packages/spec/src/claude/skills/delegate/`, any `.env*`, any file outside the Scope
  list above plus the two changelogs.
- Do NOT run `git commit`, `git push`, `git stash`, or any deploy/publish command.
- Do NOT reformat/refactor surrounding content — surgical single-line/block edits only.
- Obey repo rules in `CLAUDE.md` (conventional style, no AI attribution in content).

## Completion Criteria

1. All 4 document skills' frontmatter `metadata.author` reads exactly
   `"Anthropic, PBC — adapted by Haposoft"`.
2. `packages/spec/src/opencode/plugins/` contains zero occurrences of
   `AskUserQuestion`; the compact banner still has 4 lines with the same safety intent.
3. `frontend-design/SKILL.md` license line is `license: MIT` (grep rule case 2) OR the
   item is reported BLOCKED with grep evidence (case 3). No new LICENSE.txt fabricated.
4. Both changelogs have an `[Unreleased]` Fixed entry.
5. `npm test` (run inside `packages/spec/`) passes with no fewer tests than before (138).
6. No file outside Scope + changelogs is modified (`git status` clean of surprises).

## Evidence required

Run and include output of:

```bash
grep -n "author" packages/spec/src/claude/skills/pdf/SKILL.md packages/spec/src/claude/skills/pptx/SKILL.md packages/spec/src/claude/skills/docx/SKILL.md packages/spec/src/claude/skills/xlsx/SKILL.md
grep -rn "AskUserQuestion" packages/spec/src/opencode/ || echo "OK: no hits in opencode"
grep -n "license" packages/spec/src/claude/skills/frontend-design/SKILL.md
git -C . status --short
cd packages/spec && npm test
```

Note: `AskUserQuestion` may legitimately remain in `packages/spec/src/opencode/AGENTS.md`
(line 85 documents the tool as unavailable — that reference is correct and must stay).
The zero-occurrence requirement applies to `packages/spec/src/opencode/plugins/` only.
