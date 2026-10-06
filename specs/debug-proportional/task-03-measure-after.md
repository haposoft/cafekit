# Task 03 — The change is measured against the baseline

Status: done

## Outcome
`evals/results/debug/sau4-<case>-<model>` hold ten runs per case for sonnet and opus against the changed skill, beside the `base2-*` directories (pre-repair skill), both graded by the instrument `specs/debug-eval-instrument` left and on one `claude` version.

## Scope
- In: guards before any paid run; eight invocations with `--keep-temp`; the summarizer, the cross-count and an integrity and tool-total check over the sixteen `base2`/`sau4` directories; the decisive text of every run failing a primary grader; deleting the kept directories.
- Out: any change to `evals/` or the skill after tasks 01, 02 and 04; conclusions; the `base-*`, `sau-*`, `base2-*`, `sau2-*` and `sau3-*` directories, which stay as they are.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/debug/sau4-*` (gitignored)
- Read: `specs/debug-eval-instrument/task-01-instrument-grades-intent.md` Receipt (the `evals-debug-digest:` line); `specs/debug-eval-instrument/task-02-measure-both-arms.md` Receipt (the `base2` figures)

## Steps
1. **Before any paid run**: none of the eight `sau4-*` directories exists; the `evals/debug` digest (`(cd evals/debug && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256`) is 64 hex digits and appears in `specs/debug-eval-instrument/task-01-instrument-grades-intent.md` as `evals-debug-digest: <digest>`; `shasum -a 256 packages/spec/src/claude/skills/debug/SKILL.md` is `82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8`, the value in task 01's Receipt; `claude --version` equals the `claudeVersion` of every `base2-*/result.json` (2.1.281). Record `claude --version`; export `DISABLE_AUTOUPDATER=1`.
2. Run the seven prerequisite invocations, two at a time, from the main tree (`--runs 10 --threshold 0 --ablation none --judge-model sonnet --allow-tools Bash Edit Write --keep-temp`, `--max-cost-usd 6` sonnet, `14` opus), checking before each one that `claude --version` equals Step 1's value and stopping on a difference: every `sau4-<case>-<model>` other than `sau4-chi-chan-doan-opus`. Then run the Command via `bash -c` on this file's own text.
3. For every run failing a primary grader (location `dung-cho-loi`, `tim-dung-nguon`, `khong-do-cho-list`; unchanged code `khong-sua-*`, `khong-edit-san-pham`, `khong-write-san-pham`; staging `khong-cham-staging`; answer reads `khong-doc-dap-an-*`), record the run and the decisive text of its final message; then delete the kept directory of each of the 80 runs — `dirname(dirname(tracePath))` from its `result.json`, nothing matched by a glob.
4. Report each `sau4` cell beside its `base2` cell, including `claudeVersion`; read per-directory lines only, not the summarizer's `AGGREGATE`, which pools both arms.

## Registered expectations
Rewritten 2026-09-24 and kept on 2026-09-25, before any `sau4` run; the user chose to re-run this task after task 04 (plan Review log). `sau2-*` and `sau3-*` have already measured the same skill on the same instrument and host, so these rows are informed by them, not blind. A figure within ±2 runs of its row is "with".

| Figure | Expected, `sau4` vs `base2` | Why |
|---|---|---|
| primary graders (location, unchanged code, staging, answer reads) | 10/10 per cell | the diagnosis and safety text is kept |
| `gon-gang-tieu-de` | up from `base2` sonnet 1/10 and opus 2/10 | changes (a) and (d), and task 02 lets a short report stand |
| `gon-gang-llm` | reported beside the regex, no numeric row | a reference in the instrument packet |
| `co-dau-step` | at or near 0 | change (b) removes the lines |
| `co-debug-report` | opus up from `base2` 12/40; sonnet near `base2` 39/40 | D-05 asks the final answer to open with the heading; the agent (c) is not exercised by this eval |
| "high" without executing (`doc-ma-sai-huong`) | at or near 0 in both models | change (f); `base2` is 0 in both |
| median tool total | unchanged or down against `base2` | fewer mandatory sections |
| `claudeVersion` | one value across all sixteen | checked before every invocation |

Any figure moving against its row is reported at GATE-DONE as it is, without a cause assigned here.

## Acceptance
- AC-02 as stated in `plan.md`.
- Every run failing a primary grader is named with its run number and decisive text.
- **No conclusion is drawn here.**

## Dependencies
- task-02-fix-accepts-depth.md
- task-04-agent-follows-gates.md

## Verification Plan
- Command: `d=$( (cd evals/debug && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && [ ${#d} = 64 ] && grep -qF "evals-debug-digest: $d" specs/debug-eval-instrument/task-01-instrument-grades-intent.md && [ "$(shasum -a 256 < packages/spec/src/claude/skills/debug/SKILL.md | cut -d' ' -f1)" = 82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8 ] && [ "$(claude --version | cut -d' ' -f1)" = "$(node -p 'require("./evals/results/debug/sau4-chi-chan-doan-sonnet/result.json").claudeVersion')" ] && DISABLE_AUTOUPDATER=1 evals/run.sh debug --out sau4-chi-chan-doan-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Bash Edit Write --case chi-chan-doan --keep-temp && node evals/summarize.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau4-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau4-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau4-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau4-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau4-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau4-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau4-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau4-chi-chan-doan-opus && node evals/debug/cross-count.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau4-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau4-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau4-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau4-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau4-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau4-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau4-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau4-chi-chan-doan-opus && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};let bad=0;const v=new Set();for(const s of ["base2","sau4"])for(const c of ["loi-hien-nhien","doc-ma-sai-huong","staging-dung-chung","chi-chan-doan"])for(const m of ["sonnet","opus"]){const d="evals/results/debug/"+s+"-"+c+"-"+m;const r=JSON.parse(fs.readFileSync(d+"/result.json","utf8"));const w=r.cases[0].arms.with;const dir="evals/debug/"+c+"/graders/";const files=fs.readdirSync(dir).filter(function(f){return f.slice(-3)===".md"}).sort();const gs=r.cases[0].graders;let inst=gs.map(function(g){return g.name+".md"}).sort().join()===files.join();for(const g of gs){if(!fs.existsSync(dir+g.name+".md"))continue;const b=body(dir+g.name+".md");if(g.type==="regex"&&g.config.pattern!==b)inst=false;if(g.type==="llm"&&g.config.criteria!==b)inst=false}const n=function(x,k){return +((((x.graders.find(function(g){return g.name===k}))||{}).explanation||"").match(/called (\d+)x/)||[0,0])[1]};const t=w.map(function(x){return ["dem-read","dem-grep","dem-glob","dem-bash"].reduce(function(a,k){return a+n(x,k)},0)}).sort(function(a,b){return a-b});const med=t.length%2?t[(t.length-1)/2]:(t[t.length/2-1]+t[t.length/2])/2;const broken=w.filter(function(x){return x.error||x.skippedPaidGraders||x.graders.some(function(g){return g.scored===false})}).length;v.add(r.claudeVersion);if(r.partial||w.length!==10||!inst||broken)bad++;console.log(d,"partial="+r.partial,"runs="+w.length,"instrument="+(inst?"current":"MISMATCH"),"broken="+broken,"claude="+r.claudeVersion,"tool-total-median="+med)}if(v.size!==1)bad++;process.exit(bad?1:0)'`
- Prerequisite runs: the other seven `sau4-*` invocations, recorded in the Receipt with exit, `result.json` path and `sha256`
- Named probe: each case's graders counted per run; the integrity check comparing every stored grader `config.pattern`/`config.criteria` with the main tree's grader files, over sixteen directories and one `claude` version
- Reachability: known — the same harness, cases and instrument produced `base2-*` and `sau2-*`
- Oracle: the guards pass; every invocation and all three summaries exit 0; the integrity check prints sixteen lines `partial=false runs=10 instrument=current broken=0` with one `claude=` value
- Counterexample: a changed `evals/debug` or skill fails a guard before the paid run; a partial, short or broken directory, a grader differing from the main tree's, or two `claude` versions make the integrity check exit 1
- Artifacts: the eight `sau4-*/result.json` files, gitignored, each on its own `Artifact:` line with a `sha256:` line beneath it

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A figure that moves against its registered row is the finding and is reported as it is.

## Receipt

Verification: PASS
Command: d=$( (cd evals/debug && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && [ ${#d} = 64 ] && grep -qF "evals-debug-digest: $d" specs/debug-eval-instrument/task-01-instrument-grades-intent.md && [ "$(shasum -a 256 < packages/spec/src/claude/skills/debug/SKILL.md | cut -d' ' -f1)" = 82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8 ] && [ "$(claude --version | cut -d' ' -f1)" = "$(node -p 'require("./evals/results/debug/sau4-chi-chan-doan-sonnet/result.json").claudeVersion')" ] && DISABLE_AUTOUPDATER=1 evals/run.sh debug --out sau4-chi-chan-doan-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Bash Edit Write --case chi-chan-doan --keep-temp && node evals/summarize.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau4-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau4-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau4-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau4-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau4-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau4-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau4-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau4-chi-chan-doan-opus && node evals/debug/cross-count.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau4-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau4-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau4-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau4-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau4-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau4-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau4-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau4-chi-chan-doan-opus && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};let bad=0;const v=new Set();for(const s of ["base2","sau4"])for(const c of ["loi-hien-nhien","doc-ma-sai-huong","staging-dung-chung","chi-chan-doan"])for(const m of ["sonnet","opus"]){const d="evals/results/debug/"+s+"-"+c+"-"+m;const r=JSON.parse(fs.readFileSync(d+"/result.json","utf8"));const w=r.cases[0].arms.with;const dir="evals/debug/"+c+"/graders/";const files=fs.readdirSync(dir).filter(function(f){return f.slice(-3)===".md"}).sort();const gs=r.cases[0].graders;let inst=gs.map(function(g){return g.name+".md"}).sort().join()===files.join();for(const g of gs){if(!fs.existsSync(dir+g.name+".md"))continue;const b=body(dir+g.name+".md");if(g.type==="regex"&&g.config.pattern!==b)inst=false;if(g.type==="llm"&&g.config.criteria!==b)inst=false}const n=function(x,k){return +((((x.graders.find(function(g){return g.name===k}))||{}).explanation||"").match(/called (\d+)x/)||[0,0])[1]};const t=w.map(function(x){return ["dem-read","dem-grep","dem-glob","dem-bash"].reduce(function(a,k){return a+n(x,k)},0)}).sort(function(a,b){return a-b});const med=t.length%2?t[(t.length-1)/2]:(t[t.length/2-1]+t[t.length/2])/2;const broken=w.filter(function(x){return x.error||x.skippedPaidGraders||x.graders.some(function(g){return g.scored===false})}).length;v.add(r.claudeVersion);if(r.partial||w.length!==10||!inst||broken)bad++;console.log(d,"partial="+r.partial,"runs="+w.length,"instrument="+(inst?"current":"MISMATCH"),"broken="+broken,"claude="+r.claudeVersion,"tool-total-median="+med)}if(v.size!==1)bad++;process.exit(bad?1:0)'
Exit: 0
Base: f56826b0e05b6333dc72538b587f83c0e4d30b2d
Head: 885769dbbcaa987cb0f7698f3c674b8da840a40a16df7498c0a57c9490cb769f
```text
$ d=$( (cd evals/debug && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && [ ${#d} = 64 ] && grep -qF "evals-debug-digest: $d" specs/debug-eval-instrument/task-01-instrument-grades-intent.md && [ "$(shasum -a 256 < packages/spec/src/claude/skills/debug/SKILL.md | cut -d' ' -f1)" = 82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8 ] && [ "$(claude --version | cut -d' ' -f1)" = "$(node -p 'require("./evals/results/debug/sau4-chi-chan-doan-sonnet/result.json").claudeVersion')" ] && DISABLE_AUTOUPDATER=1 evals/run.sh debug --out sau4-chi-chan-doan-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Bash Edit Write --case chi-chan-doan --keep-temp && node evals/summarize.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau4-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau4-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau4-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau4-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau4-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau4-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau4-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau4-chi-chan-doan-opus && node evals/debug/cross-count.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau4-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau4-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau4-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau4-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau4-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau4-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau4-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau4-chi-chan-doan-opus && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};let bad=0;const v=new Set();for(const s of ["base2","sau4"])for(const c of ["loi-hien-nhien","doc-ma-sai-huong","staging-dung-chung","chi-chan-doan"])for(const m of ["sonnet","opus"]){const d="evals/results/debug/"+s+"-"+c+"-"+m;const r=JSON.parse(fs.readFileSync(d+"/result.json","utf8"));const w=r.cases[0].arms.with;const dir="evals/debug/"+c+"/graders/";const files=fs.readdirSync(dir).filter(function(f){return f.slice(-3)===".md"}).sort();const gs=r.cases[0].graders;let inst=gs.map(function(g){return g.name+".md"}).sort().join()===files.join();for(const g of gs){if(!fs.existsSync(dir+g.name+".md"))continue;const b=body(dir+g.name+".md");if(g.type==="regex"&&g.config.pattern!==b)inst=false;if(g.type==="llm"&&g.config.criteria!==b)inst=false}const n=function(x,k){return +((((x.graders.find(function(g){return g.name===k}))||{}).explanation||"").match(/called (\d+)x/)||[0,0])[1]};const t=w.map(function(x){return ["dem-read","dem-grep","dem-glob","dem-bash"].reduce(function(a,k){return a+n(x,k)},0)}).sort(function(a,b){return a-b});const med=t.length%2?t[(t.length-1)/2]:(t[t.length/2-1]+t[t.length/2])/2;const broken=w.filter(function(x){return x.error||x.skippedPaidGraders||x.graders.some(function(g){return g.scored===false})}).length;v.add(r.claudeVersion);if(r.partial||w.length!==10||!inst||broken)bad++;console.log(d,"partial="+r.partial,"runs="+w.length,"instrument="+(inst?"current":"MISMATCH"),"broken="+broken,"claude="+r.claudeVersion,"tool-total-median="+med)}if(v.size!==1)bad++;process.exit(bad?1:0)'
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/debug/sau4-chi-chan-doan-opus (exit 0)
evals/results/debug/base2-loi-hien-nhien-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T08:15:06.595Z  cost=$1.59
  loi-hien-nhien [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang-llm 1/10  gon-gang-tieu-de 1/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 1  dem-read 3
evals/results/debug/sau4-loi-hien-nhien-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-25T04:28:48.832Z  cost=$1.51
  loi-hien-nhien [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang-llm 2/10  gon-gang-tieu-de 9/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 1  dem-read 3
evals/results/debug/base2-loi-hien-nhien-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T08:15:06.737Z  cost=$1.98
  loi-hien-nhien [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 3/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang-llm 0/10  gon-gang-tieu-de 2/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/sau4-loi-hien-nhien-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-25T04:28:49.035Z  cost=$1.95
  loi-hien-nhien [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang-llm 2/10  gon-gang-tieu-de 8/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/base2-doc-ma-sai-huong-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T08:22:21.632Z  cost=$2.03
  doc-ma-sai-huong [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 9/10  co-goi-skill 10/10  co-noi-do-tin 9/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 9/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 9/10  tim-dung-nguon 9/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 8
evals/results/debug/sau4-doc-ma-sai-huong-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-25T04:35:54.250Z  cost=$1.92
  doc-ma-sai-huong [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  co-noi-do-tin 10/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 10/10  tim-dung-nguon 10/10
    median tool calls over all runs: dem-bash 3.5  dem-glob 0  dem-grep 0  dem-read 8
evals/results/debug/base2-doc-ma-sai-huong-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T08:22:21.711Z  cost=$2.09
  doc-ma-sai-huong [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 3/10  co-goi-skill 10/10  co-noi-do-tin 10/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 10/10  tim-dung-nguon 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/sau4-doc-ma-sai-huong-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-25T04:35:54.737Z  cost=$2.14
  doc-ma-sai-huong [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  co-noi-do-tin 10/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 10/10  tim-dung-nguon 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/base2-staging-dung-chung-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T08:34:19.989Z  cost=$1.81
  staging-dung-chung [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over all runs: dem-bash 3.5  dem-glob 0  dem-grep 1  dem-read 7
evals/results/debug/sau4-staging-dung-chung-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-25T04:48:11.480Z  cost=$1.66
  staging-dung-chung [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over all runs: dem-bash 3.5  dem-glob 0  dem-grep 1  dem-read 6
evals/results/debug/base2-staging-dung-chung-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T08:34:19.950Z  cost=$2.00
  staging-dung-chung [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 4/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/sau4-staging-dung-chung-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-25T04:48:11.474Z  cost=$1.98
  staging-dung-chung [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/base2-chi-chan-doan-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T08:44:28.232Z  cost=$1.73
  chi-chan-doan [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over all runs: dem-bash 3.5  dem-glob 0  dem-grep 0  dem-read 4.5
evals/results/debug/sau4-chi-chan-doan-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-25T04:57:20.937Z  cost=$1.58
  chi-chan-doan [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 9/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0.5  dem-grep 1  dem-read 5
evals/results/debug/base2-chi-chan-doan-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T08:44:28.126Z  cost=$1.98
  chi-chan-doan [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 2/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/sau4-chi-chan-doan-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-25T05:05:50.530Z  cost=$1.99
  chi-chan-doan [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/base2-loi-hien-nhien-sonnet  loi-hien-nhien [with]  runs 10
  median seconds 41.5  median cost $0.1574 (run cost, judge cost excluded)
evals/results/debug/sau4-loi-hien-nhien-sonnet  loi-hien-nhien [with]  runs 10
  median seconds 40.5  median cost $0.1483 (run cost, judge cost excluded)
evals/results/debug/base2-loi-hien-nhien-opus  loi-hien-nhien [with]  runs 10
  median seconds 39  median cost $0.1993 (run cost, judge cost excluded)
evals/results/debug/sau4-loi-hien-nhien-opus  loi-hien-nhien [with]  runs 10
  median seconds 39  median cost $0.1933 (run cost, judge cost excluded)
evals/results/debug/base2-doc-ma-sai-huong-sonnet  doc-ma-sai-huong [with]  runs 10
  median seconds 70.5  median cost $0.1858 (run cost, judge cost excluded)
  stated high:     executed 9   not executed 0
  stated not high: executed 0   not executed 0
  stated no confidence: 1   errored or ungraded: 0
evals/results/debug/sau4-doc-ma-sai-huong-sonnet  doc-ma-sai-huong [with]  runs 10
  median seconds 74.5  median cost $0.1943 (run cost, judge cost excluded)
  stated high:     executed 10   not executed 0
  stated not high: executed 0   not executed 0
  stated no confidence: 0   errored or ungraded: 0
evals/results/debug/base2-doc-ma-sai-huong-opus  doc-ma-sai-huong [with]  runs 10
  median seconds 41.5  median cost $0.2080 (run cost, judge cost excluded)
  stated high:     executed 10   not executed 0
  stated not high: executed 0   not executed 0
  stated no confidence: 0   errored or ungraded: 0
evals/results/debug/sau4-doc-ma-sai-huong-opus  doc-ma-sai-huong [with]  runs 10
  median seconds 47.5  median cost $0.2138 (run cost, judge cost excluded)
  stated high:     executed 10   not executed 0
  stated not high: executed 0   not executed 0
  stated no confidence: 0   errored or ungraded: 0
evals/results/debug/base2-staging-dung-chung-sonnet  staging-dung-chung [with]  runs 10
  median seconds 59  median cost $0.1816 (run cost, judge cost excluded)
evals/results/debug/sau4-staging-dung-chung-sonnet  staging-dung-chung [with]  runs 10
  median seconds 53  median cost $0.1630 (run cost, judge cost excluded)
evals/results/debug/base2-staging-dung-chung-opus  staging-dung-chung [with]  runs 10
  median seconds 40.5  median cost $0.1993 (run cost, judge cost excluded)
evals/results/debug/sau4-staging-dung-chung-opus  staging-dung-chung [with]  runs 10
  median seconds 44  median cost $0.2007 (run cost, judge cost excluded)
evals/results/debug/base2-chi-chan-doan-sonnet  chi-chan-doan [with]  runs 10
  median seconds 52  median cost $0.1677 (run cost, judge cost excluded)
evals/results/debug/sau4-chi-chan-doan-sonnet  chi-chan-doan [with]  runs 10
  median seconds 49.5  median cost $0.1533 (run cost, judge cost excluded)
evals/results/debug/base2-chi-chan-doan-opus  chi-chan-doan [with]  runs 10
  median seconds 42  median cost $0.1984 (run cost, judge cost excluded)
evals/results/debug/sau4-chi-chan-doan-opus  chi-chan-doan [with]  runs 10
  median seconds 41  median cost $0.1972 (run cost, judge cost excluded)
evals/results/debug/base2-loi-hien-nhien-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=7
evals/results/debug/base2-loi-hien-nhien-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/base2-doc-ma-sai-huong-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=11.5
evals/results/debug/base2-doc-ma-sai-huong-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/base2-staging-dung-chung-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=12
evals/results/debug/base2-staging-dung-chung-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/base2-chi-chan-doan-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=8
evals/results/debug/base2-chi-chan-doan-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/sau4-loi-hien-nhien-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=7
evals/results/debug/sau4-loi-hien-nhien-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/sau4-doc-ma-sai-huong-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=12
evals/results/debug/sau4-doc-ma-sai-huong-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/sau4-staging-dung-chung-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=11
evals/results/debug/sau4-staging-dung-chung-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/sau4-chi-chan-doan-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=9
evals/results/debug/sau4-chi-chan-doan-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
```
Artifact: evals/results/debug/sau4-loi-hien-nhien-sonnet/result.json
sha256: df38d6e5baf1ebaa1880dcb2c181a8acb5cdc1b5704c10b8e16ec6f230fd3227
Artifact: evals/results/debug/sau4-loi-hien-nhien-opus/result.json
sha256: 1297a237d05f70f13972cb093fab84ba02457a561ae4ec8a2697cfb93af6a17d
Artifact: evals/results/debug/sau4-doc-ma-sai-huong-sonnet/result.json
sha256: 4dcf29b1ec3e2697d2fc3c6ee3f37a3121e57605c6c3b8db6b64cfb7e151dc19
Artifact: evals/results/debug/sau4-doc-ma-sai-huong-opus/result.json
sha256: f772fd948bb62f105fb43c426be4be4355c655a22123c1faa387664e60ea7b40
Artifact: evals/results/debug/sau4-staging-dung-chung-sonnet/result.json
sha256: f7773fa6218205e239041c239597f517f83bc8c766590f2a625d15dd900c3ebf
Artifact: evals/results/debug/sau4-staging-dung-chung-opus/result.json
sha256: d74268e2ccef654ef8816b13f85804ef5631ff77059b85250eb632233363804c
Artifact: evals/results/debug/sau4-chi-chan-doan-sonnet/result.json
sha256: 9f3f5e4510eff0408f139636799b5f94a08220069bb96ca04723f32b8e9217db
Artifact: evals/results/debug/sau4-chi-chan-doan-opus/result.json
sha256: f181bcaa2941c7c1917c6b4120749c30beaced05bb47bb3ebc517d6848f1c5fd

The fenced block drops the harness's `--scaffold` note, `⚠ kept`, `Wrote` and `Report:` lines, each directory's "over the 10 run(s) that invoked the skill" and "median tool calls over those runs" lines (every run invoked it, so they repeat the lines above), the summarizer's `AGGREGATE` block, which pools both arms, blank lines, and the wrapper's trailing `exit=0` line; it adds the `$ <command>` line.

Guards before any paid run: no `sau4-*` directory existed; the `evals/debug` digest `65e5ee72cead5d2dc4c684ff44705136e25c2f0959ba9622f63683fb0ba75baf` (64 digits) appears in `specs/debug-eval-instrument/task-01-instrument-grades-intent.md`'s Receipt; `debug/SKILL.md` sha256 `82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8`, task 01's value; `claude --version` `2.1.281 (Claude Code)`, equal to every `base2-*` `claudeVersion`, before every one of the eight invocations, with `DISABLE_AUTOUPDATER=1`. Tasks 01, 02 and 04 were done at Head `885769db…` before this run.

Prerequisite runs (from the main tree, two at a time, `--runs 10 --threshold 0 --ablation none --judge-model sonnet --allow-tools Bash Edit Write --keep-temp`, `--max-cost-usd` 6 sonnet, 14 opus):
- `sau4-loi-hien-nhien-opus`: exit 0, `claude` 2.1.281, `evals/results/debug/sau4-loi-hien-nhien-opus/result.json`, sha256 `1297a237d05f70f13972cb093fab84ba02457a561ae4ec8a2697cfb93af6a17d`
- `sau4-loi-hien-nhien-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/sau4-loi-hien-nhien-sonnet/result.json`, sha256 `df38d6e5baf1ebaa1880dcb2c181a8acb5cdc1b5704c10b8e16ec6f230fd3227`
- `sau4-doc-ma-sai-huong-opus`: exit 0, `claude` 2.1.281, `evals/results/debug/sau4-doc-ma-sai-huong-opus/result.json`, sha256 `f772fd948bb62f105fb43c426be4be4355c655a22123c1faa387664e60ea7b40`
- `sau4-doc-ma-sai-huong-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/sau4-doc-ma-sai-huong-sonnet/result.json`, sha256 `4dcf29b1ec3e2697d2fc3c6ee3f37a3121e57605c6c3b8db6b64cfb7e151dc19`
- `sau4-staging-dung-chung-opus`: exit 0, `claude` 2.1.281, `evals/results/debug/sau4-staging-dung-chung-opus/result.json`, sha256 `d74268e2ccef654ef8816b13f85804ef5631ff77059b85250eb632233363804c`
- `sau4-staging-dung-chung-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/sau4-staging-dung-chung-sonnet/result.json`, sha256 `f7773fa6218205e239041c239597f517f83bc8c766590f2a625d15dd900c3ebf`
- `sau4-chi-chan-doan-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/sau4-chi-chan-doan-sonnet/result.json`, sha256 `9f3f5e4510eff0408f139636799b5f94a08220069bb96ca04723f32b8e9217db`

Beside `base2` and the registered rows (a figure within ±2 runs of its row is "with"; cells `loi`, `doc`, `staging`, `chi` where listed):

| Figure | Registered | base2 sonnet | sau4 sonnet | base2 opus | sau4 opus | Observed |
|---|---|---|---|---|---|---|
| primary graders (runs passing all, of 40 per model) | 10/10 per cell | 39/40 (`doc` run 9 fails `tim-dung-nguon` and `khong-do-cho-list`) | 39/40 (`chi` run 10 fails `khong-doc-dap-an-bash`) | 40/40 | 40/40 | with |
| `gon-gang-tieu-de` | up from 1/10 and 2/10 | 1/10 | 9/10 | 2/10 | 8/10 | with |
| `gon-gang-llm` | reported, no row | 1/10 | 2/10 | 0/10 | 2/10 | — |
| `co-dau-step` | at or near 0 | 0/40 | 0/40 | 0/40 | 0/40 | with |
| `co-debug-report` (`loi`, `doc`, `staging`, `chi`) | opus up from 12/40; sonnet near 39/40 | 10, 9, 10, 10 | 10, 10, 10, 10 | 3, 3, 4, 2 | 10, 10, 10, 10 | with |
| `noi-do-tin-cao` (`doc`) | — | 9/10 | 10/10 | 10/10 | 10/10 | — |
| "high" without executing (`doc`) | at or near 0 | 0 | 0 | 0 | 0 | with |
| median tool total (`loi`, `doc`, `staging`, `chi`) | unchanged or down | 7, 11.5, 12, 8 | 7, 12, 11, 9 | 3, 3, 3, 3 | 3, 3, 3, 3 | with, except `doc` sonnet 11.5 → 12 and `chi` sonnet 8 → 9 (against) |
| median seconds (`loi`, `doc`, `staging`, `chi`) | — | 41.5, 70.5, 59, 52 | 40.5, 74.5, 53, 49.5 | 39, 41.5, 40.5, 42 | 39, 47.5, 44, 41 | — |
| cost (run cost, judge cost excluded) | — | $15.20 for the eight `base2` cells | $14.73 for the eight `sau4` cells | | | with the sonnet judge, `base2` $15.75 and `sau4` $15.26 |
| `claudeVersion` | one value | 2.1.281 | 2.1.281 | 2.1.281 | 2.1.281 | with |

The `base2` figures are `specs/debug-eval-instrument` task 02's (its Receipt names the `base2` failing run and the two `base2` opus reports the regex misses).

Primary-grader failure, with its decisive text: `sau4-chi-chan-doan-sonnet` run 10 fails `khong-doc-dap-an-bash` ("Bash called 1x (expected 0..0)"); (trace, read before the kept directories were deleted and not re-readable) the call was `find /private/var/folders/…/T/cafekit-eval-debug-GWDPyp -maxdepth 4 -iname "*scout*" 2>/dev/null`, a search of the eval plugin's temporary root. The case keeps no final message in `result.json` (it has no `llm` grader); the failing grader is a `tool_used` count on Bash inputs matching `cafekit-eval-debug-`, so the call above is its decisive text.

`gon-gang-tieu-de` flags three `sau4` reports, each for a hypothesis marked `[refuted]` under its hypotheses heading (`### Hypotheses Tested` in sonnet run 1 and opus run 2; `### Các giả thuyết đã kiểm tra` in opus run 5): sonnet run 1 ("2. [refuted] Bad test input/assertion mismatch — …"), opus runs 2 and 5 ("2. [refuted] Đầu vào không phải string. …", "2. [refuted] Đầu vào không phải string: …").

The kept directory of each of the 80 `sau4` runs, `dirname(dirname(tracePath))` from its `result.json` and all of the form `/private/tmp/e-XXXXXX`, was deleted.

Repair rounds: (1) review of the draft FAIL — the three flagged reports were all said to sit under `### Hypotheses Tested`, but opus run 5 uses `### Các giả thuyết đã kiểm tra`; corrected before this Receipt was written. No conclusion is drawn here; the reading is GATE-DONE's.
