# Task 01 — Three new specs cases exist and compare reads any baseline prefix

Status: done

## Outcome
- `evals/specs/lam-thang-doi-ten`, `evals/specs/lam-thang-xoa-module` and `evals/specs/develop-auth` exist per plan D-01 and load without warnings under the D-02 grants.
- `evals/lean/compare.mjs` accepts `--base` and classifies the D-07 graders.

## Scope
- In:
  - each case's `case.yaml`, `scaffold.sh`, `fixture/` and graders;
  - the `develop-auth` fixture packet, its red test and `claude-scripts/provenance.cjs` (copied from `evals/develop/fixture`);
  - `compare.mjs`.
- Out: existing cases; paid runs.

## Coverage
- CP-01

## Ownership
- Create: `evals/specs/lam-thang-doi-ten/**`, `evals/specs/lam-thang-xoa-module/**`, `evals/specs/develop-auth/**`
- Modify: `evals/lean/compare.mjs`
- Read: `evals/specs/sua-typo/`, `evals/develop/mot-task-sach/`, `evals/develop/fixture/`

## Steps
1. Build the two direct cases per D-01. Each `scaffold.sh` copies the fixture, then commits it with the `mot-task-sach` git lines.
2. Build `develop-auth` per D-01, with the `mot-task-sach` scaffold pattern. Before writing it, confirm that `node --test test/google-login.test.js` fails on the fixture.
3. Add `--base` and the D-07 classes to `compare.mjs`, with one self-test showing `--base lean-sau-` reads those cells.
4. Run the Command.

## Acceptance
- AC-01:
  - every D-01 grader file exists;
  - the `develop-auth` red test fails on the fixture;
  - `evals/run.sh specs --plugin-name cf --with-skill brainstorm --with-skill develop --validate --allow-tools Write Edit Bash` prints no `✗` line and no `cannot pass` warning for the new cases;
  - the compare self-test passes;
  - the Command prints the develop skill and `evals/specs` digests for task 02's guard.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && E=evals/specs && for f in lam-thang-doi-ten/graders/khong-goi-specs.md lam-thang-doi-ten/graders/da-doi-ten.md lam-thang-doi-ten/graders/da-doi-ten-w.md lam-thang-xoa-module/graders/khong-goi-specs.md lam-thang-xoa-module/graders/bo-require.md lam-thang-xoa-module/graders/bo-require-w.md develop-auth/graders/khong-goi-specs.md develop-auth/graders/co-sua-src.md develop-auth/graders/co-viet-src.md develop-auth/graders/dung-blocked.md develop-auth/fixture/specs/google-login/plan.md develop-auth/fixture/specs/google-login/task-01-google-login.md develop-auth/fixture/claude-scripts/provenance.cjs lam-thang-doi-ten/fixture/src/format.js lam-thang-xoa-module/fixture/src/legacy-export.js; do [ -s $E/$f ] || { echo "missing $f"; exit 1; }; done && grep -q "fmtName" $E/lam-thang-doi-ten/fixture/src/customers.js && grep -q "legacy-export" $E/lam-thang-xoa-module/fixture/src/app.js && grep -q "git init" $E/lam-thang-xoa-module/scaffold.sh && echo files-ok && t=$(mktemp -d) && cp -R $E/develop-auth/fixture/. $t/ && ! (cd $t && node --test test/google-login.test.js >/dev/null 2>&1) && echo red-test-fails && rm -rf $t && out=$(evals/run.sh specs --plugin-name cf --with-skill brainstorm --with-skill develop --validate --allow-tools Write Edit Bash 2>&1) && ! printf '%s\n' "$out" | grep -E 'lam-thang|develop-auth' | grep -qE '✗|cannot pass' && echo validate-ok && node evals/lean/compare.mjs --self-test | tail -1 && for d in packages/spec/src/claude/skills/develop evals/specs; do echo "digest $d=$( (cd $d && find . -type f ! -name .DS_Store ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16)"; done`
- Named probe: the file checks, the red test, `run.sh --validate`, the compare self-test.
- Reachability: `evals/run.sh specs` discovers every case directory with a `case.yaml`; task 04 calls `compare.mjs`.
- Oracle: all of these, with exit 0:
  - `files-ok`, `red-test-fails`, `validate-ok`;
  - `self-test: ok`;
  - two `digest` lines.
- Counterexample: the Command exits non-zero on any of these:
  - a missing file;
  - a red test that passes;
  - a load error or a `cannot pass` warning;
  - a failing self-test.
- Artifacts: the case directories and `compare.mjs` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && E=evals/specs && for f in lam-thang-doi-ten/graders/khong-goi-specs.md lam-thang-doi-ten/graders/da-doi-ten.md lam-thang-doi-ten/graders/da-doi-ten-w.md lam-thang-xoa-module/graders/khong-goi-specs.md lam-thang-xoa-module/graders/bo-require.md lam-thang-xoa-module/graders/bo-require-w.md develop-auth/graders/khong-goi-specs.md develop-auth/graders/co-sua-src.md develop-auth/graders/co-viet-src.md develop-auth/graders/dung-blocked.md develop-auth/fixture/specs/google-login/plan.md develop-auth/fixture/specs/google-login/task-01-google-login.md develop-auth/fixture/claude-scripts/provenance.cjs lam-thang-doi-ten/fixture/src/format.js lam-thang-xoa-module/fixture/src/legacy-export.js; do [ -s $E/$f ] || { echo "missing $f"; exit 1; }; done && grep -q "fmtName" $E/lam-thang-doi-ten/fixture/src/customers.js && grep -q "legacy-export" $E/lam-thang-xoa-module/fixture/src/app.js && grep -q "git init" $E/lam-thang-xoa-module/scaffold.sh && echo files-ok && t=$(mktemp -d) && cp -R $E/develop-auth/fixture/. $t/ && ! (cd $t && node --test test/google-login.test.js >/dev/null 2>&1) && echo red-test-fails && rm -rf $t && out=$(evals/run.sh specs --plugin-name cf --with-skill brainstorm --with-skill develop --validate --allow-tools Write Edit Bash 2>&1) && ! printf '%s\n' "$out" | grep -E 'lam-thang|develop-auth' | grep -qE '✗|cannot pass' && echo validate-ok && node evals/lean/compare.mjs --self-test | tail -1 && for d in packages/spec/src/claude/skills/develop evals/specs; do echo "digest $d=$( (cd $d && find . -type f ! -name .DS_Store ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16)"; done
Exit: 0
Base: 0478881859422ba396e0318225ad899bc9a020de
Head: d332f6d7dda0caea5aed85f94abce9f273ce811b0e9b9d404418fa242d9bd30d
```text
files-ok
red-test-fails
validate-ok
self-test: ok
digest packages/spec/src/claude/skills/develop=595d40e006903524
digest evals/specs=561618b7159f8ca6
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before any change the Command exited 1 (`missing lam-thang-doi-ten/graders/khong-goi-specs.md`). The red test fails on the fixture (`red-test-fails`). `compare.mjs --base bad` exits 2.
- Scaffold dry runs in temp directories: each case makes one commit with a clean tree; `develop-auth` places `.claude/scripts/provenance.cjs`; `fmtName` appears in four files.
- Guard values that task 02's paid runs checked: develop skill `595d40e006903524`, `evals/specs` `5db5eb8f4e840f9e`. Task 02 then added `fast-lane-decision.mjs`, so the refreshed output above prints the newer `evals/specs` digest.
- Review: code-auditor PASS. Its Medium note says that under the current Step 0 text, routing the direct cases to specs is compliant; this was recorded in plan Known limits. Of its Low notes, the broad `khong-goi-specs` match is handled by reading the skill name from traces in the decision script, the `provenance.cjs` copy is byte-identical but unguarded, and `runs: 3` is overridden by `--runs 10`.
