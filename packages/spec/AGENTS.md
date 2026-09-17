<!-- CAFEKIT CORE START -->
# AGENTS.md

## Shared CafeKit instructions

- Deliver exactly what was asked. Do not expand, polish, or add optional work beyond the request. Match existing code style and structure.
- For process-first Specs, `plan.md` and flat `task-NN-*.md` files are
  canonical, hand-editable state. Each task has exactly one `Status:` field and
  keeps canonical execution proof in its final inline `## Receipt`.
- Specs uses three user decisions: GATE-SCOPE for scope, GATE-REVIEW for adversarial findings,
  and GATE-DONE for completion. Planning never starts implementation; implementation
  requires a new explicit user invocation.
- Synchronize only observed task state with surgical edits. Never invent proof,
  readiness, approval, review independence, or completed work.
- `NO_TESTS` and `0 tests + exit 0` do not pass when the task requires automated tests.
- When a hook blocks an action, that is an instruction boundary — do not work around it.
- Use conventional commits. Do not add AI attribution unless requested.

## Response style

Keep replies focused and brief. Match written-file length to task needs. Do not add filler sections or redundant summaries. Lead with the outcome.

## Uncertainty

Say when you are unsure and what would settle it. Label inferences instead of presenting them as verified facts.

## Delegation

Do the work yourself when it takes a handful of tool calls. Delegate genuinely independent parallel tracks. Verification comes from the project's hooks and validators, not from spawning more agents.

## Runtime ownership

- This `CORE` block is runtime-neutral and safe for every runtime.
- Runtime-specific instructions live in that runtime's own managed block, not in `CORE`.
- In a combined install, consume `CORE` plus your native block only. Ignore managed blocks not owned by your runtime. If ownership is unclear, treat the file as `CORE`-only (fail-safe).

## Commands

<!-- Add project-specific install, test, lint, and build commands here. Keep commands executable. -->

## Do not touch

<!-- List files, directories, generated artifacts, or secrets that tasks must leave unchanged. -->

## Slow or expensive

<!-- Note commands, environments, or operations that need explicit planning before running. -->

## Language Consistency <!-- cafekit:lang -->

Match the language the user writes in. Technical terms, code identifiers, and file paths may remain in English.
<!-- CAFEKIT CORE END -->

<!-- CAFEKIT CODEX START -->
## Codex runtime

- Repository instructions live in `AGENTS.md`.
- CafeKit skills live in `.agents/skills/`; invoke them as `$cf-<name>` or browse with `/skills`. Edit skills in the project, not in a global skills directory.
- Run Python skill scripts with the project venv:
  - macOS/Linux: `.agents/skills/.venv/bin/python3 scripts/<script>.py`
  - Windows: `.agents\\skills\\.venv\\Scripts\\python.exe scripts\\<script>.py`
- CafeKit agents live in `.codex/agents/*.toml` and are auto-discovered after the repository is trusted.
- Runtime support lives in `.codex/rules/`, `.codex/scripts/`, `.codex/references/`, and `.codex/runtime.json`.
- For skill selection, read `.codex/rules/skill-workflow-routing.md` and
  `.codex/rules/skill-domain-routing.md`. When capability presence is uncertain,
  run `node .codex/scripts/generate-skill-catalog.cjs --skills`; its Codex-bound
  root is `.agents/skills`. Use `$cf-route` only for ambiguous, multi-step,
  multi-domain, or risk-elevated work; explicit, obvious, and factual intents
  stay direct.
- Consult `.codex/rules/review-audit-self-decision.md` before applying audit
  feedback, reversing a verified or user decision, or cutting scope, and
  `.codex/rules/process-management.md` whenever a task starts, reuses, or ends
  long-running processes.
- Project hooks live in `.codex/hooks.json`; review trusted hooks with `/hooks`.
- New Specs work uses the process-first flow. `$cf-specs` opens GATE-SCOPE, writes
  `specs/<feature>/plan.md` with flat `task-NN-*.md` files beside it, then opens
  GATE-REVIEW after adversarial review. It never starts implementation.
- Start implementation only through a new explicit `$cf-develop` invocation.
  Execute one unblocked task at a time; each task has exactly one `Status:`
  field and the controller is its sole state-and-proof writer.
- Use `$cf-sync` for surgical updates to observed file state. A done task
  requires a canonical final inline `## Receipt` with the exact command,
  `Exit: 0`, `Verification: PASS`, runtime-derived Base and Head values, and
  non-empty fenced current output.
- At GATE-DONE, show current receipts and unresolved limitations. The user decides
  completion; no command, review, or host state may invent approval or proof.

### Legacy Specs compatibility

Existing packets containing `spec.json`, nested tasks, or legacy kernel
artifacts keep their installed adapter, `task_registry`, `semantic_model`,
`planning_depth`, lane, `execution_tier`, machine authority, separate receipts,
and closeout contract. Do not migrate them during unrelated process-first work.

## Codex caveats

- Custom agents use snake_case names and `fork_turns: "none"` for explicit delegation.
- Use Codex-native subagent delegation and task-state tools; do not rely on Claude-only tool labels.
- Do not edit global trust configuration. Hooks are not a complete security boundary; hosted tools and untrusted project hooks can bypass the local hook path.

## Combined-install boundary

Codex's native project instruction surface is root `AGENTS.md`. Combined installs keep this Codex block there because no separate Codex project entrypoint is configured by CafeKit. Other runtimes may read the same root file; this shared-root trade-off is intentional and must not be treated as filesystem isolation.

**Ownership / ignore contract (fail-safe):** This Codex block is owned by Codex CLI only. If you are Claude Code or any other runtime, ignore this entire Codex block and consume only CORE plus your native block. If you cannot determine which block is yours, treat the file as CORE-only. Do not treat another runtime's block as instructions.
<!-- CAFEKIT CODEX END -->
