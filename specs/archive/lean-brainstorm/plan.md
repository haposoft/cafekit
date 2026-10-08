# Lean brainstorm — join hard-wrapped prose, words unchanged
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-06)
- Existing:
  - `packages/spec/src/claude/skills/brainstorm/SKILL.md` is 221 lines (180 non-blank) with no step skeleton, no mermaid and no `✓ Step`; its sections (Control flags, Front-door routing, Adaptive analysis depth, Contract and evidence, Discovery Question Framework, Options, Delivery design and approval, Persistence and handoff, Completion bar) are already constraints and output standards. 72 contract clauses are pinned by the self-test (`packages/spec/scripts/run-skill-self-tests.mjs:1295`), 52 of them in this file and 10 in `references/question-framework.md` (170 lines).
  - Most of the length is hard-wrapped prose: joining it takes `SKILL.md` to about 110 lines with every word kept (user preference: no hard wrap).
  - The self-test checks only an upper bundle line budget for these files (`run-skill-self-tests.mjs:2072-2079`); fewer lines pass it.
  - Three eval cases replay a history that embeds `SKILL.md` (`evals/brainstorm/make-history.mjs`); `make-history.mjs --check` fails when the skill bytes change, so the histories are regenerated with the skill.
  - Eval readers expect the plugin name `cafekit-brainstorm` (`evals/brainstorm/read-traces.mjs:40-41`).
- Minimum change: join hard-wrapped prose lines in `SKILL.md` and `references/question-framework.md` outside frontmatter, gate blocks, code fences and tables, with a word-for-word identity check; regenerate the three histories; a light confirmation run before and after.
- Expansion signals: none.
- User decision: CUT — only join lines, no wording change; light confirmation (probe plus one case per model, about $8).

## Out of scope
- Any wording change, the Deep lens list, the handoff headings, the Domain Matrix, `agents/brainstormer.md`, graders, `evals/run.sh`; push (decided at GATE-DONE; earlier brainstorm packets were commit-only).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Join a line into the previous one only when it is a plain-prose continuation (it does not start a block: not blank, not a heading, not a list marker `-`/`*`/`N.` at any indent, not a table row, not a fence, not a `<…>` tag), outside frontmatter, gate blocks and code fences; two invariants against `git show 19c2dd0:<file>`: the whitespace-normalised word stream is identical, and the ordered sequence of block-start lines (blank, `#`, list markers with their indent, `|`, fences, `<` tags), compared without line numbers, is identical | rewording | user decision at GATE-SCOPE | line breaks inside prose carry no meaning for the model | a word-stream difference → stop and repair before anything else |
| D-02 | Confirmation runs, both sides fresh, one lane per model: `ne-cau-hoi` (history case) `--runs 5` for sonnet and opus as `lean-goc-*` before the edit and `lean-sau-*` after; after the edit also the probe `tham-do-nap-skill` sonnet `--runs 1` (`read-traces.mjs --probe` reads only the first run) (`lean-sau-tham-do-nap-skill-sonnet`, the HARD-GATE first line quoted from the replayed history). Each: `export PATH=/opt/homebrew/opt/node@22/bin:$PATH DISABLE_AUTOUPDATER=1; unset FORCE_COLOR; evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out <name> --model claude-<sonnet\|opus>-5-5 --judge-model claude-sonnet-5-5 --runs <n> --threshold 0 --ablation none --max-cost-usd <c> --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --case <case> --keep-temp` (plugin name left at `cafekit-brainstorm` for the readers) | the full 8-cell comparison | words are unchanged, so this checks loading and gross behaviour only | — | a run not clean, a run whose session transcript lacks a line that exists only in the joined `SKILL.md`, or a grader count falling by 2+ runs → named at GATE-DONE |
| D-03 | Evidence per cell: `host.txt` (claude version before/after) and `node evals/brainstorm/read-traces.mjs <dir>` output saved as `<dir>/traces.txt` right after the run (kept temp directories vanish on reboot); spend by `node evals/lean/budget.mjs --skills brainstorm --cap 20` | the brainstorm suite's $100 budget (already used by earlier packets) | per-packet cap | — | a check above the cap → stop for the user |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | brainstorm's two files are shorter with every word unchanged, histories in sync, self-test green | text layout, eval history | `skills/brainstorm/SKILL.md`, `references/question-framework.md`, `evals/brainstorm/*/history.jsonl` | none | elevated — installed skill | source: word-stream identity, `make-history.mjs --check`, full self-test |
| CP-02 | the joined skill still loads from the replayed history and behaves the same on one case per model | paid runs | `evals/results/brainstorm/lean-*` | none | elevated — paid runs | runtime: saved `traces.txt` per cell |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | The current brainstorm shall be measured on `ne-cau-hoi` with sonnet and opus before any edit. | task 01 Command |
| AC-02 | Both files shall have fewer lines with an identical word stream, the three histories shall match the new skill, and the full self-test shall pass. | task 02 Command |
| AC-03 | The replayed history shall carry the joined `SKILL.md` (shown by the digest chain of the task 03 Execution note: guarded `evals/brainstorm` digest `9fb691b9e613811a` covering three histories that hold the joined marker line), the probe shall quote the HARD-GATE line, both sides shall run on one host version, and `ne-cau-hoi` shall run cleanly in both models; counts are compared at GATE-DONE. | task 03 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Measure the current brainstorm on one case | P1 | AC-01 | `evals/results/brainstorm/lean-goc-*` | - | done |
| 02 | Join the hard-wrapped lines and regenerate histories | P1 | AC-02 | `skills/brainstorm/SKILL.md`, `references/question-framework.md`, `evals/brainstorm/*/history.jsonl` | task-01 | done |
| 03 | Confirm the joined skill | P1 | AC-03 | `evals/results/brainstorm/lean-sau-*` | task-02 | done |

## GATE-DONE report
- Line counts before/after per file and the word-stream identity result; per-grader counts of both sides from the saved `traces.txt`.

## Known limits
- Five runs a side on one case at its ceiling detect only a large collapse (≥4 of 5 runs); the packet can conclude that the joined skill loads, runs cleanly and does not collapse on `ne-cau-hoi`, not that behaviour is unchanged elsewhere (other cases, the agent path).
- `references/question-framework.md` is not in the replayed history and `ne-cau-hoi` is unlikely to read it; its joined text is checked only by the two invariants.
- `skill-loaded=history` in `read-traces.mjs` reads the case's `history.jsonl`, not the run; the run-level proof is the joined-line check.
- The digests pinned by `specs/brainstorm-eval-baseline`, `brainstorm-repair` and `brainstorm-followup` Commands no longer match after this packet, so those Commands cannot be replayed by hand; their committed Receipts stay valid (structural check of unchanged committed task files).

## Cost
`sau-ne-cau-hoi-*` cost $0.75 (sonnet) and $1.52 (opus) for 10 runs; this packet ≈ $4–8. Cap $20.

## Review log
- Round 1 (2026-10-06, two fresh reviewers): 9 deduplicated findings — Critical: the `skill-loaded` regex (the reader prints `history:5,call:0,none:0`); High: nine `\n`-bearing mutation anchors in `codex-native.test.js`, structural merges invisible to the word check, `skill-loaded` being static, the 5×1 conclusion scope; Medium: host equality across sides, the history case names; Low: probe reads run 1 only, old brainstorm Commands no longer replayable. User at GATE-REVIEW: accept all as proposed. Applied to D-01, D-02, AC-03, Known limits and tasks 01–03. Paper review closed.
- Execution note (before task 02, 2026-10-06): the D-01 joiner leaves `references/question-framework.md` at 170 → 170 lines — it has no hard-wrapped prose (every line already starts a block or is a single-line paragraph); task 02 therefore changes only `SKILL.md` (221 → 121 in the scratch draft, both invariants met) and its Command checks that the framework file is unchanged instead of shorter. Controller correction from evidence, no scope widening.
- Execution note (task 02, repair round 1, 2026-10-06): the full self-test failed on `package-inventory.test.js` "packed Claude and Codex reject adaptive Brainstorm semantic weakenings" (`claude/direct-precedence anchor must exist`): that file holds twelve more `\n`-bearing brainstorm mutation anchors (`:201-234`) that neither reviewer listed. Same repair as the nine Codex anchors (each line break plus indent replaced by the single space the join produced; anchors of other skills untouched); task 02 ownership extended to that file for this edit only.
- Execution note (task 03, 2026-10-06): the run-level joined-line check could not observe anything — the kept run directories hold no copy of the replayed history (neither the old nor the joined `SKILL.md` text is found under them; `joined-seen.txt` reads 0/5 in both cells as a record). User decision "Thay bằng chuỗi digest": task 03's Command proves the replay through the chain instead — every invocation was guarded on `evals/brainstorm` digest `9fb691b9e613811a`, that digest covers the three regenerated histories, each history holds the joined marker line `segment. Accept \`--deep\``, `evals/run.sh` copies that case directory into the run, and the probe quoted the HARD-GATE line from the replay.
- **GATE-DONE (2026-10-06): the user accepted the packet as complete** ("XONG, commit (chưa push)"): `SKILL.md` 221 → 121 lines with words and structure identical, `question-framework.md` unchanged, 9 + 12 test anchors re-spaced, histories regenerated, full self-test 1603 PASS; goc and sau `ne-cau-hoi` counts identical in both models, probe quotes the HARD-GATE line; spend $2.4654 of $20. Commit, no push.
