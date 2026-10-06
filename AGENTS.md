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

Always respond in **Tiếng Việt**. Technical terms, code identifiers, and file paths may remain in English, but explanations, comments directed at the user, and structured output must be in Tiếng Việt.


<!-- CAFEKIT CORE END -->
