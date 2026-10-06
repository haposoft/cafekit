# Task 03 — The surface that failed in task 02 is repaired

Status: blocked
Blocker: promoted only when the task 02 Receipt shows `over-routing=yes` or `develop-blocked=yes`. The controller then clears this Blocker via `/cf:sync` and sets `pending` (plan D-04).

## Outcome
Only the failing surface is rewritten, per plan D-05:
- **over-routing** → the direct-work rule names signals and typical direct work instead of a file count, with tripwires back to Specs. Critical work is never direct;
- **develop-blocked** → "do not implement it yourself" is scoped to unplanned work.

The pins move with the text without weakening any mutation, and the self-test and node suite pass.

## Scope
- In: the files D-05 names for the observed failure; one `[Unreleased]` line in each changelog.
- Out: critical routing; the other surface when it did not fail.

## Coverage
- CP-03

## Ownership
- Modify:
  - `packages/spec/src/claude/skills/specs/SKILL.md`
  - `packages/spec/src/claude/skills/develop/SKILL.md`
  - `packages/spec/scripts/run-skill-self-tests.mjs`
  - `packages/spec/bin/__tests__/codex-native.test.js`
  - `packages/spec/bin/__tests__/package-inventory.test.js`
  - `packages/spec/CHANGELOG.md`
  - `docs/project-changelog.md`

## Steps
1. Rewrite per D-05 for each failure that task 02 printed.
2. Move the `frontmatterGate` and `directGate` pins, and the mutation cases that quote the old text, to the new text. Each mutation must still fail its check.
3. Run the Command.

## Acceptance
- AC-03:
  - the description stays ≤1024 characters and ≤1024 bytes;
  - the description keeps the sentence "Auth, data, or money risk comes here first" and every routing idea (`cf:brainstorm`, `never writes code`, `answer directly`, `scope gate`), and has no forbidden word;
  - the specs body changes, against `bdaca80`, only in the paragraph that begins `Work directly`;
  - in that paragraph, every sentence that mentions `critical` also says `never`;
  - `develop/SKILL.md` changes only at its direct-work line;
  - the self-test, codex-native and package-inventory tests pass.

## Dependencies
- task-02-measure-decide.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && S=packages/spec/src/claude/skills && git show bdaca80:$S/specs/SKILL.md > /tmp/fl-specs-base.md && git show bdaca80:$S/develop/SKILL.md > /tmp/fl-dev-base.md && node -e 'const fs=require("fs");const [s,b,ds,db]=process.argv.slice(1).map(f=>fs.readFileSync(f,"utf8"));const d=JSON.parse(s.split("\n")[2].slice("description: ".length));const body=x=>{const i=x.indexOf("\n---\n",4);return x.slice(i+5)};const paras=x=>body(x).split(/\n\s*\n/);const P=paras(s),Q=paras(b);const isDirect=p=>/^Work directly/.test(p.trim());const restSame=JSON.stringify(P.filter(p=>!isDirect(p)))===JSON.stringify(Q.filter(p=>!isDirect(p)));const dp=P.filter(isDirect).join(" ");const critOk=dp.split(/(?<=\.)\s/).filter(x=>/critical/i.test(x)).every(x=>/never/i.test(x));const dl=ds.split("\n"),bl=db.split("\n");const devDiff=dl.length===bl.length&&dl.filter((l,i)=>l!==bl[i]).every(l=>/work directly/i.test(l));const ok=d.length<=1024&&Buffer.byteLength(d)<=1024&&d.includes("Auth, data, or money risk comes here first")&&["cf:brainstorm","never writes code","answer directly","scope gate"].every(n=>d.includes(n))&&!/even if|regardless|exception|\blane\b/i.test(d)&&restSame&&critOk&&devDiff;console.log("len="+d.length+" body-rest-same="+restSame+" critical-never="+critOk+" develop-diff-ok="+devDiff);process.exit(ok?0:1)' $S/specs/SKILL.md /tmp/fl-specs-base.md $S/develop/SKILL.md /tmp/fl-dev-base.md && pnpm --dir packages/spec test > /tmp/fl-selftest.log 2>&1; s=$?; tail -2 /tmp/fl-selftest.log; [ $s = 0 ] && node --test packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/package-inventory.test.js > /tmp/fl-nodetest.log 2>&1; t=$?; grep -E '^# (pass|fail)' /tmp/fl-nodetest.log; for d in specs develop; do echo "digest $d=$( (cd $S/$d && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16)"; done; [ $s = 0 ] && [ $t = 0 ]`
- Named probe: the description checks; the body and develop diffs against `bdaca80`; the self-test; the codex-native and package-inventory tests.
- Reachability: hosts read the description and the body when the skill loads.
- Oracle: all of these, with exit 0:
  - `len=<n≤1024> body-rest-same=true critical-never=true develop-diff-ok=true`;
  - a passing self-test;
  - `# fail 0`;
  - two `digest` lines.
- Counterexample: the Command exits non-zero on any of these:
  - a dropped auth sentence or routing idea;
  - a forbidden word;
  - an over-long description;
  - a body change outside the direct paragraph;
  - critical allowed as direct;
  - a failing test.
- Artifacts: the edited files (tracked); `/tmp/fl-*` (ephemeral).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
