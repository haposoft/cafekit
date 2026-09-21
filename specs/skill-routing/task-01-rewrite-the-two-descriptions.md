# Task 01 — Both descriptions cover the under-specified request and divide the doors observably

Status: pending

## Outcome
`packages/spec/src/claude/skills/specs/SKILL.md:3` and `packages/spec/src/claude/skills/brainstorm/SKILL.md:3` each carry a rewritten `description` that brings the request which does not yet say enough to act on inside one of the two doors, and that separates the doors by a condition a reader can check rather than by how abstract the work sounds. The self-test suite still passes and the eval suite still loads.

## Scope
- In: the single `description:` line of each of those two files, and nothing else on either line's neighbours.
- Out: the body of either skill, `when_to_use`, `keywords`, `category`, `argument-hint`, `name`, the other thirty skills, `rules/skill-domain-routing.md`, the eval suite, and the gitignored `.claude/` and `.agents/` copies.

## Coverage
- CP-01
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/specs/SKILL.md`, `packages/spec/src/claude/skills/brainstorm/SKILL.md`
- Read: `specs/specs-a-plus/task-10-measure-with-both-doors.md` for what the unrouted runs actually did, `evals/specs/mo-ho-du-cua/case.yaml` for the prompt being routed, `packages/spec/scripts/run-skill-self-tests.mjs:2719-2720` and `:4258-4263` for what the frontmatter must keep

## Steps
1. Before drafting anything, write the separating condition down in one sentence, together with the door it names for each of three prompts already in the repository: `evals/specs/sua-typo` (expected: no door), `evals/specs/khong-kich-hoat` (expected: no door), and `evals/specs/mo-ho-du-cua/case.yaml:12` (expected: one of the two doors). Registering the verdicts first is what makes AC-02 able to fail; a condition invented after the lines are written can always be said to fit them.
2. Read both current descriptions and the prompt in `evals/specs/mo-ho-du-cua/case.yaml:12`. Write down, before editing, which clause of the current `cf:specs` description an unrouted run could have read as permission to answer directly.
3. Draft both lines. The `cf:specs` line must keep every commitment it already makes — it produces a bounded plan and flat task files, it never writes code, it holds three human gates — because those are the claims the packet just closed measured as true. The new material is the under-specified request and the separating condition.
4. Draft the `cf:brainstorm` line against the same condition from the other side, so that a reader given the condition and a request can say which door it names. A description that merely sounds more welcoming is not a separating condition. This line may name `cf:specs` but must not put a coordination verb near it — `invoke`, `start`, `dispatch`, `launch`, `route`, `forward`, `run`, `execute` or `hand off` within reach of `specs` or `develop` triggers `handoff-boundary` (`run-skill-self-tests.mjs:1719-1720`) because the frontmatter is not stripped from the semantic corpus (`:1392-1398`), and that fails all 1366 tests.
5. Check the frontmatter invariants by hand before running anything: both `description:` values single-line and non-empty, `argument-hint` untouched in both files, `name` untouched, line counts of both files unchanged, neither line containing `--status`, `--validate`, `--archive` or the word `lane` (`run-skill-self-tests.mjs:4264`, `:5525`), and the brainstorm line free of the verb-near-door pattern above.
6. Run the Command. Compare the observed output with the Oracle; the run does not judge the wording, it judges that nothing pinned broke.

## Acceptance
- AC-01 and AC-03 as stated in `plan.md`.
- AC-02: the condition and its three registered verdicts are written before drafting; both rewritten lines are quoted in the Receipt; and the Receipt applies the condition to all three prompts and reports the door each one names. A condition that routes the typo prompt to a door fails this task.
- Both files still have the same number of lines as before the edit, and `git diff --stat` shows exactly two files with one changed line each.
- **No claim about routing behaviour is made here.** Whether the rewrite moves the counts is task 02's measurement and GATE-DONE's reading.

## Dependencies
- none

## Verification Plan
- Command: `cd packages/spec && node scripts/run-skill-self-tests.mjs && cd ../.. && evals/run.sh specs --with-skill brainstorm --validate`
- Named probe: `cf:specs frontmatter exposes only feature-description input` (`run-skill-self-tests.mjs:4258`), the `description:` and `argument-hint` assertions at `:2719-2720`, and the `stays lean` line-count check
- Reachability: known — the same suite ran on every task of `specs-a-plus`, and the `--validate` path ran in its task 09
- Oracle: the suite prints `[skill-test] PASS` and exits 0, taking about ten minutes; `--validate` exits 0, lists seven cases, and prints no `✗`; `git diff --stat` reports two files changed with one insertion and one deletion each
- Counterexample: blanking either `description` value, or reflowing it onto two lines, fails the frontmatter probe; changing `argument-hint` fails `:4263`; putting a coordination verb near `specs` in the brainstorm line fails `handoff-boundary` at `:1719-1720`. The chain is joined with `&&` throughout, so any of these stops it with a non-zero exit instead of being masked by a later success — with `;` the self-test could fail while the chain still exited 0
- Artifacts: none; both commands print their evidence to stdout, which is copied into the Receipt

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If a probe turns out to pin part of a description after all, that is new evidence about the constraint and not a reason to edit the probe: record it and return to GATE-SCOPE.

## Receipt
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
