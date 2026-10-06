<!-- CAFEKIT CLAUDE START -->
# CLAUDE.md

@AGENTS.md

<!-- Claude Code reads this file; the @import above loads the shared AGENTS.md core.
     Humans: review installed hooks with /hooks before trusting them. -->

## Claude Code runtime

- Edit project skills under `.claude/skills/`, not `~/.claude/skills`.
- Run Python skill scripts with the skill venv:
  - macOS/Linux: `.claude/skills/.venv/bin/python3 scripts/<script>.py`
  - Windows: `.claude\skills\.venv\Scripts\python.exe scripts\<script>.py`
- Consult `.claude/rules/state-sync.md`, `.claude/rules/hook-protocols.md`, and `.claude/rules/skill-workflow-routing.md` when their topics apply.
- New Specs work uses the process-first flow. `/cf:specs` opens GATE-SCOPE, writes
  `specs/<feature>/plan.md` with flat `task-NN-*.md` files beside it, then opens
  GATE-REVIEW after adversarial review. It never starts implementation.
- Start implementation only through a new explicit `/cf:develop` invocation.
  Execute one unblocked task at a time; each task has exactly one `Status:`
  field and the controller is its sole state-and-proof writer.
- Use `/cf:sync` for surgical updates to observed file state. A done task
  requires a canonical final inline `## Receipt` with the exact command,
  `Exit: 0`, `Verification: PASS`, runtime-derived Base and Head values, and
  non-empty fenced current output.
- At GATE-DONE, show current receipts and unresolved limitations. The user decides
  completion; no command, review, or host state may invent approval or proof.

## Addressing (Context Overflow Indicator)

Claude Code always addresses the user as "Bro" throughout the conversation. If it stops doing so, it is a sign the context has been compacted/truncated — tell the user to consider `/clear`.
<!-- CAFEKIT CLAUDE END -->

## This repository

`.claude/` here is an install of `packages/spec/src/claude/` (git-ignored, replaced on every reinstall). Change skills, rules, agents, hooks, and output styles in `packages/spec/src/claude/`, then reinstall; an edit made only under `.claude/` is lost.
