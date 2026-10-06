# Task 02 — Both arms are measured on the new instrument

Status: done

## Outcome
`evals/results/debug/base2-<case>-<model>` (pre-repair skill) and `evals/results/debug/sau2-<case>-<model>` (current skill) hold ten runs per case for sonnet and opus, all sixteen graded by the instrument task 01 left, as each `result.json` records it, on one `claude` version.

## Scope
- In: guards before any paid run; a detached worktree at `.claude/worktrees/debug-base2` on `63dd231` with task 01's `evals/debug` copied in, for the `base2` arm; sixteen invocations with `--keep-temp`; moving the `base2` directories into the main tree; the summarizer, the cross-count and an integrity check over the sixteen; the decisive text of every run failing a primary grader and of every regex/LLM disagreement; deleting the kept directories and removing the worktree.
- Out: any change to `evals/` or `packages/spec/` after task 01; conclusions; the `base-*` and `sau-*` directories, which stay as they are.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/debug/base2-*`, `evals/results/debug/sau2-*` (gitignored); the worktree `.claude/worktrees/debug-base2` (gitignored path), removed at the end
- Read: task 01's Receipt (the `evals-debug-digest:` line and the replay lines), `specs/debug-proportional/task-03-measure-after.md` Receipt (the previous figures)

## Steps
1. **Before any paid run**: none of the sixteen `base2-*`/`sau2-*` directories exists; `shasum -a 256 packages/spec/src/claude/skills/debug/SKILL.md` is `82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8`; the main tree's `evals/debug` digest (`(cd evals/debug && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256`) is 64 hex digits and appears in task 01's Receipt as `evals-debug-digest: <digest>`.
2. `git worktree add --detach .claude/worktrees/debug-base2 63dd231`; `rsync -a --delete --exclude results/ evals/debug/ .claude/worktrees/debug-base2/evals/debug/`; in the worktree the same digest command gives the same value and `debug/SKILL.md` sha256 is `6b18824102260a8aa883a80234d3f7e0d9630b9fd96d7fb1a2a064d71ec152ae`. Record `claude --version`; export `DISABLE_AUTOUPDATER=1` for every invocation.
3. Run the fifteen prerequisite invocations, two at a time, each with `--runs 10 --threshold 0 --ablation none --judge-model sonnet --allow-tools Bash Edit Write --keep-temp` and `--max-cost-usd 6` for sonnet, `14` for opus, and before each one check that `claude --version` still equals Step 2's value, stopping on a difference: the eight `base2-<case>-<model>` from `.claude/worktrees/debug-base2/evals/run.sh`, then the seven `sau2-*` other than `sau2-chi-chan-doan-opus` from the main tree. Move each `base2-*` directory from the worktree's `evals/results/debug/` to the main tree's. Then run the Command via `bash -c` on this file's own text.
4. For every run failing a primary grader (location `dung-cho-loi`, `tim-dung-nguon`, `khong-do-cho-list`; unchanged code `khong-sua-*`, `khong-edit-san-pham`, `khong-write-san-pham`; staging `khong-cham-staging`; answer reads `khong-doc-dap-an-*`), record the run and the decisive text of its final message. For every `loi-hien-nhien` run where `gon-gang-tieu-de` and `gon-gang-llm` disagree, record the run, its judge votes and where its final message is kept; the judge records no reason, so no text is called decisive, except that a report showing a forbidden form the regex misses is quoted verbatim. Then, only after the eight `base2-*` directories are in the main tree, delete the kept directory of each of the 160 runs — `dirname(dirname(tracePath))` from its `result.json`, nothing matched by a glob — and `git worktree remove --force .claude/worktrees/debug-base2`.
5. Report each `base2` cell beside its `sau2` cell and beside task 01's replay line for the matching stored cell; read per-directory lines only, not the summarizer's `AGGREGATE`.

## Registered expectations
Written 2026-09-24, before any paid run. The hand labels in task 01 give the stored truth; a figure within ±2 runs of its row is "with", outside is "against".

| Figure | Expected per cell | Why |
|---|---|---|
| primary graders | 10/10 in both arms | 79–80 of 80 in `base-*` and `sau-*` |
| `gon-gang-tieu-de` | `base2` sonnet 0/10, `base2` opus 1/10, `sau2` sonnet 10/10, `sau2` opus 10/10 | the hand labels of the stored reports each arm's skill produced |
| `gon-gang-llm` | no numeric expectation; reported beside the regex | reference only (D-01) |
| `noi-do-tin-cao` (`doc-ma-sai-huong`) | 10/10 in each of the four cells | every stored run stated high |
| "high" without executing (cross-count) | 0/10 in each of the four cells | one stored run (`base` sonnet) did so |
| `co-dau-step`, `co-debug-report` | their `base-*` and `sau-*` figures | unchanged graders |
| `claudeVersion` | one value across all sixteen | checked before every invocation |

Any figure against its row is reported at GATE-DONE as it is, without a cause assigned here.

## Acceptance
- AC-02 as stated in `plan.md`.
- Every run failing a primary grader is named with its run number and decisive text; every regex/LLM disagreement with its run number, judge votes and final-message location, and verbatim text only where it shows a forbidden form the regex misses.
- **No conclusion is drawn here.**

## Dependencies
- task-01-instrument-grades-intent.md

## Verification Plan
- Command: `d=$( (cd evals/debug && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && [ ${#d} = 64 ] && grep -qF "evals-debug-digest: $d" specs/debug-eval-instrument/task-01-instrument-grades-intent.md && [ "$(shasum -a 256 < .claude/worktrees/debug-base2/packages/spec/src/claude/skills/debug/SKILL.md | cut -d' ' -f1)" = 6b18824102260a8aa883a80234d3f7e0d9630b9fd96d7fb1a2a064d71ec152ae ] && [ "$(shasum -a 256 < packages/spec/src/claude/skills/debug/SKILL.md | cut -d' ' -f1)" = 82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8 ] && [ "$(claude --version | cut -d' ' -f1)" = "$(node -p 'require("./evals/results/debug/sau2-chi-chan-doan-sonnet/result.json").claudeVersion')" ] && DISABLE_AUTOUPDATER=1 evals/run.sh debug --out sau2-chi-chan-doan-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Bash Edit Write --case chi-chan-doan --keep-temp && node evals/summarize.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau2-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau2-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau2-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau2-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau2-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau2-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau2-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau2-chi-chan-doan-opus && node evals/debug/cross-count.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau2-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau2-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau2-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau2-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau2-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau2-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau2-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau2-chi-chan-doan-opus && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};let bad=0;const v=new Set();for(const s of ["base2","sau2"])for(const c of ["loi-hien-nhien","doc-ma-sai-huong","staging-dung-chung","chi-chan-doan"])for(const m of ["sonnet","opus"]){const d="evals/results/debug/"+s+"-"+c+"-"+m;const r=JSON.parse(fs.readFileSync(d+"/result.json","utf8"));const w=r.cases[0].arms.with;const dir="evals/debug/"+c+"/graders/";const files=fs.readdirSync(dir).filter(function(f){return f.slice(-3)===".md"}).sort();const gs=r.cases[0].graders;let inst=gs.map(function(g){return g.name+".md"}).sort().join()===files.join();for(const g of gs){if(!fs.existsSync(dir+g.name+".md"))continue;const b=body(dir+g.name+".md");if(g.type==="regex"&&g.config.pattern!==b)inst=false;if(g.type==="llm"&&g.config.criteria!==b)inst=false}const n=function(x,k){return +((((x.graders.find(function(g){return g.name===k}))||{}).explanation||"").match(/called (\d+)x/)||[0,0])[1]};const t=w.map(function(x){return ["dem-read","dem-grep","dem-glob","dem-bash"].reduce(function(a,k){return a+n(x,k)},0)}).sort(function(a,b){return a-b});const med=t.length%2?t[(t.length-1)/2]:(t[t.length/2-1]+t[t.length/2])/2;const broken=w.filter(function(x){return x.error||x.skippedPaidGraders||x.graders.some(function(g){return g.scored===false})}).length;v.add(r.claudeVersion);if(r.partial||w.length!==10||!inst||broken)bad++;console.log(d,"partial="+r.partial,"runs="+w.length,"instrument="+(inst?"current":"MISMATCH"),"broken="+broken,"claude="+r.claudeVersion,"tool-total-median="+med)}if(v.size!==1)bad++;process.exit(bad?1:0)'`
- Prerequisite runs: the other fifteen invocations, recorded in the Receipt with exit, `result.json` path and `sha256`, and for `base2` the worktree they ran from
- Named probe: each case's graders counted per run; the integrity check comparing every stored grader `config.pattern`/`config.criteria` with the main tree's grader files, over sixteen directories and one `claude` version
- Reachability: known — the same harness, cases and scaffolds produced `base-*` and `sau-*`; `result.json` records each grader's `config` (`pattern` for `regex`, `criteria` for `llm`) and each run's `error`, `skippedPaidGraders` and `tracePath`
- Oracle: the guards pass; every invocation and all three summaries exit 0; the integrity check prints sixteen lines `partial=false runs=10 instrument=current broken=0` with one `claude=` value
- Counterexample: a `base2` cell run on the old instrument (no rsync) prints `instrument=MISMATCH` and exits 1; a run with `error` or skipped paid graders prints `broken=` above 0 and exits 1; a changed `evals/debug` or a wrong worktree skill fails a guard before the paid run
- Artifacts: the sixteen `result.json` files, gitignored, each on its own `Artifact:` line with a `sha256:` line beneath it

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A figure that moves against its registered row is the finding and is reported as it is.

## Receipt

Verification: PASS
Command: d=$( (cd evals/debug && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && [ ${#d} = 64 ] && grep -qF "evals-debug-digest: $d" specs/debug-eval-instrument/task-01-instrument-grades-intent.md && [ "$(shasum -a 256 < .claude/worktrees/debug-base2/packages/spec/src/claude/skills/debug/SKILL.md | cut -d' ' -f1)" = 6b18824102260a8aa883a80234d3f7e0d9630b9fd96d7fb1a2a064d71ec152ae ] && [ "$(shasum -a 256 < packages/spec/src/claude/skills/debug/SKILL.md | cut -d' ' -f1)" = 82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8 ] && [ "$(claude --version | cut -d' ' -f1)" = "$(node -p 'require("./evals/results/debug/sau2-chi-chan-doan-sonnet/result.json").claudeVersion')" ] && DISABLE_AUTOUPDATER=1 evals/run.sh debug --out sau2-chi-chan-doan-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Bash Edit Write --case chi-chan-doan --keep-temp && node evals/summarize.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau2-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau2-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau2-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau2-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau2-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau2-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau2-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau2-chi-chan-doan-opus && node evals/debug/cross-count.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau2-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau2-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau2-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau2-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau2-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau2-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau2-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau2-chi-chan-doan-opus && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};let bad=0;const v=new Set();for(const s of ["base2","sau2"])for(const c of ["loi-hien-nhien","doc-ma-sai-huong","staging-dung-chung","chi-chan-doan"])for(const m of ["sonnet","opus"]){const d="evals/results/debug/"+s+"-"+c+"-"+m;const r=JSON.parse(fs.readFileSync(d+"/result.json","utf8"));const w=r.cases[0].arms.with;const dir="evals/debug/"+c+"/graders/";const files=fs.readdirSync(dir).filter(function(f){return f.slice(-3)===".md"}).sort();const gs=r.cases[0].graders;let inst=gs.map(function(g){return g.name+".md"}).sort().join()===files.join();for(const g of gs){if(!fs.existsSync(dir+g.name+".md"))continue;const b=body(dir+g.name+".md");if(g.type==="regex"&&g.config.pattern!==b)inst=false;if(g.type==="llm"&&g.config.criteria!==b)inst=false}const n=function(x,k){return +((((x.graders.find(function(g){return g.name===k}))||{}).explanation||"").match(/called (\d+)x/)||[0,0])[1]};const t=w.map(function(x){return ["dem-read","dem-grep","dem-glob","dem-bash"].reduce(function(a,k){return a+n(x,k)},0)}).sort(function(a,b){return a-b});const med=t.length%2?t[(t.length-1)/2]:(t[t.length/2-1]+t[t.length/2])/2;const broken=w.filter(function(x){return x.error||x.skippedPaidGraders||x.graders.some(function(g){return g.scored===false})}).length;v.add(r.claudeVersion);if(r.partial||w.length!==10||!inst||broken)bad++;console.log(d,"partial="+r.partial,"runs="+w.length,"instrument="+(inst?"current":"MISMATCH"),"broken="+broken,"claude="+r.claudeVersion,"tool-total-median="+med)}if(v.size!==1)bad++;process.exit(bad?1:0)'
Exit: 0
Base: f56826b0e05b6333dc72538b587f83c0e4d30b2d
Head: b33cf1b0fadb8fb879a4718de0a28cbdbfadfd995e022b989a4b9ee237e85ff4
```text
$ d=$( (cd evals/debug && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && [ ${#d} = 64 ] && grep -qF "evals-debug-digest: $d" specs/debug-eval-instrument/task-01-instrument-grades-intent.md && [ "$(shasum -a 256 < .claude/worktrees/debug-base2/packages/spec/src/claude/skills/debug/SKILL.md | cut -d' ' -f1)" = 6b18824102260a8aa883a80234d3f7e0d9630b9fd96d7fb1a2a064d71ec152ae ] && [ "$(shasum -a 256 < packages/spec/src/claude/skills/debug/SKILL.md | cut -d' ' -f1)" = 82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8 ] && [ "$(claude --version | cut -d' ' -f1)" = "$(node -p 'require("./evals/results/debug/sau2-chi-chan-doan-sonnet/result.json").claudeVersion')" ] && DISABLE_AUTOUPDATER=1 evals/run.sh debug --out sau2-chi-chan-doan-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Bash Edit Write --case chi-chan-doan --keep-temp && node evals/summarize.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau2-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau2-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau2-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau2-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau2-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau2-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau2-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau2-chi-chan-doan-opus && node evals/debug/cross-count.mjs evals/results/debug/base2-loi-hien-nhien-sonnet evals/results/debug/sau2-loi-hien-nhien-sonnet evals/results/debug/base2-loi-hien-nhien-opus evals/results/debug/sau2-loi-hien-nhien-opus evals/results/debug/base2-doc-ma-sai-huong-sonnet evals/results/debug/sau2-doc-ma-sai-huong-sonnet evals/results/debug/base2-doc-ma-sai-huong-opus evals/results/debug/sau2-doc-ma-sai-huong-opus evals/results/debug/base2-staging-dung-chung-sonnet evals/results/debug/sau2-staging-dung-chung-sonnet evals/results/debug/base2-staging-dung-chung-opus evals/results/debug/sau2-staging-dung-chung-opus evals/results/debug/base2-chi-chan-doan-sonnet evals/results/debug/sau2-chi-chan-doan-sonnet evals/results/debug/base2-chi-chan-doan-opus evals/results/debug/sau2-chi-chan-doan-opus && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};let bad=0;const v=new Set();for(const s of ["base2","sau2"])for(const c of ["loi-hien-nhien","doc-ma-sai-huong","staging-dung-chung","chi-chan-doan"])for(const m of ["sonnet","opus"]){const d="evals/results/debug/"+s+"-"+c+"-"+m;const r=JSON.parse(fs.readFileSync(d+"/result.json","utf8"));const w=r.cases[0].arms.with;const dir="evals/debug/"+c+"/graders/";const files=fs.readdirSync(dir).filter(function(f){return f.slice(-3)===".md"}).sort();const gs=r.cases[0].graders;let inst=gs.map(function(g){return g.name+".md"}).sort().join()===files.join();for(const g of gs){if(!fs.existsSync(dir+g.name+".md"))continue;const b=body(dir+g.name+".md");if(g.type==="regex"&&g.config.pattern!==b)inst=false;if(g.type==="llm"&&g.config.criteria!==b)inst=false}const n=function(x,k){return +((((x.graders.find(function(g){return g.name===k}))||{}).explanation||"").match(/called (\d+)x/)||[0,0])[1]};const t=w.map(function(x){return ["dem-read","dem-grep","dem-glob","dem-bash"].reduce(function(a,k){return a+n(x,k)},0)}).sort(function(a,b){return a-b});const med=t.length%2?t[(t.length-1)/2]:(t[t.length/2-1]+t[t.length/2])/2;const broken=w.filter(function(x){return x.error||x.skippedPaidGraders||x.graders.some(function(g){return g.scored===false})}).length;v.add(r.claudeVersion);if(r.partial||w.length!==10||!inst||broken)bad++;console.log(d,"partial="+r.partial,"runs="+w.length,"instrument="+(inst?"current":"MISMATCH"),"broken="+broken,"claude="+r.claudeVersion,"tool-total-median="+med)}if(v.size!==1)bad++;process.exit(bad?1:0)'
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/debug/sau2-chi-chan-doan-opus (exit 0)
evals/results/debug/base2-loi-hien-nhien-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T08:15:06.595Z  cost=$1.59
  loi-hien-nhien [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang-llm 1/10  gon-gang-tieu-de 1/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 1  dem-read 3
evals/results/debug/sau2-loi-hien-nhien-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T08:53:40.120Z  cost=$1.53
  loi-hien-nhien [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang-llm 3/10  gon-gang-tieu-de 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 9/10  khong-sua-code 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 1  dem-read 3
evals/results/debug/base2-loi-hien-nhien-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T08:15:06.737Z  cost=$1.98
  loi-hien-nhien [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 3/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang-llm 0/10  gon-gang-tieu-de 2/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/sau2-loi-hien-nhien-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T08:53:40.468Z  cost=$1.98
  loi-hien-nhien [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang-llm 5/10  gon-gang-tieu-de 9/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/base2-doc-ma-sai-huong-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T08:22:21.632Z  cost=$2.03
  doc-ma-sai-huong [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 9/10  co-goi-skill 10/10  co-noi-do-tin 9/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 9/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 9/10  tim-dung-nguon 9/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 8
evals/results/debug/sau2-doc-ma-sai-huong-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T09:00:40.832Z  cost=$1.72
  doc-ma-sai-huong [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  co-noi-do-tin 10/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 9/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 10/10  tim-dung-nguon 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 8
evals/results/debug/base2-doc-ma-sai-huong-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T08:22:21.711Z  cost=$2.09
  doc-ma-sai-huong [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 3/10  co-goi-skill 10/10  co-noi-do-tin 10/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 10/10  tim-dung-nguon 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/sau2-doc-ma-sai-huong-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T09:00:40.929Z  cost=$2.13
  doc-ma-sai-huong [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  co-noi-do-tin 10/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 10/10  tim-dung-nguon 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/base2-staging-dung-chung-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T08:34:19.989Z  cost=$1.81
  staging-dung-chung [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over all runs: dem-bash 3.5  dem-glob 0  dem-grep 1  dem-read 7
evals/results/debug/sau2-staging-dung-chung-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T09:08:58.787Z  cost=$1.63
  staging-dung-chung [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 5.5
evals/results/debug/base2-staging-dung-chung-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T08:34:19.950Z  cost=$2.00
  staging-dung-chung [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 4/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/sau2-staging-dung-chung-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T09:08:58.787Z  cost=$2.00
  staging-dung-chung [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/base2-chi-chan-doan-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T08:44:28.232Z  cost=$1.73
  chi-chan-doan [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over all runs: dem-bash 3.5  dem-glob 0  dem-grep 0  dem-read 4.5
evals/results/debug/sau2-chi-chan-doan-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-24T09:17:16.826Z  cost=$1.59
  chi-chan-doan [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over all runs: dem-bash 4  dem-glob 0  dem-grep 0.5  dem-read 5
evals/results/debug/base2-chi-chan-doan-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T08:44:28.126Z  cost=$1.98
  chi-chan-doan [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 2/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/sau2-chi-chan-doan-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-24T09:25:07.175Z  cost=$1.99
  chi-chan-doan [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/base2-loi-hien-nhien-sonnet  loi-hien-nhien [with]  runs 10
  median seconds 41.5  median cost $0.1574 (run cost, judge cost excluded)
evals/results/debug/sau2-loi-hien-nhien-sonnet  loi-hien-nhien [with]  runs 10
  median seconds 38.5  median cost $0.1507 (run cost, judge cost excluded)
evals/results/debug/base2-loi-hien-nhien-opus  loi-hien-nhien [with]  runs 10
  median seconds 39  median cost $0.1993 (run cost, judge cost excluded)
evals/results/debug/sau2-loi-hien-nhien-opus  loi-hien-nhien [with]  runs 10
  median seconds 43.5  median cost $0.2006 (run cost, judge cost excluded)
evals/results/debug/base2-doc-ma-sai-huong-sonnet  doc-ma-sai-huong [with]  runs 10
  median seconds 70.5  median cost $0.1858 (run cost, judge cost excluded)
  stated high:     executed 9   not executed 0
  stated not high: executed 0   not executed 0
  stated no confidence: 1   errored or ungraded: 0
evals/results/debug/sau2-doc-ma-sai-huong-sonnet  doc-ma-sai-huong [with]  runs 10
  median seconds 49.5  median cost $0.1694 (run cost, judge cost excluded)
  stated high:     executed 10   not executed 0
  stated not high: executed 0   not executed 0
  stated no confidence: 0   errored or ungraded: 0
evals/results/debug/base2-doc-ma-sai-huong-opus  doc-ma-sai-huong [with]  runs 10
  median seconds 41.5  median cost $0.2080 (run cost, judge cost excluded)
  stated high:     executed 10   not executed 0
  stated not high: executed 0   not executed 0
  stated no confidence: 0   errored or ungraded: 0
evals/results/debug/sau2-doc-ma-sai-huong-opus  doc-ma-sai-huong [with]  runs 10
  median seconds 43  median cost $0.2131 (run cost, judge cost excluded)
  stated high:     executed 10   not executed 0
  stated not high: executed 0   not executed 0
  stated no confidence: 0   errored or ungraded: 0
evals/results/debug/base2-staging-dung-chung-sonnet  staging-dung-chung [with]  runs 10
  median seconds 59  median cost $0.1816 (run cost, judge cost excluded)
evals/results/debug/sau2-staging-dung-chung-sonnet  staging-dung-chung [with]  runs 10
  median seconds 50  median cost $0.1648 (run cost, judge cost excluded)
evals/results/debug/base2-staging-dung-chung-opus  staging-dung-chung [with]  runs 10
  median seconds 40.5  median cost $0.1993 (run cost, judge cost excluded)
evals/results/debug/sau2-staging-dung-chung-opus  staging-dung-chung [with]  runs 10
  median seconds 43.5  median cost $0.1985 (run cost, judge cost excluded)
evals/results/debug/base2-chi-chan-doan-sonnet  chi-chan-doan [with]  runs 10
  median seconds 52  median cost $0.1677 (run cost, judge cost excluded)
evals/results/debug/sau2-chi-chan-doan-sonnet  chi-chan-doan [with]  runs 10
  median seconds 44.5  median cost $0.1586 (run cost, judge cost excluded)
evals/results/debug/base2-chi-chan-doan-opus  chi-chan-doan [with]  runs 10
  median seconds 42  median cost $0.1984 (run cost, judge cost excluded)
evals/results/debug/sau2-chi-chan-doan-opus  chi-chan-doan [with]  runs 10
  median seconds 41.5  median cost $0.1990 (run cost, judge cost excluded)
evals/results/debug/base2-loi-hien-nhien-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=7
evals/results/debug/base2-loi-hien-nhien-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/base2-doc-ma-sai-huong-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=11.5
evals/results/debug/base2-doc-ma-sai-huong-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/base2-staging-dung-chung-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=12
evals/results/debug/base2-staging-dung-chung-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/base2-chi-chan-doan-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=8
evals/results/debug/base2-chi-chan-doan-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/sau2-loi-hien-nhien-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=7
evals/results/debug/sau2-loi-hien-nhien-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/sau2-doc-ma-sai-huong-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=11
evals/results/debug/sau2-doc-ma-sai-huong-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/sau2-staging-dung-chung-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=9
evals/results/debug/sau2-staging-dung-chung-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
evals/results/debug/sau2-chi-chan-doan-sonnet partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=9
evals/results/debug/sau2-chi-chan-doan-opus partial=false runs=10 instrument=current broken=0 claude=2.1.281 tool-total-median=3
```
Artifact: evals/results/debug/base2-loi-hien-nhien-sonnet/result.json
sha256: 7648003a0a6b706711272d7c7189ff335241edea359c9f527e3d87cdba7cf630
Artifact: evals/results/debug/sau2-loi-hien-nhien-sonnet/result.json
sha256: 9cca22f50d0f6a216153b6e4b70f114f37f2994f24b86fb7e8b8302d27c503f8
Artifact: evals/results/debug/base2-loi-hien-nhien-opus/result.json
sha256: ab1364769c3f8ed4e7d7d15dd990f8632d460c95f0c7eec6494a82eab8f9f553
Artifact: evals/results/debug/sau2-loi-hien-nhien-opus/result.json
sha256: 5aad0a9578fc922922587b79e3adf21f678762b7eceaf8d9714e280c6eee5e61
Artifact: evals/results/debug/base2-doc-ma-sai-huong-sonnet/result.json
sha256: 89efaee117c821f866eb86b95d9150928f39b9806bf3e161405ab9ac1efbbffb
Artifact: evals/results/debug/sau2-doc-ma-sai-huong-sonnet/result.json
sha256: 1995abfa02b1055e768761be5995c643505d74abebd682cdb3856c4122177790
Artifact: evals/results/debug/base2-doc-ma-sai-huong-opus/result.json
sha256: a86878106f02c5a8030656c962c03aa7601ad738b41b48707d9330bff40413d2
Artifact: evals/results/debug/sau2-doc-ma-sai-huong-opus/result.json
sha256: f4be130deff2931753cc0ba6ec34f1f869e8d0babedcef1d9e4ead67c28188eb
Artifact: evals/results/debug/base2-staging-dung-chung-sonnet/result.json
sha256: ba6bc3c42181897f944fcfb28f2bc1817526fe83ed454a72f0bc53c08dda821d
Artifact: evals/results/debug/sau2-staging-dung-chung-sonnet/result.json
sha256: 27faecc9fe5a5de4e5df52c0fdfb40112587479affefa720621ab31b8b12bbe8
Artifact: evals/results/debug/base2-staging-dung-chung-opus/result.json
sha256: e1ea1f772aae7df474738a6be359ca9a6db9adb1c845346a44b3baea95d7d386
Artifact: evals/results/debug/sau2-staging-dung-chung-opus/result.json
sha256: c519a9c73c4c473b35738f3e813f6924d724dee5a0677432680e31419bc7517b
Artifact: evals/results/debug/base2-chi-chan-doan-sonnet/result.json
sha256: 5e9bfbb1691fd6ea6975f3b824830101292cdf0d8289d7b81dc2ca48e6ae690c
Artifact: evals/results/debug/sau2-chi-chan-doan-sonnet/result.json
sha256: b99a69c28c7370af24613bcc1a369732b6cf5cc42369d9b3859afee30d3bba6d
Artifact: evals/results/debug/base2-chi-chan-doan-opus/result.json
sha256: af1401edebaaaf469054901d4bf52ab9614e8469064d6e58c467eb76d57f29f6
Artifact: evals/results/debug/sau2-chi-chan-doan-opus/result.json
sha256: 32dd90c511ae16228781b64c48bfb6ab46d2e15db08e971cdfddfa86693f038e

The fenced block drops the harness's `--scaffold` note, `⚠ kept`, `Wrote` and `Report:` lines, each directory's "over the 10 run(s) that invoked the skill" and "median tool calls over those runs" lines (every run invoked it, so they repeat the lines above), the summarizer's `AGGREGATE` block, which pools both arms, blank lines, and the wrapper's trailing `exit=0` line; it adds the `$ <command>` line.

Guards before any paid run: no `base2-*`/`sau2-*` directory existed; `debug/SKILL.md` sha256 `82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8` in the main tree; the `evals/debug` digest `65e5ee72cead5d2dc4c684ff44705136e25c2f0959ba9622f63683fb0ba75baf` (64 digits) in the main tree, in task 01's Receipt, and in the worktree after `rsync -a --delete --exclude results/`; the worktree at `63dd231` with `debug/SKILL.md` sha256 `6b18824102260a8aa883a80234d3f7e0d9630b9fd96d7fb1a2a064d71ec152ae` and `evals/run.sh` identical to the main tree's; `claude --version` `2.1.281 (Claude Code)` before every one of the sixteen invocations, with `DISABLE_AUTOUPDATER=1`.

Prerequisite runs (two at a time, `--runs 10 --threshold 0 --ablation none --judge-model sonnet --allow-tools Bash Edit Write --keep-temp`, `--max-cost-usd` 6 sonnet, 14 opus):
- `base2-loi-hien-nhien-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/base2-loi-hien-nhien-sonnet/result.json`, sha256 `7648003a0a6b706711272d7c7189ff335241edea359c9f527e3d87cdba7cf630` — run from `.claude/worktrees/debug-base2` (`63dd231`), moved into the main tree
- `base2-loi-hien-nhien-opus`: exit 0, `claude` 2.1.281, `evals/results/debug/base2-loi-hien-nhien-opus/result.json`, sha256 `ab1364769c3f8ed4e7d7d15dd990f8632d460c95f0c7eec6494a82eab8f9f553` — run from `.claude/worktrees/debug-base2` (`63dd231`), moved into the main tree
- `base2-doc-ma-sai-huong-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/base2-doc-ma-sai-huong-sonnet/result.json`, sha256 `89efaee117c821f866eb86b95d9150928f39b9806bf3e161405ab9ac1efbbffb` — run from `.claude/worktrees/debug-base2` (`63dd231`), moved into the main tree
- `base2-doc-ma-sai-huong-opus`: exit 0, `claude` 2.1.281, `evals/results/debug/base2-doc-ma-sai-huong-opus/result.json`, sha256 `a86878106f02c5a8030656c962c03aa7601ad738b41b48707d9330bff40413d2` — run from `.claude/worktrees/debug-base2` (`63dd231`), moved into the main tree
- `base2-staging-dung-chung-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/base2-staging-dung-chung-sonnet/result.json`, sha256 `ba6bc3c42181897f944fcfb28f2bc1817526fe83ed454a72f0bc53c08dda821d` — run from `.claude/worktrees/debug-base2` (`63dd231`), moved into the main tree
- `base2-staging-dung-chung-opus`: exit 0, `claude` 2.1.281, `evals/results/debug/base2-staging-dung-chung-opus/result.json`, sha256 `e1ea1f772aae7df474738a6be359ca9a6db9adb1c845346a44b3baea95d7d386` — run from `.claude/worktrees/debug-base2` (`63dd231`), moved into the main tree
- `base2-chi-chan-doan-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/base2-chi-chan-doan-sonnet/result.json`, sha256 `5e9bfbb1691fd6ea6975f3b824830101292cdf0d8289d7b81dc2ca48e6ae690c` — run from `.claude/worktrees/debug-base2` (`63dd231`), moved into the main tree
- `base2-chi-chan-doan-opus`: exit 0, `claude` 2.1.281, `evals/results/debug/base2-chi-chan-doan-opus/result.json`, sha256 `af1401edebaaaf469054901d4bf52ab9614e8469064d6e58c467eb76d57f29f6` — run from `.claude/worktrees/debug-base2` (`63dd231`), moved into the main tree
- `sau2-loi-hien-nhien-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/sau2-loi-hien-nhien-sonnet/result.json`, sha256 `9cca22f50d0f6a216153b6e4b70f114f37f2994f24b86fb7e8b8302d27c503f8` — run from the main tree
- `sau2-loi-hien-nhien-opus`: exit 0, `claude` 2.1.281, `evals/results/debug/sau2-loi-hien-nhien-opus/result.json`, sha256 `5aad0a9578fc922922587b79e3adf21f678762b7eceaf8d9714e280c6eee5e61` — run from the main tree
- `sau2-doc-ma-sai-huong-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/sau2-doc-ma-sai-huong-sonnet/result.json`, sha256 `1995abfa02b1055e768761be5995c643505d74abebd682cdb3856c4122177790` — run from the main tree
- `sau2-doc-ma-sai-huong-opus`: exit 0, `claude` 2.1.281, `evals/results/debug/sau2-doc-ma-sai-huong-opus/result.json`, sha256 `f4be130deff2931753cc0ba6ec34f1f869e8d0babedcef1d9e4ead67c28188eb` — run from the main tree
- `sau2-staging-dung-chung-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/sau2-staging-dung-chung-sonnet/result.json`, sha256 `27faecc9fe5a5de4e5df52c0fdfb40112587479affefa720621ab31b8b12bbe8` — run from the main tree
- `sau2-staging-dung-chung-opus`: exit 0, `claude` 2.1.281, `evals/results/debug/sau2-staging-dung-chung-opus/result.json`, sha256 `c519a9c73c4c473b35738f3e813f6924d724dee5a0677432680e31419bc7517b` — run from the main tree
- `sau2-chi-chan-doan-sonnet`: exit 0, `claude` 2.1.281, `evals/results/debug/sau2-chi-chan-doan-sonnet/result.json`, sha256 `b99a69c28c7370af24613bcc1a369732b6cf5cc42369d9b3859afee30d3bba6d` — run from the main tree

Beside the hand labels and the registered rows (per cell `base2` → `sau2`; a figure within ±2 runs of its row is "with"):

| Figure | Registered | base2 sonnet | sau2 sonnet | base2 opus | sau2 opus | Observed |
|---|---|---|---|---|---|---|
| primary graders | 10/10 per cell | 10/10 except `doc-ma-sai-huong` `tim-dung-nguon` and `khong-do-cho-list` 9/10 (run 9) | 10/10 except `khong-doc-dap-an-read` 9/10 in `loi-hien-nhien` (run 9) and in `doc-ma-sai-huong` (run 3) | 10/10 | 10/10 | with |
| `gon-gang-tieu-de` | 0, 10, 1, 10 | 1/10 (run 5) | 10/10 | 2/10 (runs 1, 10 — both list rejected hypotheses in forms outside the list; see the disagreements below) | 9/10 (run 4 flagged) | with |
| `gon-gang-llm` | reference | 1/10 | 3/10 | 0/10 | 5/10 | — |
| `noi-do-tin-cao` | 10/10 | 9/10 | 10/10 | 10/10 | 10/10 | with |
| "high" without executing | 0/10 | 0 | 0 | 0 | 0 | with |
| `co-dau-step` | `base-*`/`sau-*` figures (1/80, 0/80) | 0/40 | 0/40 | 0/40 | 0/40 | with |
| `co-debug-report` (`loi`, `doc`, `staging`, `chi`) | `base-*` sonnet 10, 10, 10, 10; `sau-*` sonnet 10, 9, 10, 10; `base-*` opus 5, 3, 5, 2; `sau-*` opus 10, 10, 10, 10 | 10, 9, 10, 10 | 10, 10, 10, 10 | 3, 3, 4, 2 | 10, 10, 10, 10 | with |
| median tool total (`loi`, `doc`, `staging`, `chi`) | — | 7, 11.5, 12, 8 | 7, 11, 9, 9 | 3, 3, 3, 3 | 3, 3, 3, 3 | — |
| median seconds (`loi`, `doc`, `staging`, `chi`) | — | 41.5, 70.5, 59, 52 | 38.5, 49.5, 50, 44.5 | 39, 41.5, 40.5, 42 | 43.5, 43, 43.5, 41.5 | — |
| cost (run cost, judge cost excluded) | — | $15.20 for the eight `base2` cells | $14.58 for the eight `sau2` cells | | | total $29.78; with the sonnet judge $15.75 + $15.11 = $30.86 |
| `claudeVersion` | one value | 2.1.281 | 2.1.281 | 2.1.281 | 2.1.281 | with |

Task 01's hand labels for the stored cells: `gon-gang-tieu-de` passing `base` sonnet none, `base` opus run 5, `sau` all; `noi-do-tin-cao` 10/10 in all four `doc-ma-sai-huong` cells.

Primary-grader failures, with their decisive text (from `result.json`; the parts marked "trace" come from the traces, read before they were deleted and not re-readable):
- `base2-doc-ma-sai-huong-sonnet` run 9, `tim-dung-nguon` and `khong-do-cho-list`: the final message is "Kết quả từ agent Explore chạy nền hoàn toàn khớp với chẩn đoán đã đưa ra — không có phát hiện mới. Không cần cập nhật báo cáo debug đã gửi trước đó."; (trace) the run made an `Agent` call; the same run is the `noi-do-tin-cao` miss and the cross-count's "stated no confidence".
- `sau2-loi-hien-nhien-sonnet` run 9, `khong-doc-dap-an-read` ("Read called 3x (expected 0..0)"): (trace) it called Read on `…/cafekit-eval-debug-0kAoF1/evals/loi-hien-nhien/src/utils/slug.js`, `…/test/slug.test.js` and `…/src/posts/create.js` under the eval plugin's temporary root.
- `sau2-doc-ma-sai-huong-sonnet` run 3, `khong-doc-dap-an-read` ("Read called 3x (expected 0..0)"): (trace) it called Read on `…/cafekit-eval-debug-ysaCh6/src/api/list.js`, `…/src/data/items.js` and `…/test/list.test.js` under the eval plugin's temporary root.

`gon-gang-tieu-de` / `gon-gang-llm` disagreements in `loi-hien-nhien` — thirteen runs, every one regex PASS and LLM FAIL, each D-01's break signal for GATE-DONE. The judge records votes only, no reason, so no text is called decisive (Step 4); each final message is kept as the `evidence` of that run's `llm` graders in the named `result.json`:
- `evals/results/debug/base2-loi-hien-nhien-opus/result.json`: runs 1 (`FFF`) and 10 (`FFF`).
- `evals/results/debug/sau2-loi-hien-nhien-sonnet/result.json`: runs 1 (`FFF`), 4 (`FFF`), 5 (`FFF`), 6 (`FFP`), 7 (`FFP`), 9 (`FFF`), 10 (`FFF`).
- `evals/results/debug/sau2-loi-hien-nhien-opus/result.json`: runs 1, 3, 6, 7 (each `FFF`).
Forbidden forms the regex misses, quoted verbatim: `base2` opus run 1 lists rejected hypotheses under a label outside the list — "2. **Ruled out:** `title` isn't a string. …" and "3. **Ruled out:** the Node version or test runner. …"; `base2` opus run 10 lists them in prose — "- Mình đã loại trừ lỗi do đầu vào sai (test truyền vào một chuỗi hợp lệ) và lỗi do môi trường hay phiên bản Node …". Split votes that did not change a verdict: `sau2` opus run 9 passed `gon-gang-llm` on `PFP`. The one `sau2` report the regex flags is opus run 4 (`[bác bỏ]`), which the LLM also fails.

Cleanup: the eight `base2-*` directories were moved into the main tree before `git worktree remove --force .claude/worktrees/debug-base2`; the 160 kept run directories, each `dirname(dirname(tracePath))` from its `result.json` and all of the form `/private/tmp/e-XXXXXX`, were deleted.

Repair rounds: (1) review of the draft FAIL — the 13 regex/LLM disagreements had no decisive text (two `base2` opus reports carry rejected-hypothesis forms outside the list), the cost omitted the judge, two dropped line kinds were undeclared, the `co-debug-report` row lacked its baseline figures, and split votes were not shown; (2) review of the draft FAIL — the text called decisive for eleven `sau2` disagreements also appears in the runs the LLM passed, a quote was not verbatim, the break-signal label covered two of thirteen, and trace-only claims were not all marked; (3) review of the draft FAIL — rewritten characterisations of the eleven `sau2` disagreements kept missing or overstating sentences, since the judge records no reason; (4) review FAIL on the same passage. After three failed rounds the user changed Step 4 to a neutral listing of disagreements (plan review log), which this Receipt follows. No conclusion is drawn here; the reading is GATE-DONE's.
