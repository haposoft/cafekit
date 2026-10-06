# Task 03 — The specs description routes clear critical work to specs

Status: done

## Outcome
The `description` of `cf:specs` tells the model that auth, data or money risk goes to specs even when the request is clear or urgent. Everything else stays fixed:
- every existing routing idea is kept;
- the pinned skip clause is unchanged and verbatim;
- the rest of the frontmatter and the body are unchanged;
- the description stays within 1024 characters and 1024 bytes;
- the self-test, codex-native and package-inventory tests pass.

## Scope
- In: `SKILL.md` line 3; one `[Unreleased]` line in each changelog.
- Out: the body; `references/*`; other skills; test pins (the skip clause stays, so the pins need no change).

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/claude/skills/specs/SKILL.md`, `packages/spec/CHANGELOG.md` (English), `docs/project-changelog.md` (Vietnamese)
- Read: `packages/spec/scripts/run-skill-self-tests.mjs:704,777,5067`, `packages/spec/bin/__tests__/codex-native.test.js:164`, `packages/spec/bin/__tests__/package-inventory.test.js:93`

## Steps
1. Rewrite the description per plan D-04. To make room, shorten existing sentences, but keep every routing idea the description carries now:
   - add, build or change;
   - more than one or two files;
   - auth, data or money risk;
   - vague requests reach the scope gate;
   - the `cf:brainstorm` boundary;
   - never writes code;
   - answer directly for show or tell;
   - the skip clause.
2. Add one `[Unreleased]` line to each changelog.
3. Run the Command. It prints the new skill digest for task 04.

## Acceptance
- AC-03:
  - the description is ≤1024 characters and ≤1024 bytes;
  - it contains the skip clause verbatim, plus `cf:brainstorm`, `never writes code`, `answer directly` and `scope gate`;
  - one sentence contains `auth` (any case) together with a clear-or-urgent qualifier (`clear`, `urgent`, `hurry` or `just do it`);
  - it contains none of `even if`, `regardless`, `exception` or `lane`;
  - the body after the closing frontmatter `---` is byte-identical to `4c2544e`, and non-empty;
  - the package self-test passes, and so do the codex-native and package-inventory tests.

## Dependencies
- task-02-measure-current.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && f=packages/spec/src/claude/skills/specs/SKILL.md && git show 4c2544e:$f > /tmp/specs-skill-base.md && node -e 'const fs=require("fs");const s=fs.readFileSync(process.argv[1],"utf8"),b=fs.readFileSync(process.argv[2],"utf8");const body=x=>{const i=x.indexOf("\n---\n",4);return i<0?"":x.slice(i+5)};const d=JSON.parse(s.split("\n")[2].slice("description: ".length));const need=["skip only when a change is clear, isolated, reversible, routine, and likely limited to one or two files.","cf:brainstorm","never writes code","answer directly","scope gate"];const ok=d.length<=1024&&Buffer.byteLength(d)<=1024&&need.every(n=>d.includes(n))&&d.split(/(?<=\.)\s/).some(x=>/auth/i.test(x)&&/(clear|urgent|hurry|just do it)/i.test(x))&&!/even if|regardless|exception|\blane\b/i.test(d)&&body(s).length>0&&body(s)===body(b)&&s.split("\n").filter((l,i)=>i!==2).slice(0,9).join("\n")===b.split("\n").filter((l,i)=>i!==2).slice(0,9).join("\n");console.log("len="+d.length+" bytes="+Buffer.byteLength(d)+" body-unchanged="+(body(s)===body(b)));process.exit(ok?0:1)' $f /tmp/specs-skill-base.md && (cd packages/spec/src/claude/skills/specs && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16 | sed 's/^/skill-digest=/' && pnpm --dir packages/spec test > /tmp/specs-selftest.log 2>&1; s=$?; tail -3 /tmp/specs-selftest.log; [ $s = 0 ] && node --test packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/package-inventory.test.js > /tmp/specs-nodetest.log 2>&1; t=$?; grep -E '^# (pass|fail)' /tmp/specs-nodetest.log; [ $s = 0 ] && [ $t = 0 ]`
- Named probe: the description content, length and byte check; the frontmatter and body comparison against `4c2544e`; the package self-test; the codex-native and package-inventory tests.
- Reachability: hosts read the `description` field to decide whether to invoke the skill.
- Oracle: all of these, and exit 0:
  - `len=<n≤1024> bytes=<n≤1024> body-unchanged=true`;
  - `skill-digest=<16 hex>`;
  - a passing self-test tail;
  - `# fail 0`.
- Counterexample: the Command exits non-zero on any of these:
  - an over-long description;
  - a dropped routing idea or skip clause;
  - a forbidden word;
  - a body or other frontmatter change;
  - an empty body;
  - a failing test.
- Artifacts: the edited files (tracked); `/tmp/specs-*.log` (ephemeral).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && f=packages/spec/src/claude/skills/specs/SKILL.md && git show 4c2544e:$f > /tmp/specs-skill-base.md && node -e 'const fs=require("fs");const s=fs.readFileSync(process.argv[1],"utf8"),b=fs.readFileSync(process.argv[2],"utf8");const body=x=>{const i=x.indexOf("\n---\n",4);return i<0?"":x.slice(i+5)};const d=JSON.parse(s.split("\n")[2].slice("description: ".length));const need=["skip only when a change is clear, isolated, reversible, routine, and likely limited to one or two files.","cf:brainstorm","never writes code","answer directly","scope gate"];const ok=d.length<=1024&&Buffer.byteLength(d)<=1024&&need.every(n=>d.includes(n))&&d.split(/(?<=\.)\s/).some(x=>/auth/i.test(x)&&/(clear|urgent|hurry|just do it)/i.test(x))&&!/even if|regardless|exception|\blane\b/i.test(d)&&body(s).length>0&&body(s)===body(b)&&s.split("\n").filter((l,i)=>i!==2).slice(0,9).join("\n")===b.split("\n").filter((l,i)=>i!==2).slice(0,9).join("\n");console.log("len="+d.length+" bytes="+Buffer.byteLength(d)+" body-unchanged="+(body(s)===body(b)));process.exit(ok?0:1)' $f /tmp/specs-skill-base.md && (cd packages/spec/src/claude/skills/specs && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16 | sed 's/^/skill-digest=/' && pnpm --dir packages/spec test > /tmp/specs-selftest.log 2>&1; s=$?; tail -3 /tmp/specs-selftest.log; [ $s = 0 ] && node --test packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/package-inventory.test.js > /tmp/specs-nodetest.log 2>&1; t=$?; grep -E '^# (pass|fail)' /tmp/specs-nodetest.log; [ $s = 0 ] && [ $t = 0 ]
Exit: 0
Base: 9f8138238923b1f01cb0be84ce9f13a1c6063522
Head: 9cf9bbdbc9e3f4baa6ad198c00c59880dabcb1504e19f289d805e59c717a825e
```text
len=1018 bytes=1018 body-unchanged=true
skill-digest=83ca3a0fb61de67b
Ran 122 tests in code-review review boundary

[skill-test] PASS: 1603 tests executed
# pass 52
# fail 0
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root after the last edit; `EXIT=0` was its own exit status (the run outlived the 120 s tool limit and finished in the background, exit code 0). The reviewer reran it independently: exit 0, identical output.
- Negative proof: before the edit the Command exited 1 (`len=996 bytes=1000 body-unchanged=true`, no sentence pairing auth with a clear or urgent qualifier).
- Change: one sentence now says auth, data, or money risk comes to Specs first even when the request is clear, urgent, or says to just do it now; the other sentences are shortened to fit (1018 of 1024); the skip clause, the rest of the frontmatter and the body are byte-identical to `4c2544e`.
- Skill digest for task 04's guard: `83ca3a0fb61de67b`.
- Review: code-auditor PASS, with three Low notes: "other critical/elevated signals" are covered by the first sentence and the skip clause rather than the new one; "do not implement it yourself" is unscoped (an explicit `/cf:develop` still wins, unmeasured); the installed `.claude/skills/specs` copy keeps the old text until reinstall.
