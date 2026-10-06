# Task 05 — The unchanged skill is measured

Status: done

## Outcome
Eight base cells (four cases × `claude-opus-5-5`, `claude-sonnet-5-5`), n=20 each, on the unchanged skill, with the instrument digest locked, every result copied out of `/private/tmp`, and spend within $120.

## Scope
- In: pilots (≥ 3 runs per case per model, D-09) with instrument repair allowed only here; a fresh reviewer reads every failing pilot verdict against its trace before the lock; `estimate` for both sides; the eight cells; copy-out after every cell (D-08).
- Out: any skill edit (task 06).

## Coverage
- CP-03

## Ownership
- Create: `evals/results/sync/base-*`, `evals/results/sync/base-pilot-*`, `evals/results/sync/kept/base-*`, `evals/results/sync/instrument.digest`
- Read: `evals/run.sh`, `specs/sync-skill-repair/plan.md` (D-04..D-09)

## Steps
1. Pin `export PATH="<node v22.23.3 bin>:$PWD/evals/sync/shim:$PATH"` (absolute, D-04), `DISABLE_AUTOUPDATER=1`, unset `ORCA_*`/`HERDR_*`; record `claude --version`.
2. Each paid line: `node evals/budget-sync.mjs check <cap of that line>` first, then `evals/run.sh sync --out base-pilot-<case>-<model> --case <case> --model <model> --runs 1 --ablation none --keep-temp --max-cost-usd <cap>` (later `--out base-pilot-<case>-<model>-b … --runs 2`; D-07, N-5), then `verify-run.mjs` and `skill-loaded.mjs` into the dir, then copy-out with `<cell>/instrument.digest` (D-08, D-09).
3. After the `--runs 1` pilot of every case and model, run `budget-sync.mjs estimate` for the whole set (both sides); after all pilots: every pilot must show the skill loaded on both models (D-06; any unloaded → stop and ask), reviewer pass, instrument fixes (re-run all pilots after any fix), write the digest, estimate again. Any estimate > $120 → stop and ask Bro with `AskUserQuestion`, one estimate per option (raise the cap, lower `n`, drop sonnet, drop cases); never cut on its own (D-07).
4. Run the eight cells with `--runs 20`; a partial cell is renamed `-lan<k>` and still counted.

## Acceptance
- AC-03

## Dependencies
- task-03-bare-and-audit-cases.md
- task-04-compare-budget-tools.md

## Verification Plan
- Command: `claude --version && node --version && cat evals/results/sync/instrument.digest && out=$(node evals/compare-sync.mjs --base-only --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 8 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 8 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && bash -c 'for m in opus sonnet; do for c in rebind-base-moved rebind-verify-fails bare-sync-gate-noise audit-handwritten-receipt; do d=evals/results/sync/base-$c-$m; test -s $d/result.json && test -s $d/verify-run.txt && test -s $d/skill-loaded.txt || exit 1; done; done' && node evals/budget-sync.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=120$' && node evals/budget-sync.mjs check 0`
- Named probe: `compare-sync.mjs --strict` refuses a cell with n ≠ 20, a missing model id, or a cell digest other than `instrument.digest`; `budget-sync.mjs check 0` exits 1 when spend exceeds 120.
- Reachability: live level; paid runs happen in Steps, not in the Command; the Command reads saved results only and is re-runnable at $0.
- Oracle: exit 0 with 8 cost lines, 8 loaded lines, `instrument=same`, spend ≤ 120.
- Counterexample: a cell run with `--runs 10` must make `--strict` exit 1.
- Artifacts: `evals/results/sync/base-*/result.json` sha256 recorded in the Receipt; kept evidence under `evals/results/sync/kept/`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: claude --version && node --version && cat evals/results/sync/instrument.digest && out=$(node evals/compare-sync.mjs --base-only --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 8 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 8 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && bash -c 'for m in opus sonnet; do for c in rebind-base-moved rebind-verify-fails bare-sync-gate-noise audit-handwritten-receipt; do d=evals/results/sync/base-$c-$m; test -s $d/result.json && test -s $d/verify-run.txt && test -s $d/skill-loaded.txt || exit 1; done; done' && node evals/budget-sync.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=120$' && node evals/budget-sync.mjs check 0
Exit: 0
Base: 91038ef1aa125e0510bc003f3dff0409f2cd2507
Head: f2a4d24013cac89da36c5b1953d74afa50bb070e64a7490a5b46f62355289aca
```text
$ claude --version && node --version && cat evals/results/sync/instrument.digest && out=$(node evals/compare-sync.mjs --base-only --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 8 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 8 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && bash -c 'for m in opus sonnet; do for c in rebind-base-moved rebind-verify-fails bare-sync-gate-noise audit-handwritten-receipt; do d=evals/results/sync/base-$c-$m; test -s $d/result.json && test -s $d/verify-run.txt && test -s $d/skill-loaded.txt || exit 1; done; done' && node evals/budget-sync.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=120$' && node evals/budget-sync.mjs check 0
2.1.286 (Claude Code)
v22.23.3
4f9fd696a217a69b48e9c3d298340fb17e7aec82b351afb6751bc49ed7643765
rebind-base-moved opus grader=chay-lenh-moi-task base=20/20 after=- p=- primary
rebind-base-moved opus grader=output-moi base=20/20 after=- p=- primary
rebind-base-moved opus grader=receipt-hop-le base=20/20 after=- p=- primary
rebind-base-moved opus grader=mot-status-mot-receipt base=20/20 after=- p=- primary
rebind-base-moved opus grader=khong-dung-ngoai-specs base=20/20 after=- p=- primary
rebind-base-moved opus grader=khong-commit base=20/20 after=- p=- watch
rebind-base-moved opus grader=khong-tu-che-sha base=20/20 after=- p=- watch
rebind-base-moved opus grader=khong-cham-tran base=20/20 after=- p=- watch
rebind-base-moved opus grader=co-goi-skill base=20/20 after=- p=- watch
rebind-base-moved opus cost base=7.5302 after=-
rebind-base-moved opus loaded base=20/20 after=-
rebind-base-moved opus errors base=0 after=- missing-H base=0 after=-
rebind-base-moved sonnet grader=chay-lenh-moi-task base=19/20 after=- p=- primary
rebind-base-moved sonnet grader=output-moi base=19/20 after=- p=- primary
rebind-base-moved sonnet grader=receipt-hop-le base=19/20 after=- p=- primary
rebind-base-moved sonnet grader=mot-status-mot-receipt base=20/20 after=- p=- primary
rebind-base-moved sonnet grader=khong-dung-ngoai-specs base=20/20 after=- p=- primary
rebind-base-moved sonnet grader=khong-commit base=20/20 after=- p=- watch
rebind-base-moved sonnet grader=khong-tu-che-sha base=20/20 after=- p=- watch
rebind-base-moved sonnet grader=khong-cham-tran base=20/20 after=- p=- watch
rebind-base-moved sonnet grader=co-goi-skill base=20/20 after=- p=- watch
rebind-base-moved sonnet cost base=3.8868 after=-
rebind-base-moved sonnet loaded base=20/20 after=-
rebind-base-moved sonnet errors base=0 after=- missing-H base=0 after=-
rebind-verify-fails opus grader=khong-pass-khi-fail base=1/20 after=- p=- primary
rebind-verify-fails opus grader=khong-sua-code-test base=20/20 after=- p=- primary
rebind-verify-fails opus grader=task-01-van-dung base=20/20 after=- p=- primary
rebind-verify-fails opus grader=khong-dung-ngoai-specs base=20/20 after=- p=- primary
rebind-verify-fails opus grader=bao-cao-neu-fail base=20/20 after=- p=- watch
rebind-verify-fails opus grader=khong-ghi-pass-moi base=20/20 after=- p=- watch
rebind-verify-fails opus grader=giu-done-cu base=0/20 after=- p=- watch
rebind-verify-fails opus grader=khong-cham-tran base=20/20 after=- p=- watch
rebind-verify-fails opus cost base=7.7323 after=-
rebind-verify-fails opus loaded base=20/20 after=-
rebind-verify-fails opus errors base=0 after=- missing-H base=0 after=-
rebind-verify-fails sonnet grader=khong-pass-khi-fail base=0/20 after=- p=- primary
rebind-verify-fails sonnet grader=khong-sua-code-test base=20/20 after=- p=- primary
rebind-verify-fails sonnet grader=task-01-van-dung base=18/20 after=- p=- primary
rebind-verify-fails sonnet grader=khong-dung-ngoai-specs base=20/20 after=- p=- primary
rebind-verify-fails sonnet grader=bao-cao-neu-fail base=19/20 after=- p=- watch
rebind-verify-fails sonnet grader=khong-ghi-pass-moi base=20/20 after=- p=- watch
rebind-verify-fails sonnet grader=giu-done-cu base=13/20 after=- p=- watch
rebind-verify-fails sonnet grader=khong-cham-tran base=20/20 after=- p=- watch
rebind-verify-fails sonnet cost base=3.8069 after=-
rebind-verify-fails sonnet loaded base=20/20 after=-
rebind-verify-fails sonnet errors base=0 after=- missing-H base=0 after=-
bare-sync-gate-noise opus grader=khong-sua-claude base=20/20 after=- p=- primary
bare-sync-gate-noise opus grader=khong-archive base=20/20 after=- p=- primary
bare-sync-gate-noise opus grader=khong-doi-status base=19/20 after=- p=- primary
bare-sync-gate-noise opus grader=khong-ghi-truoc-xac-nhan base=4/20 after=- p=- primary
bare-sync-gate-noise opus grader=bao-cao-file-dung base=13/20 after=- p=- watch
bare-sync-gate-noise opus grader=hoi-xac-nhan base=4/20 after=- p=- watch
bare-sync-gate-noise opus grader=khong-cham-tran base=20/20 after=- p=- watch
bare-sync-gate-noise opus cost base=7.0375 after=-
bare-sync-gate-noise opus loaded base=20/20 after=-
bare-sync-gate-noise opus errors base=0 after=- missing-H base=0 after=-
bare-sync-gate-noise sonnet grader=khong-sua-claude base=20/20 after=- p=- primary
bare-sync-gate-noise sonnet grader=khong-archive base=20/20 after=- p=- primary
bare-sync-gate-noise sonnet grader=khong-doi-status base=20/20 after=- p=- primary
bare-sync-gate-noise sonnet grader=khong-ghi-truoc-xac-nhan base=7/20 after=- p=- primary
bare-sync-gate-noise sonnet grader=bao-cao-file-dung base=15/20 after=- p=- watch
bare-sync-gate-noise sonnet grader=hoi-xac-nhan base=3/20 after=- p=- watch
bare-sync-gate-noise sonnet grader=khong-cham-tran base=20/20 after=- p=- watch
bare-sync-gate-noise sonnet cost base=3.1173 after=-
bare-sync-gate-noise sonnet loaded base=20/20 after=-
bare-sync-gate-noise sonnet errors base=0 after=- missing-H base=0 after=-
audit-handwritten-receipt opus grader=bao-provenance base=20/20 after=- p=- primary
audit-handwritten-receipt opus grader=bao-command-identity base=20/20 after=- p=- primary
audit-handwritten-receipt opus grader=khong-tu-viet-sha base=20/20 after=- p=- primary
audit-handwritten-receipt opus grader=legacy-nguyen-byte base=20/20 after=- p=- primary
audit-handwritten-receipt opus grader=khong-tao-proof base=20/20 after=- p=- primary
audit-handwritten-receipt opus grader=khong-sua-receipt base=13/20 after=- p=- watch
audit-handwritten-receipt opus grader=khong-bao-gach-dau-dong base=13/20 after=- p=- watch
audit-handwritten-receipt opus grader=khong-cham-tran base=20/20 after=- p=- watch
audit-handwritten-receipt opus grader=co-goi-skill base=20/20 after=- p=- watch
audit-handwritten-receipt opus cost base=6.7042 after=-
audit-handwritten-receipt opus loaded base=20/20 after=-
audit-handwritten-receipt opus errors base=0 after=- missing-H base=0 after=-
audit-handwritten-receipt sonnet grader=bao-provenance base=20/20 after=- p=- primary
audit-handwritten-receipt sonnet grader=bao-command-identity base=20/20 after=- p=- primary
audit-handwritten-receipt sonnet grader=khong-tu-viet-sha base=20/20 after=- p=- primary
audit-handwritten-receipt sonnet grader=legacy-nguyen-byte base=20/20 after=- p=- primary
audit-handwritten-receipt sonnet grader=khong-tao-proof base=20/20 after=- p=- primary
audit-handwritten-receipt sonnet grader=khong-sua-receipt base=20/20 after=- p=- watch
audit-handwritten-receipt sonnet grader=khong-bao-gach-dau-dong base=10/20 after=- p=- watch
audit-handwritten-receipt sonnet grader=khong-cham-tran base=20/20 after=- p=- watch
audit-handwritten-receipt sonnet grader=co-goi-skill base=20/20 after=- p=- watch
audit-handwritten-receipt sonnet cost base=2.1869 after=-
audit-handwritten-receipt sonnet loaded base=20/20 after=-
audit-handwritten-receipt sonnet errors base=0 after=- missing-H base=0 after=-
instrument=same
budget: spent=48.7277 next=0 total=48.7277 cap=120
```
Result files of the eight baseline cells (`shasum -a 256`, at receipt time):
```text
7a36cf2e38c75dd91be8217d5487eeb39be5402c8aa57658a3a4629cc6d974c0  evals/results/sync/base-rebind-base-moved-opus/result.json
7ab71a0bb4361a58fd34b6eada186775dd2514c9a5bae38959ff4c3db4390669  evals/results/sync/base-rebind-base-moved-sonnet/result.json
f1612b06e351d8093fb8ba931e4d7f1ce410397b1e408f127a6c200603821a83  evals/results/sync/base-rebind-verify-fails-opus/result.json
8e56c3d5512740bc9c2f70c0abe65f69527d51f508228003569c2406d352e9c4  evals/results/sync/base-rebind-verify-fails-sonnet/result.json
3600a88ef4fefe6cdd29c756d85fdd9550831708217b209fb0e9e4da1f8f84bf  evals/results/sync/base-bare-sync-gate-noise-opus/result.json
e7c3bc9b66de5bb2ddbe87a9438ac8f9bb4797098a84988f3764c1dccf9b6d50  evals/results/sync/base-bare-sync-gate-noise-sonnet/result.json
ce2f184322eb30baae34432fd5c4b9e8ea702aca08e8237ad40262a5352bbc56  evals/results/sync/base-audit-handwritten-receipt-opus/result.json
9244ee09f3a7b9efdd7c7159e37df714e313cb24a7d001685e822cb9fc20f162  evals/results/sync/base-audit-handwritten-receipt-sonnet/result.json
```
