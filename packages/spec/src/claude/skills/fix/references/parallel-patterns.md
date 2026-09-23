# Parallel Patterns & Task Coordination

How to leverage multiple subagents (the `Agent` tool) and optional task tracking during fix workflows.

## Delegation Gate (applies to every subagent pattern)

Patterns A, B, D, and E dispatch subagents only when all three conditions hold:

- The user explicitly requested or permitted delegation or parallel agents.
- The active runtime exposes an Explore/delegation capability.
- The work splits into at least two distinct, non-overlapping scopes with useful independent work.

Otherwise continue sequentially in the main agent with focused local evidence.
Pattern C runs shell commands in the main agent and needs no gate.

## When to Go Parallel

| Situation | Strategy | Agent Type |
|-----------|----------|------------|
| Searching for root cause across 3+ directories | Parallel scout | `Explore` × 2-3 |
| Testing 2-3 diagnostic hypotheses simultaneously | Parallel hypothesis test | `Explore` × 2-3 |
| Verifying fix (typecheck + lint + build + test) | Parallel verification | `Bash` × 3-4 |
| Fixing 2+ independent bugs in one session | Parallel issue trees | `implementer` × N |
| Deep workflow: parallel scout, then diagnose, then optional research | Staged investigation | Mixed |

## Pattern A: Parallel Scouting

When you need to understand multiple areas of the codebase before diagnosing:

```
// Spawn in a SINGLE message — agents run concurrently
Agent(subagent_type="Explore", prompt="Scan src/auth/ for token validation logic and recent changes")
Agent(subagent_type="Explore", prompt="Scan src/middleware/ for request interceptors that touch headers")
Agent(subagent_type="Explore", prompt="Find all test files matching *auth*.test.* and check coverage")
```

Wait for all agents to return. Merge their findings into a unified context map before proceeding to diagnosis.

## Pattern B: Parallel Hypothesis Verification

After forming 2-3 hypotheses in Step 2 (Diagnose), test them concurrently:

```
Agent(subagent_type="Explore", prompt="Verify hypothesis: cache returns stale data — check TTL config in src/cache/")
Agent(subagent_type="Explore", prompt="Verify hypothesis: race condition in login flow — trace async calls in src/auth/login.ts")
Agent(subagent_type="Explore", prompt="Verify hypothesis: env var missing in production — check .env.example vs deployed config")
```

Each agent returns CONFIRMED, REFUTED, or INCONCLUSIVE with evidence.

## Pattern C: Parallel Verification

After implementing a fix, validate from every angle simultaneously:

```
Bash: npx tsc --noEmit              // Typecheck
Bash: npx eslint src/ --quiet        // Lint
Bash: npm run build                  // Build
Bash: npm test -- --bail             // Tests
```

All four must pass. If any fails, investigate that specific failure before re-attempting.

## Pattern D: Task-Coordinated Issue Trees

For 2+ independent bugs, optionally create separate dependency chains per issue
(task tools add visibility, never a required step):

```
// Issue A — payment processing error
A1 = TaskCreate(subject="[Payment] Scout affected handlers")
A2 = TaskCreate(subject="[Payment] Diagnose root cause",    addBlockedBy=[A1])
A3 = TaskCreate(subject="[Payment] Implement fix",          addBlockedBy=[A2])
A4 = TaskCreate(subject="[Payment] Verify + test",          addBlockedBy=[A3])

// Issue B — auth token expiry
B1 = TaskCreate(subject="[Auth] Scout token lifecycle")
B2 = TaskCreate(subject="[Auth] Diagnose root cause",       addBlockedBy=[B1])
B3 = TaskCreate(subject="[Auth] Implement fix",             addBlockedBy=[B2])
B4 = TaskCreate(subject="[Auth] Verify + test",             addBlockedBy=[B3])

// Final convergence
TaskCreate(subject="Integration verification",              addBlockedBy=[A4, B4])
```

Spawn one `implementer` agent per issue tree. Each agent claims tasks via `TaskUpdate(status="in_progress")` and completes via `TaskUpdate(status="completed")`.

## Pattern E: Deep Workflow — Parallel Evidence Gathering

In complex bugs, independent scout scopes may run concurrently when the
Delegation Gate is open. Diagnosis still starts only after the required scout
outputs are synthesized:

```
// Both read-only scout scopes launch simultaneously:
Agent(subagent_type="Explore", prompt="Scout scope A: map affected files, dependencies, and test coverage")
Agent(subagent_type="Explore", prompt="Scout scope B: map runtime/config paths and recent changes")
```

Wait for the scout evidence, synthesize the required codebase-context summary,
then begin hypotheses and diagnosis. Research begins only after Step 2 diagnosis
proves the root cause and identifies one unresolved external fact. It may inform
a post-diagnosis remedy decision; it never substitutes for repository evidence
or selects a fix early.

## Resource Constraints

- **Max concurrent agents:** 3-5 (beyond this, coordination overhead exceeds benefit)
- **Context limit per agent:** ~200K tokens — keep prompts focused
- **Timeout:** If an agent hasn't returned in 3 minutes, skip it and proceed with available data
- **No file conflicts:** Parallel agents must NOT edit the same files. Read-only during investigation phases.

## Fallback: When Task Tools Are Unavailable

`TaskCreate`/`TaskUpdate` are task-list tools and can be unavailable in some runtimes. If they fail:
- Track progress manually using markdown checklists
- The fix workflow itself remains fully functional — Tasks add visibility, not core logic
