# Specs fast lane — measure over-routing first, widen direct work only if it is real
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-06)
- Existing:
  - The direct-work rule is at `packages/spec/src/claude/skills/specs/SKILL.md:23-24`. It reads: "Work directly only when the cause and change are clear, isolated, reversible, `routine`, and likely limited to one or two files."
  - The description is at `SKILL.md:3` (1018/1024 characters). Its skip clause carries the same limit, and its trigger also says "anything touching more than one or two files".
  - Both clauses are pinned verbatim as `frontmatterGate` and `directGate`, together with mutation cases that quote "one or two files":
    - `packages/spec/scripts/run-skill-self-tests.mjs:704-705,922-925,5637`;
    - `packages/spec/bin/__tests__/codex-native.test.js:164-165,1289-1292`;
    - `packages/spec/bin/__tests__/package-inventory.test.js:93-94,1314-1317`.
  - `packages/spec/src/claude/skills/develop/SKILL.md:47` has a looser copy of the rule.
  - No measurement has ever shown specs over-routing safe multi-file work.
  - The previous packet left two limits open: `mo-ho-*` has not been measured with the new description (`0478881`), and "do not implement it yourself" has not been tested under `/cf:develop`.
  - `evals/develop/mot-task-sach` holds a working `/cf:develop` case: its fixture packet, git commit, `provenance.cjs`, a red test, and 30 turns / 1200 s.
- Law C2: the rule changes only after a measured failure.
- Minimum change:
  - (A) add three cases;
  - (B) measure them with the current skill, together with `mo-ho-c1` and `mo-ho-du-cua`;
  - (C) repair, only when (B) shows a failure, and only on the failing surface, then measure again.
- Expansion signals: none. About 14 files for (A)/(B), counting the case fixtures and `compare.mjs`. (C) adds about 8 more.
- User decisions:
  - GATE-SCOPE: KEEP, with 10 runs per cell.
  - GATE-REVIEW: accept all 14 findings (see Review log).

## Out of scope
- Any change to critical routing: auth, data and money stay with specs (`0478881`).
- `references/*`, other skills' text, existing cases and graders, `evals/run.sh`, npm publish, push.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Three new cases. <br>**Direct cases.** Both copy the `sua-typo` fixture. Their `scaffold.sh` copies it and then makes one git commit (the `evals/develop/mot-task-sach/scaffold.sh` git lines), so every change can be reverted. Each has `max_turns: 8`, `timeout_seconds: 300` and `allowed_tools: [Read, Glob, Grep, Skill]`. <br>• `lam-thang-doi-ten`. The fixture adds `src/format.js` with a module-internal helper `fmtName`, exported only for the app's own files. It is used by `src/customers.js`, a new `src/report.js` and `test/format.test.js`. `package.json` stays `private: true`, so no external consumer exists. Prompt: "Đổi tên hàm `fmtName` trong src/format.js thành `formatCustomerName` và sửa mọi chỗ gọi nó. Làm luôn đi." Graders: `khong-goi-specs` (copy of `sua-typo`), `da-doi-ten` (Edit, `input_match: 'formatCustomerName'`, `min: 1`), `da-doi-ten-w` (Write, same match, `min: 1`). <br>• `lam-thang-xoa-module`. The fixture adds `src/legacy-export.js`, which `src/app.js` requires but never uses, and `test/legacy-export.test.js`. Prompt: "Module src/legacy-export.js đã chết, không route nào dùng. Gỡ nó: bỏ dòng require trong src/app.js, xoá file module và test của nó. Làm luôn đi." Graders: `khong-goi-specs`, `bo-require` (Edit, `input_match: '"file_path":"[^"]*src/app\.js"'`, `min: 1`), `bo-require-w` (Write, same, `min: 1`). <br>**`develop-auth`.** The `evals/develop/mot-task-sach` scaffold pattern: fixture copy, `provenance.cjs`, git commit. Fixture is `package.json`, a pure `src/google-login.js` stub `matchGoogleUser(profile, users)` returning `null`, a red `test/google-login.test.js` (verified email matches a user → that user; unverified or unknown → `null`), and an accepted process-first packet `specs/google-login/` with one `pending` task that owns `src/google-login.js` and has the Verification Plan `node --test test/google-login.test.js`. Prompt: "/cf:develop google-login". `max_turns: 30`, `timeout_seconds: 1200`, allowed tools as `mot-task-sach`. Graders: `khong-goi-specs`, `co-sua-src` (Edit, `/src/`, `min: 1`), `co-viet-src` (Write, `/src/`, `min: 1`), `dung-blocked` (copy of the `mot-task-sach` regex, pointed at `specs/google-login/task-01-google-login.md`) | Edit-only graders; a destructive delete without git; a shared exported contract | false fails and Step 0's own critical/elevated floor would make the direct cases unfair (review F5, F7) | — | `run.sh --validate` warns on a new case → fix before task 02 |
| D-02 | Every invocation follows `specs/specs-routing-repair` D-02 (guards use its digest command, `plan.md:16`), with three changes: <br>• `lam-thang-xoa-module` and `develop-auth` add `Bash` to `--allow-tools`; <br>• `develop-auth` adds `--with-skill develop` right after `--with-skill brainstorm`; <br>• budget: `--skills specs --cap 90` (spent $47.83). | — | settled method | the host stays 2.1.289 | — |
| D-03 | Baseline cells `lean-fl-goc-<case>-<model>`, 10 runs each, for `lam-thang-doi-ten`, `lam-thang-xoa-module`, `develop-auth`, `mo-ho-c1` and `mo-ho-du-cua`, × sonnet and opus. `--max-cost-usd` is 5, or 12 for `develop-auth` | — | — | — | a cell partial or with a non-turn-cap error → rerun once as `<cell>-lan1` |
| D-04 | `evals/specs/fast-lane-decision.mjs` prints the pre-registered decision. <br>• **Direct-done** (one run of a direct case): no specs Skill call, and at least one of its two action graders passed. <br>• **Over-routing** (per model, pooled over both direct cases, n=20): `over-routing=yes` when direct-done ≤16/20. <br>• **develop-auth wrongly stopped**: a run that invoked specs, or that wrote nothing to `src/` (neither `co-sua-src` nor `co-viet-src`) and did not mark the task blocked. <br>• **develop-blocked** (per model): `develop-blocked=yes` when 3 or more of 10 runs were wrongly stopped. The script also prints, per model, the `src/` writes, the blocked count and the turn-cap count. <br>• **`mo-ho-drop`** lists any grader shared with `lean-re-*` that drops by 3 or more runs. It is report-only. <br>Thresholds are directional (review F12). <br>When either flag is `yes` and the task 02 Receipt shows it, the controller runs `/cf:sync` to clear the Blocker of tasks 03 and 04 and set them `pending`. A new `/cf:develop` then continues. Otherwise both stay `blocked`, and GATE-DONE closes on the measurement | a judgement read | C2 needs a failure that is cited and decided before the numbers exist | — | — |
| D-05 | Task 03, only when promoted, repairs only the surface that failed. <br>• **Over-routing.** The direct-work rule names signals instead of a file count: one subsystem, reversible (tracked in version control), verifiable now, a small diff. It lists typical direct work: fully specified, mechanical or rename, docs- or test-only, revert, removing named dead code, a clear config value, an in-scope review finding, logging without behaviour change. It names tripwires that send work back to Specs. Critical risk is never direct; "destructive" keeps meaning data or production state. The change is applied in `SKILL.md:23-24`, in both description clauses that count files (trigger and skip, ≤1024 characters), in `develop/SKILL.md:47`, and in the pins of the three test files. <br>• **develop-blocked.** The description scopes "do not implement it yourself" to work that has no accepted plan, and the pins follow | rewriting both surfaces when only one failed | rules pay rent | — | a pin cannot be moved without weakening its mutation → stop and ask the user |
| D-06 | Task 04 measures `lean-fl-sau-*` on two groups. <br>• The failing cases from task 02, with baseline `lean-fl-goc-*`. <br>• The guards `dung-o-c1` (sonnet 20 runs) and `sua-nho-lam-luon`, with baseline `lean-sau-*` (current description, review F3), and `mo-ho-du-cua`, with baseline `lean-fl-goc-*`. <br>Each group is compared with `evals/lean/compare.mjs --skill specs --base <prefix> --after lean-fl-sau-`. | baseline `lean-goc-*` | it predates `0478881` | — | any `REGRESS` → named at GATE-DONE |
| D-07 | `evals/lean/compare.mjs` gains `--base <prefix>` (default `lean-goc-`). Its `specs` table classifies the new graders: <br>• primary: `da-goi-mot-skill`, `khong-tu-chot`, `co-marker`, `mot-cau-hoi-c1`; <br>• watch: `da-doi-ten`, `da-doi-ten-w`, `bo-require`, `bo-require-w`, `co-sua-src`, `co-viet-src`, `dung-blocked`, `da-goi-specs`, `da-goi-brainstorm`. <br>One self-test covers `--base` | a new helper | task 04 cannot run otherwise (review F2) | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | three cases can show over-routing and a wrongly stopped develop run; compare can read any baseline prefix | cases, fixtures, graders, helper | `evals/specs/{lam-thang-doi-ten,lam-thang-xoa-module,develop-auth}/`, `evals/lean/compare.mjs` | none | routine — eval instrument | `run.sh --validate`, compare self-test |
| CP-02 | the current skill is measured on five cases and the pre-registered decision is printed | paid runs, decision script | `evals/results/specs/lean-fl-goc-*`, `evals/specs/fast-lane-decision.mjs` | none | elevated — paid runs | runtime: 10 clean cells |
| CP-03 | the observed failure is repaired on its own surface | skill text, pins | `skills/specs/SKILL.md`, `skills/develop/SKILL.md`, 3 test files, changelogs | none | elevated — installed skill | source: self-test, node suite, body check |
| CP-04 | the repair is measured | paid runs | `evals/results/specs/lean-fl-sau-*` | none | elevated — paid runs | runtime: cells and `compare.mjs` |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | The three new cases shall load without warnings under the D-02 grants and carry the D-01 graders. `compare.mjs` shall accept `--base` and classify the D-07 graders, and its self-test shall pass. | task 01 Command |
| AC-02 | The current skill shall be measured in 10 clean cells, and the decision script shall print the `over-routing`, `develop-blocked` and `mo-ho-drop` lines. | task 02 Command |
| AC-03 | When task 02 reports a failure, only the failing surface shall be rewritten per D-05. Critical routing shall stay unchanged, the body shall change only in the direct-work paragraph, and the self-test and node suite shall pass. | task 03 Command |
| AC-04 | When task 03 is done, the repair shall be measured per D-06 and compared for GATE-DONE. | task 04 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Add the three cases and teach compare a base prefix | P1 | AC-01 | `evals/specs/{lam-thang-doi-ten,lam-thang-xoa-module,develop-auth}/`, `evals/lean/compare.mjs` | - | done |
| 02 | Measure the current skill and decide | P1 | AC-02 | `evals/results/specs/lean-fl-goc-*`, `evals/specs/fast-lane-decision.mjs` | task-01 | done |
| 03 | Repair the failing surface | P1 | AC-03 | `skills/specs/SKILL.md`, `skills/develop/SKILL.md`, 3 test files, changelogs | task-02 | blocked |
| 04 | Measure the repair | P1 | AC-04 | `evals/results/specs/lean-fl-sau-*` | task-03 | blocked |

## Known limits
- The direct cases cover two shapes of mechanical work. A clean result does not prove that other shapes (docs-only, revert, config) route directly.
- `lam-thang-doi-ten` renames an exported helper inside a private app. A strict reader may still call that `elevated`.
- Under the current Step 0 text ("likely limited to one or two files", and a delete that a strict reader may call destructive), routing either direct case to specs is compliant. So `over-routing=yes` measures whether the file-count rule is too strict, not whether the model broke the rule (task 01 review).
- `khong-goi-specs` matches any Skill input containing "specs" (for example `specs/google-login` passed to develop). The decision script therefore reads the invoked skill's name from the trace.
- The develop rule sees only Edit and Write. A run that writes `src/` through Bash (sonnet `develop-auth` run 7: `cat > src/google-login.js`) counts as wrongly stopped, so that count can only be too high. `loaded.txt` of `develop-auth` checks specs only; develop loaded 10/10 in both models (`loaded.mjs develop`, task 02 review).
- `develop-auth` measures whether implementation starts, not whether the task closes with a Receipt.
- The `mo-ho-*` comparison is against `lean-re-*`, which ran on the description before `0478881`, on the same host.
- With 20 pooled runs, the ≤16 threshold is directional.

## Cost
- Direct and `mo-ho` cells cost about $1–2 each.
- `develop-auth` cells cost about $3–6 each.
- Baseline: about $25. Task 04, if promoted: about $20.
- Budget cap: `--cap 90`.

## Review log
- Round 1 (2026-10-06, one fresh reviewer): 14 findings (2 Critical, 6 High, 4 Medium, 2 Low). The user accepted all of them at GATE-REVIEW. Applied:
  - F1, F4: `develop-auth` uses the `evals/develop` scaffold, has a red test, and runs 30 turns / 1200 s.
  - F2: `--base` and new grader classes in `compare.mjs`, owned by task 01.
  - F3: guard baselines are `lean-sau-*`.
  - F5, F6: Write graders, `khong-goi-specs` and `dung-blocked` on `develop-auth`, and the wrongly-stopped rule.
  - F7: git in the direct-case scaffolds, a private internal helper, and a clarified meaning of "destructive".
  - F8: the trigger clause is added to D-05.
  - F9: the direct-done pair.
  - F10: Commands print digests.
  - F11: a node body check and the critical-in-direct check.
  - F12: pooled, directional thresholds; `mo-ho-drop` is report-only.
  - F13: the promotion line.
  - F14: flag order.
- Paper review closed.
- **GATE-DONE (2026-10-06): the user accepted the packet as complete** ("XONG, commit + push"). The pre-registered decision was `over-routing=no` (direct-done 20/20 in both models), `develop-blocked=no` (`/cf:develop` implemented 10/10, one of them through Bash) and `mo-ho-drop=none`. Under C2 the direct-work rule stays as it is, and tasks 03 and 04 stay `blocked` because no failure promoted them. Spend was $14.55 for this packet and $62.38 cumulative, under the $90 cap.
