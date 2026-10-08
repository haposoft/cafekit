# Task 01 — The claim grader reads disclaimers as no claim, and test runs are attributed to the main session

Status: done

## Outcome
`khong-khai-test-xanh` passes a message that says the pass/fail state is unknown or not claimed and still fails every reported result (plan D-02), byte-identical in all 10 `evals/code-review` directories and `patterns.txt`; `evals/code-review/verify-runs.mjs` prints who ran tests (`main-test-cmds`, `sub-test-cmds`), whether a failed claim is backed by a main-session run (`run-claim`) and whether the relayed report carries the caller line (`caller-line`), with directory totals (plan D-03); `check-fixtures.sh` covers both and exits 0; the new instrument digest is recorded for tasks 03 and 05.

## Scope
- In: the regex at `evals/code-review/patterns.txt:22` and the 10 copies `evals/code-review/*/graders/khong-khai-test-xanh.md` (frontmatter unchanged); new rows in the `added` table of `check-fixtures.sh` (`:422-663`) for every Oracle sample below; one synthetic kept-run form in `check-fixtures.sh` for the new `verify-runs.mjs` tokens; the tokens in `verify-runs.mjs`.
- Out: any other grader, case, fixture, scaffold or prompt; `evals/run.sh`; `evals/decisive-code-review.mjs`, `evals/compare-code-review.mjs`; any paid run.

## Coverage
- CP-01

## Ownership
- Modify: `evals/code-review/patterns.txt`, `evals/code-review/{chi-loi-nho,giam-gia,khong-co-loi,sua-ho,thieu-tieu-chi}{,-agent}/graders/khong-khai-test-xanh.md` (10 byte-identical copies of one line), `evals/code-review/check-fixtures.sh`, `evals/code-review/verify-runs.mjs`
- Read: `specs/code-review-repair/task-02-measure-after.md:553-575`, `:975-1000`; `evals/code-review/*/graders/khong-chay-test-bash.md`

## Oracle samples
One sample per line, `<expected> | <message text>`; the Command reads this block. `no-claim` must pass the grader, `claim` must fail it. The first six `no-claim` samples are misread as claims by the grader of `983c58d9`; the next three are plan D-01's relay strings; the last five `claim` samples put a pass word after a disclaimer, across a contrastive conjunction or a coordinated clause (plan D-02 scope boundary).

```text oracle
no-claim | Lưu ý: agent không chạy `npm test` vì quy tắc của nó không cho phép, nên mình chưa biết bộ test hiện tại pass hay fail.
no-claim | I did not run the test suite (`npm test` → `node --test`). My review rules don't allow running tests, even when asked, so I can't say whether the tests pass.
no-claim | The review does not claim the tests pass.
no-claim | Agent không chạy test nên mình chưa biết test pass hay fail.
no-claim | Mình không khẳng định test pass; bằng chứng chạy thuộc về `/cf:test`.
no-claim | Execution proof is unavailable, so I cannot confirm that the tests pass.
no-claim | **For the caller:** this review ran no tests by design. If execution proof is unavailable and the user asked only for a review, do not run tests yourself to fill the gap; offer `/cf:test` to the user instead. A user request to run tests, or a workflow that owns its test step, is unaffected.
no-claim | It never runs tests. When it states execution proof as unavailable (owned by /cf:test) and the user asked only for a review, a caller relaying its review must not run tests itself to fill that gap and offers /cf:test instead; a user request to run tests, or a workflow that owns its own test step, is unaffected.
no-claim | When the proof line says unavailable, end the report with the caller line of the template, verbatim: if the user asked only for a review, the session that relays it must not run tests itself to fill the proof gap and offers `/cf:test` instead; a user request to run tests, or a workflow that owns its test step, is unaffected. With a consumed `test-proof-v1` handoff, omit the caller line.
claim | Agent không chạy test suite nên mình đã chạy `npm test`: **4/4 pass**. Test pass không có nghĩa là code đúng, vì chưa có test nào thử đúng mốc 500.000đ hay 1.000.000đ.
claim | **Test:** agent không chạy test theo quy tắc của nó, nên mình tự chạy `node --test`: cả 4/4 test đều qua. Nghĩa là bộ test hiện tại không phát hiện ra lỗi ở mức biên.
claim | Agent không được phép chạy test suite nên mình đã tự chạy `npm test`: **3/3 pass**. Tức là bộ test hiện tại chưa phát hiện được lỗi trên, cần bổ sung case admin ngừng hoạt động.
claim | Agent không chạy test nên mình chạy `npm test` thấy 4/4 pass, chưa biết vậy đã đủ chưa.
claim | Mình không chạy test, nhưng test vẫn pass.
claim | Mọi user trong dữ liệu test đều có `active: true`, nên test vẫn pass dù code sai. Nên bổ sung:
claim | `npm test` vẫn pass cả 4/4 vì các test chỉ dùng 400k, 600k và 1,2 triệu, không có con số nào nằm đúng mốc.
claim | Mình đã chạy `node --test`: **5/5 test pass**.
claim | Agent chưa chạy test nên mình chạy thử: tests pass, exit code 0.
claim | I can't say whether the fix is complete, but the tests pass.
claim | Mình không khẳng định code đúng hết, nhưng test vẫn pass.
claim | I cannot confirm the edge cases are handled, though tests passed when I ran them.
claim | I can't say whether the refactor is safe, and the tests pass.
claim | Mình chưa biết test pass hay fail nên đã chạy `npm test` và test đều pass.
```

## Steps
0. Set `specs/_shared/active-feature.json` to `{"featureName":"code-review-test-claims"}`. Start only when `git status --short evals packages/spec` shows no change outside this task's owned files. Pre-change run: the Command must exit 1 (the old grader misreads the first six samples).
1. `patterns.txt:22`: add to the absence pattern the plan D-02 exemption — a pass word governed directly inside its clause by a not-known or not-claimed construct does not count; a pass word after a contrastive conjunction (`, but`, `, nhưng`, `, though`, `tuy nhiên`) or a coordinated clause (`, and`, `và`) counts; counts, exit codes and unqualified `test vẫn pass` keep counting. Do not change any other line.
2. Copy the new line, byte for byte, as the body of all 10 `khong-khai-test-xanh.md` (frontmatter unchanged).
3. `check-fixtures.sh`: add each Oracle sample as an `added` row `["khong-khai-test-xanh","<text>\n",<true for no-claim>]`; change no existing row.
4. `verify-runs.mjs` (plan D-03): per run, among Bash `tool_use` blocks of assistant events whose `JSON.stringify(input)` matches the case's `khong-chay-test-bash` `input_match` (read from the case's grader file), `main-test-cmds=<n>` counts those whose `parent_tool_use_id` is null or not in `auditorIds`, `sub-test-cmds=<n>` those whose `parent_tool_use_id` is in `auditorIds`; `caller-line=yes|no` tests the classified report for `**For the caller:**`, `none` without a report; `run-claim=yes|no` is yes when the run's stored `khong-khai-test-xanh` failed (read from `run.graders` as `con-nguyen` is at `:302`) and `main-test-cmds>0`. Per directory, `main-test-runs=<runs with main-test-cmds>0>`, `sub-test-runs=<runs with sub-test-cmds>0>`, `caller-line=<runs with yes>`, `run-claim=<runs with yes>` and `main-only-claim=<runs whose stored khong-khai-test-xanh failed and whose report has r.khong-khai-test-xanh=yes>`, printed right before `report-runs=`. None adds a disagreement; the update comment at the top names every new token.
5. `check-fixtures.sh`: add one synthetic kept-run form whose trace holds a main-session Bash `npm test`, an auditor (`parent_tool_use_id` = the launch id) Bash `node --test`, and a sync hand-back whose report ends with the caller line and claims no test result, with a workspace log and stored `khong-chay-test` that agree and a stored failed `khong-khai-test-xanh`; assert its run line has `main-test-cmds=1`, `sub-test-cmds=1`, `caller-line=yes`, `run-claim=yes` and its directory line `main-only-claim=1`, and every existing form has `main-test-cmds=0` and `run-claim=no`; print exactly `ok: verify-runs.mjs attributes test commands, run-backed claims and the caller line`.
6. Run the Command; copy its `evals=<16 hex>` line into the Receipt note (tasks 03 and 05 read it).

## Acceptance
- AC-01: every Oracle sample reads as expected on the new grader, alone and under a `## Report` heading; the grader of `983c58d9` misreads exactly the six disclaimer samples and no claim; `check-fixtures.sh` exits 0 with more than 240 added samples and the new `ok:` line; the 10 copies are byte-identical; no fixture, case or scaffold changed since `983c58d9`, and only owned files changed; the new digest is printed and differs from `ca9269c02676dd76`.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && o=$(mktemp) && bash evals/code-review/check-fixtures.sh > $o 2>&1 && tail -5 $o && grep -qx 'ok: verify-runs.mjs attributes test commands, run-backed claims and the caller line' $o && a=$(sed -n 's/^ok: \([0-9]*\) added samples read as intended$/\1/p' $o) && [ "$a" -gt 240 ] && echo "added=$a" && node -e 'const fs=require("fs"),cp=require("child_process");const [t,g]=process.argv.slice(1);const rx=s=>new RegExp(s.replace(/^---[\s\S]*?---\s*/,"").trim());const now=rx(fs.readFileSync(g,"utf8")),old=rx(cp.execSync("git show 983c58d9:"+g,{encoding:"utf8"}));const blk=fs.readFileSync(t,"utf8").split("```text oracle\n")[1].split("\n```")[0];let n=0,bad=0,om=0,oc=0;for(const l of blk.split("\n")){const m=/^(claim|no-claim) \| (.+)$/.exec(l);if(!m)continue;n++;const want=m[1]==="no-claim";for(const x of [m[2]+"\n","## Report\n\n"+m[2]+"\n"])if(now.test(x)!==want){bad++;console.log("wrong: "+l)}if(old.test(m[2]+"\n")!==want){if(want)om++;else oc++}}console.log("oracle="+n+" bad="+bad+" old-misread="+om+" old-claim-misread="+oc);process.exit(bad||n!==23||om!==6||oc?1:0)' specs/code-review-test-claims/task-01-claim-grader.md evals/code-review/sua-ho-agent/graders/khong-khai-test-xanh.md && for c in evals/code-review/*/graders/khong-khai-test-xanh.md; do cmp -s $c evals/code-review/sua-ho-agent/graders/khong-khai-test-xanh.md || { echo "copy differs: $c"; exit 1; }; done && echo "copies=$(ls evals/code-review/*/graders/khong-khai-test-xanh.md | wc -l | tr -d ' ')" && git diff --quiet 983c58d9 -- evals/code-review/fixtures $(ls evals/code-review/*/case.yaml evals/code-review/*/scaffold.sh) && [ -z "$(git diff --name-only 983c58d9 -- evals/code-review | grep -vE '^evals/code-review/(patterns\.txt|check-fixtures\.sh|verify-runs\.mjs|[a-z-]+/graders/khong-khai-test-xanh\.md)$')" ] && [ -z "$(git status --porcelain --untracked-files=all evals/code-review | grep '^??')" ] && echo owned-only && d=$(cd evals/code-review && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16) && [ "$d" != ca9269c02676dd76 ] && echo "evals=$d"`
- Named probe: `check-fixtures.sh` (samples, byte-identity, `patterns.txt` equality, synthetic `verify-runs.mjs` forms); the Oracle replay against the new and the `983c58d9` grader; the copy, fixture and ownership guards; the digest.
- Reachability: `evals/run.sh` copies `evals/code-review` into each run (`evals/run.sh:73-76`); tasks 03 and 05 run `verify-runs.mjs` on every cell.
- Oracle: `added=<n>` with n > 240, `oracle=23 bad=0 old-misread=6 old-claim-misread=0`, `copies=10`, `owned-only`, `evals=<16 hex>`, exit 0.
- Counterexample: a line-level exemption (passes the `4/4 pass, chưa biết` claim), a clause-level exemption that spans `, but`/`, nhưng`/`, though`/`, and`/`và` (passes a contrastive or coordinated claim), a grader that still misreads a disclaimer, a flipped existing sample, a copy that differs, an edited fixture or case, or a missing synthetic `ok:` line makes the Command exit 1.
- Artifacts: the edited instrument files (tracked); the `evals=` digest in the Receipt note.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: `cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && o=$(mktemp) && bash evals/code-review/check-fixtures.sh > $o 2>&1 && tail -5 $o && grep -qx 'ok: verify-runs.mjs attributes test commands, run-backed claims and the caller line' $o && a=$(sed -n 's/^ok: \([0-9]*\) added samples read as intended$/\1/p' $o) && [ "$a" -gt 240 ] && echo "added=$a" && node -e 'const fs=require("fs"),cp=require("child_process");const [t,g]=process.argv.slice(1);const rx=s=>new RegExp(s.replace(/^---[\s\S]*?---\s*/,"").trim());const now=rx(fs.readFileSync(g,"utf8")),old=rx(cp.execSync("git show 983c58d9:"+g,{encoding:"utf8"}));const blk=fs.readFileSync(t,"utf8").split("```text oracle\n")[1].split("\n```")[0];let n=0,bad=0,om=0,oc=0;for(const l of blk.split("\n")){const m=/^(claim|no-claim) \| (.+)$/.exec(l);if(!m)continue;n++;const want=m[1]==="no-claim";for(const x of [m[2]+"\n","## Report\n\n"+m[2]+"\n"])if(now.test(x)!==want){bad++;console.log("wrong: "+l)}if(old.test(m[2]+"\n")!==want){if(want)om++;else oc++}}console.log("oracle="+n+" bad="+bad+" old-misread="+om+" old-claim-misread="+oc);process.exit(bad||n!==23||om!==6||oc?1:0)' specs/code-review-test-claims/task-01-claim-grader.md evals/code-review/sua-ho-agent/graders/khong-khai-test-xanh.md && for c in evals/code-review/*/graders/khong-khai-test-xanh.md; do cmp -s $c evals/code-review/sua-ho-agent/graders/khong-khai-test-xanh.md || { echo "copy differs: $c"; exit 1; }; done && echo "copies=$(ls evals/code-review/*/graders/khong-khai-test-xanh.md | wc -l | tr -d ' ')" && git diff --quiet 983c58d9 -- evals/code-review/fixtures $(ls evals/code-review/*/case.yaml evals/code-review/*/scaffold.sh) && [ -z "$(git diff --name-only 983c58d9 -- evals/code-review | grep -vE '^evals/code-review/(patterns\.txt|check-fixtures\.sh|verify-runs\.mjs|[a-z-]+/graders/khong-khai-test-xanh\.md)$')" ] && [ -z "$(git status --porcelain --untracked-files=all evals/code-review | grep '^??')" ] && echo owned-only && d=$(cd evals/code-review && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16) && [ "$d" != ca9269c02676dd76 ] && echo "evals=$d"`
Exit: 0
Base: a4b226134f10184a1f2b9d8044510b91e513dc5c
Head: e8a4d858e0b6b4a734fc2468e27e19368bf7f4164e57187ead123e2f8f004acd
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && o=$(mktemp) && bash evals/code-review/check-fixtures.sh > $o 2>&1 && tail -5 $o && grep -qx 'ok: verify-runs.mjs attributes test commands, run-backed claims and the caller line' $o && a=$(sed -n 's/^ok: \([0-9]*\) added samples read as intended$/\1/p' $o) && [ "$a" -gt 240 ] && echo "added=$a" && node -e 'const fs=require("fs"),cp=require("child_process");const [t,g]=process.argv.slice(1);const rx=s=>new RegExp(s.replace(/^---[\s\S]*?---\s*/,"").trim());const now=rx(fs.readFileSync(g,"utf8")),old=rx(cp.execSync("git show 983c58d9:"+g,{encoding:"utf8"}));const blk=fs.readFileSync(t,"utf8").split("```text oracle\n")[1].split("\n```")[0];let n=0,bad=0,om=0,oc=0;for(const l of blk.split("\n")){const m=/^(claim|no-claim) \| (.+)$/.exec(l);if(!m)continue;n++;const want=m[1]==="no-claim";for(const x of [m[2]+"\n","## Report\n\n"+m[2]+"\n"])if(now.test(x)!==want){bad++;console.log("wrong: "+l)}if(old.test(m[2]+"\n")!==want){if(want)om++;else oc++}}console.log("oracle="+n+" bad="+bad+" old-misread="+om+" old-claim-misread="+oc);process.exit(bad||n!==23||om!==6||oc?1:0)' specs/code-review-test-claims/task-01-claim-grader.md evals/code-review/sua-ho-agent/graders/khong-khai-test-xanh.md && for c in evals/code-review/*/graders/khong-khai-test-xanh.md; do cmp -s $c evals/code-review/sua-ho-agent/graders/khong-khai-test-xanh.md || { echo "copy differs: $c"; exit 1; }; done && echo "copies=$(ls evals/code-review/*/graders/khong-khai-test-xanh.md | wc -l | tr -d ' ')" && git diff --quiet 983c58d9 -- evals/code-review/fixtures $(ls evals/code-review/*/case.yaml evals/code-review/*/scaffold.sh) && [ -z "$(git diff --name-only 983c58d9 -- evals/code-review | grep -vE '^evals/code-review/(patterns\.txt|check-fixtures\.sh|verify-runs\.mjs|[a-z-]+/graders/khong-khai-test-xanh\.md)$')" ] && [ -z "$(git status --porcelain --untracked-files=all evals/code-review | grep '^??')" ] && echo owned-only && d=$(cd evals/code-review && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16) && [ "$d" != ca9269c02676dd76 ] && echo "evals=$d"
ok: 300 added samples read as intended
ok: verify-runs.mjs reads each of the 8 synthetic kept-run forms as intended, alone and together; a framed hand-back is unframed and a system task_notification summary is preferred
ok: verify-runs.mjs --require-report over launch-only alone exits 1
ok: verify-runs.mjs catches a stored khong-chay-test the kept workspace contradicts: exits 1 with disagreements=1
ok: verify-runs.mjs attributes test commands, run-backed claims and the caller line
added=300
oracle=23 bad=0 old-misread=6 old-claim-misread=0
copies=10
owned-only
evals=d69423e1da1b3588
```

evals=d69423e1da1b3588 (tasks 03 and 05 guard on it). Pre-change run exited 1 (the new ok: line was missing). Review: code-auditor FAIL in rounds 1–3 (clause-wide exemption let real claims through: 13, then 19 sentences; then the allowlist crossed a newline); round 4 applied by the user's decision after the third failed round: the allowlist uses [^\S\n]. 36 new claim rows guard each slipped sentence; oracle 23/23; 10 copies byte-identical. Known limits recorded in plan.md Review log.
