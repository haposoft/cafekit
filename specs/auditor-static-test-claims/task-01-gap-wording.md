# Task 01 — code-auditor describes a test gap by the missing case, never by a test outcome

Status: done

## Outcome
`packages/spec/src/claude/agents/code-auditor.md` carries plan D-01's GAP sentence once, as the line directly after `do not otherwise say whether tests pass, and still return the verdict.`, with every word of `b733a16d` kept; the Codex projection carries it; a new self-test rule pins it with a weakening; the changed auditor digest is recorded for task 02.

## Scope
- In: the GAP line; one `present(...)` rule inside `runCodeReviewBoundaryCheck` (`packages/spec/scripts/run-skill-self-tests.mjs:5980-6118`).
- Out: any other word of `code-auditor.md`; existing self-test rules; `skills/code-review/*`; graders and `evals/`; AGENTS.md, CLAUDE.md, rules; the installed `.claude/` and `.codex/` copies.

## Coverage
- CP-01

## Pins the edit must keep
- Every existing auditor rule in `runCodeReviewBoundaryCheck` (`:6058-6100`), including the description relay sentence and the caller line as the last report-template line; `:4668-4675`; `bin/__tests__/develop-contract.test.js:255-257`; `bin/__tests__/codex-native.test.js:2141-2154`, `:2218-2229` (no `/cf:`, `cf:`, `Claude Code` in Codex-visible files), `:3071-3080`. The edit only adds a line, so no pinned word changes; if one would, stop and ask the user.

## Ownership
- Modify: `packages/spec/src/claude/agents/code-auditor.md`, `packages/spec/scripts/run-skill-self-tests.mjs`; `specs/_shared/active-feature.json` (gitignored, Step 0)
- Read: plan D-01; `packages/spec/bin/lib/codex-install.js:307`

## Steps
0. Write `specs/_shared/active-feature.json` as `{"featureName": "auditor-static-test-claims"}` (gitignored, `.gitignore:87`), then check it by value: `node -e 'process.exit(JSON.parse(require("fs").readFileSync("specs/_shared/active-feature.json","utf8")).featureName==="auditor-static-test-claims"?0:1)'` exits 0. `git status --short -- packages/spec` is empty. From a separate controller run of `cd packages/spec && node scripts/run-skill-self-tests.mjs`, record the pre-change `code-review review boundary rejects <r> weakenings of <r> rules` and `[skill-test] PASS: <N>` lines; expected 63 and 1359 (plan, 2026-10-08) — if they differ, stop and ask the user (the Command pins 64 and 1361). A pre-change run of the Command exits 1.
1. In `code-auditor.md`, insert GAP (plan D-01, exact bytes: `Describe a test gap by the case or assertion the tests lack, never by a test outcome: write "no test covers a missing config file".`) as a new line after `:24`, before the relay line `When the proof line says unavailable, …`.
2. In `runCodeReviewBoundaryCheck`, after the rule `"auditor reports no test result as evidence"` (`:6064`), add `present("auditor names a test gap without a test outcome", "auditor", <GAP as a JS string>)`. Nothing else: no comment, constant or duplicate string added only to satisfy a grep.
3. Run the Command. Record `agent=<16 hex>` and the pre- and post-change self-test lines in the Receipt note (task 02 reads `agent=`). Then apply the plan's commit rule (explicit paths only; never `evals/ask/*`).

## Acceptance
- AC-01: GAP (no "pass" word, no quoted outcome) appears exactly once as a whole line and its previous line is `do not otherwise say whether tests pass, and still return the verdict.`; with GAP removed the whitespace-normalized file equals `git show b733a16d:packages/spec/src/claude/agents/code-auditor.md`'s; `packages/spec` differs from `b733a16d` only in the two owned files; the Codex `developer_instructions` contain GAP and no `cf:`; the new rule name exists; `code-review review boundary rejects 64 weakenings of 64 rules`; `[skill-test] PASS: 1361 tests executed`; `agent=` other than `2d0283b5b552dfcc`; "missing config" appears nowhere under `evals/code-review` (so a report that copies the example is visible).

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && f=packages/spec/src/claude/agents/code-auditor.md && S='Describe a test gap by the case or assertion the tests lack, never by a test outcome: write "no test covers a missing config file".' && ! grep -rqi 'missing config' evals/code-review && echo example-unused && [ "$(git diff --name-only b733a16d -- packages/spec | tr '\n' ' ')" = "packages/spec/scripts/run-skill-self-tests.mjs packages/spec/src/claude/agents/code-auditor.md " ] && [ "$(grep -cxF -- "$S" $f)" = 1 ] && [ "$(grep -B1 -xF -- "$S" $f | head -1)" = 'do not otherwise say whether tests pass, and still return the verdict.' ] && echo gap-line && node -e 'const fs=require("fs"),cp=require("child_process");const [f,S]=process.argv.slice(1);const n=s=>s.replace(/\s+/g," ").trim();const now=fs.readFileSync(f,"utf8");const base=cp.execSync("git show b733a16d:"+f,{encoding:"utf8"});if(now.split(S).length!==2||n(now.replace(S,""))!==n(base)){console.log("words changed");process.exit(1)}console.log("words-additive")' $f "$S" && node -e 'const fs=require("fs");const {convertCodexAgentContent}=require("./packages/spec/bin/lib/codex-install.js");const t=convertCodexAgentContent(fs.readFileSync(process.argv[1],"utf8"),"code-auditor.md");const i=JSON.parse(/^developer_instructions = (".*")$/m.exec(t)[1]);if(!i.includes(process.argv[2])||/\/cf:|\bcf:/.test(i)){console.log("codex projection");process.exit(1)}console.log("codex-ok")' $f "$S" && grep -qF '"auditor names a test gap without a test outcome"' packages/spec/scripts/run-skill-self-tests.mjs && ag=$(shasum -a 256 $f | cut -c1-16) && [ "$ag" != 2d0283b5b552dfcc ] && echo "agent=$ag" && out=$(cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1) && echo "$out" | grep -xF 'code-review review boundary rejects 64 weakenings of 64 rules' && echo "$out" | grep -xF '[skill-test] PASS: 1361 tests executed'`
- Named probe: the example-unused grep over `evals/code-review` (fixtures, prompts, graders); the touched-files check against `b733a16d`; the GAP line count and position; the additive-words check; `convertCodexAgentContent`; the rule-name grep; `runCodeReviewBoundaryCheck` (the new rule and its weakening) inside `run-skill-self-tests.mjs`, which also runs the `bin/__tests__` node suite with `develop-contract.test.js` and `codex-native.test.js`.
- Reachability: `evals/run.sh --with-agent code-auditor` copies this file into the eval plugin (`evals/run.sh:88`, task 02); the installer copies it for Claude and converts it to `.codex/agents/code_auditor.toml` (`codex-install.js:307`).
- Oracle: `example-unused`, `gap-line`, `words-additive`, `codex-ok`, `agent=<16 hex>`, the two exact self-test lines, exit 0.
- Counterexample: "missing config" present under `evals/code-review`; GAP missing, reworded, duplicated or placed elsewhere; an existing word changed; a third file under `packages/spec` changed; a Codex projection without GAP or with `cf:`; a missing rule, a rule whose weakening still passes, or a failing self-test makes the Command exit 1.
- Artifacts: the two edited source files (tracked); `agent=` in the Receipt note.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && f=packages/spec/src/claude/agents/code-auditor.md && S='Describe a test gap by the case or assertion the tests lack, never by a test outcome: write "no test covers a missing config file".' && ! grep -rqi 'missing config' evals/code-review && echo example-unused && [ "$(git diff --name-only b733a16d -- packages/spec | tr '\n' ' ')" = "packages/spec/scripts/run-skill-self-tests.mjs packages/spec/src/claude/agents/code-auditor.md " ] && [ "$(grep -cxF -- "$S" $f)" = 1 ] && [ "$(grep -B1 -xF -- "$S" $f | head -1)" = 'do not otherwise say whether tests pass, and still return the verdict.' ] && echo gap-line && node -e 'const fs=require("fs"),cp=require("child_process");const [f,S]=process.argv.slice(1);const n=s=>s.replace(/\s+/g," ").trim();const now=fs.readFileSync(f,"utf8");const base=cp.execSync("git show b733a16d:"+f,{encoding:"utf8"});if(now.split(S).length!==2||n(now.replace(S,""))!==n(base)){console.log("words changed");process.exit(1)}console.log("words-additive")' $f "$S" && node -e 'const fs=require("fs");const {convertCodexAgentContent}=require("./packages/spec/bin/lib/codex-install.js");const t=convertCodexAgentContent(fs.readFileSync(process.argv[1],"utf8"),"code-auditor.md");const i=JSON.parse(/^developer_instructions = (".*")$/m.exec(t)[1]);if(!i.includes(process.argv[2])||/\/cf:|\bcf:/.test(i)){console.log("codex projection");process.exit(1)}console.log("codex-ok")' $f "$S" && grep -qF '"auditor names a test gap without a test outcome"' packages/spec/scripts/run-skill-self-tests.mjs && ag=$(shasum -a 256 $f | cut -c1-16) && [ "$ag" != 2d0283b5b552dfcc ] && echo "agent=$ag" && out=$(cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1) && echo "$out" | grep -xF 'code-review review boundary rejects 64 weakenings of 64 rules' && echo "$out" | grep -xF '[skill-test] PASS: 1361 tests executed'
Exit: 0
Base: ee2f88f25603daaa9654421be4195d4805fa5a26
Head: b65dfd49e7d8871566bfac3dd245f00d72cb27e6169d884e1fcea7b674491e1a
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && f=packages/spec/src/claude/agents/code-auditor.md && S='Describe a test gap by the case or assertion the tests lack, never by a test outcome: write "no test covers a missing config file".' && ! grep -rqi 'missing config' evals/code-review && echo example-unused && [ "$(git diff --name-only b733a16d -- packages/spec | tr '\n' ' ')" = "packages/spec/scripts/run-skill-self-tests.mjs packages/spec/src/claude/agents/code-auditor.md " ] && [ "$(grep -cxF -- "$S" $f)" = 1 ] && [ "$(grep -B1 -xF -- "$S" $f | head -1)" = 'do not otherwise say whether tests pass, and still return the verdict.' ] && echo gap-line && node -e 'const fs=require("fs"),cp=require("child_process");const [f,S]=process.argv.slice(1);const n=s=>s.replace(/\s+/g," ").trim();const now=fs.readFileSync(f,"utf8");const base=cp.execSync("git show b733a16d:"+f,{encoding:"utf8"});if(now.split(S).length!==2||n(now.replace(S,""))!==n(base)){console.log("words changed");process.exit(1)}console.log("words-additive")' $f "$S" && node -e 'const fs=require("fs");const {convertCodexAgentContent}=require("./packages/spec/bin/lib/codex-install.js");const t=convertCodexAgentContent(fs.readFileSync(process.argv[1],"utf8"),"code-auditor.md");const i=JSON.parse(/^developer_instructions = (".*")$/m.exec(t)[1]);if(!i.includes(process.argv[2])||/\/cf:|\bcf:/.test(i)){console.log("codex projection");process.exit(1)}console.log("codex-ok")' $f "$S" && grep -qF '"auditor names a test gap without a test outcome"' packages/spec/scripts/run-skill-self-tests.mjs && ag=$(shasum -a 256 $f | cut -c1-16) && [ "$ag" != 2d0283b5b552dfcc ] && echo "agent=$ag" && out=$(cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1) && echo "$out" | grep -xF 'code-review review boundary rejects 64 weakenings of 64 rules' && echo "$out" | grep -xF '[skill-test] PASS: 1361 tests executed'
example-unused
gap-line
words-additive
codex-ok
agent=119468ccbc7d5e00
code-review review boundary rejects 64 weakenings of 64 rules
[skill-test] PASS: 1361 tests executed
```

agent=119468ccbc7d5e00 (task 02 guards on it). Pre-change: self-test 'code-review review boundary rejects 63 weakenings of 63 rules' and PASS 1359; the Command exited 1 after example-unused. Post-change: 64 of 64 rules, PASS 1361. Review: code-auditor PASS, no findings (GAP exact bytes and place, additive only, pin fails when the sentence is removed, the khong-khai-test-xanh grader passes the GAP sentence and an echoed example, Codex projection keeps it).
