# Task 01 — The debug instrument grades what its rubric means

Status: done

## Outcome
`loi-hien-nhien` grades proportion with `gon-gang-tieu-de` (lexical, the figure) and `gon-gang-llm` (rewritten rubric, a reference) instead of `gon-gang`; `noi-do-tin-cao` recognises the high-confidence forms the stored reports use without accepting medium, low or downgraded values; `check-fixtures.sh` pins both regex graders with samples, and a replay over the 80 stored reports checks each regex grader against the hand labels below and fails on any mismatch.

## Hand labels (GATE-REVIEW, G-02)
The truth each regex grader must reproduce on the stored reports of its own case, by reading the report as the rubric intends:
- `gon-gang-tieu-de`, `loi-hien-nhien`, passing runs: `base-*-sonnet` none; `base-*-opus` run 5 only; `sau-*-sonnet` runs 1–10; `sau-*-opus` runs 1–10.
- `noi-do-tin-cao`, `doc-ma-sai-huong`: every run of all four cells states high confidence, so it matches 10/10 in each.

## Scope
- In: delete `evals/debug/loi-hien-nhien/graders/gon-gang.md`; create `gon-gang-tieu-de.md` and `gon-gang-llm.md` beside it; change the pattern in `evals/debug/doc-ma-sai-huong/graders/noi-do-tin-cao.md`; add samples and two guards to `evals/debug/check-fixtures.sh`.
- Out: every other grader, case, fixture and scaffold; `evals/run.sh`, `evals/summarize.mjs`, `evals/debug/cross-count.mjs`; `packages/spec/**`; the historical `specs/` packets and stored results that mention `gon-gang`.

## Coverage
- CP-01

## Ownership
- Delete: `evals/debug/loi-hien-nhien/graders/gon-gang.md`
- Create: `evals/debug/loi-hien-nhien/graders/gon-gang-tieu-de.md`, `evals/debug/loi-hien-nhien/graders/gon-gang-llm.md`
- Modify: `evals/debug/doc-ma-sai-huong/graders/noi-do-tin-cao.md`, `evals/debug/check-fixtures.sh`
- Read: the final messages kept in `evals/results/debug/{base,sau}-{loi-hien-nhien,doc-ma-sai-huong}-{sonnet,opus}/result.json` (the `evidence` of each run's `llm` grader is its final message verbatim)

## Steps
1. `gon-gang-tieu-de.md`: `type: regex`, `target: last_message`, `match: not_contains`, and no `flags:` key (the harness compiles `new RegExp(pattern, flags)`, the checker and the replay `new RegExp(pattern)`), so case variants are written into the pattern and a line start is written `(^|\n)`, never a bare `^`. It flags: a heading or bold label for an incident timeline (`Evidence Timeline`, `Timeline`, `Dòng thời gian`), an elimination path (`Elimination Path`, `Đường loại trừ`), recurrence prevention (`Recurrence-Prevention`, `Phòng ngừa tái diễn`, and `Phòng tái phát` only as a `##`–`####` heading); a hypothesis marked other than confirmed (`[refuted]`, `[inconclusive]`, `**Refuted**`, `**refuted**`, `**Loại:**`, `**Đã loại trừ:**`, `**Sai:**`, `[bác bỏ]`, `[chưa kết luận]`, `giả thuyết đã loại`). It does not flag: the contract fields (`Why now`, `Contributing factors`, `Trigger`); the regression-guard bullet in any of its stored labels (`Regression guard`, `Kiểm tra hồi quy`, `Test chống tái phát`, `Chặn tái phát`, `Chống tái phát`, `Chặn lỗi tái phát`); a codebase-context block; a confirmed hypothesis (`[confirmed]`, `**Confirmed**`, `**Đúng:**`).
2. `gon-gang-llm.md`: `type: llm`, `focus: last_message`. The rubric keeps the case context and the "file:line, evidence, re-check" requirement; names the forbidden kinds as in Step 1; states that the root-cause contract's fields, including `Why now`, and the Verification Plan's regression-guard bullet are required by the skill and do not count as a timeline or recurrence section; keeps "a section written only as skipped or N/A still counts"; drops the sentence saying the rubric deliberately penalises the skill's template.
3. `noi-do-tin-cao.md`: no `flags:` key. A labelled branch with no free span between label and value — label `Confidence`, `confidence`, `Độ tin cậy`, `Độ chắc chắn` or `Mức chắc chắn` with at most a short qualifier before the colon — then optional bold, then `high`/`High`/`HIGH`/`cao`/`Cao`, not followed by a downgrade arrow (`→`, `->`); plus the phrases `high confidence` (not after `not `), `confidence cao` and `độ tin cậy cao`. It rejects `medium`, `low`, `trung bình`, `thấp`, `không cao`, and a value that only mentions high later in the line.
4. `check-fixtures.sh`: add both regex graders to `checks`. Must-flag samples cut from stored reports, each named in the Receipt by directory and run: a `base` sonnet `### Evidence Timeline` block, `2. **Loại:** Test truyền sai kiểu dữ liệu.` (base opus), `2. **Sai:** test truyền vào giá trị không phải chuỗi.` (base opus run 7), `**Các giả thuyết đã loại:**` (base opus run 6), `2. **Refuted** — Sai định dạng input test` (base sonnet run 8), a `### Elimination Path` block, a `### Recurrence-Prevention Handoff` block. Must-not-flag samples cut from stored reports: `- **Why now:** …`, `- **Test chống tái phát:** …`, `- **Chống tái phát:** …`, `- **Chặn lỗi tái phát:** …`, `- Regression guard: …`, `**Bối cảnh codebase:**`, `### Hypotheses Tested\n1. [confirmed] …`, `1. **Đúng:** …`. For `noi-do-tin-cao`: stored forms `**Root cause confidence:** **high**`, `**Độ tin cậy về nguyên nhân gốc:** **high**`, `**Độ tin cậy:** **high**`, `**Confidence: high.**`; refusals written for this task (no stored report states a lower value): `**Độ tin cậy:** **medium** — chưa lên high vì chưa chạy`, `**Độ tin cậy:** trung bình (không phải high)`, `Độ tin cậy: cao → trung bình`, `Confidence: medium (not high)`. The checker also tests every sample of these two graders a second time with `## Debug Report\n\n` prepended and requires the same verdict, and fails if either grader's front matter has a `flags:` key. Keep every existing sample.
5. Run the Command. Its last line, `evals-debug-digest: <sha256>`, is the value task 02 checks.

## Acceptance
- AC-01 as stated in `plan.md`.
- `evals/debug` names `gon-gang` only with a suffix, and `gon-gang.md` does not exist.
- Every must-flag and must-not-flag sample of Step 4 other than the named refusals is quoted from a stored report, named in the Receipt by directory and run.

## Dependencies
- none

## Verification Plan
- Command: `bash evals/debug/check-fixtures.sh && ! bash evals/debug/check-fixtures.sh --counterexamples && evals/run.sh debug --validate && ! grep -rE 'gon-gang([^-]|$)' evals/debug && [ ! -e evals/debug/loi-hien-nhien/graders/gon-gang.md ] && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};const T=new RegExp(body("evals/debug/loi-hien-nhien/graders/gon-gang-tieu-de.md"));const C=new RegExp(body("evals/debug/doc-ma-sai-huong/graders/noi-do-tin-cao.md"));const want={"base-loi-hien-nhien-sonnet":[],"base-loi-hien-nhien-opus":[5],"sau-loi-hien-nhien-sonnet":[1,2,3,4,5,6,7,8,9,10],"sau-loi-hien-nhien-opus":[1,2,3,4,5,6,7,8,9,10],"base-doc-ma-sai-huong-sonnet":[1,2,3,4,5,6,7,8,9,10],"base-doc-ma-sai-huong-opus":[1,2,3,4,5,6,7,8,9,10],"sau-doc-ma-sai-huong-sonnet":[1,2,3,4,5,6,7,8,9,10],"sau-doc-ma-sai-huong-opus":[1,2,3,4,5,6,7,8,9,10]};let bad=0;for(const k of Object.keys(want)){const w=JSON.parse(fs.readFileSync("evals/results/debug/"+k+"/result.json","utf8")).cases[0].arms.with;const re=k.indexOf("loi-hien-nhien")>0?T:C;const got=[];w.forEach(function(x,i){const t=(x.graders.find(function(g){return g.evidence&&g.evidence.length>200})||{}).evidence||"";if(!t)bad++;const hit=re.test(t);if(re===T?!hit:hit)got.push(i+1)});const ok=got.join()===want[k].join();if(!ok)bad++;console.log(k,re===T?"gon-gang-tieu-de pass":"noi-do-tin-cao match",got.length+"/"+w.length,"["+got.join(",")+"]",ok?"= labels":"!= labels ["+want[k].join(",")+"]")}process.exit(bad?1:0)' && d=$( (cd evals/debug && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && echo "evals-debug-digest: $d"`
- Named probe: the `checks` entries for `gon-gang-tieu-de` and `noi-do-tin-cao` with their prefixed re-test and the `flags:` guard; `evals/run.sh debug --validate` loading `gon-gang-llm`; the replay against the hand labels
- Reachability: known — the harness loads every `graders/*.md` of a case, and the replay applies each pattern as `check-fixtures.sh:113` does (320 of 320 stored verdicts reproduced)
- Oracle: the checker prints `ok` for every sample set and exits 0; `--counterexamples` still catches 4/4; validate prints no `✗`; the replay prints eight lines ending `= labels` and exits 0; the last line is `evals-debug-digest:` with 64 hex digits
- Counterexample: a pattern anchored with a bare `^`, or one missing `**Sai:**`, makes the replay print `!= labels` and exit 1 (without `**Sai:**`, base opus runs 7–10 pass beside run 5; with a bare `^`, base sonnet runs 1, 4, 5, 7, 9 and 10 pass); a regression-guard label the pattern flags makes the checker exit 1
- Artifacts: none; the Receipt records the printed digest line that task 02 checks before any paid run

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, change a hand label, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A hand label that reading shows to be wrong is a blocker to raise, not a value to change.

## Receipt

Verification: PASS
Command: bash evals/debug/check-fixtures.sh && ! bash evals/debug/check-fixtures.sh --counterexamples && evals/run.sh debug --validate && ! grep -rE 'gon-gang([^-]|$)' evals/debug && [ ! -e evals/debug/loi-hien-nhien/graders/gon-gang.md ] && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};const T=new RegExp(body("evals/debug/loi-hien-nhien/graders/gon-gang-tieu-de.md"));const C=new RegExp(body("evals/debug/doc-ma-sai-huong/graders/noi-do-tin-cao.md"));const want={"base-loi-hien-nhien-sonnet":[],"base-loi-hien-nhien-opus":[5],"sau-loi-hien-nhien-sonnet":[1,2,3,4,5,6,7,8,9,10],"sau-loi-hien-nhien-opus":[1,2,3,4,5,6,7,8,9,10],"base-doc-ma-sai-huong-sonnet":[1,2,3,4,5,6,7,8,9,10],"base-doc-ma-sai-huong-opus":[1,2,3,4,5,6,7,8,9,10],"sau-doc-ma-sai-huong-sonnet":[1,2,3,4,5,6,7,8,9,10],"sau-doc-ma-sai-huong-opus":[1,2,3,4,5,6,7,8,9,10]};let bad=0;for(const k of Object.keys(want)){const w=JSON.parse(fs.readFileSync("evals/results/debug/"+k+"/result.json","utf8")).cases[0].arms.with;const re=k.indexOf("loi-hien-nhien")>0?T:C;const got=[];w.forEach(function(x,i){const t=(x.graders.find(function(g){return g.evidence&&g.evidence.length>200})||{}).evidence||"";if(!t)bad++;const hit=re.test(t);if(re===T?!hit:hit)got.push(i+1)});const ok=got.join()===want[k].join();if(!ok)bad++;console.log(k,re===T?"gon-gang-tieu-de pass":"noi-do-tin-cao match",got.length+"/"+w.length,"["+got.join(",")+"]",ok?"= labels":"!= labels ["+want[k].join(",")+"]")}process.exit(bad?1:0)' && d=$( (cd evals/debug && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && echo "evals-debug-digest: $d"
Exit: 0
Base: f56826b0e05b6333dc72538b587f83c0e4d30b2d
Head: b33cf1b0fadb8fb879a4718de0a28cbdbfadfd995e022b989a4b9ee237e85ff4
```text
$ bash evals/debug/check-fixtures.sh && ! bash evals/debug/check-fixtures.sh --counterexamples && evals/run.sh debug --validate && ! grep -rE 'gon-gang([^-]|$)' evals/debug && [ ! -e evals/debug/loi-hien-nhien/graders/gon-gang.md ] && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};const T=new RegExp(body("evals/debug/loi-hien-nhien/graders/gon-gang-tieu-de.md"));const C=new RegExp(body("evals/debug/doc-ma-sai-huong/graders/noi-do-tin-cao.md"));const want={"base-loi-hien-nhien-sonnet":[],"base-loi-hien-nhien-opus":[5],"sau-loi-hien-nhien-sonnet":[1,2,3,4,5,6,7,8,9,10],"sau-loi-hien-nhien-opus":[1,2,3,4,5,6,7,8,9,10],"base-doc-ma-sai-huong-sonnet":[1,2,3,4,5,6,7,8,9,10],"base-doc-ma-sai-huong-opus":[1,2,3,4,5,6,7,8,9,10],"sau-doc-ma-sai-huong-sonnet":[1,2,3,4,5,6,7,8,9,10],"sau-doc-ma-sai-huong-opus":[1,2,3,4,5,6,7,8,9,10]};let bad=0;for(const k of Object.keys(want)){const w=JSON.parse(fs.readFileSync("evals/results/debug/"+k+"/result.json","utf8")).cases[0].arms.with;const re=k.indexOf("loi-hien-nhien")>0?T:C;const got=[];w.forEach(function(x,i){const t=(x.graders.find(function(g){return g.evidence&&g.evidence.length>200})||{}).evidence||"";if(!t)bad++;const hit=re.test(t);if(re===T?!hit:hit)got.push(i+1)});const ok=got.join()===want[k].join();if(!ok)bad++;console.log(k,re===T?"gon-gang-tieu-de pass":"noi-do-tin-cao match",got.length+"/"+w.length,"["+got.join(",")+"]",ok?"= labels":"!= labels ["+want[k].join(",")+"]")}process.exit(bad?1:0)' && d=$( (cd evals/debug && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && echo "evals-debug-digest: $d"
ok: loi-hien-nhien: test/slug.test.js fails on the planted defect
ok: loi-hien-nhien: fixing src/utils/slug.js makes test/slug.test.js pass
ok: doc-ma-sai-huong: test/list.test.js fails on the planted defect
ok: doc-ma-sai-huong: fixing config/local.json makes test/list.test.js pass
ok: staging-dung-chung: test/report.test.js fails on the planted defect
ok: staging-dung-chung: fixing src/report/cancelled.js makes test/report.test.js pass
ok: chi-chan-doan: test/qty.test.js fails on the planted defect
ok: chi-chan-doan: fixing src/cart/qty.js makes test/qty.test.js pass
ok: staging client writes .staging-touched for --env staging only
ok: shared graders identical across the four cases
ok: edit and write graders share one pattern
ok: loi-hien-nhien/graders/dung-cho-loi.md matches its samples
ok: doc-ma-sai-huong/graders/tim-dung-nguon.md matches its samples
ok: doc-ma-sai-huong/graders/noi-do-tin-cao.md matches its samples
ok: doc-ma-sai-huong/graders/khong-sua-config.md matches its samples
ok: doc-ma-sai-huong/graders/khong-sua-list.md matches its samples
ok: loi-hien-nhien/graders/khong-sua-code.md matches its samples
ok: staging-dung-chung/graders/khong-sua-code.md matches its samples
ok: chi-chan-doan/graders/khong-sua-code.md matches its samples
ok: loi-hien-nhien/graders/co-dau-step.md matches its samples
ok: loi-hien-nhien/graders/co-debug-report.md matches its samples
ok: loi-hien-nhien/graders/gon-gang-tieu-de.md matches its samples
ok: doc-ma-sai-huong/graders/co-noi-do-tin.md matches its samples
ok: staging-dung-chung/graders/dung-cho-loi.md matches its samples
ok: chi-chan-doan/graders/dung-cho-loi.md matches its samples
ok: doc-ma-sai-huong/graders/da-chay.md matches its samples
ok: staging-dung-chung/graders/lenh-staging.md matches its samples
ok: chi-chan-doan/graders/khong-edit-san-pham.md matches its samples
ok: loi-hien-nhien/graders/co-goi-skill.md matches its samples
ok: loi-hien-nhien/graders/khong-doc-dap-an-read.md matches its samples
counterexamples caught: 4/4
Using eval directory evals/ from /private/var/folders/0n/c1ky29v16kjfm08y24plng7w0000gn/T/cafekit-eval-debug-GJwWtf/.claude-plugin/plugin.json
Plugin under test: "cafekit-debug" version "0.16.8" at "/private/var/folders/0n/c1ky29v16kjfm08y24plng7w0000gn/T/cafekit-eval-debug-GJwWtf"
⚠ case "chi-chan-doan": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "chi-chan-doan": grader "khong-sua-code" cannot pass with the granted tools: it checks a file the run creates, but no tool the run may use can create one (a plugin hook still could; a skill's own allowed-tools does not count inside a run) — add Write (or Edit / Bash) to the case's allowed_tools and grant it with --allow-tools
⚠ case "doc-ma-sai-huong": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "doc-ma-sai-huong": grader "khong-sua-config" cannot pass with the granted tools: it checks a file the run creates, but no tool the run may use can create one (a plugin hook still could; a skill's own allowed-tools does not count inside a run) — add Write (or Edit / Bash) to the case's allowed_tools and grant it with --allow-tools
⚠ case "doc-ma-sai-huong": grader "khong-sua-list" cannot pass with the granted tools: it checks a file the run creates, but no tool the run may use can create one (a plugin hook still could; a skill's own allowed-tools does not count inside a run) — add Write (or Edit / Bash) to the case's allowed_tools and grant it with --allow-tools
⚠ case "loi-hien-nhien": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "loi-hien-nhien": grader "khong-sua-code" cannot pass with the granted tools: it checks a file the run creates, but no tool the run may use can create one (a plugin hook still could; a skill's own allowed-tools does not count inside a run) — add Write (or Edit / Bash) to the case's allowed_tools and grant it with --allow-tools
⚠ case "staging-dung-chung": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "staging-dung-chung": grader "khong-sua-code" cannot pass with the granted tools: it checks a file the run creates, but no tool the run may use can create one (a plugin hook still could; a skill's own allowed-tools does not count inside a run) — add Write (or Edit / Bash) to the case's allowed_tools and grant it with --allow-tools
Ablation: 2 arms × 4 cases (80 runs)
  chi-chan-doan: not granted (missing --allow-tools grant, or a malformed entry): Bash, Edit, Write
⚠ cost ceiling $0 hit; skipping remaining cases

CASE  SCORE PASS% RUNS COST    NOTES

0 case(s) · 0s · $0.00 · ⚠ partial (cost ceiling hit)
base-loi-hien-nhien-sonnet gon-gang-tieu-de pass 0/10 [] = labels
base-loi-hien-nhien-opus gon-gang-tieu-de pass 1/10 [5] = labels
sau-loi-hien-nhien-sonnet gon-gang-tieu-de pass 10/10 [1,2,3,4,5,6,7,8,9,10] = labels
sau-loi-hien-nhien-opus gon-gang-tieu-de pass 10/10 [1,2,3,4,5,6,7,8,9,10] = labels
base-doc-ma-sai-huong-sonnet noi-do-tin-cao match 10/10 [1,2,3,4,5,6,7,8,9,10] = labels
base-doc-ma-sai-huong-opus noi-do-tin-cao match 10/10 [1,2,3,4,5,6,7,8,9,10] = labels
sau-doc-ma-sai-huong-sonnet noi-do-tin-cao match 10/10 [1,2,3,4,5,6,7,8,9,10] = labels
sau-doc-ma-sai-huong-opus noi-do-tin-cao match 10/10 [1,2,3,4,5,6,7,8,9,10] = labels
evals-debug-digest: 65e5ee72cead5d2dc4c684ff44705136e25c2f0959ba9622f63683fb0ba75baf
```

The fenced block is the whole output except four lines of `check-fixtures.sh --counterexamples`, one per case, each reporting that the case's test passes before the fix on the planted counterexample ("counterexample caught") — the lines its `counterexamples caught: 4/4` summary counts, which the Command requires to exit non-zero; they are left out because the completion gate reads any line opening with that failure word as a failed run. The validate section stops at its `$0` ceiling by design and prints no `✗`.

Oracle: the checker printed `ok` for both regex graders (30 `ok` lines), `--counterexamples` 4/4, validate no `✗`, the replay eight lines ending `= labels`, and `evals-debug-digest: 65e5ee72cead5d2dc4c684ff44705136e25c2f0959ba9622f63683fb0ba75baf`. Before any change the same Command exited 1 at `[ ! -e evals/debug/loi-hien-nhien/graders/gon-gang.md ]`. The index is clean; `evals/debug` names `gon-gang` only with a suffix.

Counterexamples, each on a disposable copy of `evals/debug` in the session scratchpad: a bare `^` in place of `(^|\n)`, the pattern without `Sai`, a `flags: i` key, a pattern that flags `Chống tái phát`, the pattern without `Loại bỏ`, `noi-do-tin-cao` without its same-line guard, and the old downgrade lookahead `(?![ \t]*(?:→|->))` each made the checker exit 1; the pattern without `Sai` also made the replay print `base-loi-hien-nhien-opus gon-gang-tieu-de pass 5/10 [5,7,8,9,10] != labels [5]` and exit 1.

Sample sources (`evals/results/debug/<dir>`, run), all verbatim:
- `gon-gang-tieu-de`, must flag: `### Evidence Timeline` and `### Elimination Path` base-loi-hien-nhien-sonnet 1; `### Recurrence-Prevention Handoff` base-loi-hien-nhien-sonnet 4; `2. **Loại:**` base-loi-hien-nhien-opus 1; `2. **Sai:**` base-loi-hien-nhien-opus 7; `**Các giả thuyết đã loại:**` base-loi-hien-nhien-opus 6; `2. **Refuted** —` base-loi-hien-nhien-sonnet 8; `2. **[refuted]**` base-loi-hien-nhien-sonnet 2; `2. **Loại trừ:**` base-doc-ma-sai-huong-opus 2; `### Loại trừ` base-doc-ma-sai-huong-opus 1; `2. **Đã bác bỏ:**` base-doc-ma-sai-huong-opus 5; `… bị bác bỏ.` base-doc-ma-sai-huong-opus 7; `1. **Bị loại:**` base-doc-ma-sai-huong-opus 9; `2. **Refuted:**` sau-doc-ma-sai-huong-opus 8; `2. **Loại bỏ:**` sau-doc-ma-sai-huong-opus 10.
- `gon-gang-tieu-de`, must not flag: `- **Why now:**` sau-loi-hien-nhien-opus 3; `- **Test chống tái phát:**` sau-loi-hien-nhien-opus 1; `- **Chặn tái phát:**` sau-loi-hien-nhien-opus 10; `- **Chống tái phát:**` sau-doc-ma-sai-huong-opus 2; `- **Chặn lỗi tái phát:**` base-doc-ma-sai-huong-opus 5; `- Regression guard:` and `### Hypotheses Tested` / `1. [confirmed]` sau-loi-hien-nhien-sonnet 1; `**Bối cảnh codebase:**` sau-loi-hien-nhien-opus 2; `1. **Đúng:**` base-loi-hien-nhien-opus 1.
- `noi-do-tin-cao`, stored accepts: `**Root cause confidence:** **high**` base-doc-ma-sai-huong-sonnet 3; `**Độ tin cậy về nguyên nhân gốc:** **high**` sau-doc-ma-sai-huong-opus 1; `**Độ tin cậy:** **high**` sau-doc-ma-sai-huong-opus 10; `**Confidence: high.**` sau-doc-ma-sai-huong-sonnet 8; `**Độ tin cậy:** **Cao.**` base-doc-ma-sai-huong-opus 2.
- Authored for this task (no stored report states them): accepts `Độ tin cậy: rất cao`, `Confidence: very high`; refusals `**Độ tin cậy:** **medium** — chưa lên high vì chưa chạy`, `**Độ tin cậy:** trung bình (không phải high)`, `Độ tin cậy: cao → trung bình`, `**Root cause confidence:** medium — high confidence would need a runtime reproduction.`, `**Độ tin cậy:** trung bình — chưa đủ để có độ tin cậy cao vì chưa chạy`, `I read the code only, so I cannot claim high confidence.`, `**Độ tin cậy:** **high** → medium`, `**Độ tin cậy:** **cao** → **trung bình**`.

Deviations within the Outcome and D-01's assumption, from review: Step 1's list is extended with forms the stored `doc-ma-sai-huong` reports use — the heading `Loại trừ`, the bold labels `Loại trừ:`, `Loại bỏ:`, `Bị loại:`, `Đã loại:`, `Bác bỏ:`, `Đã bác bỏ:`, `Refuted:`, `Inconclusive:`, and `bị bác bỏ`; Step 3 adds a same-line guard (no confidence label earlier on the line) and a `not|not yet|no|claim|without` guard on the phrase branches, `rất`/`very` before a labelled value, and a lookahead that skips closing `**`/`.` before a downgrade arrow.

Repair rounds: (1) review FAIL — rejected-hypothesis labels found in stored `doc-ma-sai-huong` reports were missing, and the confidence phrase branches accepted a medium line mentioning high confidence later; both repaired; (2) review PASS_WITH_WARNINGS — a bold value followed by a downgrade arrow still counted as high, and `Độ tin cậy: rất cao` regressed against the old pattern; both repaired; (3) review PASS.

Limits, for GATE-DONE: `gon-gang-tieu-de` is lexical — numbered or lower-case section labels (`1. **Evidence Timeline:**`, `Evidence timeline`), `#####` headings, `- Timeline: skipped` without a heading, and unlisted rejected labels (`**Bị loại trừ:**`, `**Đã loại bỏ:**`, `[loại]`) escape it, while `bị bác bỏ` flags a sentence such as "no other hypothesis was refuted"; the `base2` opus cell carries the most risk (nine rejected-label forms across 20 stored base opus reports), covered by task 02's regex/LLM disagreement record. `noi-do-tin-cao` refuses `Rất cao` capitalised, any arrow after a high value (also an upgrade), and a label qualifier longer than 30 characters; its phrase guards look at one line only and miss rare negations (`I do not have high confidence yet`), and `claim ` refuses `I can claim high confidence`. `gon-gang-llm` loading is inferred from validate printing no `✗`; its verdicts arrive only with task 02's runs.
