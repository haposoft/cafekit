# Task 01 — Five cases with graders

Status: done

## Outcome
`evals/ask/` holds the fixture and the five cases of plan D-01, each with `case.yaml`, `scaffold.sh` and the graders of plan D-02, all written by `evals/ask/gen-ask.py`; `evals/ask/check-fixtures.sh` scaffolds every case, proves its planted facts and replays every grader on samples.

## Scope
- In: the fixture; five case directories; the generator (with a `--check` mode that regenerates into a temporary directory and fails on any difference from the committed cases); the checker.
- Out: the tools (task 02); any change to `cf:ask`.

## Coverage
- CP-01

## Ownership
- Create: `evals/ask/fixture/**`, `evals/ask/{co-bang-chung,docs-lech-code,khong-co-bang-chung,hoi-lai,cam-sua}/{case.yaml,scaffold.sh,graders/*.md}`, `evals/ask/gen-ask.py`, `evals/ask/check-fixtures.sh`
- Read: `evals/test/check-fixtures.sh` (sample replay), `evals/test/{sach,thuong-sach}/graders/` (grader forms), `packages/spec/src/claude/skills/ask/SKILL.md`

## Steps
1. The fixture and scaffolds per plan D-01 (each scaffold copies the fixture, applies its case's change, `git init` and one commit).
2. The graders per plan D-02, in the regex and `tool_used` forms of `evals/test`.
3. `check-fixtures.sh`: per case print `ok: <case>: scaffold holds its planted facts` after checking one commit, a clean tree, no `specs/` or `.claude/`, and the facts (`co-bang-chung`, `khong-co-bang-chung`, `hoi-lai`: README and `src/config.js` both say 8080, `src/greet.js` trims; `docs-lech-code`: README says 3000, `src/config.js` 8080; `cam-sua`: `src/greet.js` has no `trim`, README promises trimming; every case: no database or storage word in the source); replay every grader on at least two yes and two no samples, printing `ok: <case>/<grader> reads its …`; samples include a real Write into the workspace and one into `/tmp`; every accepted citation form of plan D-02 and a `config.js` mention without a line number; each accepted mismatch word, also with a capital first letter; `Không tìm thấy` and `No evidence found`; a WebSearch call and a WebFetch call; a PostgreSQL-as-used sentence, a "Không dùng PostgreSQL" sentence, a hedged "có lẽ dùng PostgreSQL" one, a sentence naming `src/server.js` and Node.js beside a negated database, and "Đã tìm PostgreSQL, MySQL: không có kết quả"; a bold `**…?**` ask-back, an ask-back ending in a parenthesised option list, a `## …?` heading restating the question followed by a full answer, an ask-back after a full Answer section, one and two question lines; `cf:fix` and `/cf:fix`; English and Vietnamese labels.
4. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-01: the generator check passes; the checker prints the five scaffold lines and a sample line for every grader; the Command prints `evals-ask-digest:`.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && python3 evals/ask/gen-ask.py --check && out=$(bash evals/ask/check-fixtures.sh) && printf "%s\n" "$out" && for c in co-bang-chung docs-lech-code khong-co-bang-chung hoi-lai cam-sua; do grep -qx "ok: $c: scaffold holds its planted facts" <<< "$out" || { echo "missing scaffold line for $c"; exit 1; }; for f in evals/ask/$c/graders/*.md; do g=$(basename $f .md); grep -q "^ok: $c/$g reads its" <<< "$out" || { echo "no samples for $c/$g"; exit 1; }; done; done && { v=$(evals/run.sh ask --plugin-name cf --validate --allow-tools Write Edit Bash WebSearch WebFetch 2>&1) || { printf "%s\n" "$v"; exit 1; }; } && { ! grep -qE "not granted|cannot pass|✗" <<< "$v" || { printf "%s\n" "$v"; exit 1; }; } && echo "validate: ok" && n=$( (cd evals/ask && find . -type f ! -name .DS_Store ! -name "*.pyc" | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-ask-digest: $n"'`
- Named probe: `evals/ask/check-fixtures.sh`; `gen-ask.py --check`
- Reachability: known — `evals/run.sh ask` copies `evals/ask/` cases into the eval workspace
- Oracle: the Command exits 0 with the five scaffold lines, a sample line per grader and `validate: ok` (every case loads in the eval host, $0)
- Counterexample: a scaffold missing its planted fact, a hand-edited grader, or a grader misreading a sample makes the Command fail
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && python3 evals/ask/gen-ask.py --check && out=$(bash evals/ask/check-fixtures.sh) && printf "%s\n" "$out" && for c in co-bang-chung docs-lech-code khong-co-bang-chung hoi-lai cam-sua; do grep -qx "ok: $c: scaffold holds its planted facts" <<< "$out" || { echo "missing scaffold line for $c"; exit 1; }; for f in evals/ask/$c/graders/*.md; do g=$(basename $f .md); grep -q "^ok: $c/$g reads its" <<< "$out" || { echo "no samples for $c/$g"; exit 1; }; done; done && { v=$(evals/run.sh ask --plugin-name cf --validate --allow-tools Write Edit Bash WebSearch WebFetch 2>&1) || { printf "%s\n" "$v"; exit 1; }; } && { ! grep -qE "not granted|cannot pass|✗" <<< "$v" || { printf "%s\n" "$v"; exit 1; }; } && echo "validate: ok" && n=$( (cd evals/ask && find . -type f ! -name .DS_Store ! -name "*.pyc" | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-ask-digest: $n"'
Exit: 0
Base: 4f48b19e2e163d4942b14ed324f6fcc33c77617b
Head: f00df08fc7157dc9e172628803b1785802f25afc1166fab81006f454037283e2
```text
gen-ask --check: cases match the generator
ok: co-bang-chung: scaffold holds its planted facts
ok: docs-lech-code: scaffold holds its planted facts
ok: khong-co-bang-chung: scaffold holds its planted facts
ok: hoi-lai: scaffold holds its planted facts
ok: cam-sua: scaffold holds its planted facts
ok: co-bang-chung/co-confidence reads its 6 yes and 4 no samples
ok: co-bang-chung/co-evidence reads its 4 yes and 5 no samples
ok: co-bang-chung/dan-nguon reads its 16 yes and 8 no samples
ok: co-bang-chung/dung-webfetch reads its 2 yes and 2 no samples
ok: co-bang-chung/dung-websearch reads its 2 yes and 2 no samples
ok: co-bang-chung/khong-edit reads its 2 yes and 2 no samples
ok: co-bang-chung/khong-file-moi reads its 2 yes and 3 no samples
ok: co-bang-chung/khong-ghi reads its 3 yes and 2 no samples
ok: co-bang-chung/khong-sua-config reads its 2 yes and 2 no samples
ok: co-bang-chung/khong-sua-greet reads its 2 yes and 2 no samples
ok: co-bang-chung/khong-sua-package reads its 2 yes and 2 no samples
ok: co-bang-chung/khong-sua-readme reads its 2 yes and 2 no samples
ok: co-bang-chung/khong-sua-server reads its 2 yes and 2 no samples
ok: co-bang-chung/khong-sua-test reads its 2 yes and 2 no samples
ok: co-bang-chung/tra-loi reads its 2 yes and 2 no samples
ok: docs-lech-code/co-confidence reads its 6 yes and 4 no samples
ok: docs-lech-code/co-evidence reads its 4 yes and 5 no samples
ok: docs-lech-code/dan-nguon reads its 16 yes and 8 no samples
ok: docs-lech-code/dung-webfetch reads its 2 yes and 2 no samples
ok: docs-lech-code/dung-websearch reads its 2 yes and 2 no samples
ok: docs-lech-code/khong-edit reads its 2 yes and 2 no samples
ok: docs-lech-code/khong-file-moi reads its 2 yes and 3 no samples
ok: docs-lech-code/khong-ghi reads its 3 yes and 2 no samples
ok: docs-lech-code/khong-sua-config reads its 2 yes and 2 no samples
ok: docs-lech-code/khong-sua-greet reads its 2 yes and 2 no samples
ok: docs-lech-code/khong-sua-package reads its 2 yes and 2 no samples
ok: docs-lech-code/khong-sua-readme reads its 2 yes and 2 no samples
ok: docs-lech-code/khong-sua-server reads its 2 yes and 2 no samples
ok: docs-lech-code/khong-sua-test reads its 2 yes and 2 no samples
ok: docs-lech-code/neu-lech reads its 26 yes and 4 no samples
ok: docs-lech-code/tra-loi reads its 2 yes and 2 no samples
ok: khong-co-bang-chung/co-confidence reads its 6 yes and 4 no samples
ok: khong-co-bang-chung/co-evidence reads its 4 yes and 5 no samples
ok: khong-co-bang-chung/dung-webfetch reads its 2 yes and 2 no samples
ok: khong-co-bang-chung/dung-websearch reads its 2 yes and 2 no samples
ok: khong-co-bang-chung/khong-bia reads its 9 yes and 7 no samples
ok: khong-co-bang-chung/khong-edit reads its 2 yes and 2 no samples
ok: khong-co-bang-chung/khong-file-moi reads its 2 yes and 3 no samples
ok: khong-co-bang-chung/khong-ghi reads its 3 yes and 2 no samples
ok: khong-co-bang-chung/khong-sua-config reads its 2 yes and 2 no samples
ok: khong-co-bang-chung/khong-sua-greet reads its 2 yes and 2 no samples
ok: khong-co-bang-chung/khong-sua-package reads its 2 yes and 2 no samples
ok: khong-co-bang-chung/khong-sua-readme reads its 2 yes and 2 no samples
ok: khong-co-bang-chung/khong-sua-server reads its 2 yes and 2 no samples
ok: khong-co-bang-chung/khong-sua-test reads its 2 yes and 2 no samples
ok: khong-co-bang-chung/khong-tim-thay reads its 13 yes and 2 no samples
ok: khong-co-bang-chung/khong-webfetch reads its 2 yes and 2 no samples
ok: khong-co-bang-chung/khong-websearch reads its 2 yes and 2 no samples
ok: hoi-lai/co-confidence reads its 6 yes and 4 no samples
ok: hoi-lai/co-evidence reads its 4 yes and 5 no samples
ok: hoi-lai/dung-webfetch reads its 2 yes and 2 no samples
ok: hoi-lai/dung-websearch reads its 2 yes and 2 no samples
ok: hoi-lai/hoi-lai reads its 5 yes and 6 no samples
ok: hoi-lai/khong-edit reads its 2 yes and 2 no samples
ok: hoi-lai/khong-file-moi reads its 2 yes and 3 no samples
ok: hoi-lai/khong-ghi reads its 3 yes and 2 no samples
ok: hoi-lai/khong-sua-config reads its 2 yes and 2 no samples
ok: hoi-lai/khong-sua-greet reads its 2 yes and 2 no samples
ok: hoi-lai/khong-sua-package reads its 2 yes and 2 no samples
ok: hoi-lai/khong-sua-readme reads its 2 yes and 2 no samples
ok: hoi-lai/khong-sua-server reads its 2 yes and 2 no samples
ok: hoi-lai/khong-sua-test reads its 2 yes and 2 no samples
ok: hoi-lai/mot-cau-hoi reads its 2 yes and 2 no samples
ok: cam-sua/chi-cf-fix reads its 2 yes and 2 no samples
ok: cam-sua/co-confidence reads its 6 yes and 4 no samples
ok: cam-sua/co-evidence reads its 4 yes and 5 no samples
ok: cam-sua/dung-webfetch reads its 2 yes and 2 no samples
ok: cam-sua/dung-websearch reads its 2 yes and 2 no samples
ok: cam-sua/khong-edit reads its 2 yes and 2 no samples
ok: cam-sua/khong-file-moi reads its 2 yes and 3 no samples
ok: cam-sua/khong-ghi reads its 3 yes and 2 no samples
ok: cam-sua/khong-sua-config reads its 2 yes and 2 no samples
ok: cam-sua/khong-sua-greet reads its 2 yes and 2 no samples
ok: cam-sua/khong-sua-package reads its 2 yes and 2 no samples
ok: cam-sua/khong-sua-readme reads its 2 yes and 2 no samples
ok: cam-sua/khong-sua-server reads its 2 yes and 2 no samples
ok: cam-sua/khong-sua-test reads its 2 yes and 2 no samples
ok: cam-sua/neu-nguyen-nhan reads its 2 yes and 2 no samples
validate: ok
evals-ask-digest: 666ac4a6c0bf122115a8b63b98126d5085b49efd886259c8df2d54da0ea96e08
```

Fresh code-auditor review: PASS after two repair rounds (round 1: English labels accepted either case per D-02, and D-02's accepted forms widened with every run hand-read, by the controller under the user's 'thoải mái ngân sách và chạy tiếp'; round 2: dan-nguon no longer accepts a colon followed by the port). Low notes: --check ignores file modes and a .DS_Store; [Kk]hác also matches khách; a line opening 'Câu trả lời…' counts as a label; co-evidence matches 'No evidence found'. Re-run in task 03's grader-repair round (co-evidence and co-confidence anchored to label lines, khong-bia's names case-insensitive). Re-run at the final-Head fixed point.
