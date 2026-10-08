# Task 01 — The skill and the auditor stop running tests, share one severity scale and keep the header

Status: done

## Outcome
`cf:code-review` and `code-auditor` both carry the execution boundary of plan D-01, the severity scale and precedence of D-02 and the verbatim headers and labels of D-03; `references/verification-gate.md` no longer demands the reviewer's own proof (D-04); a new self-test group named `code-review review boundary` pins each rule and proves it rejects a weakening of each; the 0.16.8 changelog entry names the change.

## Scope
- In: the wording of the three review files, one self-test group, one changelog line.
- Out: the other references (`adversarial-review.md`, `spec-compliance-review.md`, `pre-landing-checklists.md`, `review-focus.md`), every other skill and agent (including `fix/references/review-cycle.md`), the installed `.claude/`, the generated `packages/spec/.agents/`, `evals/`.

## Coverage
- CP-01, CP-02, CP-03

## Ownership
- Modify: `packages/spec/src/claude/skills/code-review/SKILL.md`, `packages/spec/src/claude/agents/code-auditor.md`, `packages/spec/src/claude/skills/code-review/references/verification-gate.md`, `packages/spec/scripts/run-skill-self-tests.mjs`, `packages/spec/CHANGELOG.md`
- Read: the ten existing pins listed in plan.md's Scope decision (they must keep passing), `specs/code-review-eval-baseline/task-03-measure-baseline.md` (its Receipt's decisive text shows the forms the rules must cover), `packages/spec/src/claude/skills/fix/references/review-cycle.md` and `packages/spec/src/claude/skills/develop/references/quality-gate.md` (consumers of the verdict surface)

## Steps
1. Run the Command once and see it fail: the group `code-review review boundary` does not exist yet.
2. `SKILL.md`:
   - state the boundary once — never run the project's test suite or a test file, a sanity check included; a read-only run of the reviewed code (for example `node -e` on the changed function) may reproduce a defect and is cited as a reproduction, never as test evidence; never report a test result, a pass count or an exit code as the review's evidence; without a `test-proof-v1` handoff the proof line is exactly `**Execution proof:** unavailable (owned by cf:test)` and the report does not otherwise say whether tests pass; the review still returns its correctness verdict;
   - add D-02's scale with one example per tier and its precedence: Critical and High need a concrete failure a user or operator hits; the compliance Criticals apply only with a supplied task or spec, where `UNVERIFIED` means supplied proof that failed; a leftover debug log is at most Medium, a secret or credential it prints is a separate security finding; a behavior the change's README or docs state as intended is Low or a question; define a blocking Medium as one with a concrete failure before merge, and state that a review whose heaviest remaining finding is a non-blocking Medium returns `PASS_WITH_WARNINGS` and one with only Low findings returns `PASS` (user decision at this task's review);
   - require the header line `# Code Review Results [cf:code-review]`, the field labels and the severity labels `Critical`, `High`, `Medium`, `Low` verbatim in English, content in the user's language;
   - keep every phrase the existing pins read.
3. `code-auditor.md`:
   - add the same boundary; restrict `Bash` to read-only inspection (`git show`, `git diff`, `git log`, `git status`, search, reading files), the read-only reproduction and the Strict attestation validator (`node .claude/scripts/validate-spec-output.cjs <specDir> --semantic-digest` or its `.codex` twin, `:186`); reword "Read and report only" (`:12`, `:175`) to "never edits files" plus that allowance;
   - replace the four one-line tiers (`:100-104`) with the shared scale and its examples; say the task/spec-compliance rules (`:41-43`) and the Automatic Criticals (`:154-167`) other than the logging-redaction and filesystem-write ones, which apply whenever the diff touches those surfaces (user decision at this task's review), apply only when a task or spec is supplied, and that `UNVERIFIED` in `:165` means supplied proof that failed; state the `PASS_WITH_WARNINGS` rule for non-blocking Mediums;
   - make `BLOCKED` (`:120`) exclude missing execution proof, which is stated as unavailable while the verdict is still returned;
   - keep `## Review Report`, its headings and the severity labels verbatim, content in the user's language;
   - keep `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`, "The definition of `PASS` defers to `cf:code-review`", "cannot finish a task" and every phrase the existing pins read.
4. `verification-gate.md`: keep what a legacy packet's supplied proof must contain and how it is consumed; remove the "Iron Law" (`:3` description, `:6` heading, `:10-11`), "If you have not compiled it, ran it, or seen it pass tests" (`:20`), "you must cite one of the following concrete proofs" (`:23`) and the instruction to return `BLOCKED` on a review without proof (`:43-46`), aligned with `SKILL.md`'s boundary.
5. `run-skill-self-tests.mjs`: add one check function that
   - reads the three files and fails with a named `[FAIL]` line when a rule is missing: for both surfaces the no-test-suite rule, the read-only reproduction allowance, no test result as review evidence, the exact unavailable proof line, the severity examples and precedence (debug log at most Medium; secret as a separate finding; documented intended behavior not Medium or heavier; compliance Criticals only with a task or spec; `UNVERIFIED` as failed supplied proof; non-blocking Medium → `PASS_WITH_WARNINGS`), the verbatim header, field and severity labels; for the auditor also the `Bash` allowance with the validator and the `BLOCKED` definition without missing proof; for `verification-gate.md` the absence of "Iron Law", "MUST NOT issue a final verdict of PASS unless", "you do not know if it works", "ran it, or seen it pass tests", "you must cite one of the following concrete proofs", "without providing concrete execution proofs", "no execution proof is available" and "Resume only after proof arrives";
   - applies one weakening per rule to an in-memory copy (the rule's sentence removed, the debug-log example rated High, a forbidden phrase restored) and fails unless each is rejected, so the number of weakenings equals the number of rules;
   - prints `Ran <N> tests in code-review review boundary` and `code-review review boundary rejects <K> weakenings of <R> rules`, and is called from the runner's main sequence so its count joins the total.
6. `CHANGELOG.md`: one line under the existing `[0.16.8]` entry's changes naming the review boundary, the severity scale and the verbatim headers and labels.

## Acceptance
- AC-01, AC-02, AC-03, AC-04 as stated in `plan.md`.
- The Receipt carries the three `sha256` lines the Command prints, in `shasum`'s `<hash>  <path>` form; task 02 pins them.

## Dependencies
- none

## Verification Plan
- Command: `cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1); st=$?; printf '%s\n' "$out" | grep -E '^\[FAIL\]|^Ran [0-9]+ tests? in code-review review boundary|^code-review review boundary rejects|^\[skill-test\] PASS:'; m=$(printf '%s\n' "$out" | sed -n 's/^\[skill-test\] PASS: \([0-9]*\) tests executed$/\1/p'); [ $st = 0 ] && [ -n "$m" ] && [ "$m" -gt 1434 ] && printf '%s\n' "$out" | grep -qE '^Ran [0-9]+ tests? in code-review review boundary$' && printf '%s\n' "$out" | awk '/^code-review review boundary rejects [0-9]+ weakenings of [0-9]+ rules$/ { if ($5 == $8 && $5 > 0) ok = 1 } END { exit ok ? 0 : 1 }' && node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js src/claude/hooks/__tests__/semantic-review-authority.test.js 2>&1 | grep -E '^# (tests|pass|fail) ' && node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js src/claude/hooks/__tests__/semantic-review-authority.test.js > /dev/null 2>&1 && shasum -a 256 src/claude/skills/code-review/SKILL.md src/claude/agents/code-auditor.md src/claude/skills/code-review/references/verification-gate.md`
- Named probe: the self-test group `code-review review boundary` with its weakening check, the existing pin `code-auditor speaks the shared verdict surface`, and the four `node --test` files that read these surfaces
- Reachability: known — `evals/run.sh` copies `packages/spec/src/claude/skills/code-review` and, with `--with-agent code-auditor`, `agents/code-auditor.md` into the plugin under test (task 02 measures the live effect); the runner and the `node --test` files read the same source files
- Oracle: exit 0; `Ran <N> tests in code-review review boundary`; `code-review review boundary rejects <K> weakenings of <R> rules` with K = R ≥ 1; `[skill-test] PASS: <M> tests executed` with M above 1434; `# fail 0` from the `node --test` files; no `[FAIL]` line; three `sha256` lines
- Counterexample: the boundary sentence removed from either surface, the debug-log example rated High, a severity or header label left translatable, `BLOCKED` still listing missing execution proof in the auditor, the validator missing from the auditor's `Bash` allowance, or any forbidden phrase left in `verification-gate.md` (the demand to return `BLOCKED` when no execution proof is available included) each make the group print `[FAIL]`; a weakening the group fails to reject makes it print `[FAIL]` too, and fewer weakenings than rules fails the `K = R` check; each makes the Command exit non-zero
- Artifacts: none beyond the three source files' `sha256`

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A pre-existing pin that the new wording breaks is kept by rewording, never by deleting the pin.

## Receipt

Verification: PASS
Command: cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1); st=$?; printf '%s\n' "$out" | grep -E '^\[FAIL\]|^Ran [0-9]+ tests? in code-review review boundary|^code-review review boundary rejects|^\[skill-test\] PASS:'; m=$(printf '%s\n' "$out" | sed -n 's/^\[skill-test\] PASS: \([0-9]*\) tests executed$/\1/p'); [ $st = 0 ] && [ -n "$m" ] && [ "$m" -gt 1434 ] && printf '%s\n' "$out" | grep -qE '^Ran [0-9]+ tests? in code-review review boundary$' && printf '%s\n' "$out" | awk '/^code-review review boundary rejects [0-9]+ weakenings of [0-9]+ rules$/ { if ($5 == $8 && $5 > 0) ok = 1 } END { exit ok ? 0 : 1 }' && node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js src/claude/hooks/__tests__/semantic-review-authority.test.js 2>&1 | grep -E '^# (tests|pass|fail) ' && node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js src/claude/hooks/__tests__/semantic-review-authority.test.js > /dev/null 2>&1 && shasum -a 256 src/claude/skills/code-review/SKILL.md src/claude/agents/code-auditor.md src/claude/skills/code-review/references/verification-gate.md
Exit: 0
Base: 983c58d9137176a84d146efc17a11648ede3dc7e
Head: d57d4dfe8bef19d889e11e507cdfd0e50b8079f12d173df9e953d1002d182596
```text
$ cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1); st=$?; printf '%s\n' "$out" | grep -E '^\[FAIL\]|^Ran [0-9]+ tests? in code-review review boundary|^code-review review boundary rejects|^\[skill-test\] PASS:'; m=$(printf '%s\n' "$out" | sed -n 's/^\[skill-test\] PASS: \([0-9]*\) tests executed$/\1/p'); [ $st = 0 ] && [ -n "$m" ] && [ "$m" -gt 1434 ] && printf '%s\n' "$out" | grep -qE '^Ran [0-9]+ tests? in code-review review boundary$' && printf '%s\n' "$out" | awk '/^code-review review boundary rejects [0-9]+ weakenings of [0-9]+ rules$/ { if ($5 == $8 && $5 > 0) ok = 1 } END { exit ok ? 0 : 1 }' && node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js src/claude/hooks/__tests__/semantic-review-authority.test.js 2>&1 | grep -E '^# (tests|pass|fail) ' && node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js src/claude/hooks/__tests__/semantic-review-authority.test.js > /dev/null 2>&1 && shasum -a 256 src/claude/skills/code-review/SKILL.md src/claude/agents/code-auditor.md src/claude/skills/code-review/references/verification-gate.md
code-review review boundary rejects 61 weakenings of 61 rules
Ran 122 tests in code-review review boundary
[skill-test] PASS: 1556 tests executed
# tests 129
# pass 128
# fail 0
99fd6f1fc6f3eed6ae36d7c354c9a49c343b8c41fa264709db31ab375b141f6e  src/claude/skills/code-review/SKILL.md
4e4dd0f20f6d9520a4e8776f73712a16e4d365d68ae896121b11a14b49b7ab64  src/claude/agents/code-auditor.md
9345f28f4f1779cf6cde57496c02883abf715ccade976e9c241a058e71793bed  src/claude/skills/code-review/references/verification-gate.md
```

Re-run at the packet's final Head before GATE-DONE (2026-09-28), after tasks 02 and 03 added `evals/budget-cap.mjs`, `evals/compare-code-review.mjs`, `evals/decisive-code-review.mjs` and `evals/probe-skill-name.sh`; the output equals the first run's.
