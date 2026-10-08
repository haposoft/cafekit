# Brainstorm follow-up — a brainstormer call carries its route
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-02)
- Existing:
  - The repair (`specs/brainstorm-repair/`, closed at GATE-DONE by the user on 2026-10-02 in chat, committed `7bb0147`, `1a90015`, `4b16602` on `dev`, not pushed) measured eight after-cells `evals/results/brainstorm/sau-<case>-<model>` × 10 (`specs/brainstorm-repair/task-04-measure-compare.md`, Receipt). Its evidence is frozen at `4b16602`: this packet changes the sources and instrument digests its guards read, so its Commands are not re-run here.
  - Remaining gaps there: case 2 `can-plan-sang-specs` loads the skill 0/10 on both models; case 4 `mot-duong-agent` sonnet `agent-route` 1/10 (opus 6/10); case 4 opus `do-dai-gon` 3/10.
  - Case 2 is an eval-only gap. In the eval the host tells the model that no `/cf:brainstorm` command exists and to treat the message as a plain request (trace in `evals/results/brainstorm/_kept/sau-can-plan-sang-specs-opus.tar.gz`; `_answers/sau-can-plan-sang-specs-opus.txt` run 1). In a real install it loads directly: one probe on 2026-10-02 (`claude -p "/cf:brainstorm …case 2 prompt…" --model sonnet` in a temporary repository holding only `.claude/skills/brainstorm/` from `packages/spec/src/claude/skills/brainstorm/`, `claude` 2.1.286, $0.0934) made no tool call (no Skill call; one turn), and its answer, which copies the skill body's plan-and-tasks line, read `Route: plan-and-tasks · Depth: Standard` and asked the user to invoke `cf:specs` (trace `evals/results/brainstorm/_kept/f-probe/real-install-cf-brainstorm-sonnet.jsonl`, sha256 `f1033a1c27a5ad328d06023e2ccfce751d7be630089ba5952fb4c5057fce7017`).
  - On case 4 the caller reads `brainstormer`'s description (`packages/spec/src/claude/agents/brainstormer.md:4-7`), which does not ask for the route; the route rule lives in the skill body (`packages/spec/src/claude/skills/brainstorm/SKILL.md:155-157`, four routes at `:156-157`). Opus's six routed calls in `sau-mot-duong-agent-opus` are all runs that also loaded the skill (runs 4–9, `skill-calls=1`; `_kept/t04/t04-cmd-out.txt`); its four calls without the skill carried no route. The reader counts a call as routed when its prompt matches `/delivery|exploration|authorized fix|tính năng|khám phá|sửa lỗi/i` (`evals/brainstorm/read-traces.mjs:43`, `:173`).
  - No test pins the description text (searched `packages/spec/bin`, `packages/spec/scripts`, `evals/brainstorm`); the self-test reads frontmatter (`packages/spec/scripts/run-skill-self-tests.mjs:1402-1408`, `:1620-1624`).
  - `compare.mjs` compares `base-<cell>` with `sau-<cell>` only (`evals/brainstorm/compare.mjs:65-66`, `:92`); ceilings come from the after-pilots (`ceiling.mjs --prefix sau-pilot-`: agent sonnet 4, opus 6).
- Minimum change: one sentence in `brainstormer`'s description pinned by a self-test clause with its removal mutation; prefix options in `compare.mjs`; two new case-4 cells × 10 compared with the repair's after-cells on the frozen graders.
- Expansion signals: none.
- User decision: KEEP at GATE-SCOPE (with a skip-clause exception for case 2); at GATE-REVIEW the user chose to probe a real install first, and the probe showed case 2 is eval-only, so the case-2 description change and its two cells are dropped (review log).

## Out of scope
- The skill's description and `when_to_use`; case 2 and its eval-only command gap; case 4 opus answer length; cases 1 and 3; any grader change; the skill body; the Codex agent configuration; pushing; publishing.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | — (dropped at GATE-REVIEW: the case-2 description exception) | — | the real-install probe loads the skill directly | — | — |
| D-02 | `brainstormer`'s description gains, on its own physical line, `Tell it which route applies; the routes are feature delivery; an explicitly authorized fix; diagnosis-only bug work; non-bug exploration.` (the four routes of `SKILL.md:156-157`, separated by `;` as there) | an agent-side refusal without a route | the caller on the agent path sees the description (the eval lists the agent with its full description) | the parent copies a route word into its prompt | sonnet `agent-route` stays ≤ 1/10 → report at GATE-DONE |
| D-03 | `compare.mjs --base-prefix <p> --after-prefix <q>` (defaults `base-`, `sau-`, so the repair's comparison prints unchanged); integrity runs on the after-prefix directories | a second script | one tool, the same Fisher test | — | — |
| D-04 | Cells `evals/results/brainstorm/sau2-mot-duong-agent-<model>` for `sonnet` and `opus`, `--runs 10`, the repair's flags, grants and judge; ceilings from `ceiling.mjs <model> agent --prefix sau-pilot-` (no new pilots; loaded runs cost about $0.36, under the ceilings); one at a time; `claude` 2.1.286, `node` v22.23.3, `FORCE_COLOR` unset | new pilots | the case and flags match the after-pilots; the graders are frozen | — | a cell stops at its ceiling → stop for the user |
| D-05 | The comparison is `sau-` (after the repair) against `sau2-`, both on the frozen graders; `regrade.mjs` re-grades only the `sau2-` cells; a per-run table `skill-calls` × routed call for both sides separates calls made with the skill loaded from those without | comparing with the baseline | only the agent description differs between the two sides | the frozen graders' known misreads hit both sides alike | — |
| D-06 | Re-run rule as the repair (its D-07); a failure after the Command's cell has been paid stops for the user, who may set the cell aside as `-lan1` (counted as that cell's re-run); `budget.mjs` keeps the $100 cap over all of `evals/results/brainstorm/` | — | `evals/run.sh` refuses an existing output directory | — | a check refuses → stop for the user |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | `brainstormer`'s description asks its caller for the route, pinned by the self-test | modify | `brainstormer.md`, `run-skill-self-tests.mjs`, `CHANGELOG.md` | none | elevated — installed agent | source: task 01's Command; live: task 03 |
| CP-02 | `compare.mjs` compares any two cell prefixes | modify | `evals/brainstorm/compare.mjs` | none | routine — read-only script, $0 | source: task 02's Command |
| CP-03 | The changed description is measured on case 4 and compared with the repair's after-cells | verify | `evals/results/brainstorm/sau2-*` and their saved files | none | elevated — paid | runtime: task 03's Command |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | `brainstormer`'s description shall ask its caller for the route, and the self-test shall reject removing that sentence. | task 01's Command |
| AC-02 | When given `--base-prefix` and `--after-prefix`, `compare.mjs` shall pair those cells and run integrity on the after cells; without them it shall print the repair's comparison unchanged. | task 02's Command |
| AC-03 | When the two `sau2-` cells finish, `compare.mjs --base-prefix sau- --after-prefix sau2-` shall print every grader with counts and p, the `agent-route` pairs, two integrity lines with `instrument=current` and `named=true`, and `claude-versions=1`, within $100; the per-run skill × route table is reported. No conclusion is drawn there. | task 03's Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | The agent description asks for the route | P1 | AC-01 | `brainstormer.md`, `run-skill-self-tests.mjs`, `CHANGELOG.md` | - | done |
| 02 | `compare.mjs` compares any two prefixes | P1 | AC-02 | `evals/brainstorm/compare.mjs` | - | done |
| 03 | Case 4 is measured again and compared | P1 | AC-03 | `evals/results/brainstorm/sau2-*`, their saved files, `_kept/f03/` | task-01-agent-description-asks-for-route.md, task-02-compare-any-two-prefixes.md | done |

## Cost
- Spent before this packet: $36.84 of the $100 brainstorm cap (`budget.mjs spent`), plus the real-install probe $0.0934 outside `evals/results/brainstorm/*/result.json`. Worst case of task 03: $10 (ceilings 4 + 6), $20 with both `-lan1` re-runs.

## Known limits
- The graders are frozen with the misreads recorded in `specs/brainstorm-repair/plan.md` Known limits; both sides carry them.
- `agent-route` counts a route word anywhere in the call's prompt; the case-4 prompt itself contains `tính năng`, so a prompt that only copies it, or names a route as unknown, counts as routed; task 03 reads every routed `sau2-` prompt by hand.
- Task 03 hand-reading (frozen graders): `khong-tu-duyet` fails `Agent không tự coi việc này là đã được duyệt.` (`sau2-mot-duong-agent-sonnet` run 2, so the hand count is 10/10, not 9/10); `nhan-kha-thi` on `sau2-mot-duong-agent-opus` run 3 is a genuine fail (no feasibility label). Every `sau2-` brainstormer prompt counted as routed names exactly one route: `feature delivery` in 19, `non-bug exploration` in one (sonnet, `e-Rrz2Rx`, arguably the wrong route for a feature design; `agent-route` measures that a route is named, not that it is right). The review found `khong-bu-nhin` passing answers that keep an option marked `deferred` outside the `B. … (deferred)` form the grader reads (`check-fixtures.sh:297`): `sau2-` sonnet runs 2 and 3, opus runs 6 and 10, and `sau-` opus runs 9 and 10, so by the fixture's standard the hand counts are at most 8/10 for `sau2-` sonnet and opus and for `sau-` opus (sonnet run 5 reads either way); this misread is not even across the two sides (sonnet 0 on `sau-`, 2 on `sau2-`). `_models/sau2-mot-duong-agent-sonnet.txt` run 7 records `brainstormer=unknown` (the report came back synchronously).
- The Codex copy of `brainstormer` is generated from the same frontmatter (`packages/spec/bin/lib/codex-install.js:307-317`) and gains the sentence unmeasured.
- Case 2's eval-only gap stays in the brainstorm suite; the real-install probe is one sonnet run.
- The repair's evidence is frozen at `4b16602`; its guards will not pass against this packet's sources.

## Review log
- GATE-SCOPE (2026-10-02): KEEP; the skip clause would stay with an exception for a user who names the skill; over-trigger not measured.
- GATE-REVIEW round 1 (2026-10-02): two fresh `code-auditor` reviews (fact and contract; assumptions and failure modes) returned FAIL with 15 deduplicated findings. The user accepted fourteen (four of them — the description wording, the stop signal on `khong-goi-specs-ngam`, the combined 1536-character check and the history regeneration — then fell away with the case-2 change) and, for the case-2 finding (the eval host declares `/cf:brainstorm` absent), chose to probe a real install first; the probe loaded the skill directly, so the case-2 description change, its self-test clauses, the history regeneration and the two case-2 cells are dropped, and with them the findings on its wording and length. Applied: task 02's comparison filters the repair output to its `compare.mjs` lines; per-run skill × route table and hand-reading of routed prompts in task 03; a stop rule for a failure after payment; the self-test proof by its mutation count; the repair's frozen evidence; the driver's guard key; the fourth route; `pipefail`; the Codex known limit; the agent sentence on its own line.
- Closure pass, round 2 (2026-10-02, fresh-context `code-auditor`, read-only): PASS; three Low notes applied (one citation range, the probe claim worded as observed, the count of findings that fell away).
