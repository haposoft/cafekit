# Documentation & Planning Standards

## Living Documents

The project maintains these core documents in `./docs`:

| Document | Purpose |
|----------|---------|
| `development-roadmap.md` | Phase tracking, milestones, and progress metrics |
| `project-changelog.md` | Chronological record of features, fixes, and changes |
| `system-architecture.md` | Technical architecture and design decisions |
| `code-standards.md` | Coding conventions and quality expectations |

### Freshness Rule

- Before updating any doc, check its last modified date
- If a doc hasn't been updated in >2 weeks while development is active, flag it for review
- The `docs-keeper` agent should proactively scan for stale docs during weekly reviews

## When to Update

The `docs-keeper` agent is responsible for keeping these documents current. Trigger an update whenever:

- A development phase transitions (e.g., "In Progress" → "Complete")
- A verified task completion changes user-facing behavior, architecture, API contracts, operational flow, or project status enough that docs should be refreshed
- A significant feature ships or a critical bug is resolved
- Security patches are applied or dependencies change
- Project scope or timeline shifts
- Weekly progress reviews are due

### Update Discipline

1. **Read first** — review the current state of roadmap and changelog before editing
2. **Stay consistent** — maintain formatting, version numbering, and cross-references
3. **Verify after** — confirm links work and dates are accurate
4. **Reality check** — documentation must reflect actual implementation status, not aspirations

### Changelog Entry Format

Use [Keep a Changelog](https://keepachangelog.com/) convention:

```markdown
## [version] - YYYY-MM-DD

### Added
- Feature description (#PR-number)

### Fixed
- Bug fix description (#issue-number)

### Changed
- Breaking change or behavior change description
```

---

## Process-first specification and execution tracker

### Where plans live

Keep every new feature packet in one direct child of `./specs/`. The Markdown
files are the durable state and must remain readable without a compiler or a
generated index.

### Primary directory layout

```text
specs/
└── user-auth/
    ├── plan.md
    ├── task-01-setup.md
    └── task-02-api.md
```

Task files are direct children beside `plan.md`; do not place them in a task
subdirectory.
The plan records the GATE-SCOPE scope decision, explicit exclusions, acceptance
criteria, and task mapping. Each task owns one usable outcome, bounded paths,
dependencies, acceptance, and a runnable Verification Plan.

### Gates and execution handoff

- GATE-SCOPE: the user chooses EXPAND, KEEP, or CUT before the plan is written.
- GATE-REVIEW: the user accepts, rejects, or revises deduplicated adversarial findings.
- Specs stops after planning; implementation begins only through a new explicit
  Develop invocation.
- GATE-DONE: after execution, current receipts and limitations are shown and the user
  decides whether the feature is complete.

### Task state and proof

Each task contains exactly one `Status:` field. The final inline `## Receipt`
is canonical proof and must contain the exact command, `Exit: 0`,
`Verification: PASS`, runtime-derived Base and Head values, and non-empty
fenced current output before the task becomes done.

Sync only observed state with surgical edits. Re-read the changed task after
every update; never infer missing proof, approval, or readiness. When a done
task changes user-facing behavior, architecture, API contracts, operations, or
project status, classify docs impact and update only affected existing docs.

Comply with the overarching rules in `./rules/ai-dev-rules.md`.

## Legacy specification layout

Existing features containing `spec.json`, nested `tasks/task-R*.md`, or other
legacy kernel artifacts keep their installed adapters and original layout.
Preserve `task_registry`, `semantic_model`, `planning_depth`, lane,
`execution_tier`, machine authority, typed topology, separate receipts, and
feature closeout files. Do not migrate them as part of unrelated documentation
work.
