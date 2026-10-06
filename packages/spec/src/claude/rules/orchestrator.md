# Subagent Coordination

## Mandatory Context for Every Delegation

Every subagent prompt **must** include these three paths:

- **Work Context** — the git root containing the target files
- **Specs Directory** — `{work_context}/specs/`
- **Docs Directory** — `{work_context}/docs/`

When CWD and work context differ (e.g., editing files in a sibling project), always use the **work context** paths.

```
Example prompt:
"Resolve the date-parsing regression.
 Work context: /repos/billing-service
 Specs: /repos/billing-service/specs/
 Docs: /repos/billing-service/docs/"
```

---

## Resource Constraints

- Each subagent has a **200K token context window** — scope tasks to fit comfortably within it
- Spawning many parallel agents degrades system performance — check available CPU/memory before scaling out. For parallel implementation waves the cap is 3 concurrent agents by default, never more than 5 (each agent carries the 200K budget above)
- Prefer fewer, well-scoped agents over many overlapping ones
- Include system resource info (from hook injection) when delegating tasks so subagents can self-regulate

---

## Execution Patterns

### Sequential (dependent tasks)

Use when each step relies on the output of the previous one:

- **Feature delivery:** Plan → Implement → Test → Review
- **New subsystem:** Research → Design → Code → Document

Each agent must finish completely before the next one starts. Forward relevant outputs in the handoff prompt.

### Implementation Review Chain

For implementation tasks, keep the chain explicit:

1. Implement against one active task/spec scope.
2. Verify with `test-runner` using task files and exact evidence commands.
3. Review with `code-auditor` using task files, design contracts, and the diff.

Do not dispatch multiple implementation agents against the same files or same task **within the same working tree**. Parallelize only independent scopes with distinct file ownership — the sanctioned pattern for parallel implementation is **worktree isolation** (one agent per task, each in its own git worktree) with a **single writer per file per wave** and orchestrator-only spec-state writes, per `skills/develop/references/parallel-waves.md`.

### Parallel (independent tasks)

Spawn concurrent agents when work does not overlap:

- Separate, non-conflicting components (e.g., frontend + backend + docs)
- Isolated feature branches handled by different agents
- Platform-specific work (iOS vs Android)

**Prerequisites for parallel execution:**
- Confirm no file ownership conflicts
- Define merge/integration points upfront

---

## Completion Statuses

Every subagent must close its response with a structured status block:

```
Status: DONE | CONCERNS | BLOCKED | NEEDS_INFO
Summary: <one or two sentences>
Details: <concerns, blockers, or missing info — if applicable>
```

### `DONE`
Task finished successfully. Proceed to the next step in the pipeline.

### `CONCERNS`
Task finished, but the agent flagged uncertainties.
- Observations about tech debt or file size → note for later, continue now
- Doubts about correctness → resolve **before** moving to review

### `BLOCKED`
Task cannot be completed as scoped. Never retry with the same inputs — instead try:
1. Provide additional context
2. Simplify or decompose the task
3. Escalate to the user

### `NEEDS_INFO`
Agent lacks information to proceed. Supply the missing context and re-dispatch.

> If an agent fails the same task **3+ times**, stop retrying and escalate.

## Model Escalation

When the current session or a subagent runs on a model below `fable` (e.g. `opus`, `sonnet`, `haiku`) and hits a hard problem — repeated failed attempts, a high-stakes design fork, or fuzzy requirements — spawn the `strategist` agent for counsel instead of switching the session model. It runs autonomously on the strongest available model and returns full advice in one reply, with no interview and no user round-trips. Give it the task, evidence gathered so far, approaches tried, and the specific question. It advises only; the caller stays responsible for the implementation.

Counsel is not execution proof: it cannot close a task, satisfy a Verification Plan, or stand in for a Receipt. Escalate to the user when the strategist also cannot resolve it, or when the fork is one only the user may decide.

---

## Prompt Engineering for Subagents

Subagents operate in a fresh context — they have **zero knowledge** of the parent session.
They should receive task files, relevant design/requirements excerpts, file paths, acceptance criteria, and current diffs. Do not rely on inherited chat history.

### Prompt Template

```
Task: [specific task description]
Files to modify: [list]
Files to read for context: [list]
Acceptance criteria: [list]
Constraints: [any relevant constraints]
Spec reference: [spec folder path if applicable]

Work context: [project path]
Specs: [specs path]
Docs: [docs path]
```

### Do

- Write explicit, self-contained prompts with task description, file paths, and acceptance criteria
- Summarize relevant decisions; do not replay conversation history
- Reference specific files to read or modify
- When following a plan, include the relevant phase text only — not the entire plan

### Avoid

| ❌ Vague | ✅ Precise |
|----------|-----------|
| "Pick up where we left off" | "Add the `/users` POST endpoint per `phase-02.md`" |
| "Fix the issues we talked about" | "Add null-check in `auth.ts:45` — root cause: missing input validation" |
| "Explore the codebase" | "Read `src/api/routes.ts`, then add the missing handler" |
| Dumping 50+ lines of chat history | A 5-line summary with file paths |
