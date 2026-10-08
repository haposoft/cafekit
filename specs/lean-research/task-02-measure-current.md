# Task 02 — The current research skill is measured in 8 cells

Status: done

## Outcome
Eight result directories `evals/results/research/lean-goc-<case>-<model>` (plan D-02's four skill-path cases × sonnet and opus), ten runs each, every run loaded, at least nine runs with both web tools at init, on the research skill bytes of `dd8c5b57` before task 03 edits anything; answers, reports and models saved out of the kept traces.

## Scope
- In: 3 pilots and 8 cells in one lone lane (plan D-03); `exit.txt`, `lane.txt`, `skill-digest.txt`, `host.txt`, `loaded.txt`, `web.txt`, `skills.txt` per directory and the saved answers, written in the same shell step as each cell (plan D-04).
- Out: any skill, case, grader, fixture or `evals/run.sh` edit; the `-agent` cases.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/research/lean-goc-*`, `evals/results/research/lean-pilot-goc-*`, `evals/results/research/{_answers,_reports,_models}-lean/lean-*goc-*.txt` (all gitignored)
- Read: `evals/run.sh`, `evals/lean/*`, `evals/save-research-answers.mjs`

## Steps
0. Preflight per plan § Shared files and schedule: set `specs/_shared/active-feature.json` to `{"featureName":"lean-research"}`; research cells run last, after the sibling lean lanes are idle (plan D-03).
1. Guard before every invocation (stop on any mismatch): directory digest `dg() { (cd "$1" && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16); }` of `packages/spec/src/claude/skills/research` = `de31c72b6402a2ef` and of `evals/research` = `6d359911e10b63a5`; `shasum -a 256 evals/run.sh` starts `a75cd5b5fbe5b643`; `node --version` = `v22.23.3`; `claude --version` = `2.1.291 (Claude Code)`; `node evals/lean/budget.mjs check <c> --skills research --cap 120`; then wait (never stop anything) until `pgrep -f '[c]laude plugin eval' | wc -l | tr -d ' '` prints `0`.
2. Each invocation is one shell step (`<dir>` = `evals/results/research/<name>`; `run.sh` refuses an existing `<dir>`, so values taken before the run are held in shell variables): `D=packages/spec/src/claude; b=$(pgrep -f '[c]laude plugin eval' | wc -l | tr -d ' '); h1=$(claude --version); sg=$(printf 'research=%s\nspecs=%s\nresearcher=%s' "$(dg $D/skills/research)" "$(dg $D/skills/specs)" "$(shasum -a 256 $D/agents/researcher.md | cut -c1-16)"); evals/run.sh research … --out <name> … (plan D-03); x=$?; mkdir -p <dir>; echo "exit=$x" > <dir>/exit.txt; echo "before=$b after=$(pgrep -f '[c]laude plugin eval' | wc -l | tr -d ' ')" > <dir>/lane.txt; printf '%s\n' "$sg" > <dir>/skill-digest.txt; { echo "$h1"; claude --version; } > <dir>/host.txt;` then, in the same step, the evidence commands:
   - `node evals/lean/loaded.mjs research <dir> > <dir>/loaded.txt`;
   - web check `node -e 'const fs=require("fs"),cp=require("child_process"),path=require("path");const d=process.argv[1];const w=JSON.parse(fs.readFileSync(d+"/result.json","utf8")).cases[0].arms.with;let k=0;w.forEach((x,i)=>{let ok=false;try{cp.spawnSync("chmod",["-R","u+rwX",path.dirname(path.dirname(x.tracePath))]);const init=fs.readFileSync(x.tracePath,"utf8").split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return {}}}).find(e=>e.type==="system"&&e.subtype==="init")||{};ok=(init.tools||[]).includes("WebSearch")&&(init.tools||[]).includes("WebFetch")}catch{}if(ok)k++;console.log("run="+(i+1)+" web="+(ok?"yes":"no"))});console.log("web="+k+"/"+w.length)' <dir> > <dir>/web.txt`;
   - Skill calls by name `node -e 'const fs=require("fs"),cp=require("child_process"),path=require("path");const w=JSON.parse(fs.readFileSync(process.argv[1]+"/result.json","utf8")).cases[0].arms.with;const K=["cf:research","cf:specs","other"],t={};w.forEach((x,i)=>{const c={"cf:research":0,"cf:specs":0,other:0};try{cp.spawnSync("chmod",["-R","u+rwX",path.dirname(path.dirname(x.tracePath))]);for(const l of fs.readFileSync(x.tracePath,"utf8").split("\n")){let e;try{e=JSON.parse(l)}catch{continue}if(!e||e.type!=="assistant")continue;for(const b of (e.message&&e.message.content)||[])if(b&&b.type==="tool_use"&&b.name==="Skill"){const s=String((b.input||{}).skill||"");c[s==="cf:research"||s==="cf:specs"?s:"other"]++}}}catch{}K.forEach(k=>t[k]=(t[k]||0)+c[k]);console.log("run="+(i+1)+" "+K.map(k=>k+"="+c[k]).join(" "))});console.log("skills "+K.map(k=>k+"="+t[k]).join(" "))' <dir> > <dir>/skills.txt`;
   - `node evals/save-research-answers.mjs --answers evals/results/research/_answers-lean --reports evals/results/research/_reports-lean --models evals/results/research/_models-lean <dir>`.
3. Pilots, each as Step 2: `--case da-co-quyet-dinh` sonnet `--runs 3 --max-cost-usd 3` and opus `--runs 1 --max-cost-usd 3` (`lean-pilot-goc-da-co-quyet-dinh-<model>`), and `--case khong-luu-khong-sua` sonnet `--runs 1 --max-cost-usd 3` (`lean-pilot-goc-khong-luu-khong-sua-sonnet`); any run not loaded, without web tools, errored or partial, or a `lane.txt` other than `before=0 after=0` → stop and ask the user.
4. Cells `lean-goc-<case>-<model>` for `chon-kien-truc-theo-rang-buoc da-co-quyet-dinh khong-luu-khong-sua nguon-cu-mau-thuan`, `--runs 10`, `--max-cost-usd 5` (sonnet) or `8` (opus), one at a time; a cell meeting any plan D-06 condition reruns once into `<cell>-lan1`.
5. Run the Command.

## Acceptance
- AC-02: 8 cells complete, each `loaded=10/10` and `web=` at least 9, each `host.txt` one version, each `skill-digest.txt` with `research=de31c72b6402a2ef`, each `lane.txt` `before=0 after=0`, each with `skills.txt` and a saved answers file; `compare.mjs --skill research --base-only` exits 0 with 8 `base ok runs=10` lines (no errored run); spend within the cap.

## Dependencies
- task-01-research-helpers.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && grep -q '^Status: done' specs/lean-research/task-01-research-helpers.md && n=0 && for d in evals/results/research/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; tail -1 "$d/web.txt" | grep -qE '^web=(9|10)/10$' || { echo "web: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'research=de31c72b6402a2ef' "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -qx 'before=0 after=0' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; tail -1 "$d/skills.txt" | grep -q '^skills ' || { echo "skills: $d"; exit 1; }; [ -s "evals/results/research/_answers-lean/$(basename "$d").txt" ] || { echo "answers: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill research --base-only | tee $t/b && [ "$(grep -c ' base ok runs=10$' $t/b)" = 8 ] && echo "base-ok=8" && node evals/lean/budget.mjs spent --skills research --cap 120`
- Named probe: saved `loaded.txt`, `web.txt`, `host.txt`, `skill-digest.txt`, `lane.txt`, `skills.txt` and answers; `compare.mjs --base-only` (a run with `error` is dropped from `runs=`, so 8 `runs=10` lines mean no errored run); `budget.mjs spent`.
- Reachability: `evals/run.sh research` builds the `cf` plugin from `packages/spec/src/claude/skills/research` (with `specs` and the `researcher` agent) and writes `evals/results/research/<out>`.
- Oracle: `cells=8`, 8 `base ok runs=10` lines, `base-ok=8`, `budget: spent=<x> cap=120`, exit 0.
- Counterexample: a missing, partial, not-loaded or web-short cell, an errored run, a research digest other than `de31c72b6402a2ef`, an overlapping lane, a missing `skills.txt` or answers file, or a host change inside a cell makes the Command exit 1.
- Artifacts: result directories and saved answers (gitignored, local).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A quota, rate-limit or billing error → stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && grep -q '^Status: done' specs/lean-research/task-01-research-helpers.md && n=0 && for d in evals/results/research/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; tail -1 "$d/web.txt" | grep -qE '^web=(9|10)/10$' || { echo "web: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'research=de31c72b6402a2ef' "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -qx 'before=0 after=0' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; tail -1 "$d/skills.txt" | grep -q '^skills ' || { echo "skills: $d"; exit 1; }; [ -s "evals/results/research/_answers-lean/$(basename "$d").txt" ] || { echo "answers: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill research --base-only | tee $t/b && [ "$(grep -c ' base ok runs=10$' $t/b)" = 8 ] && echo "base-ok=8" && node evals/lean/budget.mjs spent --skills research --cap 120
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: e1e86cebb3e7e402b7142325f4500fe98ee92ba9a080e88e577d20c714e45e38
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && grep -q '^Status: done' specs/lean-research/task-01-research-helpers.md && n=0 && for d in evals/results/research/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; tail -1 "$d/web.txt" | grep -qE '^web=(9|10)/10$' || { echo "web: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'research=de31c72b6402a2ef' "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -qx 'before=0 after=0' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; tail -1 "$d/skills.txt" | grep -q '^skills ' || { echo "skills: $d"; exit 1; }; [ -s "evals/results/research/_answers-lean/$(basename "$d").txt" ] || { echo "answers: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill research --base-only | tee $t/b && [ "$(grep -c ' base ok runs=10$' $t/b)" = 8 ] && echo "base-ok=8" && node evals/lean/budget.mjs spent --skills research --cap 120
cells=8
cell=chon-kien-truc-theo-rang-buoc-sonnet base ok runs=10
cell=chon-kien-truc-theo-rang-buoc-opus base ok runs=10
cell=da-co-quyet-dinh-sonnet base ok runs=10
cell=da-co-quyet-dinh-opus base ok runs=10
cell=khong-luu-khong-sua-sonnet base ok runs=10
cell=khong-luu-khong-sua-opus base ok runs=10
cell=nguon-cu-mau-thuan-sonnet base ok runs=10
cell=nguon-cu-mau-thuan-opus base ok runs=10
base-ok=8
budget: spent=16.9478 cap=120
```

One lane alone on the machine (every lane.txt before=0 after=0). Pilots (da-co-quyet-dinh sonnet 3, opus 1; khong-luu-khong-sua sonnet 1) loaded and had web tools in every run. Eight cells: each loaded 10/10, web 10/10, 0 errored runs, research=de31c72b6402a2ef; answers saved to _answers-lean. Spend 16.9478 of 120.
