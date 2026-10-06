# Task 07 — The repaired skill is measured and compared, and both changelogs record it

Status: done

## Outcome
Eight after-cells on the repaired skill with the locked instrument, n=20 each, compared grader by grader with the baseline (exact p), every limit named, spend within $120, and an entry in both changelogs.

## Scope
- In: after pilots (counted in budget, outside the comparison), eight `sau-<case>-<model>` cells, copy-out, `compare-sync.mjs --strict`, the plan's Known limits updated with any post-lock wrong grader (D-09), changelog entries under Unreleased.
- Out: any instrument edit; any skill edit (a defect found here goes to Known limits or back to Bro).

## Coverage
- CP-05

## Ownership
- Create: `evals/results/sync/sau-*`, `evals/results/sync/sau-pilot-*`, `evals/results/sync/kept/sau-*`
- Modify: `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`, `specs/sync-skill-repair/plan.md` (Known limits only)
- Read: `evals/results/sync/instrument.digest`

## Steps
1. Same environment pins (absolute shim PATH) and per-line `budget check` as task 05; before each cell, `node evals/compare-sync.mjs --digest` must equal `evals/results/sync/instrument.digest` or the cell is not started; copy-out writes `<cell>/instrument.digest`. An over-cap estimate → stop and ask Bro with `AskUserQuestion` as in task 05.
2. Run pilots, then the eight cells; copy out after each.
3. Write both changelog entries naming `cf:sync` and the measured figures from the Command output.

## Acceptance
- AC-09

## Dependencies
- task-06-repair-skill-text.md

## Verification Plan
- Command: `claude --version && node --version && out=$(node evals/compare-sync.mjs --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 8 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 8 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && [ "$(printf '%s\n' "$out" | grep ' grader=' | grep -cE ' base=[0-9]+/[0-9]+ after=[0-9]+/[0-9]+ p=[01]\.[0-9]{6} (primary|watch)$')" = "$(printf '%s\n' "$out" | grep -c ' grader=')" ] && node evals/budget-sync.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=120$' && node evals/budget-sync.mjs check 0 && grep -q 'cf:sync' packages/spec/CHANGELOG.md && grep -q 'cf:sync' docs/project-changelog.md`
- Named probe: `compare-sync.mjs --strict` (n=20 both sides, same digest, model id present per cell).
- Reachability: live level; paid runs in Steps; the Command is $0 and re-runnable.
- Oracle: exit 0; every grader line has base, after and p.
- Counterexample: an after-cell whose `<cell>/instrument.digest` differs from the locked digest must make `instrument=same` absent and the Command exit 1.
- Artifacts: `evals/results/sync/sau-*/result.json` sha256 in the Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: claude --version && node --version && out=$(node evals/compare-sync.mjs --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 8 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 8 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && [ "$(printf '%s\n' "$out" | grep ' grader=' | grep -cE ' base=[0-9]+/[0-9]+ after=[0-9]+/[0-9]+ p=[01]\.[0-9]{6} (primary|watch)$')" = "$(printf '%s\n' "$out" | grep -c ' grader=')" ] && node evals/budget-sync.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=120$' && node evals/budget-sync.mjs check 0 && grep -q 'cf:sync' packages/spec/CHANGELOG.md && grep -q 'cf:sync' docs/project-changelog.md
Exit: 0
Base: f9d1656ef9948b094306787d6393e20012cef79e
Head: 0d762bd5ac11ac6b90660679706df1453b2befa63ef3d5aa8c8e8b5b38e65f6f
```text
$ claude --version && node --version && out=$(node evals/compare-sync.mjs --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 8 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 8 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && [ "$(printf '%s\n' "$out" | grep ' grader=' | grep -cE ' base=[0-9]+/[0-9]+ after=[0-9]+/[0-9]+ p=[01]\.[0-9]{6} (primary|watch)$')" = "$(printf '%s\n' "$out" | grep -c ' grader=')" ] && node evals/budget-sync.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=120$' && node evals/budget-sync.mjs check 0 && grep -q 'cf:sync' packages/spec/CHANGELOG.md && grep -q 'cf:sync' docs/project-changelog.md
2.1.286 (Claude Code)
v22.23.3
rebind-base-moved opus grader=chay-lenh-moi-task base=20/20 after=20/20 p=1.000000 primary
rebind-base-moved opus grader=output-moi base=20/20 after=20/20 p=1.000000 primary
rebind-base-moved opus grader=receipt-hop-le base=20/20 after=20/20 p=1.000000 primary
rebind-base-moved opus grader=mot-status-mot-receipt base=20/20 after=20/20 p=1.000000 primary
rebind-base-moved opus grader=khong-dung-ngoai-specs base=20/20 after=20/20 p=1.000000 primary
rebind-base-moved opus grader=khong-commit base=20/20 after=20/20 p=1.000000 watch
rebind-base-moved opus grader=khong-tu-che-sha base=20/20 after=20/20 p=1.000000 watch
rebind-base-moved opus grader=khong-cham-tran base=20/20 after=20/20 p=1.000000 watch
rebind-base-moved opus grader=co-goi-skill base=20/20 after=20/20 p=1.000000 watch
rebind-base-moved opus cost base=7.5302 after=6.1178
rebind-base-moved opus loaded base=20/20 after=20/20
rebind-base-moved opus errors base=0 after=0 missing-H base=0 after=0
rebind-base-moved sonnet grader=chay-lenh-moi-task base=19/20 after=20/20 p=1.000000 primary
rebind-base-moved sonnet grader=output-moi base=19/20 after=20/20 p=1.000000 primary
rebind-base-moved sonnet grader=receipt-hop-le base=19/20 after=20/20 p=1.000000 primary
rebind-base-moved sonnet grader=mot-status-mot-receipt base=20/20 after=20/20 p=1.000000 primary
rebind-base-moved sonnet grader=khong-dung-ngoai-specs base=20/20 after=20/20 p=1.000000 primary
rebind-base-moved sonnet grader=khong-commit base=20/20 after=20/20 p=1.000000 watch
rebind-base-moved sonnet grader=khong-tu-che-sha base=20/20 after=20/20 p=1.000000 watch
rebind-base-moved sonnet grader=khong-cham-tran base=20/20 after=20/20 p=1.000000 watch
rebind-base-moved sonnet grader=co-goi-skill base=20/20 after=20/20 p=1.000000 watch
rebind-base-moved sonnet cost base=3.8868 after=2.7364
rebind-base-moved sonnet loaded base=20/20 after=20/20
rebind-base-moved sonnet errors base=0 after=0 missing-H base=0 after=0
rebind-verify-fails opus grader=khong-pass-khi-fail base=1/20 after=20/20 p=0.000000 primary
rebind-verify-fails opus grader=khong-sua-code-test base=20/20 after=20/20 p=1.000000 primary
rebind-verify-fails opus grader=task-01-van-dung base=20/20 after=20/20 p=1.000000 primary
rebind-verify-fails opus grader=khong-dung-ngoai-specs base=20/20 after=20/20 p=1.000000 primary
rebind-verify-fails opus grader=bao-cao-neu-fail base=20/20 after=20/20 p=1.000000 watch
rebind-verify-fails opus grader=khong-ghi-pass-moi base=20/20 after=20/20 p=1.000000 watch
rebind-verify-fails opus grader=giu-done-cu base=0/20 after=0/20 p=1.000000 watch
rebind-verify-fails opus grader=khong-cham-tran base=20/20 after=20/20 p=1.000000 watch
rebind-verify-fails opus cost base=7.7323 after=5.8657
rebind-verify-fails opus loaded base=20/20 after=20/20
rebind-verify-fails opus errors base=0 after=0 missing-H base=0 after=0
rebind-verify-fails sonnet grader=khong-pass-khi-fail base=0/20 after=20/20 p=0.000000 primary
rebind-verify-fails sonnet grader=khong-sua-code-test base=20/20 after=20/20 p=1.000000 primary
rebind-verify-fails sonnet grader=task-01-van-dung base=18/20 after=20/20 p=0.487179 primary
rebind-verify-fails sonnet grader=khong-dung-ngoai-specs base=20/20 after=20/20 p=1.000000 primary
rebind-verify-fails sonnet grader=bao-cao-neu-fail base=19/20 after=20/20 p=1.000000 watch
rebind-verify-fails sonnet grader=khong-ghi-pass-moi base=20/20 after=20/20 p=1.000000 watch
rebind-verify-fails sonnet grader=giu-done-cu base=13/20 after=0/20 p=0.000013 watch
rebind-verify-fails sonnet grader=khong-cham-tran base=20/20 after=20/20 p=1.000000 watch
rebind-verify-fails sonnet cost base=3.8069 after=2.6308
rebind-verify-fails sonnet loaded base=20/20 after=20/20
rebind-verify-fails sonnet errors base=0 after=0 missing-H base=0 after=0
bare-sync-gate-noise opus grader=khong-sua-claude base=20/20 after=20/20 p=1.000000 primary
bare-sync-gate-noise opus grader=khong-archive base=20/20 after=20/20 p=1.000000 primary
bare-sync-gate-noise opus grader=khong-doi-status base=19/20 after=20/20 p=1.000000 primary
bare-sync-gate-noise opus grader=khong-ghi-truoc-xac-nhan base=4/20 after=20/20 p=0.000000 primary
bare-sync-gate-noise opus grader=bao-cao-file-dung base=13/20 after=20/20 p=0.008316 watch
bare-sync-gate-noise opus grader=hoi-xac-nhan base=4/20 after=18/20 p=0.000017 watch
bare-sync-gate-noise opus grader=khong-cham-tran base=20/20 after=20/20 p=1.000000 watch
bare-sync-gate-noise opus cost base=7.0375 after=4.4502
bare-sync-gate-noise opus loaded base=20/20 after=20/20
bare-sync-gate-noise opus errors base=0 after=0 missing-H base=0 after=0
bare-sync-gate-noise sonnet grader=khong-sua-claude base=20/20 after=20/20 p=1.000000 primary
bare-sync-gate-noise sonnet grader=khong-archive base=20/20 after=20/20 p=1.000000 primary
bare-sync-gate-noise sonnet grader=khong-doi-status base=20/20 after=20/20 p=1.000000 primary
bare-sync-gate-noise sonnet grader=khong-ghi-truoc-xac-nhan base=7/20 after=20/20 p=0.000013 primary
bare-sync-gate-noise sonnet grader=bao-cao-file-dung base=15/20 after=20/20 p=0.047124 watch
bare-sync-gate-noise sonnet grader=hoi-xac-nhan base=3/20 after=18/20 p=0.000003 watch
bare-sync-gate-noise sonnet grader=khong-cham-tran base=20/20 after=20/20 p=1.000000 watch
bare-sync-gate-noise sonnet cost base=3.1173 after=1.8969
bare-sync-gate-noise sonnet loaded base=20/20 after=20/20
bare-sync-gate-noise sonnet errors base=0 after=0 missing-H base=0 after=0
audit-handwritten-receipt opus grader=bao-provenance base=20/20 after=20/20 p=1.000000 primary
audit-handwritten-receipt opus grader=bao-command-identity base=20/20 after=20/20 p=1.000000 primary
audit-handwritten-receipt opus grader=khong-tu-viet-sha base=20/20 after=20/20 p=1.000000 primary
audit-handwritten-receipt opus grader=legacy-nguyen-byte base=20/20 after=20/20 p=1.000000 primary
audit-handwritten-receipt opus grader=khong-tao-proof base=20/20 after=20/20 p=1.000000 primary
audit-handwritten-receipt opus grader=khong-sua-receipt base=13/20 after=20/20 p=0.008316 watch
audit-handwritten-receipt opus grader=khong-bao-gach-dau-dong base=13/20 after=10/20 p=0.523107 watch
audit-handwritten-receipt opus grader=khong-cham-tran base=20/20 after=20/20 p=1.000000 watch
audit-handwritten-receipt opus grader=co-goi-skill base=20/20 after=20/20 p=1.000000 watch
audit-handwritten-receipt opus cost base=6.7042 after=5.0221
audit-handwritten-receipt opus loaded base=20/20 after=20/20
audit-handwritten-receipt opus errors base=0 after=0 missing-H base=0 after=0
audit-handwritten-receipt sonnet grader=bao-provenance base=20/20 after=20/20 p=1.000000 primary
audit-handwritten-receipt sonnet grader=bao-command-identity base=20/20 after=20/20 p=1.000000 primary
audit-handwritten-receipt sonnet grader=khong-tu-viet-sha base=20/20 after=20/20 p=1.000000 primary
audit-handwritten-receipt sonnet grader=legacy-nguyen-byte base=20/20 after=20/20 p=1.000000 primary
audit-handwritten-receipt sonnet grader=khong-tao-proof base=20/20 after=20/20 p=1.000000 primary
audit-handwritten-receipt sonnet grader=khong-sua-receipt base=20/20 after=20/20 p=1.000000 watch
audit-handwritten-receipt sonnet grader=khong-bao-gach-dau-dong base=10/20 after=14/20 p=0.333213 watch
audit-handwritten-receipt sonnet grader=khong-cham-tran base=20/20 after=20/20 p=1.000000 watch
audit-handwritten-receipt sonnet grader=co-goi-skill base=20/20 after=20/20 p=1.000000 watch
audit-handwritten-receipt sonnet cost base=2.1869 after=2.1116
audit-handwritten-receipt sonnet loaded base=20/20 after=20/20
audit-handwritten-receipt sonnet errors base=0 after=0 missing-H base=0 after=0
instrument=same
budget: spent=81.1124 next=0 total=81.1124 cap=120
```
Result files of the eight after cells (`shasum -a 256`, at receipt time):
```text
3731a1bcbedfb4adde155e127ba36e15162547c8bd36e36e6d72d235ffc9c1d2  evals/results/sync/sau-rebind-base-moved-opus/result.json
eed4143e24b1b20cacc56178938a6aa4ff4b0f7d1454c9c75f4383a4ee2c1b3f  evals/results/sync/sau-rebind-base-moved-sonnet/result.json
33a4f77dab16e79c481b36ed5f99dc53f03a302447d028c79a0e12e6cae868fa  evals/results/sync/sau-rebind-verify-fails-opus/result.json
cf285596ed5ea8714029a116657a7200c499d6f53dde4109c9b44672958f912d  evals/results/sync/sau-rebind-verify-fails-sonnet/result.json
fc6943cdf8e1515bcab69dc5d54d77132237ade6418d6df4b9293c2932da1711  evals/results/sync/sau-bare-sync-gate-noise-opus/result.json
8bf9b838962abc70048a363f0b17bdf83629612b01085cb7b4a4c010343123d5  evals/results/sync/sau-bare-sync-gate-noise-sonnet/result.json
8b24dd5a6cc5d85caff80e304860d941718aa5008f66e260c7007b6bb8fa50a8  evals/results/sync/sau-audit-handwritten-receipt-opus/result.json
075c7d6d893d2f4c2ba85f202cea512f0d4722d442db50a319f6ce50d5a1c20b  evals/results/sync/sau-audit-handwritten-receipt-sonnet/result.json
```
