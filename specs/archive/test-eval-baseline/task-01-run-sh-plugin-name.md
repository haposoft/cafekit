# Task 01 — `run.sh` takes a plugin name

Status: done

## Outcome
`evals/run.sh` accepts `--plugin-name <name>` beside `--with-skill`/`--with-agent` (plan D-01) and writes it as the temporary plugin's `name`, every other byte of the plugin unchanged; without the flag the build equals the default; `evals/check-run-sh.sh` proves this and the refusals with a stub `claude`, and `evals/check-with-agent.sh` still passes, spending nothing.

## Scope
- In: the flag in the leading flag loop of `evals/run.sh` and its usage comment (the flag precedes `--validate`/`--out`); `evals/check-run-sh.sh`.
- Out: the default name; other suites; any paid run.

## Coverage
- CP-01

## Ownership
- Modify: `evals/run.sh`
- Create: `evals/check-run-sh.sh`
- Read: `evals/run.sh:36-90`, `evals/check-with-agent.sh`

## Steps
1. In the `--with-skill`/`--with-agent` loop add `--plugin-name <name>`: at most once, `^[a-z0-9][a-z0-9-]*$`, else exit 2 with a message before `claude` runs; `plugin.json` uses it, else `cafekit-$skill`.
2. `check-run-sh.sh`: a temporary directory holding a stub `claude` that copies `$PWD/.claude-plugin/plugin.json` to a file named by an environment variable and exits 0; with it first on `PATH`:
   - `evals/run.sh develop --validate` → capture A, with `"name": "cafekit-develop"`;
   - `evals/run.sh develop --plugin-name cf --validate` → capture B, equal to A except `"name": "cf"`;
   - `evals/run.sh develop --with-skill specs --plugin-name cf --validate` → `"name": "cf"`;
   - `--plugin-name Bad_Name` and a repeated `--plugin-name` → exit 2 and no capture file;
   print `ok: default name cafekit-develop`, `ok: --plugin-name cf changes only the name`, `ok: --plugin-name after --with-skill`, `ok: invalid name exits 2 before claude`, `ok: repeated flag exits 2 before claude`; exit 1 on any mismatch. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-01: the Command prints the five `ok:` lines, `check-with-agent: ok` and `run-sh-sha256:`, and exits 0.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && out=$(bash evals/check-run-sh.sh) && printf "%s\n" "$out" && for l in "ok: default name cafekit-develop" "ok: --plugin-name cf changes only the name" "ok: --plugin-name after --with-skill" "ok: invalid name exits 2 before claude" "ok: repeated flag exits 2 before claude"; do printf "%s\n" "$out" | grep -qxF "$l" || { echo "missing: $l"; exit 1; }; done && bash evals/check-with-agent.sh > /dev/null && echo "check-with-agent: ok" && echo "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)"'`
- Named probe: `evals/check-run-sh.sh` (stub `claude` capturing `plugin.json`); `evals/check-with-agent.sh` (default build equals `e93060b` for five suites)
- Reachability: known — tasks 04 and 05 call `evals/run.sh test --plugin-name cf`
- Oracle: the five lines, `check-with-agent: ok` and the digest print, and the Command exits 0
- Counterexample: a run.sh that ignores the flag, changes the default or another plugin byte, accepts `Bad_Name` or calls `claude` before refusing makes a checker exit 1
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && out=$(bash evals/check-run-sh.sh) && printf "%s\n" "$out" && for l in "ok: default name cafekit-develop" "ok: --plugin-name cf changes only the name" "ok: --plugin-name after --with-skill" "ok: invalid name exits 2 before claude" "ok: repeated flag exits 2 before claude"; do printf "%s\n" "$out" | grep -qxF "$l" || { echo "missing: $l"; exit 1; }; done && bash evals/check-with-agent.sh > /dev/null && echo "check-with-agent: ok" && echo "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)"'
Exit: 0
Base: 69d08975a4aea14d5e0d07ef09ffd9ec3f7eae1b
Head: cc860298d1ce86c3ea3c6a73c9d226dba3191dee060a6bbe3b96eadb4a8584f1
```text
ok: default name cafekit-develop
ok: --plugin-name cf changes only the name
ok: --plugin-name after --with-skill
ok: invalid name exits 2 before claude
ok: repeated flag exits 2 before claude
check-with-agent: ok
run-sh-sha256: a75cd5b5fbe5b6438a5eea160625bf8380383b96ead35a54a6dc10b46764d4fa
```

Fresh code-auditor re-review after repair round 1: PASS. Re-run at the final-Head fixed point.
