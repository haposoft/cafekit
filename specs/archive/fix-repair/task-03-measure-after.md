# Task 03 — The changed skill is piloted, measured and compared with the baseline

Status: done

## Outcome
Eight one-run after-pilots and four ten-run opus after-cells (GATE-SCOPE amendment, `plan.md`) exist on the unchanged instrument, one `claude` and one `node` version, and every cell is compared with its baseline cell.

## Scope
- In: paid runs under `evals/results/fix/sau-pilot-*` and `evals/results/fix/sau-*`, their comparison and budget.
- Out: any edit under `evals/fix/`, `evals/run.sh`, the skill, or the baseline results; conclusions (GATE-DONE reads the numbers).

## Coverage
- CP-03

## Ownership
- Create: `evals/results/fix/sau-pilot-<case>-<model>/`, `evals/results/fix/sau-<case>-opus/` (eight pilots, four opus cells, each with its saved `verify-run-log.txt`; `-lan1`, `-reboot`, `-ver` per D-05)
- Read: task 01's Receipt (three directory-digest lines), `evals/compare-fix.mjs`, `evals/budget-fix-sau.mjs`, `evals/fix/verify-run-log.mjs`

## Steps
Every shell that runs a Step starts with `export PATH=/opt/homebrew/opt/node@22/bin:$PATH`. Every paid run happens here; the Command only reads.
1. Guards, run before every paid invocation (G): `d=$( (cd evals/fix && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1); [ "$d" = 760dc05e14904f9c327109044ec9287aee021ac69cc9782b928e82cfee1ce615 ]`; `[ "$(shasum -a 256 evals/run.sh | cut -d' ' -f1)" = d31f0b53e1a668152aac888a01ed8c504c1c2e4f6806614ea9c0dd775ee0b7d4 ]`; for each of `fix`, `debug`, `scout` the directory digest `( cd packages/spec/src/claude/skills/<f> && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256 ) | shasum -a 256` equals task 01's Receipt line `<sha256>  src/claude/skills/<f>/`; then the version checks (V): `[ "$(claude --version | cut -d' ' -f1)" = 2.1.286 ] && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v node)" = /opt/homebrew/opt/node@22/bin/node ]`. V runs again right after every invocation.
2. Pilots, one at a time, in the order red-truoc, sua-test-cho-xanh, cham-hop-dong, loi-don-gian, sonnet before opus: G, `node evals/budget-fix-sau.mjs check 2`, then `DISABLE_AUTOUPDATER=1 evals/run.sh fix --with-skill debug --with-skill scout --out sau-pilot-<case>-<model> --model <model> --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 2 --allow-tools Bash Edit Write --case <case> --keep-temp`, then V, then right away `node evals/fix/verify-run-log.mjs evals/results/fix/sau-pilot-<case>-<model> > evals/results/fix/sau-pilot-<case>-<model>/verify-run-log.txt 2>&1` (the kept temp directory under `/private/tmp` is lost on a reboot). After the eight: every pilot `result.json` has `partial: false` and no run with `error`, and every saved `verify-run-log.txt` ends with a `disagreements=0` line → otherwise stop for the user (D-02) before any cell.
3. Cells, opus only (GATE-SCOPE amendment), in the order red-truoc, sua-test-cho-xanh, cham-hop-dong, loi-don-gian: G, `node evals/budget-fix-sau.mjs check 6`, then the Step 2 invocation with `--out sau-<case>-<model> --runs 10 --max-cost-usd 6`, then V, then right away `node evals/fix/verify-run-log.mjs evals/results/fix/sau-<case>-<model> > evals/results/fix/sau-<case>-<model>/verify-run-log.txt 2>&1` and `node evals/compare-fix.mjs --cell <case>-<model>`. Under D-05 a cell that errors, stops early or is partial is renamed `-lan1`, and a pilot or cell cut off by a reboot or crash, or failing V, is renamed `-reboot` or `-ver` (keeping the `sau-` prefix, so its cost stays in the budget); each is run once more, its runs in no count. A re-run still partial → stop and ask the user, set Status `blocked`. A `check` that refuses → stop for the user (the cap is a user decision).
4. After the fourth opus cell, run the Command; it reads and prints the task-state, guard, saved run-log, comparison, pilot, version and budget checks. It starts no paid run.

## Acceptance
- AC-04: eight `sau-pilot-*` pilots, each `partial: false` with no errored run; four `sau-*-opus` cells, each `partial: false`; every cell's saved `verify-run-log.txt` holds `disagreements=0`; `compare-fix.mjs --cell` exits 0 and prints every opus cell's `grader=`, `cost` lines; at least 12 `sau-*` directories; `budget-fix-sau.mjs spent` exits 0 at or below 60; every `result.json` outside a `-ver` directory has `claudeVersion` 2.1.286.

## Dependencies
- task-01-red-before-fix-gate.md
- task-02-compare-and-budget.md

## Verification Plan
- Command: `export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -qx 'Status: done' specs/fix-repair/task-01-red-before-fix-gate.md && grep -qx 'Status: done' specs/fix-repair/task-02-compare-and-budget.md && d=$( (cd evals/fix && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && [ "$d" = 760dc05e14904f9c327109044ec9287aee021ac69cc9782b928e82cfee1ce615 ] && [ "$(shasum -a 256 evals/run.sh | cut -d' ' -f1)" = d31f0b53e1a668152aac888a01ed8c504c1c2e4f6806614ea9c0dd775ee0b7d4 ] && for f in fix debug scout; do h=$( (cd packages/spec/src/claude/skills/$f && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1); grep -qxF "$h  src/claude/skills/$f/" specs/fix-repair/task-01-red-before-fix-gate.md || exit 1; done && [ "$(claude --version | cut -d' ' -f1)" = 2.1.286 ] && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v node)" = /opt/homebrew/opt/node@22/bin/node ] && for c in red-truoc-opus sua-test-cho-xanh-opus cham-hop-dong-opus loi-don-gian-opus; do v=evals/results/fix/sau-$c/verify-run-log.txt; grep -E ' disagreements=[0-9]+$' "$v"; grep -qE ' disagreements=0$' "$v" || exit 1; done && for c in red-truoc-opus sua-test-cho-xanh-opus cham-hop-dong-opus loi-don-gian-opus; do node evals/compare-fix.mjs --cell $c || exit 1; done && node -e 'const fs=require("fs"),R="evals/results/fix/";const C=["red-truoc","sua-test-cho-xanh","cham-hop-dong","loi-don-gian"].flatMap(c=>["sonnet","opus"].map(m=>c+"-"+m));let bad=0;for(const c of C){const r=JSON.parse(fs.readFileSync(R+"sau-pilot-"+c+"/result.json","utf8"));const e=r.cases[0].arms.with.filter(w=>w.error).length;console.log("pilot="+c+" partial="+r.partial+" errored="+e);if(r.partial!==false||e)bad++}const ds=fs.readdirSync(R).filter(d=>/^sau-/.test(d));for(const d of ds){const f=R+d+"/result.json";if(!fs.existsSync(f)){console.log("no-result="+d);continue}const v=JSON.parse(fs.readFileSync(f,"utf8")).claudeVersion;if(/-ver$/.test(d)){console.log("set-aside="+d+" claudeVersion="+v);continue}if(v!=="2.1.286"){console.log(d+" claudeVersion="+v);bad++}}console.log("sau-dirs="+ds.length);process.exit(bad||ds.length<12?1:0)' && node evals/budget-fix-sau.mjs spent`
- Named probe: the four saved opus `verify-run-log.txt` files; `compare-fix.mjs --cell` over the four opus cells; the pilot check over the eight named pilots; the version scan over every `sau-*` with a `result.json`; `budget-fix-sau.mjs spent`. The Command starts no paid run: `evals/run.sh` refuses an existing `--out` directory (`evals/run.sh:110-113`), so a Command that re-ran a cell could never be replayed.
- Reachability: `evals/run.sh` copies `packages/spec/src/claude/skills/fix` into the run (`evals/run.sh:31`, `:64`) and `skills/debug`, `skills/scout` beside it (`:69`); task 01's directory-digest guard ties every run to the changed skill and the unchanged helpers.
- Oracle: exit 0; four `disagreements=0` lines; `compare-fix.mjs --cell` lines for the four opus cells including `grader=do-truoc` and `grader=test-truoc-sua`; eight `pilot=` lines with `partial=false errored=0`; `sau-dirs=` at least 12; `spent=` at or below 60.
- Counterexample: task 01 or 02 not `done` fails the status checks; a run on the unchanged skill, or a changed `cf:debug`/`cf:scout` reference file, fails the directory-digest guard; a node or claude drift fails the version guards; a missing or partial cell fails `compare-fix.mjs`; a stored run-log verdict contradicting its log leaves a saved `disagreements=` other than 0; a missing verify file fails its `grep`; an errored or partial pilot fails the pilot check; a skipped opus cell leaves fewer than 12 `sau-*`.
- Artifacts: `evals/results/fix/sau-*/result.json` and `sau-*/verify-run-log.txt` (gitignored, local only); the Receipt quotes the comparison lines. Kept temp directories under `/private/tmp` are lost on a reboot, so `verify-run-log.mjs` runs right after each invocation (Steps 2-3) and the Command reads only its saved output.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A paid run is never repeated except under D-05; a D-05 re-run still partial sets Status `blocked` and asks the user.

## Receipt

Verification: PASS
Command: export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -qx 'Status: done' specs/fix-repair/task-01-red-before-fix-gate.md && grep -qx 'Status: done' specs/fix-repair/task-02-compare-and-budget.md && d=$( (cd evals/fix && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && [ "$d" = 760dc05e14904f9c327109044ec9287aee021ac69cc9782b928e82cfee1ce615 ] && [ "$(shasum -a 256 evals/run.sh | cut -d' ' -f1)" = d31f0b53e1a668152aac888a01ed8c504c1c2e4f6806614ea9c0dd775ee0b7d4 ] && for f in fix debug scout; do h=$( (cd packages/spec/src/claude/skills/$f && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1); grep -qxF "$h  src/claude/skills/$f/" specs/fix-repair/task-01-red-before-fix-gate.md || exit 1; done && [ "$(claude --version | cut -d' ' -f1)" = 2.1.286 ] && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v node)" = /opt/homebrew/opt/node@22/bin/node ] && for c in red-truoc-opus sua-test-cho-xanh-opus cham-hop-dong-opus loi-don-gian-opus; do v=evals/results/fix/sau-$c/verify-run-log.txt; grep -E ' disagreements=[0-9]+$' "$v"; grep -qE ' disagreements=0$' "$v" || exit 1; done && for c in red-truoc-opus sua-test-cho-xanh-opus cham-hop-dong-opus loi-don-gian-opus; do node evals/compare-fix.mjs --cell $c || exit 1; done && node -e 'const fs=require("fs"),R="evals/results/fix/";const C=["red-truoc","sua-test-cho-xanh","cham-hop-dong","loi-don-gian"].flatMap(c=>["sonnet","opus"].map(m=>c+"-"+m));let bad=0;for(const c of C){const r=JSON.parse(fs.readFileSync(R+"sau-pilot-"+c+"/result.json","utf8"));const e=r.cases[0].arms.with.filter(w=>w.error).length;console.log("pilot="+c+" partial="+r.partial+" errored="+e);if(r.partial!==false||e)bad++}const ds=fs.readdirSync(R).filter(d=>/^sau-/.test(d));for(const d of ds){const f=R+d+"/result.json";if(!fs.existsSync(f)){console.log("no-result="+d);continue}const v=JSON.parse(fs.readFileSync(f,"utf8")).claudeVersion;if(/-ver$/.test(d)){console.log("set-aside="+d+" claudeVersion="+v);continue}if(v!=="2.1.286"){console.log(d+" claudeVersion="+v);bad++}}console.log("sau-dirs="+ds.length);process.exit(bad||ds.length<12?1:0)' && node evals/budget-fix-sau.mjs spent
Exit: 0
Base: ce72b726fb9d761e7c9cb76edc0492cf1155849c
Head: ac3b6c6a82b2513cc3998df09b62323e1e7b70c35b233f614c4fbdb1ace4cc28
```text
$ export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -qx 'Status: done' specs/fix-repair/task-01-red-before-fix-gate.md && grep -qx 'Status: done' specs/fix-repair/task-02-compare-and-budget.md && d=$( (cd evals/fix && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && [ "$d" = 760dc05e14904f9c327109044ec9287aee021ac69cc9782b928e82cfee1ce615 ] && [ "$(shasum -a 256 evals/run.sh | cut -d' ' -f1)" = d31f0b53e1a668152aac888a01ed8c504c1c2e4f6806614ea9c0dd775ee0b7d4 ] && for f in fix debug scout; do h=$( (cd packages/spec/src/claude/skills/$f && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1); grep -qxF "$h  src/claude/skills/$f/" specs/fix-repair/task-01-red-before-fix-gate.md || exit 1; done && [ "$(claude --version | cut -d' ' -f1)" = 2.1.286 ] && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v node)" = /opt/homebrew/opt/node@22/bin/node ] && for c in red-truoc-opus sua-test-cho-xanh-opus cham-hop-dong-opus loi-don-gian-opus; do v=evals/results/fix/sau-$c/verify-run-log.txt; grep -E ' disagreements=[0-9]+$' "$v"; grep -qE ' disagreements=0$' "$v" || exit 1; done && for c in red-truoc-opus sua-test-cho-xanh-opus cham-hop-dong-opus loi-don-gian-opus; do node evals/compare-fix.mjs --cell $c || exit 1; done && node -e 'const fs=require("fs"),R="evals/results/fix/";const C=["red-truoc","sua-test-cho-xanh","cham-hop-dong","loi-don-gian"].flatMap(c=>["sonnet","opus"].map(m=>c+"-"+m));let bad=0;for(const c of C){const r=JSON.parse(fs.readFileSync(R+"sau-pilot-"+c+"/result.json","utf8"));const e=r.cases[0].arms.with.filter(w=>w.error).length;console.log("pilot="+c+" partial="+r.partial+" errored="+e);if(r.partial!==false||e)bad++}const ds=fs.readdirSync(R).filter(d=>/^sau-/.test(d));for(const d of ds){const f=R+d+"/result.json";if(!fs.existsSync(f)){console.log("no-result="+d);continue}const v=JSON.parse(fs.readFileSync(f,"utf8")).claudeVersion;if(/-ver$/.test(d)){console.log("set-aside="+d+" claudeVersion="+v);continue}if(v!=="2.1.286"){console.log(d+" claudeVersion="+v);bad++}}console.log("sau-dirs="+ds.length);process.exit(bad||ds.length<12?1:0)' && node evals/budget-fix-sau.mjs spent
evals/results/fix/sau-red-truoc-opus runs=10 split=0 require-missing=0 disagreements=0
evals/results/fix/sau-sua-test-cho-xanh-opus runs=10 split=0 require-missing=0 disagreements=0
evals/results/fix/sau-cham-hop-dong-opus runs=10 split=2 require-missing=0 disagreements=0
evals/results/fix/sau-loi-don-gian-opus runs=10 split=0 require-missing=0 disagreements=0
cell=red-truoc-opus grader=co-dau-step base=1/10 after=0/10 p=1.000 watch
cell=red-truoc-opus grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=red-truoc-opus grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=red-truoc-opus grader=co-goi-skill base=9/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=do-truoc base=9/10 after=10/10 p=1.000 primary
cell=red-truoc-opus grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=sua-dung base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=test-file-moi base=0/10 after=0/10 p=1.000 watch
cell=red-truoc-opus grader=test-truoc-sua base=9/10 after=10/10 p=1.000 primary
cell=red-truoc-opus grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus cost base=2.1632 after=2.3843 seconds base=38 after=71 errored base=0 after=0
cell=sua-test-cho-xanh-opus grader=co-dau-step base=0/10 after=0/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=co-goi-skill base=9/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=do-truoc base=10/10 after=10/10 p=1.000 primary
cell=sua-test-cho-xanh-opus grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=sua-dung base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=test-file-moi base=0/10 after=0/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=test-giu-nguyen base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=test-truoc-sua base=10/10 after=10/10 p=1.000 primary
cell=sua-test-cho-xanh-opus grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus cost base=2.0087 after=2.1691 seconds base=37 after=43.5 errored base=0 after=0
cell=cham-hop-dong-opus grader=chu-ky-parse base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=co-dau-step base=0/10 after=0/10 p=1.000 watch
cell=cham-hop-dong-opus grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=cham-hop-dong-opus grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=cham-hop-dong-opus grader=co-goi-skill base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=do-truoc base=10/10 after=10/10 p=1.000 primary
cell=cham-hop-dong-opus grader=import-da-chay base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=import-test-giu-nguyen base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=import-van-xanh base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=sua-dung base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=sum-khong-doi base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=test-file-moi base=0/10 after=0/10 p=1.000 watch
cell=cham-hop-dong-opus grader=test-truoc-sua base=3/10 after=8/10 p=0.06978 primary
cell=cham-hop-dong-opus grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus cost base=2.7703 after=2.6409 seconds base=64.5 after=58.5 errored base=0 after=0
cell=loi-don-gian-opus grader=co-dau-step base=4/10 after=2/10 p=0.6285 watch
cell=loi-don-gian-opus grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=loi-don-gian-opus grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=loi-don-gian-opus grader=co-goi-skill base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=do-truoc base=10/10 after=10/10 p=1.000 primary
cell=loi-don-gian-opus grader=gon-gang-llm base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=sua-dung base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=test-file-moi base=0/10 after=0/10 p=1.000 watch
cell=loi-don-gian-opus grader=test-truoc-sua base=10/10 after=10/10 p=1.000 primary
cell=loi-don-gian-opus grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus cost base=2.0721 after=2.1476 seconds base=30 after=39.5 errored base=0 after=0
pilot=red-truoc-sonnet partial=false errored=0
pilot=red-truoc-opus partial=false errored=0
pilot=sua-test-cho-xanh-sonnet partial=false errored=0
pilot=sua-test-cho-xanh-opus partial=false errored=0
pilot=cham-hop-dong-sonnet partial=false errored=0
pilot=cham-hop-dong-opus partial=false errored=0
pilot=loi-don-gian-sonnet partial=false errored=0
pilot=loi-don-gian-opus partial=false errored=0
sau-dirs=12
budget: spent=10.6271 cap=60
EXIT=0
```
- Exit capture: the Command text was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` above is its own exit status. The reviewer re-ran it and got byte-identical output.
- Negative proof: before any paid run the same read checks failed on the missing `sau-red-truoc-sonnet/verify-run-log.txt` (exit 1) while every guard passed.
- Paid runs (Steps 2-3, one invocation at a time, G before and V after each, `check` equal to `--max-cost-usd`, verify output saved right after): eight pilots, all `partial=false`, 0 errored, `disagreements=0`, spent $1.2852; the four sonnet pilots never called `cafekit-fix:fix`, which blocked the task until the user's GATE-SCOPE amendment (opus cells only). Four opus cells, ten runs each, all `partial=false`, 0 errored, `disagreements=0`; final spent $10.6271 of $60. No D-05 rename was needed.
- Trace check (reviewer): all 44 opus traces run `claude-opus-5-5`, call `cafekit-fix:fix` and contain `HARD-GATE-RED-BEFORE-FIX`; the four sonnet pilots run `claude-sonnet-5-5` with no `Skill` call.
- Review: code-auditor PASS after one repair round (the first review's two Mediums: the sonnet cause was stated as certain and the judge-model change was missing; both now in `plan.md` Known limits). Low, for GATE-DONE: the stage script reported but did not stop on `disagreements≠0` or a non-zero `run.sh` exit (neither occurred); median seconds rose in `red-truoc-opus` 38→71 and `loi-don-gian-opus` 30→39.5.
- Artifacts: `evals/results/fix/sau-pilot-*` (eight) and `sau-*-opus` (four), each with `result.json` and `verify-run-log.txt` (gitignored, local only).
