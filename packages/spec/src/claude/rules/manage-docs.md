# Documentation & Planning Standards

## Living Documents

When the project keeps these core documents in `./docs`, keep them current (a project may have only some of them):

| Document | Purpose |
|----------|---------|
| `development-roadmap.md` | Phase tracking, milestones, and progress metrics |
| `project-changelog.md` | Chronological record of features, fixes, and changes |
| `system-architecture.md` | Technical architecture and design decisions |
| `code-standards.md` | Coding conventions and quality expectations |

### Freshness Rule

- Before updating any doc, check its last modified date

## When to Update

The `docs-keeper` agent is responsible for keeping these documents current. Trigger an update whenever:

- A development phase transitions (e.g., "In Progress" → "Complete")
- A verified task completion changes user-facing behavior, architecture, API contracts, operational flow, or project status enough that docs should be refreshed
- A significant feature ships or a critical bug is resolved
- Security patches are applied or dependencies change
- Project scope or timeline shifts

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
- Feature description (#PR-number when there is one)

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

Task status, the inline `## Receipt` and its proof contract are defined in
`state-sync.md`.

Sync only observed state with surgical edits. Re-read the changed task after
every update; never infer missing proof, approval, or readiness. When a done
task changes user-facing behavior, architecture, API contracts, operations, or
project status, classify docs impact and update only affected existing docs.

Comply with the overarching rules in `ai-dev-rules.md`.
