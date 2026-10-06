# Task 01 — The skill delivers its payload

Status: done

## Outcome
`cf:test` tells the agent to end its final message with the concise report (`**Status:** <verdict>` first) followed by `### Machine handoff (test-proof-v1)` and exactly one fenced `json` block holding the validated payload when the target's task can be read, ends with `No payload: target not identifiable.` otherwise, and shows a checked `BLOCKED` example and the `FAIL` variants (plan D-01); the skill self-tests pin the new clauses (plan D-02).

## Scope
- In: `SKILL.md` "Verdict and report" (and the handoff line near `:80` if it contradicts); `references/execution-strategy.md` §7 and a compact example under §4; required clauses and mutations in `run-skill-self-tests.mjs`.
- Out: the schema keys and rules; the `test-runner` agent; other skills; `.claude/`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/test/SKILL.md`, `packages/spec/src/claude/skills/test/references/execution-strategy.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `packages/spec/bin/__tests__/develop-contract.test.js:1000-1130`, `packages/spec/bin/__tests__/codex-native.test.js:2740-2780`

## Steps
1. `SKILL.md`: after the report template, state the placement rule of plan D-01 (the readable-task condition, the heading, one fenced `json` block, "the handoff block follows the report and is not part of it", no further fenced block after it, the no-payload line otherwise); keep "Do not place the full JSON payload … in the concise report"; repeat no existing anchor and never say the report may carry JSON.
2. `execution-strategy.md` §7: the same placement in one sentence; under §4 the `BLOCKED` example of plan D-01 (object `target`, `provenance` SHAs, top-level and branch `command`/`exit` null together, one seven-key branch per Named probe with zero counts, `reachability.status` `BLOCKED`, a real `payload_sha256` computed with sorted-key compact JSON) and one line naming the two `FAIL` variants; commands in the example use `node --test`.
3. `run-skill-self-tests.mjs`: required clauses for the placement, the not-part-of-the-report sentence, the no-payload line and the example, each with a named mutation (`payload-placement`, `payload-separate`, `payload-none`, `payload-example`) that removes it; the existing checks keep passing.
4. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-01: the skill self-tests pass with the new clause check and its four mutations; the pinned Node tests pass; the example payload passes `validate()`; the Command prints `test-skill-digest:`.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1) && printf "%s\n" "$out" | grep -E "cf:test|skill-test\] PASS" && grep -qxF "✔ cf:test plan-native checker rejects semantic weakenings" <<< "$out" && t=$(node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (tests|pass|fail)" && grep -qx "# fail 0" <<< "$t" && grep -qF "### Machine handoff (test-proof-v1)" src/claude/skills/test/SKILL.md && for m in payload-placement payload-separate payload-none payload-example; do grep -qF "\"$m\"" scripts/run-skill-self-tests.mjs || { echo "no mutation $m"; exit 1; }; done && node --input-type=module -e "import fs from \"fs\"; import { validate } from \"../../evals/test/check-payload.mjs\"; const s = fs.readFileSync(\"src/claude/skills/test/references/execution-strategy.md\", \"utf8\"); const b = [...s.matchAll(/\\x60\\x60\\x60json\\n([\\s\\S]*?)\\n\\x60\\x60\\x60/g)].map((m) => JSON.parse(m[1])).filter((j) => j.schema_version === \"test-proof-v1\"); if (b.length !== 1) { console.error(\"want one example payload, found \" + b.length); process.exit(1); } const p = b[0], bad = validate(p, p.branches.map((x) => x.id), \"BLOCKED\"); if (p.verdict !== \"BLOCKED\" || p.reachability?.status !== \"BLOCKED\" || !p.provenance || p.command !== null || p.exit !== null || p.branches.some((x) => x.command !== null || x.exit !== null)) bad.push(\"blocked-shape\"); if (bad.length) { console.error(\"example invalid: \" + bad.join(\",\")); process.exit(1); } console.log(\"example payload: valid\");" && d=$( (cd src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "test-skill-digest: $d"'`
- Named probe: `cf:test plan-native checker rejects semantic weakenings` in `run-skill-self-tests.mjs`; `develop-contract.test.js`, `codex-native.test.js`
- Reachability: known — `evals/run.sh test` builds the eval plugin from `packages/spec/src/claude/skills/test` (`evals/run.sh:33`)
- Oracle: the Command exits 0 with the self-test PASS line, `# fail 0`, `example payload: valid` and the digest
- Counterexample: dropping the placement clause, the separation sentence, the no-payload line or the example makes the intact-source or semantic-weakening checks fail; a wrong digest, a string `target`, a branch missing a key, a null `provenance`, a non-null `command`/`exit`, or a `reachability.status` other than `BLOCKED` in the example makes the example check fail
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1) && printf "%s\n" "$out" | grep -E "cf:test|skill-test\] PASS" && grep -qxF "✔ cf:test plan-native checker rejects semantic weakenings" <<< "$out" && t=$(node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js 2>&1) && printf "%s\n" "$t" | grep -E "^# (tests|pass|fail)" && grep -qx "# fail 0" <<< "$t" && grep -qF "### Machine handoff (test-proof-v1)" src/claude/skills/test/SKILL.md && for m in payload-placement payload-separate payload-none payload-example; do grep -qF "\"$m\"" scripts/run-skill-self-tests.mjs || { echo "no mutation $m"; exit 1; }; done && node --input-type=module -e "import fs from \"fs\"; import { validate } from \"../../evals/test/check-payload.mjs\"; const s = fs.readFileSync(\"src/claude/skills/test/references/execution-strategy.md\", \"utf8\"); const b = [...s.matchAll(/\\x60\\x60\\x60json\\n([\\s\\S]*?)\\n\\x60\\x60\\x60/g)].map((m) => JSON.parse(m[1])).filter((j) => j.schema_version === \"test-proof-v1\"); if (b.length !== 1) { console.error(\"want one example payload, found \" + b.length); process.exit(1); } const p = b[0], bad = validate(p, p.branches.map((x) => x.id), \"BLOCKED\"); if (p.verdict !== \"BLOCKED\" || p.reachability?.status !== \"BLOCKED\" || !p.provenance || p.command !== null || p.exit !== null || p.branches.some((x) => x.command !== null || x.exit !== null)) bad.push(\"blocked-shape\"); if (bad.length) { console.error(\"example invalid: \" + bad.join(\",\")); process.exit(1); } console.log(\"example payload: valid\");" && d=$( (cd src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "test-skill-digest: $d"'
Exit: 0
Base: 599a9073634813bd0ac6c4984f5d34d8365dc65d
Head: e9da26c7b3dab0fcb7d76f8688a1f6be8cc6c9ebda6e31db87a828a668b69fdc
```text
✔ cf:test plan-native proof contract is complete and bounded
✔ cf:test plan-native checker rejects semantic weakenings
✔ cf:test supports spec-aware feature testing
[skill-test] PASS: 1653 tests executed
# tests 104
# pass 104
# fail 0
example payload: valid
test-skill-digest: 7b24ad2912b891212af6fd0a3615e38f04e2d6d418b925ac44f5368175f6ad91
```

Fresh code-auditor review: PASS (wording matches D-01, the example payload re-verified independently, all five mutations raise payload-delivery). Re-run at the final-Head fixed point.
