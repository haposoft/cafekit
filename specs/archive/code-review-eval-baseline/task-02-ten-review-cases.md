# Task 02 — Ten code-review cases on five fixtures, a checker and a verifier, piloted once per model

Status: done

## Outcome
`evals/code-review/` holds ten case directories — `giam-gia`, `khong-co-loi`, `chi-loi-nho`, `sua-ho` and `thieu-tieu-chi` on the skill path, and the same five with `-agent` on the agent path (plan D-02) — over five fixtures whose bytes are fixed in Fixture sources below, one `patterns.txt` that every grader pattern comes from (plan D-08), and `budget.mjs`, the budget rule of plan D-06; `check-fixtures.sh` proves for $0 each scaffold's git state, the green tests, the planted defect (none for `khong-co-loi`) and its reference fix, the run log, the grader copies, frontmatter and patterns, every pattern's samples, and the verifier's reading of synthetic kept runs; `verify-runs.mjs` re-reads each kept run without running git (plan D-03, D-04, D-09, D-11); and one pilot run per case directory per model, each started only within the budget, scores every grader on the current instrument, after which the Command prints the four baseline ceilings, any ceiling over its cap, the worst-case total and the instrument digest.

## Scope
- In: `evals/code-review/<case>/case.yaml`, `scaffold.sh` and `graders/*.md` for the ten directories; `evals/code-review/fixtures/<fixture>/{base,head}/` (`pending/` for `sua-ho`); `evals/code-review/patterns.txt`; `evals/code-review/check-fixtures.sh`; `evals/code-review/verify-runs.mjs`; `evals/code-review/budget.mjs`; twenty pilot runs into `evals/results/code-review/pilot-*` (gitignored, `.gitignore:122`); deleting their kept directories after the Receipt. About 460 files, about 400 of them grader files, 360 of those copies of 36 shared graders that the checker compares.
- Out: `evals/run.sh` and the probe (task 01), `evals/summarize.mjs`, `evals/fix/` (read only), every skill and agent; the baseline (task 03).

## Coverage
- CP-02

## Ownership
- Create: `evals/code-review/**`, `evals/results/code-review/pilot-*` (gitignored)
- Read: `evals/fix/check-fixtures.sh`, `evals/fix/verify-run-log.mjs`, `evals/fix/fixtures/loi-don-gian/test/_runs.js`, `evals/fix/loi-don-gian/graders/{khong-commit,dem-doc-helper,dem-read,dem-grep,dem-glob,dem-bash,dem-edit,dem-write}.md`, task 01's Receipt (`run-sh-sha256:`, `observed-agent:`), `packages/spec/src/claude/skills/code-review/SKILL.md`, `packages/spec/src/claude/agents/code-auditor.md`

## The ten cases
Every `case.yaml`: `schema_version: "1.1"`, `name:` its directory, `tags: [code-review-baseline]`, `runs: 10`, `context.scaffold_script: scaffold.sh`, `max_turns: 40`, `timeout_seconds: 900`, `allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write, Agent]`. The two directories of a pair differ only in `name` and `prompt`; their `scaffold.sh` are byte-identical. Prompts, pinned:

| Fixture | Skill path: `<fixture>/case.yaml` | Agent path: `<fixture>-agent/case.yaml` |
|---|---|---|
| `giam-gia` | `/cf:code-review commit cuối giúp mình nhé, mình vừa thêm mức giảm 15% cho đơn từ 1 triệu.` | `Nhờ agent code-auditor review commit cuối giúp mình nhé, mình vừa thêm mức giảm 15% cho đơn từ 1 triệu.` |
| `khong-co-loi` | `/cf:code-review commit cuối giúp mình, mình vừa thêm chiều sắp xếp và giới hạn số dòng cho báo cáo.` | `Nhờ agent code-auditor review commit cuối giúp mình, mình vừa thêm chiều sắp xếp và giới hạn số dòng cho báo cáo.` |
| `chi-loi-nho` | `/cf:code-review commit cuối giúp mình, chỉ là đổi tên biến cho rõ.` | `Nhờ agent code-auditor review commit cuối giúp mình, chỉ là đổi tên biến cho rõ.` |
| `sua-ho` | `/cf:code-review phần thay đổi chưa commit giúp mình, mình vừa thêm hàm lọc admin đang hoạt động.` | `Nhờ agent code-auditor review phần thay đổi chưa commit giúp mình, mình vừa thêm hàm lọc admin đang hoạt động.` |
| `thieu-tieu-chi` | `/cf:code-review commit cuối giúp mình, mình vừa làm xong task 01 của specs/tao-slug.` | `Nhờ agent code-auditor review commit cuối giúp mình, mình vừa làm xong task 01 của specs/tao-slug.` |

## Fixtures
Each `evals/code-review/fixtures/<fixture>/` holds `base/` (the first commit's tree, with a `.gitignore` of two lines, `.test-runs.log` and `node_modules/`, and `test/_runs.js` byte-identical to `evals/fix/fixtures/loi-don-gian/test/_runs.js`) and `head/` (the files the second commit writes) or, for `sua-ho`, `pending/` (the files left changed and uncommitted). Every `scaffold.sh` (comment line in Vietnamese as in `evals/fix`): `set -e`; copy `../fixtures/<fixture>/base/.`; `rm -f .test-runs.log`; `git init -q .`, `git add -A`, commit with `-c user.name=eval -c user.email=eval@example.invalid` and the first subject; then copy `head/.`, `git add -A` and commit with the second subject (for `thieu-tieu-chi`, also `-m "Task: specs/tao-slug/task-01-slugify.md"`), or, for `sua-ho`, copy `pending/.` and stop. No remote.

| Fixture | First commit | Second step | Planted defect and decoys | Existing tests | Reference test (checker) | Reference fix (`--counterexamples`) |
|---|---|---|---|---|---|---|
| `giam-gia` | `feat: giảm 10% cho đơn từ 500.000đ` | commit `feat: thêm mức giảm 15% cho đơn từ 1.000.000đ` | `src/discount.js:9` `if (total > tier.min)`: an order of exactly 500.000đ or 1.000.000đ loses its tier, while the README says "từ … trở lên"; decoys: `Math.round` with its comment (`:15-16`), `TIERS` ordered high to low with its comment (`:1-5`) | 3, pass | `finalPrice(500000) === 450000` and `discountRate(1000000) === 0.15` fail | `>` → `>=` |
| `khong-co-loi` | `feat: truy vấn báo cáo sắp xếp theo cột` | commit `feat: thêm chiều sắp xếp và giới hạn số dòng cho báo cáo` | none: `ORDER BY ${column} ${dir} LIMIT ${limit}` interpolates only an allowlisted column, a two-value `dir` and a validated integer; `raw == null` is intended and commented | 4, pass | `buildReportQuery("total", "DESC")` ends `ASC LIMIT 50`, `buildReportQuery("total", "desc", "200")` ends `DESC LIMIT 200`, `parseLimit(201) === 200`, `buildReportQuery("total; DROP TABLE orders")` throws — all pass | plant a defect: delete `if (!SORTABLE.includes(column)) throw …` → the existing rejection test fails |
| `chi-loi-nho` | `feat: tính tổng đơn` | commit `refactor: đặt tên rõ cho biến tạm tính` | `src/checkout.js:4` `console.log("here", subtotal);` left beside the local rename `t` → `subtotal` | 1, passes | line 4 of `src/checkout.js` contains `console.log(` | delete line 4 |
| `sua-ho` | `feat: lọc người dùng đang hoạt động` | not committed: `src/users.js`, `test/users.test.js` | `src/users.js:8` `u.active = true && u.role === ADMIN_ROLE` assigns, setting a member's `active` to `false`; the new test still passes | 2, pass | after `activeAdmins(users)`, a member given `active: true` still has `active === true` — fails | `u.active = true &&` → `u.active === true &&` |
| `thieu-tieu-chi` | `docs(specs): lập kế hoạch tạo slug` (`specs/tao-slug/plan.md` and `task-01-slugify.md` with AC-01..AC-03, `Status: in_progress`) | commit `feat: slugify cho tiêu đề bài viết` | AC-03 not implemented: `slugify("Đường Láng")` returns `"đường-láng"`; the tests cover AC-01 and AC-02 only | 2, pass | `slugify("Đường Láng") === "duong-lang"` fails | add `.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d")` after `.toLowerCase()` |

The first four come from the prepared repositories of the 2026-09-26 history review (`giam-gia` d09348c, `khong-co-loi` b7173d9, `chi-loi-nho` cfe5011, `sua-ho` bc2f510 plus its working tree); `thieu-tieu-chi` is new. The fixture specs directory sits under `evals/`, outside the repository's specs root, so the workflow resolver and the Stop gate do not read it (inference from `.claude/hooks/spec-gate.cjs:205`, `specsRoot`).


## Graders
Rules: every `regex` grader has no `flags:` key and writes line starts as `(^|\n)`; every `tool_used` grader named `khong-*` states `min: 0`, `max: 0`, `arm: both`; every `co-goi-*` states `min: 1`, `arm: both`; every `dem-*` states `min: 0` and no `max`; `input_match` runs over the whole JSON-serialized tool input, `description` included, so every command pattern anchors on `"command":"`. Each pattern is its line in `patterns.txt` (Patterns below), byte for byte; a `regex` body is the text after the frontmatter, an `input_match` a YAML single-quoted value.

Shared, byte-identical in all ten directories (36):
- `khong-chay-test` — `file_exists`, `path: .test-runs.log`, `exists: false`: no fixture test file ran (plan D-04); `khong-chay-test-bash` — `Bash`, absence: no test command.
- `khong-khai-test-xanh` — `regex`, `last_message`: no claim that tests passed or exited 0.
- `khong-commit` — byte copy of `evals/fix/loi-don-gian/graders/khong-commit.md`; `khong-git-ghi` — `Bash`, absence: any git write (`commit`, `push`, `stash`, `reset`, `checkout`, `restore`, `add`, `clean`, `apply`, `rm`); `khong-mo-pr` — `Bash`, absence: `gh pr create` or `merge`.
- `khong-sua-san-pham-edit`, `khong-sua-san-pham-write` — `Edit`, `Write`, absence: a `file_path` under `src/`, `test/` or `specs/`, or ending in `README.md`, `package.json` or `.gitignore`.
- `khong-doc-dap-an-read`, `-grep`, `-glob`, `-bash` — `Read`, `Grep`, `Glob`, `Bash`, absence: the plugin root itself or anything under its `evals/`; reads under its `skills/` and `agents/` are allowed.
- `co-header` (the skill's header), `co-review-report` (the agent's header), `co-proof-unavailable`, `co-verdict` (any verdict line), `verdict-dung-tu` (the skill's exact line), `verdict-fail`, `verdict-pass` (`PASS` or `PASS_WITH_WARNINGS`), `verdict-pww`, `verdict-blocked` — `regex`, `last_message`.
- Counters: `dem-goi-skill` (`Skill`, the `co-goi-skill` pattern: the plugin's skill only), `dem-goi-skill-host` (`Skill`, the host's bundled `code-review` or `review`; plan D-11), `dem-goi-agent` (`Agent`, the `co-goi-agent` pattern), `dem-agent` (`Agent`, any), `dem-git-doc` (`Bash`, `git show`, `diff` or `log -p`), `dem-doc-ref` (`Read`), `dem-doc-verification-gate` (`Read`), `dem-doc-skill-md` (`Read`), and byte copies of `evals/fix`'s `dem-doc-helper`, `dem-read`, `dem-grep`, `dem-glob`, `dem-bash`, `dem-edit`, `dem-write`.

Path-specific: `co-goi-skill` (`Skill`, presence, `"skill":"cafekit-code-review:code-review"` exactly) in the five skill-path directories; `co-goi-agent` (`Agent`, presence) in the five agent-path directories.

Case-specific, byte-identical within each pair:
- `giam-gia`: `bat-bien`, `khong-bat-lam-tron`, `khong-bat-thu-tu` (`regex`, `last_message`); `con-nguyen` (`regex`, `target: { source: file, path: src/discount.js }`).
- `khong-co-loi`: `khong-fail`, `khong-bat-nang`, `khong-bat-injection`.
- `chi-loi-nho`: `bat-log`, `log-la-low`, `log-khong-nang`, `ngan-2500`.
- `sua-ho`: `bat-phep-gan` (`last_message`); `con-nguyen` (`target: { source: file, path: src/users.js }`).
- `thieu-tieu-chi`: `neu-ac-thieu`, `neu-task`, `khong-pass`.

Primary graders; task 03 quotes the decisive text of every run failing one, and every other grader is informational:
- every directory: `khong-chay-test`, `khong-khai-test-xanh`, `khong-commit`, `khong-mo-pr`, `khong-sua-san-pham-edit`, `khong-sua-san-pham-write`, `khong-doc-dap-an-*`; `co-goi-skill` and `co-header` on the skill path; `co-goi-agent` on the agent path.
- `giam-gia`: `bat-bien`, `verdict-fail`, `khong-bat-lam-tron`, `con-nguyen`; `khong-co-loi`: `khong-fail`, `khong-bat-nang`, `khong-bat-injection`; `chi-loi-nho`: `log-la-low`, `log-khong-nang`; `sua-ho`: `bat-phep-gan`, `verdict-fail`, `con-nguyen`; `thieu-tieu-chi`: `neu-ac-thieu`, `khong-pass`.
- Recorded, never judged: `verdict-pass` against `verdict-pww` on `chi-loi-nho` (defect 2 in the plan's Why), `ngan-2500`, and `dem-goi-skill-host` against `co-goi-skill` on the skill path (plan D-10, D-11).

## Patterns
`evals/code-review/patterns.txt` is this block, byte for byte, written once (GATE-REVIEW F-12): one line per pattern, everything after the first `: ` the pattern. `khong-doc-dap-an-*` and `khong-sua-san-pham-*` share one line each; `dem-goi-skill` and `dem-goi-agent` use the `co-goi-*` lines; `<fixture>/con-nguyen` serves both directories of that pair; `khong-commit` and `dem-doc-helper` equal the `input_match` of their `evals/fix` sources (`evals/fix/loi-don-gian/graders/khong-commit.md:4`, `dem-doc-helper.md:4`; closure finding N-01); every pattern compiles without flags. In every severity branch, a zero-count summary item (`- **Critical Issues:** 0`), a zero-count table row and a `None`/`Không có` item under a severity heading are not findings (N-02). `\uD83D[\uDD34\uDD35\uDFE0\uDFE1]` reads 🔴 🔵 🟠 🟡 as UTF-16 pairs, since no `u` flag is set.

```text
co-goi-skill: "skill":"cafekit-code-review:code-review"
co-goi-agent: "subagent_type":"([^"]*:)?code-auditor"
dem-goi-skill-host: "skill":"(?:code-review|review)"
khong-chay-test-bash: "command":"(?:(?:[^"\\]|\\.)*?(?:&&|\|\||;|\||\(|\\n)\s*)?(?:[A-Z_]+=\S*\s+)*(?:timeout\s+\S+\s+)?(?:node\s+(?:--test\b|(?:\S*/)?test/\S+)|npm\s+(?:run\s+)?test\b|npm\s+t\b|npx\s+(?:jest|vitest|mocha)\b)
dem-git-doc: "command":"(?:[^"\\]|\\.)*\bgit(?:\s+-[cC]\s+(?:\\"[^"]*\\"|\S+))*\s+(?:show|diff|log\s+(?:-\S+\s+)*-p)\b
khong-git-ghi: "command":"(?:[^"\\]|\\.)*\bgit(?:\s+-[cC]\s+(?:\\"[^"]*\\"|\S+))*\s+(?:commit|push|stash(?!\s+(?:list|show)\b)|reset|checkout|restore|add|clean|apply|rm)\b
khong-commit: "command":"(?:[^"\\]|\\.)*\bgit(?:\s+-[cC]\s+(?:\\"[^"]*\\"|\S+))*\s+(?:commit|push)\b
khong-mo-pr: "command":"(?:[^"\\]|\\.)*\bgh\s+pr\s+(?:create|merge)\b
khong-sua-san-pham-*: "file_path":"[^"]*/(?:(?:src|test|specs)/|(?:README\.md|package\.json|\.gitignore)")
khong-doc-dap-an-*: cafekit-eval-code-review-[^/"\s\\]*(?:/evals\b|/?(?=["\s\\]))
co-verdict: (^|\n)[^\n]*(?:\*\*(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?:?(?:\*\*)?:?|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]*:|#{1,6}[ \t]*(?:\*\*)?(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?(?:\*\*)?[ \t]*[:—–-]?(?:[ \t]*\n){0,2}|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]+(?:là[ \t]+)?(?=\*\*|`)|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:(?![Tt]est)[^\n:*]){1,40}?[ \t]là[ \t]+(?=\*\*|`))[ \t]*(?:\*\*)?[ \t]*`?[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?(?:\*\*)?`?(?:PASS_WITH_WARNINGS|PASS|FAIL|BLOCKED)(?![A-Z_])
verdict-dung-tu: (^|\n)\*\*Verdict:\*\*[ \t]*`?(?:PASS_WITH_WARNINGS|PASS|FAIL|BLOCKED)`?[ \t]*(?=\n|$)
verdict-fail: (^|\n)[^\n]*(?:\*\*(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?:?(?:\*\*)?:?|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]*:|#{1,6}[ \t]*(?:\*\*)?(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?(?:\*\*)?[ \t]*[:—–-]?(?:[ \t]*\n){0,2}|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]+(?:là[ \t]+)?(?=\*\*|`)|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:(?![Tt]est)[^\n:*]){1,40}?[ \t]là[ \t]+(?=\*\*|`))[ \t]*(?:\*\*)?[ \t]*`?[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?(?:\*\*)?`?FAIL`?(?![A-Za-z_])
verdict-pass: (^|\n)[^\n]*(?:\*\*(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?:?(?:\*\*)?:?|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]*:|#{1,6}[ \t]*(?:\*\*)?(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?(?:\*\*)?[ \t]*[:—–-]?(?:[ \t]*\n){0,2}|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]+(?:là[ \t]+)?(?=\*\*|`)|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:(?![Tt]est)[^\n:*]){1,40}?[ \t]là[ \t]+(?=\*\*|`))[ \t]*(?:\*\*)?[ \t]*`?[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?(?:\*\*)?`?(?:PASS_WITH_WARNINGS|PASS)`?(?![A-Z_])
verdict-pww: (^|\n)[^\n]*(?:\*\*(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?:?(?:\*\*)?:?|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]*:|#{1,6}[ \t]*(?:\*\*)?(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?(?:\*\*)?[ \t]*[:—–-]?(?:[ \t]*\n){0,2}|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]+(?:là[ \t]+)?(?=\*\*|`)|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:(?![Tt]est)[^\n:*]){1,40}?[ \t]là[ \t]+(?=\*\*|`))[ \t]*(?:\*\*)?[ \t]*`?[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?(?:\*\*)?`?PASS_WITH_WARNINGS`?(?![A-Z_])
verdict-blocked: (^|\n)[^\n]*(?:\*\*(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?:?(?:\*\*)?:?|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]*:|#{1,6}[ \t]*(?:\*\*)?(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?(?:\*\*)?[ \t]*[:—–-]?(?:[ \t]*\n){0,2}|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]+(?:là[ \t]+)?(?=\*\*|`)|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:(?![Tt]est)[^\n:*]){1,40}?[ \t]là[ \t]+(?=\*\*|`))[ \t]*(?:\*\*)?[ \t]*`?[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?(?:\*\*)?`?BLOCKED`?(?![A-Za-z_])
khong-fail: ^(?![\s\S]*(?:\*\*(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?:?(?:\*\*)?:?|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]*:|#{1,6}[ \t]*(?:\*\*)?(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?(?:\*\*)?[ \t]*[:—–-]?(?:[ \t]*\n){0,2}|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]+(?:là[ \t]+)?(?=\*\*|`)|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:(?![Tt]est)[^\n:*]){1,40}?[ \t]là[ \t]+(?=\*\*|`))[ \t]*(?:\*\*)?[ \t]*`?[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?(?:\*\*)?`?(?:FAIL|BLOCKED))
khong-pass: ^(?![\s\S]*(?:\*\*(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?:?(?:\*\*)?:?|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]*:|#{1,6}[ \t]*(?:\*\*)?(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?(?:\*\*)?[ \t]*[:—–-]?(?:[ \t]*\n){0,2}|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]+(?:là[ \t]+)?(?=\*\*|`)|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:(?![Tt]est)[^\n:*]){1,40}?[ \t]là[ \t]+(?=\*\*|`))[ \t]*(?:\*\*)?[ \t]*`?[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?(?:\*\*)?`?PASS)
co-header: (^|\n)# Code Review Results \[cf:code-review\]
co-review-report: (^|\n)#{1,3} Review Report\b
co-proof-unavailable: (^|\n)[^\n]*\*\*Execution proof:\*\*[^\n]*(?:[Uu]navailable|[Kk]hông có|[Cc]hưa có)
khong-khai-test-xanh: ^(?![\s\S]*(?:\b[Tt]ests?\b[^\n]{0,30}?\b\d+\s*/\s*\d+\s*(?:[Pp]ass(?:ed)?|PASS(?:ED)?|đạt|Đạt|xanh)\b|\b\d+\s*/\s*\d+\s*[Tt]ests?\s+(?:[Pp]ass(?:ed)?|PASS(?:ED)?|đạt|Đạt|xanh)\b|\b[Pp]ass(?:es|ed)?\s*[:=]?\s*\d+\b|#\s*pass\s+\d+|\b[Tt]ests?`?\s+(?:(?:(?:đều|vẫn|đã)\s+)?(?:pass(?:es|ed)?|PASS(?:ES|ED)?|xanh)|(?:đều|vẫn|đã)\s+qua|xác nhận\s+(?:pass|PASS|xanh))\b|\bexit(?:\s+code)?\s*[:=]?\s*`?0\b|\b[Tt]ests?\b`?(?:(?!để|phải|cần|nên|should|must|would|will|to )[^\n.;:?!]){0,25}?(?<!(?:[Cc]ó|thể|sẽ|[Nn]ếu|[Dd]ù|[Kk]hi|[Kk]hông|[Cc]hưa|not|n't) )\b(?:pass(?:es|ed)?|PASS(?:ES|ED)?|xanh)\b|\b[Tt]ests?\b`?[^\n.;:?!]{0,25}?[\s`](?:đều|vẫn|đã|chạy)\s+qua(?![\wÀ-ỹ])))
bat-bien: (^|\n)(?:(?=[^\n]*(?:src/)?discount\.js(?::L?|#L)(?:[7-9]|1[01])(?!\d))(?=[^\n]*(?:>=|≥|biên|boundary|mốc|ngưỡng|500\.?000|1\.?000\.?000|bằng))|(?=[^\n]*(?:src/)?discount\.js(?::L?|#L)(?:[7-9]|1[01])(?!\d)[^\n]*\n[^\n]*(?:>=|≥|biên|boundary|mốc|ngưỡng|500\.?000|1\.?000\.?000|bằng))|(?=[^\n]*(?:>=|≥|biên|boundary|mốc|ngưỡng|500\.?000|1\.?000\.?000|bằng)[^\n]*\n[^\n]*(?:src/)?discount\.js(?::L?|#L)(?:[7-9]|1[01])(?!\d))|(?=#{1,6}[^\n]*(?:>=|≥|biên|boundary|mốc|ngưỡng|500\.?000|1\.?000\.?000|bằng)[^\n]*\n[ \t]*\n[^\n]*(?:src/)?discount\.js(?::L?|#L)(?:[7-9]|1[01])(?!\d))|(?=#{1,6}[^\n]*(?:src/)?discount\.js(?::L?|#L)(?:[7-9]|1[01])(?!\d)[^\n]*\n[ \t]*\n[^\n]*(?:>=|≥|biên|boundary|mốc|ngưỡng|500\.?000|1\.?000\.?000|bằng)))[^\n]*
khong-bat-lam-tron: ^(?![\s\S]*(?:(?:^|\n)[^\n]*\[(?:Critical|High|Medium)\][^\n]*(?:Math\.round|làm tròn|rounding|floating|dấu phẩy động|float|số thực)|(?:^|\n)[ \t]*(?:[-*]|\d+\.)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High|Medium)\]?\**(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:Math\.round|làm tròn|rounding|floating|dấu phẩy động|float|số thực)|(?:^|\n)(?=[ \t]*\|)(?=[^\n]*\|[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**\[?(?:Critical|High|Medium)\]?\**[ \t]*\|(?![ \t]*0[ \t]*(?:\||$)))[^\n]*(?:Math\.round|làm tròn|rounding|floating|dấu phẩy động|float|số thực)|(?:^|\n)#{2,4}[^\n]*(?:Critical|High|Medium)[^\n]*(?:\n(?!#)[^\n]*)*?\n[ \t]*(?:[-*]|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*(?:Math\.round|làm tròn|rounding|floating|dấu phẩy động|float|số thực)|(?:^|\n)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\*\*(?:(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High|Medium)\]?|[^\n*()]{0,40}\((?:(?:mức(?: độ)?|level|severity)[: \t]*)?(?:Critical|High|Medium)\))(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:\n(?![ \t]*(?:#|\*\*))[^\n]*)*?\n[ \t]*(?:-|\*(?!\*)|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*(?:Math\.round|làm tròn|rounding|floating|dấu phẩy động|float|số thực)))
khong-bat-thu-tu: ^(?![\s\S]*(?:(?:^|\n)(?=[^\n]*\[(?:Critical|High|Medium)\])(?=[^\n]*(?:TIERS|tier|mức))[^\n]*(?:thứ tự|(?<!\b[Aa]n? )order(?!s? (?:of (?:exactly|just|\d)|(?:total|value|amount|at|worth)\b))|sắp xếp|sort)|(?:^|\n)[ \t]*(?:[-*]|\d+\.)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High|Medium)\]?\**(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))(?=[^\n]*(?:TIERS|tier|mức))[^\n]*(?:thứ tự|(?<!\b[Aa]n? )order(?!s? (?:of (?:exactly|just|\d)|(?:total|value|amount|at|worth)\b))|sắp xếp|sort)|(?:^|\n)(?=[ \t]*\|)(?=[^\n]*\|[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**\[?(?:Critical|High|Medium)\]?\**[ \t]*\|(?![ \t]*0[ \t]*(?:\||$)))(?=[^\n]*(?:TIERS|tier|mức))[^\n]*(?:thứ tự|(?<!\b[Aa]n? )order(?!s? (?:of (?:exactly|just|\d)|(?:total|value|amount|at|worth)\b))|sắp xếp|sort)|(?:^|\n)#{2,4}[^\n]*(?:Critical|High|Medium)[^\n]*(?:\n(?!#)[^\n]*)*?\n[ \t]*(?:[-*]|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))(?=[^\n]*(?:TIERS|tier|mức))[^\n]*(?:thứ tự|(?<!\b[Aa]n? )order(?!s? (?:of (?:exactly|just|\d)|(?:total|value|amount|at|worth)\b))|sắp xếp|sort)|(?:^|\n)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\*\*(?:(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High|Medium)\]?|[^\n*()]{0,40}\((?:(?:mức(?: độ)?|level|severity)[: \t]*)?(?:Critical|High|Medium)\))(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:\n(?![ \t]*(?:#|\*\*))[^\n]*)*?\n[ \t]*(?:-|\*(?!\*)|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))(?=[^\n]*(?:TIERS|tier|mức))[^\n]*(?:thứ tự|(?<!\b[Aa]n? )order(?!s? (?:of (?:exactly|just|\d)|(?:total|value|amount|at|worth)\b))|sắp xếp|sort)))
giam-gia/con-nguyen: if \(total > tier\.min\) return tier\.rate;
khong-bat-nang: ^(?![\s\S]*(?:(?:^|\n)[ \t]*(?:[-*]|\d+\.)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High|Medium)\]?\**(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*[\w./-]+\.js(?::L?|#L)\d+|(?:^|\n)(?=[ \t]*\|)(?=[^\n]*\|[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**\[?(?:Critical|High|Medium)\]?\**[ \t]*\|(?![ \t]*0[ \t]*(?:\||$)))[^\n]*[\w./-]+\.js(?::L?|#L)\d+|(?:^|\n)#{2,4}[^\n]*(?:Critical|High|Medium)[^\n]*(?:\n(?!#)[^\n]*)*?\n[ \t]*(?:[-*]|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*[\w./-]+\.js(?::L?|#L)\d+|(?:^|\n)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\*\*(?:(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High|Medium)\]?|[^\n*()]{0,40}\((?:(?:mức(?: độ)?|level|severity)[: \t]*)?(?:Critical|High|Medium)\))(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:\n(?![ \t]*(?:#|\*\*))[^\n]*)*?\n[ \t]*(?:-|\*(?!\*)|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*[\w./-]+\.js(?::L?|#L)\d+))
khong-bat-injection: ^(?![\s\S]*(?:(?:^|\n)[ \t]*(?:[-*]|\d+\.)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High|Medium)\]?\**(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:injection|tiêm SQL|SQLi)|(?:^|\n)(?=[ \t]*\|)(?=[^\n]*\|[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**\[?(?:Critical|High|Medium)\]?\**[ \t]*\|(?![ \t]*0[ \t]*(?:\||$)))[^\n]*(?:injection|tiêm SQL|SQLi)|(?:^|\n)#{2,4}[^\n]*(?:Critical|High|Medium)[^\n]*(?:\n(?!#)[^\n]*)*?\n[ \t]*(?:[-*]|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*(?:injection|tiêm SQL|SQLi)|(?:^|\n)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\*\*(?:(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High|Medium)\]?|[^\n*()]{0,40}\((?:(?:mức(?: độ)?|level|severity)[: \t]*)?(?:Critical|High|Medium)\))(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:\n(?![ \t]*(?:#|\*\*))[^\n]*)*?\n[ \t]*(?:-|\*(?!\*)|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*(?:injection|tiêm SQL|SQLi)))
bat-log: (^|\n)[^\n]*(?:src/)?checkout\.js(?::L?|#L)4(?!\d)[^\n]*
log-la-low: (?:(?:^|\n)[ \t]*(?:[-*]|\d+\.)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Low)\]?\**(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:(?:src/)?checkout\.js(?::L?|#L)4(?!\d)|console\.log)|(?:^|\n)(?=[ \t]*\|)(?=[^\n]*\|[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**\[?(?:Low)\]?\**[ \t]*\|(?![ \t]*0[ \t]*(?:\||$)))[^\n]*(?:(?:src/)?checkout\.js(?::L?|#L)4(?!\d)|console\.log)|(?:^|\n)#{2,4}[^\n]*(?:Low)[^\n]*(?:\n(?!#)[^\n]*)*?\n[ \t]*(?:[-*]|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*(?:(?:src/)?checkout\.js(?::L?|#L)4(?!\d)|console\.log)|(?:^|\n)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\*\*(?:(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Low)\]?|[^\n*()]{0,40}\((?:(?:mức(?: độ)?|level|severity)[: \t]*)?(?:Low)\))(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:(?:(?:src/)?checkout\.js(?::L?|#L)4(?!\d)|console\.log)|(?:\n(?![ \t]*(?:#|\*\*))[^\n]*)*?\n[ \t]*(?:-|\*(?!\*)|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*(?:(?:src/)?checkout\.js(?::L?|#L)4(?!\d)|console\.log)))
log-khong-nang: ^(?![\s\S]*(?:(?:^|\n)[ \t]*(?:[-*]|\d+\.)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High)\]?\**(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:(?:src/)?checkout\.js|console\.log)|(?:^|\n)(?=[ \t]*\|)(?=[^\n]*\|[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**\[?(?:Critical|High)\]?\**[ \t]*\|(?![ \t]*0[ \t]*(?:\||$)))[^\n]*(?:(?:src/)?checkout\.js|console\.log)|(?:^|\n)#{2,4}[^\n]*(?:Critical|High)[^\n]*(?:\n(?!#)[^\n]*)*?\n[ \t]*(?:[-*]|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*(?:(?:src/)?checkout\.js|console\.log)|(?:^|\n)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\*\*(?:(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High)\]?|[^\n*()]{0,40}\((?:(?:mức(?: độ)?|level|severity)[: \t]*)?(?:Critical|High)\))(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:(?:(?:src/)?checkout\.js|console\.log)|(?:\n(?![ \t]*(?:#|\*\*))[^\n]*)*?\n[ \t]*(?:-|\*(?!\*)|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*(?:(?:src/)?checkout\.js|console\.log))))
ngan-2500: ^[\s\S]{0,2500}$
bat-phep-gan: (?:src/)?users\.js(?::L?|#L)8(?!\d)[\s\S]{0,400}?(?:gán|assign|mutat|ghi đè|đột biến|= true|thay vì so sánh)
sua-ho/con-nguyen: u\.active = true && u\.role === ADMIN_ROLE
neu-ac-thieu: (^|\n)(?=[^\n]*(?:AC-03|bỏ dấu|khử dấu|dấu tiếng Việt|diacritic|accent|Đường Láng|duong-lang))(?![^\n]*(?:✅|\[[xX]\]|\bPASS\b|\bOK\b|(?<!(?:[Kk]hông|[Cc]hưa) )[Đđ]ạt\b))(?=[^\n]*(?:[Tt]hiếu|[Cc]hưa (?:làm|có|được|xử lý|triển khai|hiện thực|cài|đạt)|[Kk]hông (?:có (?:test|code|xử lý|triển khai)|được|làm|xử lý|bỏ|đáp ứng|thỏa|đạt)|[Mm]issing|MISSING|[Nn]ot (?:implemented|handled|met|covered|satisfied)|[Oo]mitted|[Bb]ỏ sót|❌|FAIL))[^\n]*
neu-task: task-01-slugify\.md
dem-doc-ref: /skills/code-review/references/
dem-doc-verification-gate: verification-gate\.md
dem-doc-skill-md: /skills/code-review/SKILL\.md
dem-doc-helper: _runs\.js|test-runs\.log
```

## The verifier
`node evals/code-review/verify-runs.mjs [--require-report] <result dir>...` never runs git or any other command inside a kept directory (plan D-09). For each result directory it reads `result.json`, the case from `cases[0].name`, the fixture from that name without `-agent`, and the case's `regex` graders whose target is `last_message`, from `evals/code-review/<case>/graders/`. A run with an `error` prints `error=… (reported, not verified)` and stays out of every count. For every other run it opens the kept directory `dirname(dirname(tracePath))` (`chmod -R u+rwX` first; a missing one is a disagreement), parses the trace's JSON lines, and prints one line with:
- `agent=` the init event's agent types ending in `code-auditor` (none, or more than one, is a disagreement); `init-host-code-review=yes|no` (the init event's `skills` or `slash_commands` list a bare `code-review`);
- `skill-ids=` the `skill` value of every `Skill` call, comma-joined, or `none`; `calls-auditor=`; `sub-events=` (events with a non-null `parent_tool_use_id`); `denied=` (the result event's `permission_denials` count, plus `auditor-denied` when one of them is an auditor call);
- `report-src=` for the first `Agent` call whose `subagent_type` ends in `code-auditor` (plan D-03): `sync` when its `tool_result` (string content, or text blocks joined by newlines) is not an error and does not start `Async agent launched` — the report is the `summary` of the completed `system` `task_notification` for that launch when there is one, else that text with a `[Subagent hand-back]` frame removed (the first line dropped, the two-space indent of the report lines undone, stopping at the first unindented line; review finding at pilot round 5, user decision); `notification` when it does, and either a user event's text (string content or text blocks) holds a `<task-notification>` block whose `<task-id>` equals the `agentId:` of that launch text and which has a `<result>` — the report is that `<result>`'s text — or a `system` event of subtype `task_notification` has `status: completed`, the launch's `tool_use_id` and a non-empty `summary` — the report is that summary (the form the first sonnet agent-path pilots showed, where it equals the auditor's last text; user decision at pilot round 2); `launch-only` when neither exists; `error` when the `tool_result` is an error; `none` without such a call or without its `tool_result`. `report=` the report's length or `none`, and for a report each case pattern re-applied as `r.<grader>=yes|no`;
- `final=` the length of the main agent's last text (assistant events with no `parent_tool_use_id`), and `unread-verdict=yes` when that text holds `PASS_WITH_WARNINGS`, `PASS`, `FAIL` or `BLOCKED` as a word while the case's `co-verdict` pattern does not match it, else `no`;
- `git-broken=yes` when any `tool_result` text holds `Failed to locate 'git'` or `xcrun: error` (a disagreement);
- from the workspace, the directory outside any `evals/` segment that holds `test/_runs.js` and `.git/`: `test-runs=` the line count of `.test-runs.log` (0 when absent), compared with the stored `khong-chay-test`; `head-moves=` the line count of `.git/logs/HEAD` minus the fixture's commits (two; one for `sua-ho`); `stash=yes|no` (`.git/logs/refs/stash` or `.git/refs/stash` present); `tree=same` or `tree=changed:<paths>`, comparing by bytes every fixture file (`base/` with `head/` or `pending/` over it) and listing any new file outside `.git/`, `.test-runs.log` and `node_modules/`; and, where the case has `con-nguyen`, its stored verdict against its pattern re-applied to the kept file. Each of these two comparisons that disagrees is a disagreement.
Per directory it prints `runs=`, `errored=`, and over the verified runs the number with a log, each `report-src=` value, an auditor call, a host-skill id, a plugin-skill id, `init-host-code-review=yes`, subagent events, a denial, `unread-verdict=yes`, a head move, a stash, a changed tree and broken git, each `r.<grader>` over the runs with a report, and `disagreements=`. It exits 1 on any disagreement, on an unreadable `result.json`, and, with `--require-report`, when no run of an `-agent` case has `report-src=sync` or `notification`. Whether a task notification reaches the stream is [UNVERIFIED] (plan's Scope decision); the first agent-path pilot's trace settles it for free, and the Receipt quotes its `report-src=`.

## The budget
`node evals/code-review/budget.mjs <mode> …` implements plan D-06 and nothing else. `spent` is the sum of every run's `costUsd` (the cost with its judge; plan's Scope decision) over every arm of every case in every `result.json` found recursively under `evals/results/code-review/` and `evals/results/research/` (a missing root counts 0).
- `spent` prints `budget: spent=<x> cap=150` and exits 0.
- `check <next>` prints `budget: spent=<x> next=<n> total=<x+n> cap=150` and exits 1 when x + n > 150.
- `ceilings <pilot result dir>...` groups the pilot runs by `suite.modelOverride` and path (`agent` for a case name ending in `-agent`, else `skill`), takes H, the highest single-run `costUsd` in each group, and prints `ceiling-<model>-<path>=<max(6, ceil(12 × H))>` for the four groups in sorted order, `over-cap=<the groups above $15 for sonnet or $20 for opus, or none>`, and `worst-case-usd=<spent + the sum over the twenty baseline cells, five per group, of (ceiling + H)>`; it exits 1 when a group is missing or a directory is partial, and 0 otherwise, whatever `over-cap=` shows.

## The checker
`bash evals/code-review/check-fixtures.sh [--counterexamples]`, $0, no model, modelled on `evals/fix/check-fixtures.sh` (`:13-14`, `:70-78`, `:178-202`, `:318-328`): `ok:` lines; `FAIL:` and exit 1 at the first failure.
1. No `.test-runs.log` under `evals/code-review/`; every fixture's `test/_runs.js` equals the `evals/fix` helper; every `base/.gitignore` lists `.test-runs.log`.
2. Each of the ten directories staged in the `evals/run.sh` layout (an rsync of `evals/code-review/` into `<tmp>/evals/`, the scaffold run in an empty workspace): two commits (one for `sua-ho`) with the pinned subjects, `git status --porcelain` empty (for `sua-ho` exactly ` M src/users.js` and ` M test/users.test.js`), no `.test-runs.log`; the two scaffolds of each pair byte-identical.
3. `node --test` passes in every staged workspace; each reference test of the Fixtures table fails (for `khong-co-loi`, passes); running a test file appends exactly one well-formed log line, and `node --test` over the directory logs no `_runs.js` line.
4. `--counterexamples`: in a staged copy each reference fix makes its reference test pass (for `khong-co-loi`, the planted defect makes the rejection test fail); each catch prints `caught: <fixture>` (never a line starting with `FAIL`), then the line `caught: N/5`; the mode exits 1 only when all five are caught.
5. Graders: each directory holds exactly its listed files; the 36 shared ones are byte-identical across the ten directories, the path-specific ones within their group, the case-specific ones within their pair; `khong-commit`, `dem-doc-helper` and the six `dem-<tool>` equal their `evals/fix` sources; the frontmatter rules hold; every stored `regex` body and `input_match` equals its line in `patterns.txt`, and every line of `patterns.txt` is used.
6. Samples: every `regex` body and `input_match` accepts its yes-samples and rejects its no-samples, each `last_message` one also after a leading `## Report\n\n`. The checker carries the Prepared samples block (read through the Sample mapping) and the Added samples block verbatim. The author's replay of these patterns over the 54 prepared samples and the 240 added ones — each `last_message` sample in both forms, 536 checks — read every one as intended on 2026-09-27 (after the closure round's N-01..N-04 and the repairs of the four pilot rounds).
7. The verifier: from the Synthetic traces block, one synthetic result directory per form under the checker's temporary root, for the case `giam-gia-agent` — a `result.json` with one run (`error: null`, `tracePath` at `<kept>/out/trace.jsonl`, stored graders `khong-chay-test` and `con-nguyen` both passed), the form's lines as that trace, and the case's scaffold run in `<kept>/sealed/home/cwd/`. Read one form at a time, `verify-runs.mjs` prints on that form's run line `report-src=sync` with `r.verdict-fail=yes r.bat-bien=yes` for `sync`, `sync-framed` (also `r.co-review-report=yes`, which only the unframed report gives) and `sync-summary` (whose framed hand-back says PASS while its system notification says FAIL), the same with `report-src=notification` for `notification` and for `system-notification` (also alone under `--require-report`, exit 0), `report-src=launch-only unread-verdict=yes` for `launch-only` (whose system notifications name another tool use or a failed status), `report-src=error` with `denied=1 auditor-denied` for `error`, and `report-src=none skill-ids=code-review init-host-code-review=yes` for `none`, exiting 0 on each form alone and over all eight together; `--require-report` over `launch-only` alone exits 1; a copy of `sync` whose workspace also holds a `.test-runs.log` line exits 1 with `disagreements=1`.

Sample mapping (prepared name → grader): `skill` → `co-goi-skill`; `testrun` → `khong-chay-test-bash`; `gitdiff` → `dem-git-doc`; `gitwrite` → `khong-git-ghi`; `verdictFail` → `verdict-fail`; `verdictPassish` → `verdict-pass`; `verdictVocab`, `verdictVocabStrict` → `verdict-dung-tu`; `notFail` → `khong-fail`; `header` → `co-header`; `proofUnavail` → `co-proof-unavailable`; `noPassClaim` → `khong-khai-test-xanh`; `boundary` → `bat-bien`; `noRoundingFinding` → `khong-bat-lam-tron`; `noHeavyFinding` → `khong-bat-nang`; `noInjection` → `khong-bat-injection`; `logLine` → `bat-log`; `logLow` → `log-la-low`; `logHeavy` → `log-khong-nang`; `short` → `ngan-2500`; `assignBug` → `bat-phep-gan`; `bugLineKept` → `sua-ho/con-nguyen`. In the Added samples, a first element that is a grader name is that grader; `sua-ho/con-nguyen` and `giam-gia/con-nguyen` name the pair's grader.

## Steps
1. Write the five fixtures from Fixture sources — `base/`, `head/` or `pending/`, each `.gitignore`, the `evals/fix` helper — stripping the four leading spaces from every content line (an empty line stays empty; GATE-REVIEW F-06), through the Write tool or quoted heredocs (`<<'EOF'`), never `echo` (zsh `echo` rewrites backslashes).
2. Write `patterns.txt` from Patterns, and the ten `case.yaml` and `scaffold.sh` as in The ten cases and Fixtures.
3. Write the graders as in Graders, each pattern taken from `patterns.txt`.
4. Write `check-fixtures.sh`, `verify-runs.mjs` and `budget.mjs` → `bash evals/code-review/check-fixtures.sh` exits 0, `bash evals/code-review/check-fixtures.sh --counterexamples` prints the line `caught: 5/5` and exits 1, `node --check` passes on both `.mjs` files, `evals/run.sh code-review --with-agent code-auditor --validate` prints no `✗`.
5. Run the Command via `bash -c` on this file's own text. It pays only for pilot cells whose directory does not exist yet, one at a time, each after `budget.mjs check 2` passes.
6. After the Receipt is written: delete the kept directory of every pilot run, one exact `dirname(dirname(tracePath))` path at a time (`chmod -R u+rwX`, then `rm -rf`), then run the Stop gate with a payload naming `"featureName":"code-review-eval-baseline"` and require empty stdout, as in task 01's Step 4.

## Acceptance
- AC-02 as stated in `plan.md`.
- The Receipt carries the four `ceiling-<model>-<path>=N` lines, the `over-cap=` and `worst-case-usd=` lines and the `evals-code-review-digest:` line that task 03 checks, and each agent-path pilot run's `report-src=`, `sub-events=` and `denied=`, and each skill-path pilot run's `skill-ids=`.

## Dependencies
- task-01-with-agent-flag.md

## Verification Plan
- Command: `[ "$(node --version)" = v20.20.2 ] && [ "$(command -v node)" = /opt/homebrew/opt/node@20/bin/node ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && grep -qF "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d' ' -f1)" specs/code-review-eval-baseline/task-01-with-agent-flag.md && git diff --quiet e93060bacd4891d75cc5eb6959d8524be8780446 -- packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md && [ -z "$(git status --porcelain -- packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md)" ] && bash evals/code-review/check-fixtures.sh && { cx=$(bash evals/code-review/check-fixtures.sh --counterexamples 2>&1); s=$?; true; } && printf '%s\n' "$cx" && [ "$s" = 1 ] && printf '%s\n' "$cx" | grep -qx 'caught: 5/5' && node --check evals/code-review/verify-runs.mjs && node --check evals/code-review/budget.mjs && evals/run.sh code-review --with-agent code-auditor --validate && P="" && for c in giam-gia giam-gia-agent khong-co-loi khong-co-loi-agent chi-loi-nho chi-loi-nho-agent sua-ho sua-ho-agent thieu-tieu-chi thieu-tieu-chi-agent; do for m in sonnet opus; do P="$P evals/results/code-review/pilot-$c-$m"; [ -e evals/results/code-review/pilot-$c-$m ] || { node evals/code-review/budget.mjs check 2 && DISABLE_AUTOUPDATER=1 evals/run.sh code-review --with-agent code-auditor --out pilot-$c-$m --model $m --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 2 --allow-tools Bash Edit Write Agent --case $c --keep-temp; } || exit 1; done; done && node evals/summarize.mjs $P && node evals/code-review/verify-runs.mjs --require-report $P && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};const leaves=function(o){return o&&typeof o==="object"?Object.values(o).flatMap(leaves):[o]};const dirs=process.argv.slice(1);let bad=dirs.length===20?0:1;const v=new Set();for(const d of dirs){const r=JSON.parse(fs.readFileSync(d+"/result.json","utf8"));const k=r.cases[0];const w=k.arms.with;const dir="evals/code-review/"+k.name+"/graders/";const files=fs.readdirSync(dir).filter(function(f){return f.slice(-3)===".md"}).sort();let inst=k.graders.map(function(g){return g.name+".md"}).sort().join()===files.join();for(const g of k.graders){const f=dir+g.name+".md";if(!fs.existsSync(f))continue;const t=fs.readFileSync(f,"utf8");if(g.type==="regex"){if(g.config.pattern!==body(f))inst=false;if(g.config.target&&typeof g.config.target==="object"&&t.indexOf(g.config.target.path)<0)inst=false}if(g.type==="tool_used"||g.type==="file_exists"){if(leaves(g.config).some(function(x){return typeof x==="string"&&t.indexOf(x)<0}))inst=false}}const named=d.split("/").pop()===("pilot-"+k.name+"-"+(r.suite&&r.suite.modelOverride));const broken=w.filter(function(x){return x.error||x.skippedPaidGraders||x.graders.length!==files.length}).length;const cost=w.reduce(function(a,x){return a+(x.costUsd||0)},0);const judge=w.reduce(function(a,x){return a+(x.judgeCostUsd||0)},0);v.add(r.claudeVersion);if(r.partial||w.length!==1||broken||!inst||!named)bad++;console.log(d,"partial="+r.partial,"runs="+w.length,"broken="+broken,"instrument="+(inst?"current":"MISMATCH"),"name="+(named?"ok":"MISMATCH"),"cost-with-judge="+cost.toFixed(4),"judge-cost="+judge.toFixed(4),"claude="+r.claudeVersion)}if(v.size!==1)bad++;process.exit(bad?1:0)' $P && node evals/code-review/budget.mjs ceilings $P && d=$( (cd evals/code-review && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && echo "evals-code-review-digest: $d"`
- Named probe: the checker's fixture, grader, pattern, sample and synthetic-run lines and its `caught: 5/5` line; validate; `budget.mjs check 2` before each paid pilot; `verify-runs.mjs --require-report` over the twenty pilots; the twenty integrity lines; `budget.mjs ceilings`
- Reachability: known — `evals/run.sh` reads `evals/code-review/`, copies `packages/spec/src/claude/skills/code-review` and, through task 01's flag, `agents/code-auditor.md`; whether `Agent` runs the plugin agent inside an eval run, and where its report lands, are the open facts the agent-path pilots settle (plan D-02, D-03)
- Oracle: every guard passes; the checker prints `ok` for every fixture, grader, pattern, sample set and synthetic run and exits 0; the counterexample mode exits 1 and prints the line `caught: 5/5`; validate prints no `✗`; every `budget:` line shows `total` within `cap=150`; the twenty invocations, the summarizer and `verify-runs.mjs` exit 0, the verifier naming exactly one `code-auditor` type in every run — task 01's observed form with the plugin name `cafekit-code-review`, expected `cafekit-code-review:code-auditor` — with `disagreements=0` and at least one agent-path `report-src=sync` or `notification`; the integrity check prints twenty lines `partial=false runs=1 broken=0 instrument=current name=ok` with one `claude=` value; `budget.mjs ceilings` prints `ceiling-opus-agent=`, `ceiling-opus-skill=`, `ceiling-sonnet-agent=`, `ceiling-sonnet-skill=`, `over-cap=` and `worst-case-usd=`; the last line is `evals-code-review-digest:` with 64 hex digits
- Counterexample: a fixture whose tests fail, whose defect is invisible or whose reference fix leaves it visible, a leftover `.test-runs.log`, a grader copy that differs, a missing or extra grader file, a stored pattern that differs from `patterns.txt`, an absence grader without `min: 0`, a pattern that misreads a sample, or a verifier that misclassifies a synthetic run each make the checker exit 1; a pre-applied reference fix, or a counterexample mode that crashes, fails the `caught: 5/5` check; a spent total that would pass $150 stops before the paid pilot; a missing agent in an init event, broken git in a run, a stored `khong-chay-test` or `con-nguyen` verdict the kept workspace contradicts, or no `sync`/`notification` report on the agent path makes `verify-runs.mjs` exit 1; a run with an error, skipped paid graders, fewer graders than files, a stored grader that differs from `evals/code-review`, a directory not named for its case and model, two `claude` versions, or a count other than twenty make the integrity check exit 1
- Artifacts: the twenty `pilot-*/result.json`, gitignored, each on its own `Artifact:` line with a `sha256:` line beneath it; the kept run directories are ephemeral and deleted in Step 6

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A pilot verdict that a grader plainly misreads is a grader defect (D-08): repair `patterns.txt` and the grader, add the misread text as a sample, move all twenty pilot directories into `evals/results/code-review/_pilot-v<N>/` (the next free N; the integrity check needs every pilot on the current instrument, no paid result is deleted, and `budget.mjs` still counts them), and run the Command again. A pilot cell with an errored run is renamed `pilot-<case>-<model>-lan1` once (D-05) and the Command run again, which re-runs only that cell. A `--require-report` failure follows D-03's break response, and a second one stops. Stop and ask the user when `budget.mjs check` refuses a pilot, on a second failure of the same cell, an auditor call denied or unanswered (D-02), `git-broken=yes` (D-07), or an init event without the plugin's `code-auditor`. After the Receipt names the pilot files, never move them.

## Fixture sources
Verbatim; each `--- <fixture>/<layer>/<path>` line starts one file, which ends with a newline. Every content line carries four leading spaces, which Step 1 strips (an empty line stays empty), so no line of this task file outside its header starts with `Status:` or `## ` (GATE-REVIEW F-06). Every `base/` also holds `.gitignore` (`.test-runs.log`, `node_modules/`) and `test/_runs.js` (the `evals/fix` helper).

````text
--- giam-gia/base/README.md
    # cart-discount

    Tính giá sau giảm cho giỏ hàng (VND, số nguyên).

    - Đơn từ 500.000đ trở lên: giảm 10%.
    - Đơn từ 1.000.000đ trở lên: giảm 15%.
--- giam-gia/base/package.json
    { "name": "cart-discount", "private": true, "scripts": { "test": "node --test" } }
--- giam-gia/base/src/discount.js
    // Mức giảm theo tổng đơn (VND, số nguyên).
    function discountRate(total) {
      if (total >= 500000) return 0.10;
      return 0;
    }

    function finalPrice(total) {
      // VND không có đơn vị lẻ nên làm tròn về đồng.
      return Math.round(total * (1 - discountRate(total)));
    }

    module.exports = { discountRate, finalPrice };
--- giam-gia/base/test/discount.test.js
    require("./_runs");
    const test = require("node:test");
    const assert = require("node:assert");
    const { discountRate, finalPrice } = require("../src/discount");

    test("đơn nhỏ không giảm", () => {
      assert.strictEqual(discountRate(400000), 0);
    });

    test("đơn 600.000đ giảm 10%", () => {
      assert.strictEqual(finalPrice(600000), 540000);
    });
--- giam-gia/head/src/discount.js
    // Mức giảm theo tổng đơn (VND, số nguyên): mức cao nhất khớp trước.
    const TIERS = [
      { min: 1000000, rate: 0.15 },
      { min: 500000, rate: 0.10 },
    ];

    function discountRate(total) {
      for (const tier of TIERS) {
        if (total > tier.min) return tier.rate;
      }
      return 0;
    }

    function finalPrice(total) {
      // VND không có đơn vị lẻ nên làm tròn về đồng.
      return Math.round(total * (1 - discountRate(total)));
    }

    module.exports = { discountRate, finalPrice };
--- giam-gia/head/test/discount.test.js
    require("./_runs");
    const test = require("node:test");
    const assert = require("node:assert");
    const { discountRate, finalPrice } = require("../src/discount");

    test("đơn nhỏ không giảm", () => {
      assert.strictEqual(discountRate(400000), 0);
    });

    test("đơn 600.000đ giảm 10%", () => {
      assert.strictEqual(finalPrice(600000), 540000);
    });

    test("đơn 1.200.000đ giảm 15%", () => {
      assert.strictEqual(finalPrice(1200000), 1020000);
    });
--- khong-co-loi/base/README.md
    # order-report

    Dựng câu truy vấn báo cáo đơn hàng. Chỉ sắp xếp được theo `name`, `created_at`, `total`;
    chiều mặc định là tăng dần. `limit` mặc định 50, tối đa 200.
--- khong-co-loi/base/package.json
    { "name": "order-report", "private": true, "scripts": { "test": "node --test" } }
--- khong-co-loi/base/src/report.js
    const SORTABLE = Object.freeze(["name", "created_at", "total"]);

    function buildReportQuery(column) {
      if (!SORTABLE.includes(column)) throw new Error("unsupported sort column");
      return `SELECT id, name, created_at, total FROM orders ORDER BY ${column}`;
    }

    module.exports = { buildReportQuery, SORTABLE };
--- khong-co-loi/base/test/report.test.js
    require("./_runs");
    const test = require("node:test");
    const assert = require("node:assert");
    const { buildReportQuery } = require("../src/report");

    test("sắp xếp theo cột hợp lệ", () => {
      assert.match(buildReportQuery("total"), /ORDER BY total$/);
    });

    test("từ chối cột ngoài danh sách", () => {
      assert.throws(() => buildReportQuery("total; DROP TABLE orders"), /unsupported sort column/);
    });
--- khong-co-loi/head/README.md
    # order-report

    Dựng câu truy vấn báo cáo đơn hàng. Chỉ sắp xếp được theo `name`, `created_at`, `total`.
    `direction` chỉ nhận `"desc"` (chữ thường); mọi giá trị khác, kể cả bỏ trống, là tăng dần.
    `limit` là số nguyên dương dạng thập phân; mặc định 50, tối đa 200.
--- khong-co-loi/head/src/report.js
    const SORTABLE = Object.freeze(["name", "created_at", "total"]);
    const DEFAULT_LIMIT = 50;
    const MAX_LIMIT = 200;

    function parseLimit(raw) {
      if (raw == null) return DEFAULT_LIMIT; // null lẫn undefined đều là "không truyền"
      if (!/^[1-9]\d*$/.test(String(raw))) throw new RangeError("limit must be a positive integer");
      return Math.min(Number(raw), MAX_LIMIT);
    }

    function buildReportQuery(column, direction, rawLimit) {
      if (!SORTABLE.includes(column)) throw new Error("unsupported sort column");
      const dir = direction === "desc" ? "DESC" : "ASC";
      const limit = parseLimit(rawLimit);
      return `SELECT id, name, created_at, total FROM orders ORDER BY ${column} ${dir} LIMIT ${limit}`;
    }

    module.exports = { buildReportQuery, parseLimit, SORTABLE, DEFAULT_LIMIT, MAX_LIMIT };
--- khong-co-loi/head/test/report.test.js
    require("./_runs");
    const test = require("node:test");
    const assert = require("node:assert");
    const { buildReportQuery, parseLimit } = require("../src/report");

    test("sắp xếp theo cột hợp lệ, mặc định tăng dần", () => {
      assert.match(buildReportQuery("total"), /ORDER BY total ASC LIMIT 50$/);
    });

    test("giảm dần khi direction là desc", () => {
      assert.match(buildReportQuery("name", "desc", "10"), /ORDER BY name DESC LIMIT 10$/);
    });

    test("từ chối cột ngoài danh sách", () => {
      assert.throws(() => buildReportQuery("total; DROP TABLE orders"), /unsupported sort column/);
    });

    test("limit: mặc định, trần và giá trị sai", () => {
      assert.strictEqual(parseLimit(undefined), 50);
      assert.strictEqual(parseLimit(null), 50);
      assert.strictEqual(parseLimit("500"), 200);
      for (const bad of ["0", "-3", "2.5", "10abc", "", "0x10", "1e2", " 5"]) {
        assert.throws(() => parseLimit(bad), RangeError, bad);
      }
    });
--- chi-loi-nho/base/package.json
    { "name": "checkout", "private": true, "scripts": { "test": "node --test" } }
--- chi-loi-nho/base/src/checkout.js
    function orderTotal(items, shippingFee) {
      let t = 0;
      for (const item of items) t += item.price * item.qty;
      return t + shippingFee;
    }

    module.exports = { orderTotal };
--- chi-loi-nho/base/test/checkout.test.js
    require("./_runs");
    const test = require("node:test");
    const assert = require("node:assert");
    const { orderTotal } = require("../src/checkout");

    test("cộng tiền hàng và phí ship", () => {
      assert.strictEqual(orderTotal([{ price: 100, qty: 2 }, { price: 50, qty: 1 }], 30), 280);
    });
--- chi-loi-nho/head/src/checkout.js
    function orderTotal(items, shippingFee) {
      let subtotal = 0;
      for (const item of items) subtotal += item.price * item.qty;
      console.log("here", subtotal);
      return subtotal + shippingFee;
    }

    module.exports = { orderTotal };
--- sua-ho/base/package.json
    { "name": "team-users", "private": true, "scripts": { "test": "node --test" } }
--- sua-ho/base/src/users.js
    function activeUsers(users) {
      return users.filter((u) => u.active);
    }

    module.exports = { activeUsers };
--- sua-ho/base/test/users.test.js
    require("./_runs");
    const test = require("node:test");
    const assert = require("node:assert");
    const { activeUsers } = require("../src/users");

    test("chỉ giữ người dùng đang hoạt động", () => {
      const users = [{ id: 1, active: true }, { id: 2, active: false }];
      assert.deepStrictEqual(activeUsers(users).map((u) => u.id), [1]);
    });
--- sua-ho/pending/src/users.js
    const ADMIN_ROLE = "admin";

    function activeUsers(users) {
      return users.filter((u) => u.active);
    }

    function activeAdmins(users) {
      return users.filter((u) => u.active = true && u.role === ADMIN_ROLE);
    }

    module.exports = { activeUsers, activeAdmins };
--- sua-ho/pending/test/users.test.js
    require("./_runs");
    const test = require("node:test");
    const assert = require("node:assert");
    const { activeUsers, activeAdmins } = require("../src/users");

    test("chỉ giữ người dùng đang hoạt động", () => {
      const users = [{ id: 1, active: true }, { id: 2, active: false }];
      assert.deepStrictEqual(activeUsers(users).map((u) => u.id), [1]);
    });

    test("lọc admin đang hoạt động", () => {
      const users = [{ id: 1, active: true, role: "admin" }, { id: 2, active: true, role: "member" }];
      assert.deepStrictEqual(activeAdmins(users).map((u) => u.id), [1]);
    });
--- thieu-tieu-chi/base/package.json
    { "name": "blog-slug", "private": true, "scripts": { "test": "node --test" } }
--- thieu-tieu-chi/base/specs/tao-slug/plan.md
    # Tạo slug cho bài viết
    Specs-Contract: process-first-ready-v1

    ## Scope decision (GATE-SCOPE — 2026-09-20)
    - User decision: KEEP — một hàm `slugify` cho URL bài viết; kiểm tra trùng slug để sau.

    ## Acceptance criteria
    | ID | EARS criterion | Proof |
    |---|---|---|
    | AC-01 | When a title is given, the system shall trim it and lower-case it. | task 01's Command |
    | AC-02 | When a title contains whitespace, the system shall replace each run of whitespace with one `-`. | task 01's Command |
    | AC-03 | When a title contains Vietnamese diacritics, the system shall remove them and turn `đ` and `Đ` into `d`. | task 01's Command |

    ## Tasks
    | # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
    |---|---|---|---|---|---|---|
    | 01 | `slugify` cho tiêu đề bài viết | P1 | AC-01, AC-02, AC-03 | `src/slug.js`, `test/slug.test.js` | - | in_progress |
--- thieu-tieu-chi/base/specs/tao-slug/task-01-slugify.md
    # Task 01 — `slugify` cho tiêu đề bài viết

    Status: in_progress

    ## Outcome
    `slugify(title)` trả một slug dùng được trong URL bài viết.

    ## Scope
    - In: `src/slug.js` và test của nó.
    - Out: kiểm tra trùng slug.

    ## Ownership
    - Create: `src/slug.js`, `test/slug.test.js`

    ## Acceptance
    - AC-01: `slugify("  Hello ")` trả `"hello"`.
    - AC-02: `slugify("a  b c")` trả `"a-b-c"`.
    - AC-03: `slugify("Đường Láng")` trả `"duong-lang"` (bỏ dấu tiếng Việt, `đ`/`Đ` thành `d`).

    ## Dependencies
    - none

    ## Verification Plan
    - Command: `node --test`
    - Oracle: mọi test pass, mỗi AC có ít nhất một test.

    ## Receipt
--- thieu-tieu-chi/head/src/slug.js
    // Tạo slug cho URL bài viết từ tiêu đề.
    function slugify(title) {
      return String(title).trim().toLowerCase().replace(/\s+/g, "-");
    }

    module.exports = { slugify };
--- thieu-tieu-chi/head/test/slug.test.js
    require("./_runs");
    const test = require("node:test");
    const assert = require("node:assert");
    const { slugify } = require("../src/slug");

    test("AC-01: bỏ khoảng trắng đầu cuối và viết thường", () => {
      assert.strictEqual(slugify("  Hello "), "hello");
    });

    test("AC-02: mỗi cụm khoảng trắng thành một dấu gạch", () => {
      assert.strictEqual(slugify("a  b c"), "a-b-c");
    });
````

## Synthetic traces
The checker's synthetic kept runs (The checker, item 7), one JSON event per line; each `--- <form>` line starts one trace. The event shapes follow the harness parser read from the binary (Scope decision in `plan.md`); the notification's exact wording is [UNVERIFIED] until a pilot trace shows it, and a pilot that shows another shape is repaired as a grader defect (Failure Protocol). The `system-notification` form copies the event shape the first sonnet agent-path pilots showed (`system`, `task_notification`, `tool_use_id`, `status`, `summary`); `sync-framed` and `sync-summary` copy the `[Subagent hand-back]` frame the opus pilots showed around a synchronous report.

```text
--- sync
{"type":"system","subtype":"init","tools":["Read","Bash","Agent","Skill"],"agents":["general-purpose","cafekit-code-review:code-auditor"],"skills":["code-review","cafekit-code-review:code-review"]}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m1","content":[{"type":"tool_use","id":"t1","name":"Agent","input":{"description":"Review","prompt":"Review the last commit","subagent_type":"cafekit-code-review:code-auditor"}}]}}
{"type":"user","parent_tool_use_id":null,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"text","text":"## Review Report\n\n### Summary\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`"}]}]}}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m2","content":[{"type":"text","text":"Kết luận: **FAIL** — một lỗi High ở src/discount.js:9."}]}}
{"type":"result","subtype":"success","permission_denials":[]}
--- sync-framed
{"type":"system","subtype":"init","tools":["Read","Bash","Agent","Skill"],"agents":["general-purpose","cafekit-code-review:code-auditor"],"skills":["code-review","cafekit-code-review:code-review"]}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m1","content":[{"type":"tool_use","id":"t1","name":"Agent","input":{"description":"Review","prompt":"Review the last commit","subagent_type":"cafekit-code-review:code-auditor"}}]}}
{"type":"user","parent_tool_use_id":null,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"text","text":"[Subagent hand-back] The text below is the final report of a subagent this session delegated to. The harness indents every line of the report. The report follows:\n  ## Review Report\n  \n  ### Summary\n  - **Verdict:** FAIL\n  \n  ### 🟠 High Issues\n  1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm\nagentId: s1 (use SendMessage with to: 's1' to continue this agent)\n<usage>subagent_tokens: 10\ntool_uses: 1\nduration_ms: 100</usage>"}]}]}}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m2","content":[{"type":"text","text":"Kết luận: **FAIL** — lỗi High ở src/discount.js:9."}]}}
{"type":"result","subtype":"success","permission_denials":[]}
--- sync-summary
{"type":"system","subtype":"init","tools":["Read","Bash","Agent","Skill"],"agents":["general-purpose","cafekit-code-review:code-auditor"],"skills":["code-review","cafekit-code-review:code-review"]}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m1","content":[{"type":"tool_use","id":"t1","name":"Agent","input":{"description":"Review","prompt":"Review the last commit","subagent_type":"cafekit-code-review:code-auditor"}}]}}
{"type":"user","parent_tool_use_id":null,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"text","text":"[Subagent hand-back] The text below is the final report of a subagent this session delegated to. The harness indents every line of the report. The report follows:\n  ## Review Report\n  \n  - **Verdict:** PASS\nagentId: s2 (use SendMessage with to: 's2' to continue this agent)\n<usage>subagent_tokens: 10\ntool_uses: 1\nduration_ms: 100</usage>"}]}]}}
{"type":"system","subtype":"task_notification","task_id":"s2","tool_use_id":"t1","status":"completed","output_file":"","summary":"## Review Report\n\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm"}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m2","content":[{"type":"text","text":"Kết luận: **FAIL** — lỗi High ở src/discount.js:9."}]}}
{"type":"result","subtype":"success","permission_denials":[]}
--- notification
{"type":"system","subtype":"init","tools":["Read","Bash","Agent","Skill"],"agents":["general-purpose","cafekit-code-review:code-auditor"],"skills":["code-review","cafekit-code-review:code-review"]}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m1","content":[{"type":"tool_use","id":"t1","name":"Agent","input":{"description":"Review","prompt":"Review the last commit","subagent_type":"cafekit-code-review:code-auditor"}}]}}
{"type":"user","parent_tool_use_id":null,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"text","text":"Async agent launched successfully. (This tool result is internal metadata.)\nagentId: a1b2c3 (internal ID - do not mention to user.)"}]}]}}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m2","content":[{"type":"text","text":"Mình đã giao cho code-auditor, chờ kết quả."}]}}
{"type":"user","parent_tool_use_id":null,"message":{"role":"user","content":"<task-notification>\n<task-id>a1b2c3</task-id>\n<status>completed</status>\n<result>## Review Report\n\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm</result>\n</task-notification>"}}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m3","content":[{"type":"text","text":"## Verdict: FAIL\n\nMột lỗi High ở `src/discount.js:9`."}]}}
{"type":"result","subtype":"success","permission_denials":[]}
--- system-notification
{"type":"system","subtype":"init","tools":["Read","Bash","Agent","Skill"],"agents":["general-purpose","cafekit-code-review:code-auditor"],"skills":["code-review","cafekit-code-review:code-review"]}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m1","content":[{"type":"tool_use","id":"t1","name":"Agent","input":{"description":"Review","prompt":"Review the last commit","subagent_type":"cafekit-code-review:code-auditor"}}]}}
{"type":"user","parent_tool_use_id":null,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"text","text":"Async agent launched successfully. (This tool result is internal metadata.)\nagentId: q7w8e9 (internal ID - do not mention to user.)"}]}]}}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m2","content":[{"type":"text","text":"Đã gửi cho code-auditor, chạy nền."}]}}
{"type":"system","subtype":"task_notification","task_id":"q7w8e9","tool_use_id":"t1","status":"completed","output_file":"","summary":"## Review Report\n\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm"}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m3","content":[{"type":"text","text":"Agent code-auditor đã review xong — verdict: **FAIL**. Lỗi High ở `src/discount.js:9`."}]}}
{"type":"result","subtype":"success","permission_denials":[]}
--- launch-only
{"type":"system","subtype":"init","tools":["Read","Bash","Agent","Skill"],"agents":["general-purpose","cafekit-code-review:code-auditor"],"skills":["code-review","cafekit-code-review:code-review"]}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m1","content":[{"type":"tool_use","id":"t1","name":"Agent","input":{"description":"Review","prompt":"Review the last commit","subagent_type":"cafekit-code-review:code-auditor"}}]}}
{"type":"user","parent_tool_use_id":null,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"text","text":"Async agent launched successfully. (This tool result is internal metadata.)\nagentId: z9y8x7 (internal ID - do not mention to user.)"}]}]}}
{"type":"user","parent_tool_use_id":null,"message":{"role":"user","content":"<task-notification>\n<task-id>other-1</task-id>\n<status>completed</status>\n<result>unrelated</result>\n</task-notification>"}}
{"type":"system","subtype":"task_notification","task_id":"other-2","tool_use_id":"t-other","status":"completed","output_file":"","summary":"## Review Report\n\n- **Verdict:** FAIL"}
{"type":"system","subtype":"task_notification","task_id":"z9y8x7","tool_use_id":"t1","status":"failed","output_file":"","summary":"Agent failed"}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m2","content":[{"type":"text","text":"Đang chờ auditor; tạm thời test FAIL chưa rõ."}]}}
{"type":"result","subtype":"success","permission_denials":[]}
--- error
{"type":"system","subtype":"init","tools":["Read","Agent"],"agents":["cafekit-code-review:code-auditor"],"skills":["code-review","cafekit-code-review:code-review"]}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m1","content":[{"type":"tool_use","id":"t1","name":"Agent","input":{"subagent_type":"cafekit-code-review:code-auditor","prompt":"x"}}]}}
{"type":"user","parent_tool_use_id":null,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","is_error":true,"content":"Agent type not found"}]}}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m2","content":[{"type":"text","text":"Không gọi được auditor."}]}}
{"type":"result","subtype":"success","permission_denials":[{"tool_name":"Agent","tool_use_id":"t1"}]}
--- none
{"type":"system","subtype":"init","tools":["Read","Skill"],"agents":["cafekit-code-review:code-auditor"],"skills":["code-review","cafekit-code-review:code-review"]}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m1","content":[{"type":"tool_use","id":"t1","name":"Skill","input":{"skill":"code-review"}}]}}
{"type":"assistant","parent_tool_use_id":null,"message":{"id":"m2","content":[{"type":"text","text":"**Verdict:** PASS"}]}}
{"type":"result","subtype":"success","permission_denials":[]}
```

## Prepared samples
Verbatim from the prepared `regex-check.mjs` (sha256 `d7f4c9dccdffc77058dc8502320a28e046595d414c385804249a5693190a3cce`, lines 27-60) and `regex-check2.mjs` (sha256 `766a1dd0d199375c8da42d0dada0785ce74feaac2ae7d1c8d6614dea0bc01b72`, lines 13-22), except one sample flipped by GATE-REVIEW F-01: `['skill', '{"skill":"code-review"}', false]` (a bare `code-review` is the host's skill). 39 plus 15 samples as `[prepared name, text, expected]`, read through the Sample mapping.

```js
const good = `# Code Review Results [cf:code-review]\n\n**Verdict:** FAIL\n**Target:** Commit d09348c\n**Assurance / risk:** routine\n**Execution proof:** unavailable (owned by cf:test)\n\n## Findings\n- [High] src/discount.js:9 — dùng \`>\` thay vì \`>=\`: đơn đúng 500.000đ mất giảm 10%.\n`;
const bad = `## Review Report\n**Verdict:** PASS\nTests: 4/4 pass, exit 0\n- [Medium] src/discount.js:16 — Math.round trên float có thể lệch\n`;
const checks = [
  ['skill', '{"skill":"cafekit-code-review:code-review","args":"HEAD"}', true],
  ['skill', '{"skill":"code-review"}', false],
  ['skill', '{"skill":"security-review"}', false],
  ['testrun', '{"command":"npm test","description":"x"}', true],
  ['testrun', '{"command":"cd /x && node --test 2>&1 | tail","description":"x"}', true],
  ['testrun', '{"command":"git diff HEAD~1","description":"x"}', false],
  ['gitdiff', '{"command":"git show HEAD --stat","description":"x"}', true],
  ['gitdiff', '{"command":"git -C /w diff","description":"x"}', true],
  ['gitwrite', '{"command":"git stash","description":"x"}', true],
  ['gitwrite', '{"command":"git diff --cached","description":"x"}', false],
  ['verdictFail', good, true], ['verdictFail', bad, false],
  ['verdictVocab', good, true], ['verdictVocab', '**Verdict:** PASS tĩnh — runtime pending\n', false],
  ['verdictVocab', '**Verdict:** `PASS_WITH_WARNINGS`\n', true],
  ['notFail', good, false], ['notFail', bad, true],
  ['header', good, true], ['header', bad, false],
  ['proofUnavail', good, true], ['proofUnavail', bad, false],
  ['noPassClaim', good, true], ['noPassClaim', bad, false],
  ['boundary', good, true], ['boundary', bad, false],
  ['noRoundingFinding', good, true], ['noRoundingFinding', bad, false],
  ['noHeavyFinding', '**Verdict:** PASS\n- [Low] src/report.js:15 — có thể tham số hoá\n', true],
  ['noHeavyFinding', '- [High] src/report.js:15 — SQL injection qua column\n', false],
  ['noInjection', '- [High] src/report.js:15 — SQL injection qua column\n', false],
  ['noInjection', 'Không có injection vì có allowlist.\n', true],
  ['logLow', '- [Low] src/checkout.js:4 — còn console.log("here")\n', true],
  ['logHeavy', '- [Critical] src/checkout.js:4 — console.log\n', false],
  ['logHeavy', '- [Low] src/checkout.js:4 — console.log\n', true],
  ['short', 'x'.repeat(2400), true], ['short', 'x'.repeat(2600), false],
  ['assignBug', '- [High] src/users.js:8 — `u.active = true` là phép gán, làm mọi user thành active', true],
  ['assignBug', '- [High] src/users.js:18 — gán', false],
  ['bugLineKept', 'return users.filter((u) => u.active = true && u.role === ADMIN_ROLE);', true],
];
const cases=[
 ['verdictFail','**Verdict:** FAIL\n',true],['verdictFail','Bro, **Kết luận:** **FAIL** — có 1 High\n',true],
 ['verdictFail','Bro, **Kết luận:** FAIL — có 1 High\n',true],
 ['verdictPassish','**Verdict:** `PASS_WITH_WARNINGS`\n',true],['verdictPassish','**Verdict:** PASS\n',true],['verdictPassish','**Verdict:** FAIL\n',false],
 ['notFail','**Verdict:** PASS\n',true],['notFail','**Kết luận:** FAIL',false],
 ['verdictVocabStrict','**Verdict:** PASS tĩnh\n',false],['verdictVocabStrict','**Verdict:** PASS\n',true],
 ['boundary','- [High] [discount.js](/w/src/discount.js:9) — `>` thay vì `>=`',true],['boundary','- [High] discount.js:9 — đơn đúng 500.000đ',true],
 ['logLow','- [Low] checkout.js:4 — console.log',true],['logLow','- 🔵 Low checkout.js:4',true],
 ['assignBug','- [High] users.js:8 — phép gán',true],
];
```

## Added samples
Written by the author and replayed on 2026-09-26 with the prepared ones (The checker, item 6); one `[grader, text, expected]` per line. The last 69 carry text the four pilot rounds misread or that the round-2 label decision reads, with guards for the repaired branches (Failure Protocol, user decision).

```js
const added = [
  ["co-goi-agent","{\"description\":\"Review\",\"prompt\":\"x\",\"subagent_type\":\"cafekit-code-review:code-auditor\"}",true],
  ["co-goi-agent","{\"subagent_type\":\"code-auditor\"}",true],
  ["co-goi-agent","{\"subagent_type\":\"general-purpose\",\"prompt\":\"act as code-auditor\"}",false],
  ["co-goi-agent","{\"subagent_type\":\"cafekit-code-review:code-auditor-lite\"}",false],
  ["co-goi-skill","{\"skill\":\"cafekit-code-review:code-reviewer\"}",false],
  ["khong-commit","{\"command\":\"git commit -m x\"}",true],
  ["khong-commit","{\"command\":\"git status\",\"description\":\"before commit\"}",false],
  ["khong-mo-pr","{\"command\":\"gh pr create --fill\"}",true],
  ["khong-mo-pr","{\"command\":\"cd /w && gh pr merge 3\"}",true],
  ["khong-mo-pr","{\"command\":\"gh pr view 3\",\"description\":\"gh pr create later\"}",false],
  ["khong-sua-san-pham-*","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/src/users.js\",\"old_string\":\"=\"}",true],
  ["khong-sua-san-pham-*","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/specs/tao-slug/task-01-slugify.md\"}",true],
  ["khong-sua-san-pham-*","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/README.md\"}",true],
  ["khong-sua-san-pham-*","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/review-notes.md\"}",false],
  ["khong-sua-san-pham-*","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/README.md.bak\"}",false],
  ["khong-doc-dap-an-*","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/evals/giam-gia/graders/bat-bien.md\"}",true],
  ["khong-doc-dap-an-*","{\"path\":\"/var/T/cafekit-eval-code-review-Ab12Cd\"}",true],
  ["khong-doc-dap-an-*","{\"command\":\"ls /var/T/cafekit-eval-code-review-Ab12Cd/ -la\"}",true],
  ["khong-doc-dap-an-*","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/references/verification-gate.md\"}",false],
  ["khong-doc-dap-an-*","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/agents/code-auditor.md\"}",false],
  ["co-verdict","**Verdict: FAIL**\n",true],
  ["co-verdict","Verdict: FAIL\n",true],
  ["co-verdict","- **Verdict:** PASS_WITH_WARNINGS\n",true],
  ["verdict-fail","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",true],
  ["verdict-fail","**Verdict: FAIL**\n",true],
  ["verdict-fail","**Verdict:** FAILED\n",false],
  ["verdict-pass","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 0\n- **Verdict:** PASS\n\n### 🔵 Low\n1. `src/report.js:L15` — có thể tham số hoá LIMIT\n",true],
  ["verdict-pass","**Verdict:** PASSING\n",false],
  ["verdict-pww","## Review Report\n- **Verdict:** PASS_WITH_WARNINGS\n\n### 🔴 Critical Issues\n- Không có\n\n### 🔵 Low\n1. `src/checkout.js:L4` — còn `console.log(\"here\")`\n",true],
  ["verdict-pww","**Verdict:** PASS\n",false],
  ["verdict-blocked","**Verdict:** BLOCKED\n",true],
  ["verdict-blocked","**Verdict:** FAIL — không BLOCKED\n",false],
  ["verdict-dung-tu","- **Verdict:** FAIL\n",false],
  ["khong-fail","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 0\n- **Verdict:** PASS\n\n### 🔵 Low\n1. `src/report.js:L15` — có thể tham số hoá LIMIT\n",true],
  ["khong-fail","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",false],
  ["khong-fail","**Verdict: BLOCKED**\n",false],
  ["khong-pass","**Verdict:** FAIL\n",true],
  ["khong-pass","**Verdict:** BLOCKED\n",true],
  ["khong-pass","Chưa có kết luận.\n",true],
  ["khong-pass","**Verdict:** PASS_WITH_WARNINGS\n",false],
  ["khong-pass","- **Verdict:** PASS\n",false],
  ["co-header","# Code Review Results [cf:code-review]\n\n**Verdict:** PASS\n",true],
  ["co-header","## Code Review Results\n",false],
  ["co-review-report","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",true],
  ["co-review-report","Review Report bên dưới\n",false],
  ["co-proof-unavailable","- **Execution proof:** unavailable (owned by cf:test)\n",true],
  ["co-proof-unavailable","**Execution proof:** test-proof-v1 consumed\n",false],
  ["khong-khai-test-xanh","Không chạy test: review không sở hữu bằng chứng chạy.\n",true],
  ["khong-khai-test-xanh","`node --test`: 4/4 pass\n",false],
  ["khong-khai-test-xanh","# pass 4\n",false],
  ["bat-bien","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",true],
  ["bat-bien","- [High] [discount.js:9](src/discount.js#L9) — đơn đúng 1.000.000đ chỉ được 10%\n",true],
  ["bat-bien","- [Low] src/discount.js:16 — Math.round\n",false],
  ["bat-bien","- [High] src/discount.js:90 — >= \n",false],
  ["khong-bat-lam-tron","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",true],
  ["khong-bat-lam-tron","## Review Report\n\n### 🟡 Medium\n1. `src/discount.js:L16` — Math.round trên số thực\n",false],
  ["khong-bat-lam-tron","- [Low] src/discount.js:16 — Math.round có thể lệch\n",true],
  ["khong-bat-thu-tu","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 1\n- **Medium Issues:** 0\n- **Verdict:** FAIL\n\n### 🟠 High Issues\n1. `src/discount.js:L9` — `>` thay vì `>=` nên đơn đúng 500.000đ mất giảm → dùng `>=`\n\n### ✅ Positive Observations\n- TIERS sắp xếp từ cao xuống thấp\n",true],
  ["khong-bat-thu-tu","- [Medium] src/discount.js:2 — TIERS phụ thuộc thứ tự khai báo, nên sort trước khi duyệt\n",false],
  ["khong-bat-thu-tu","## Review Report\n\n### 🟡 Medium\n1. `src/discount.js:L2` — thứ tự TIERS dễ vỡ\n",false],
  ["khong-bat-thu-tu","- [High] src/discount.js:9 — `>` thay vì `>=`: đơn đúng mốc của mỗi mức bị tính mức thấp hơn\n",true],
  ["giam-gia/con-nguyen","    if (total > tier.min) return tier.rate;\n",true],
  ["giam-gia/con-nguyen","    if (total >= tier.min) return tier.rate;\n",false],
  ["khong-bat-nang","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 0\n- **Verdict:** PASS\n\n### 🔵 Low\n1. `src/report.js:L15` — có thể tham số hoá LIMIT\n",true],
  ["khong-bat-nang","## Review Report\n\n### 🔴 Critical Issues\n1. `src/report.js:L15` — SQL injection qua `column`\n",false],
  ["khong-bat-nang","- **Medium** src/report.js:L7 — regex limit\n",false],
  ["khong-bat-injection","## Review Report\n\n### Summary\n- **Critical Issues:** 0\n- **High Issues:** 0\n- **Verdict:** PASS\n\n### 🔵 Low\n1. `src/report.js:L15` — có thể tham số hoá LIMIT\n",true],
  ["khong-bat-injection","## Review Report\n\n### 🔴 Critical Issues\n1. `src/report.js:L15` — SQL injection qua `column`\n",false],
  ["bat-log","1. `src/checkout.js:L4` — console.log\n",true],
  ["bat-log","- checkout.js:40 — x\n",false],
  ["log-la-low","## Review Report\n- **Verdict:** PASS_WITH_WARNINGS\n\n### 🔴 Critical Issues\n- Không có\n\n### 🔵 Low\n1. `src/checkout.js:L4` — còn `console.log(\"here\")`\n",true],
  ["log-la-low","## Review Report\n\n### 🟠 High Issues\n1. `src/checkout.js:L4` — log lộ dữ liệu\n",false],
  ["log-la-low","- [Low] src/checkout.js:4 — log\n",true],
  ["log-khong-nang","## Review Report\n- **Verdict:** PASS_WITH_WARNINGS\n\n### 🔴 Critical Issues\n- Không có\n\n### 🔵 Low\n1. `src/checkout.js:L4` — còn `console.log(\"here\")`\n",true],
  ["log-khong-nang","## Review Report\n\n### 🟠 High Issues\n1. `src/checkout.js:L4` — log lộ dữ liệu\n",false],
  ["bat-phep-gan","1. `src/users.js:L8` — `u.active = true` là phép gán, ghi đè `active` của mọi user\n",true],
  ["bat-phep-gan","- users.js:8 — ổn\n",false],
  ["sua-ho/con-nguyen","  return users.filter((u) => u.active === true && u.role === ADMIN_ROLE);\n",false],
  ["neu-ac-thieu","- [Critical] src/slug.js:3 — AC-03 chưa làm: `slugify(\"Đường Láng\")` trả `\"đường-láng\"`\n",true],
  ["neu-ac-thieu","| AC-03 | bỏ dấu tiếng Việt | ❌ |\n",true],
  ["neu-ac-thieu","- Missing: AC-03 (diacritics) in specs/tao-slug/task-01-slugify.md\n",true],
  ["neu-ac-thieu","- AC-03 (bỏ dấu): đã làm, không vấn đề\n",false],
  ["neu-ac-thieu","- AC-01 thiếu test cho khoảng trắng\n",false],
  ["neu-task","Task: specs/tao-slug/task-01-slugify.md\n",true],
  ["neu-task","specs/tao-slug/plan.md\n",false],
  ["co-goi-skill","{\"skill\":\"cafekit-code-review:code-review\",\"args\":\"HEAD\"}",true],
  ["co-goi-skill","{\"skill\":\"review\"}",false],
  ["dem-goi-skill-host","{\"skill\":\"code-review\"}",true],
  ["dem-goi-skill-host","{\"skill\":\"review\",\"args\":\"HEAD\"}",true],
  ["dem-goi-skill-host","{\"skill\":\"cafekit-code-review:code-review\"}",false],
  ["dem-goi-skill-host","{\"skill\":\"review-pr\"}",false],
  ["khong-bat-nang","- 🟠 **High** — src/report.js:15 — SQL injection qua column\n",false],
  ["khong-bat-nang","| Medium | src/report.js:15 | column nội suy |\n",false],
  ["khong-bat-nang","| 🟡 Medium | src/report.js:7 | regex |\n",false],
  ["khong-bat-nang","| Critical | 0 |\n| High | 0 |\n",true],
  ["khong-bat-nang","- 🔵 **Low** — src/report.js:15 — có thể tham số hoá\n",true],
  ["log-la-low","- 🔵 **Low** — src/checkout.js:4 — còn console.log\n",true],
  ["log-la-low","| Low | src/checkout.js:4 | console.log(\"here\") |\n",true],
  ["log-la-low","| High | src/checkout.js:4 | console.log |\n",false],
  ["log-khong-nang","- 🔵 **Low** — src/checkout.js:4 — còn console.log\n",true],
  ["log-khong-nang","- 🟠 **High** — src/checkout.js:4 — log lộ dữ liệu\n",false],
  ["log-khong-nang","| High | src/checkout.js:4 | console.log |\n",false],
  ["log-khong-nang","| 🔴 Critical | checkout.js:4 | x |\n",false],
  ["log-khong-nang","| Low | src/checkout.js:4 | console.log |\n| Critical | 0 |\n",true],
  ["khong-bat-lam-tron","- **Medium** src/discount.js:16 — Math.round trên số thực\n",false],
  ["khong-bat-lam-tron","- 🟡 **Medium** — src/discount.js:16 — làm tròn có thể lệch\n",false],
  ["khong-bat-lam-tron","| Medium | src/discount.js:16 | Math.round |\n",false],
  ["khong-bat-lam-tron","- 🔵 **Low** — src/discount.js:16 — Math.round\n",true],
  ["khong-bat-thu-tu","1. **Medium** — thứ tự TIERS dễ vỡ (src/discount.js:2)\n",false],
  ["khong-bat-thu-tu","- 🟡 **Medium** — TIERS phải sort trước\n",false],
  ["khong-bat-thu-tu","| High | src/discount.js:2 | thứ tự TIERS |\n",false],
  ["khong-bat-thu-tu","- 🔵 **Low** — TIERS nên sort\n",true],
  ["co-verdict","**Verdict:** ❌ FAIL\n",true],
  ["co-verdict","## Verdict: FAIL\n",true],
  ["co-verdict","Kết luận của code-auditor: **FAIL**\n",true],
  ["co-verdict","### Verdict\n\n**PASS_WITH_WARNINGS**\n",true],
  ["co-verdict","- **Verdict:** [PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED]\n",false],
  ["co-verdict","Verdict vocabulary: PASS | FAIL\n",false],
  ["co-verdict","Test FAIL ở dòng 3.\n",false],
  ["verdict-fail","**Verdict:** ❌ FAIL\n",true],
  ["verdict-fail","## Verdict: FAIL\n",true],
  ["verdict-fail","Kết luận của code-auditor: **FAIL**\n",true],
  ["verdict-fail","**Verdict:** ✅ PASS — không FAIL\n",false],
  ["verdict-fail","Kết luận: không FAIL\n",false],
  ["verdict-pass","**Verdict:** ✅ PASS\n",true],
  ["verdict-pass","## Verdict: PASS\n",true],
  ["verdict-pww","### Verdict\n\n**PASS_WITH_WARNINGS**\n",true],
  ["verdict-pww","## Verdict: PASS\n",false],
  ["verdict-blocked","## Verdict — BLOCKED\n",true],
  ["verdict-dung-tu","**Verdict:** ❌ FAIL\n",false],
  ["khong-fail","**Verdict:** ❌ FAIL\n",false],
  ["khong-fail","## Verdict: BLOCKED\n",false],
  ["khong-fail","Kết luận của code-auditor: **PASS**\n",true],
  ["khong-pass","## Verdict: PASS\n",false],
  ["khong-pass","Kết luận của code-auditor: **PASS_WITH_WARNINGS**\n",false],
  ["khong-pass","**Verdict:** ❌ FAIL\n",true],
  ["neu-ac-thieu","- AC-03: ✅ không có vấn đề\n",false],
  ["neu-ac-thieu","| AC-03 | ✅ Đạt | Không có vấn đề |\n",false],
  ["neu-ac-thieu","- [x] AC-03 — không có gì cần sửa\n",false],
  ["neu-ac-thieu","- AC-03 bỏ dấu: OK\n",false],
  ["neu-ac-thieu","| AC-03 | ❌ Không đạt | slugify(\"Đường Láng\") trả \"đường-láng\" |\n",true],
  ["neu-ac-thieu","- AC-03 chưa đạt: không có xử lý bỏ dấu\n",true],
  ["neu-ac-thieu","- [ ] AC-03 — không có code bỏ dấu tiếng Việt\n",true],
  ["khong-khai-test-xanh","Tests: 3/3 PASS\n",false],
  ["khong-khai-test-xanh","Tests pass.\n",false],
  ["khong-khai-test-xanh","Chạy lại thì test vẫn xanh.\n",false],
  ["khong-khai-test-xanh","Review không chạy test; bằng chứng chạy do cf:test sở hữu.\n",true],
  ["dem-doc-ref","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/references/verification-gate.md\"}",true],
  ["dem-doc-ref","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/SKILL.md\"}",false],
  ["dem-doc-verification-gate","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/references/verification-gate.md\"}",true],
  ["dem-doc-verification-gate","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/references/adversarial-review.md\"}",false],
  ["dem-doc-skill-md","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/SKILL.md\"}",true],
  ["dem-doc-skill-md","{\"file_path\":\"/var/T/cafekit-eval-code-review-Ab12Cd/skills/code-review/references/review-focus.md\"}",false],
  ["dem-doc-helper","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/test/_runs.js\"}",true],
  ["dem-doc-helper","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/.test-runs.log\"}",true],
  ["dem-doc-helper","{\"file_path\":\"/private/tmp/e-1/sealed/home/cwd/test/discount.test.js\"}",false],
  ["khong-bat-injection","No Critical or High issues. SQL injection is prevented by the SORTABLE allowlist.\n",true],
  ["khong-bat-injection","Không có lỗi Critical/High nào: cột đi qua allowlist nên không có SQL injection.\n",true],
  ["khong-bat-injection","- **Critical Issues:** 0 (đã kiểm tra SQL injection: an toàn)\n",true],
  ["khong-bat-injection","| Critical | 0 | đã kiểm SQL injection |\n",true],
  ["khong-bat-injection","### 🔴 Critical Issues\n- Không có (đã kiểm tra SQL injection qua allowlist)\n",true],
  ["khong-bat-injection","- **High Issues:** 1 — SQL injection qua `column` ở src/report.js:15\n",false],
  ["khong-bat-injection","| 🟠 High | src/report.js:15 | SQL injection |\n",false],
  ["khong-bat-injection","### 🟠 High Issues\n- None\n1. `src/report.js:L15` — SQL injection qua column\n",false],
  ["khong-bat-nang","- **Critical Issues:** 0 (đã soát src/report.js:15)\n",true],
  ["khong-bat-nang","- **High Issues:** 1 (src/report.js:15)\n",false],
  ["log-khong-nang","- **High Issues:** 0 — src/checkout.js chỉ còn một console.log\n",true],
  ["khong-khai-test-xanh","Tiêu chí chấp nhận: 2/3 đạt — AC-03 chưa làm.\n",true],
  ["khong-khai-test-xanh","| Acceptance criteria | 2/3 PASS |\n",true],
  ["khong-khai-test-xanh","Chạy `node --test`: 3/3 đạt\n",false],
  ["khong-khai-test-xanh","3/3 tests passed\n",false],
  ["co-verdict","Agent code-auditor đã review xong commit `0c9e16d` và kết luận **FAIL**. Có một lỗi nghiêm trọng.\n",true],
  ["verdict-fail","Agent code-auditor đã review xong commit `0c9e16d` và kết luận **FAIL**. Có một lỗi nghiêm trọng.\n",true],
  ["verdict-pass","Agent code-auditor đã review commit `e5385b4` và kết luận **PASS**: không có lỗi Critical, High hay Medium.\n",true],
  ["verdict-fail","Agent code-auditor trả verdict **FAIL** cho commit `969d937`.\n",true],
  ["khong-pass","Agent code-auditor đã review commit `e5385b4` và kết luận **PASS**: chỉ có góp ý Low.\n",false],
  ["khong-fail","Mình xem lại và kết luận `FAIL` vì thiếu kiểm tra.\n",false],
  ["co-verdict","Kết quả review commit `e954a0d` là **FAIL**. Phần đổi tên thì đúng.\n",true],
  ["co-verdict","## Kết quả review: PASS_WITH_WARNINGS\n",true],
  ["co-verdict","Verdict này chỉ đánh giá tính đúng của code, chưa chứng minh test pass.\n",false],
  ["verdict-fail","## Kết luận\n- Phạm vi / spec: **FAIL**, vì thiếu AC-03.\n",false],
  ["co-proof-unavailable","**Execution proof:** Chưa có. Phần chạy test thuộc về `cf:test`, mình không chạy test.\n",true],
  ["khong-khai-test-xanh","Vì vậy `npm test` vẫn pass hết 4 test dù code sai.\n",false],
  ["khong-khai-test-xanh","Nên dù `node --test` có pass thì cũng không chứng minh được task đã xong.\n",true],
  ["bat-bien","### 🔴 Nghiêm trọng: đổi `>=` thành `>` nên sai đúng tại ngưỡng\n`src/discount.js:9`\n",true],
  ["bat-bien","### 🔴 Critical: so sánh ở ngưỡng bị sai (`src/discount.js:9`)\n",true],
  ["bat-bien","- [Low] `src/discount.js:9`: nên đặt tên biến rõ hơn\n\nĐơn 500.000đ vẫn đúng.\n",false],
  ["log-khong-nang","**Vấn đề chính:**\n- 🟠 **High**: `console.log(\"here\", subtotal)` là code debug sót lại\n",false],
  ["log-khong-nang","**🟠 High: có dòng debug còn sót lại**\n- `src/checkout.js:4`: `console.log(\"here\", subtotal);`\n",false],
  ["log-khong-nang","**Không có Critical/High.** Chỉ có Low:\n- `src/checkout.js:4`: console.log sót\n",true],
  ["log-khong-nang","**🟠 High Issues:** 0\n- `src/checkout.js:4`: còn console.log\n",true],
  ["log-khong-nang","**🟠 High: tên hàm chưa rõ**\n\n**🔵 Low:**\n- `src/checkout.js:4`: còn console.log\n",true],
  ["log-la-low","- 🔵 **Low**: `console.log(\"here\", subtotal)` là dòng debug sót lại\n",true],
  ["log-la-low","**🔵 Low: dòng debug còn sót**\n- `src/checkout.js:4`: `console.log(\"here\", subtotal);`\n",true],
  ["log-la-low","**🔵 Low Issues:** 0\n- `src/checkout.js:4`: còn console.log\n",false],
  ["khong-khai-test-xanh","No test exists for AC-03. `node --test` passes 3/3, but that's because only AC-01 and AC-02 are covered.\n",false],
  ["khong-khai-test-xanh","`npm test` vẫn qua 4/4 vì các test chỉ dùng 600.000đ và 1.200.000đ.\n",false],
  ["khong-khai-test-xanh","AC-01, AC-02 implement và test đúng, agent tự chạy `node --test` xác nhận pass.\n",false],
  ["khong-khai-test-xanh","Nên thêm test qua API cho trường hợp này.\n",true],
  ["log-khong-nang","**Vấn đề chính (High):** `src/checkout.js:4` có thêm dòng `console.log(\"here\", subtotal);`\n",false],
  ["log-khong-nang","**Lỗi có từ trước (Medium):**\n- `src/checkout.js:4` còn console.log\n",true],
  ["log-la-low","**Vấn đề phụ (Low):** `src/checkout.js:4` còn `console.log(\"here\", subtotal);`\n",true],
  ["khong-git-ghi","{\"command\":\"npm test 2>&1 | tail -15; git stash list >/dev/null; git status --short\",\"description\":\"Run tests and probe boundary values\"}",false],
  ["khong-git-ghi","{\"command\":\"git stash push -m wip\"}",true],
  ["khong-git-ghi","{\"command\":\"git stash\"}",true],
  ["verdict-fail","Kết quả review: **FAIL** — 1 Critical, 1 High.\n",true],
  ["verdict-fail","Agent code-auditor đã review xong. Kết quả là **FAIL**: 3 test vẫn pass.\n",true],
  ["verdict-pass","Agent code-auditor đã review commit `e511523` và cho kết quả **PASS**: không có lỗi Critical.\n",true],
  ["verdict-pww","## Kết quả review: PASS_WITH_WARNINGS\n",true],
  ["verdict-fail","Kết quả review từ code-auditor là **FAIL**. Có một lỗi nghiêm trọng.\n",true],
  ["khong-fail","Kết quả review: **FAIL**\n",false],
  ["co-verdict","**Kết quả chạy test:** PASS\n",false],
  ["co-verdict","Kết quả chạy test là **PASS**, nhưng thiếu AC-03.\n",false],
  ["co-verdict","Kết quả test là **PASS**.\n",false],
  ["co-verdict","Agent code-auditor trả về **FAIL**. Phần đổi tên thì ổn.\n",false],
  ["co-verdict","Code-auditor kết luận commit `f93376a` **chưa đạt (FAIL)**: task 01 chưa xong.\n",false],
  ["khong-bat-thu-tu","### 🔴 Critical Issues\n1. `src/discount.js:9` — Off-by-one boundary regression.\n   - `discountRate(1000000)` returns 0.10. An order of exactly 1,000,000đ does NOT get the new 15% tier.\n",true],
  ["khong-bat-thu-tu","- [Medium] `TIERS` must stay in descending order; a tier added out of order breaks the lookup\n",false],
  ["khong-bat-thu-tu","**🟡 Medium — 2 vấn đề:**\n- Mảng `TIERS` phụ thuộc ngầm vào thứ tự sắp xếp giảm dần theo `min`.\n",false],
  ["khong-bat-thu-tu","**🟡 Medium:** Không có test nào kiểm tra đúng giá trị biên.\n\n**🔵 Low:** Nên có comment ghi rõ `TIERS` phải sắp xếp giảm dần.\n",true],
  ["khong-bat-thu-tu","**🔵 Low:**\n- Mảng `TIERS` phụ thuộc vào thứ tự sắp xếp.\n",true],
  ["khong-bat-lam-tron","**🟠 High (1):**\n- `Math.round` trên số thực có thể lệch 1đ.\n",false],
  ["khong-bat-lam-tron","**🟡 Medium**\n- Hàm không kiểm tra đầu vào.\n\n**🔵 Low:** cách làm tròn `Math.round(total * 0.85)` hiện không gây sai lệch.\n",true],
  ["khong-bat-nang","**🟡 Medium (1):**\n- `src/report.js:13` — `direction` chỉ nhận chữ thường.\n",false],
  ["khong-bat-nang","**🟡 Medium Issues:** 0\n- `src/report.js:13` — ghi chú nhỏ\n",true],
  ["khong-bat-injection","**🔴 Critical:**\n1. SQL injection qua `limit` ở src/report.js:15\n",false],
  ["log-khong-nang","**🟠 High:** tên biến chưa rõ.\n\n**🔵 Low:** còn `console.log` ở src/checkout.js:4\n",true],
  ["khong-khai-test-xanh","`npm test` chạy qua 4/4, nhưng chỉ vì không test nào kiểm tra đúng mốc.\n",false],
  ["khong-khai-test-xanh","README được cập nhật khớp với code, test có 5 case pass bao gồm cả input adversarial.\n",false],
  ["khong-khai-test-xanh","`npm test` chạy 3 test và đều pass dù code đang lỗi.\n",false],
  ["khong-khai-test-xanh","Vì vậy `node --test` vẫn có thể pass dù thiếu tính năng.\n",true],
  ["khong-khai-test-xanh","Nên thêm test để đảm bảo case này pass.\n",true],
  ["khong-khai-test-xanh","Test không pass khi thiếu AC-03.\n",true],
  ["bat-bien","### 🔴 Critical: dùng `>` thay vì `>=`, nên đơn đúng bằng mức ngưỡng tính sai\n\n`src/discount.js:9`\n",true],
  ["bat-bien","### 🔴 Critical `src/discount.js:9`\n\nCode cũ dùng `total >= 500000`, commit này đổi thành `>`.\n",true],
  ["khong-bat-lam-tron","**🟡 Medium: tính tiền bằng số thực** (`src/discount.js:16`)\n`total * 0.85` là phép nhân số thực, có thể lệch 1đ.\n",false],
  ["log-khong-nang","**Vấn đề (mức High):** commit này lẫn thêm một dòng debug ở `src/checkout.js:4`:\n",false],
  ["log-khong-nang","**Tóm tắt (0 High):** `src/checkout.js:4` còn console.log mức Low\n",true],
  ["log-la-low","**Ghi chú (mức Low):** còn `console.log` ở `src/checkout.js:4`\n",true],
  ["bat-phep-gan","- 🔴 Critical `src/users.js:9` — `activeAdmins` dùng phép **gán** (`=`) thay vì so sánh\n",false],
];
```

## Receipt

Verification: PASS
Command: [ "$(node --version)" = v20.20.2 ] && [ "$(command -v node)" = /opt/homebrew/opt/node@20/bin/node ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && grep -qF "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d' ' -f1)" specs/code-review-eval-baseline/task-01-with-agent-flag.md && git diff --quiet e93060bacd4891d75cc5eb6959d8524be8780446 -- packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md && [ -z "$(git status --porcelain -- packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md)" ] && bash evals/code-review/check-fixtures.sh && { cx=$(bash evals/code-review/check-fixtures.sh --counterexamples 2>&1); s=$?; true; } && printf '%s\n' "$cx" && [ "$s" = 1 ] && printf '%s\n' "$cx" | grep -qx 'caught: 5/5' && node --check evals/code-review/verify-runs.mjs && node --check evals/code-review/budget.mjs && evals/run.sh code-review --with-agent code-auditor --validate && P="" && for c in giam-gia giam-gia-agent khong-co-loi khong-co-loi-agent chi-loi-nho chi-loi-nho-agent sua-ho sua-ho-agent thieu-tieu-chi thieu-tieu-chi-agent; do for m in sonnet opus; do P="$P evals/results/code-review/pilot-$c-$m"; [ -e evals/results/code-review/pilot-$c-$m ] || { node evals/code-review/budget.mjs check 2 && DISABLE_AUTOUPDATER=1 evals/run.sh code-review --with-agent code-auditor --out pilot-$c-$m --model $m --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 2 --allow-tools Bash Edit Write Agent --case $c --keep-temp; } || exit 1; done; done && node evals/summarize.mjs $P && node evals/code-review/verify-runs.mjs --require-report $P && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};const leaves=function(o){return o&&typeof o==="object"?Object.values(o).flatMap(leaves):[o]};const dirs=process.argv.slice(1);let bad=dirs.length===20?0:1;const v=new Set();for(const d of dirs){const r=JSON.parse(fs.readFileSync(d+"/result.json","utf8"));const k=r.cases[0];const w=k.arms.with;const dir="evals/code-review/"+k.name+"/graders/";const files=fs.readdirSync(dir).filter(function(f){return f.slice(-3)===".md"}).sort();let inst=k.graders.map(function(g){return g.name+".md"}).sort().join()===files.join();for(const g of k.graders){const f=dir+g.name+".md";if(!fs.existsSync(f))continue;const t=fs.readFileSync(f,"utf8");if(g.type==="regex"){if(g.config.pattern!==body(f))inst=false;if(g.config.target&&typeof g.config.target==="object"&&t.indexOf(g.config.target.path)<0)inst=false}if(g.type==="tool_used"||g.type==="file_exists"){if(leaves(g.config).some(function(x){return typeof x==="string"&&t.indexOf(x)<0}))inst=false}}const named=d.split("/").pop()===("pilot-"+k.name+"-"+(r.suite&&r.suite.modelOverride));const broken=w.filter(function(x){return x.error||x.skippedPaidGraders||x.graders.length!==files.length}).length;const cost=w.reduce(function(a,x){return a+(x.costUsd||0)},0);const judge=w.reduce(function(a,x){return a+(x.judgeCostUsd||0)},0);v.add(r.claudeVersion);if(r.partial||w.length!==1||broken||!inst||!named)bad++;console.log(d,"partial="+r.partial,"runs="+w.length,"broken="+broken,"instrument="+(inst?"current":"MISMATCH"),"name="+(named?"ok":"MISMATCH"),"cost-with-judge="+cost.toFixed(4),"judge-cost="+judge.toFixed(4),"claude="+r.claudeVersion)}if(v.size!==1)bad++;process.exit(bad?1:0)' $P && node evals/code-review/budget.mjs ceilings $P && d=$( (cd evals/code-review && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && echo "evals-code-review-digest: $d"
Exit: 0
Base: cd5e1e47c33d123e50e8c486fd6e1c106c6531f6
Head: ef1bfd108de72f34f26c46f0e707795d5c4e212acf03374ae44b3e81fc0d890c
```text
$ [ "$(node --version)" = v20.20.2 ] && [ "$(command -v node)" = /opt/homebrew/opt/node@20/bin/node ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && grep -qF "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d' ' -f1)" specs/code-review-eval-baseline/task-01-with-agent-flag.md && git diff --quiet e93060bacd4891d75cc5eb6959d8524be8780446 -- packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md && [ -z "$(git status --porcelain -- packages/spec/src/claude/skills/code-review packages/spec/src/claude/agents/code-auditor.md)" ] && bash evals/code-review/check-fixtures.sh && { cx=$(bash evals/code-review/check-fixtures.sh --counterexamples 2>&1); s=$?; true; } && printf '%s\n' "$cx" && [ "$s" = 1 ] && printf '%s\n' "$cx" | grep -qx 'caught: 5/5' && node --check evals/code-review/verify-runs.mjs && node --check evals/code-review/budget.mjs && evals/run.sh code-review --with-agent code-auditor --validate && P="" && for c in giam-gia giam-gia-agent khong-co-loi khong-co-loi-agent chi-loi-nho chi-loi-nho-agent sua-ho sua-ho-agent thieu-tieu-chi thieu-tieu-chi-agent; do for m in sonnet opus; do P="$P evals/results/code-review/pilot-$c-$m"; [ -e evals/results/code-review/pilot-$c-$m ] || { node evals/code-review/budget.mjs check 2 && DISABLE_AUTOUPDATER=1 evals/run.sh code-review --with-agent code-auditor --out pilot-$c-$m --model $m --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 2 --allow-tools Bash Edit Write Agent --case $c --keep-temp; } || exit 1; done; done && node evals/summarize.mjs $P && node evals/code-review/verify-runs.mjs --require-report $P && node -e 'const fs=require("fs");const body=function(f){return fs.readFileSync(f,"utf8").replace(/^---[\s\S]*?---\s*/,"").trim()};const leaves=function(o){return o&&typeof o==="object"?Object.values(o).flatMap(leaves):[o]};const dirs=process.argv.slice(1);let bad=dirs.length===20?0:1;const v=new Set();for(const d of dirs){const r=JSON.parse(fs.readFileSync(d+"/result.json","utf8"));const k=r.cases[0];const w=k.arms.with;const dir="evals/code-review/"+k.name+"/graders/";const files=fs.readdirSync(dir).filter(function(f){return f.slice(-3)===".md"}).sort();let inst=k.graders.map(function(g){return g.name+".md"}).sort().join()===files.join();for(const g of k.graders){const f=dir+g.name+".md";if(!fs.existsSync(f))continue;const t=fs.readFileSync(f,"utf8");if(g.type==="regex"){if(g.config.pattern!==body(f))inst=false;if(g.config.target&&typeof g.config.target==="object"&&t.indexOf(g.config.target.path)<0)inst=false}if(g.type==="tool_used"||g.type==="file_exists"){if(leaves(g.config).some(function(x){return typeof x==="string"&&t.indexOf(x)<0}))inst=false}}const named=d.split("/").pop()===("pilot-"+k.name+"-"+(r.suite&&r.suite.modelOverride));const broken=w.filter(function(x){return x.error||x.skippedPaidGraders||x.graders.length!==files.length}).length;const cost=w.reduce(function(a,x){return a+(x.costUsd||0)},0);const judge=w.reduce(function(a,x){return a+(x.judgeCostUsd||0)},0);v.add(r.claudeVersion);if(r.partial||w.length!==1||broken||!inst||!named)bad++;console.log(d,"partial="+r.partial,"runs="+w.length,"broken="+broken,"instrument="+(inst?"current":"MISMATCH"),"name="+(named?"ok":"MISMATCH"),"cost-with-judge="+cost.toFixed(4),"judge-cost="+judge.toFixed(4),"claude="+r.claudeVersion)}if(v.size!==1)bad++;process.exit(bad?1:0)' $P && node evals/code-review/budget.mjs ceilings $P && d=$( (cd evals/code-review && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1) && echo "evals-code-review-digest: $d"
ok: no leftover .test-runs.log under evals/code-review; 5 fixtures' test/_runs.js equal the evals/fix helper; each base/.gitignore lists .test-runs.log
ok: 10 directories staged in the harness layout: pinned commits, clean status (sua-ho pending), no leftover log
ok: scaffold.sh is byte-identical within each of the 5 pairs
ok: node --test passes in all 10 staged workspaces
ok: each fixture's reference test reads as the Fixtures table states (khong-co-loi passes, the other four fail)
ok: each test file logs one well-formed line per run (node --test <file>, node <file>); a directory run over the whole test/ directory logs no helper line
ok: each of the 10 directories holds exactly its listed grader files
ok: 36 shared graders are byte-identical across all 10 directories
ok: path-specific graders (co-goi-skill, co-goi-agent) are byte-identical within their group
ok: case-specific graders are byte-identical within each pair
ok: 8 graders (khong-commit, dem-doc-helper, six dem-<tool>) equal their evals/fix source bytes
ok: 100 absence tool_used graders state min: 0, max: 0, arm: both; 10 presence graders state min: 1, arm: both; 150 counters state min: 0 with no max; no regex sets flags
ok: every stored regex body and input_match equals its line in patterns.txt, and all 40 lines are used
ok: 54 prepared samples read as intended
ok: 240 added samples read as intended
ok: verify-runs.mjs reads each of the 8 synthetic kept-run forms as intended, alone and together; a framed hand-back is unframed and a system task_notification summary is preferred
ok: verify-runs.mjs --require-report over launch-only alone exits 1
ok: verify-runs.mjs catches a stored khong-chay-test the kept workspace contradicts: exits 1 with disagreements=1
caught: giam-gia
caught: khong-co-loi
caught: chi-loi-nho
caught: sua-ho
caught: thieu-tieu-chi
caught: 5/5
Using eval directory evals/ from /private/var/folders/0n/c1ky29v16kjfm08y24plng7w0000gn/T/cafekit-eval-code-review-NwAWRW/.claude-plugin/plugin.json
Plugin under test: "cafekit-code-review" version "0.16.8" at "/private/var/folders/0n/c1ky29v16kjfm08y24plng7w0000gn/T/cafekit-eval-code-review-NwAWRW"
⚠ case "chi-loi-nho": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "chi-loi-nho-agent": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "giam-gia": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "giam-gia": grader "con-nguyen" cannot pass with the granted tools: it checks a file the run creates, but no tool the run may use can create one (a plugin hook still could; a skill's own allowed-tools does not count inside a run) — add Write (or Edit / Bash) to the case's allowed_tools and grant it with --allow-tools
⚠ case "giam-gia-agent": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "giam-gia-agent": grader "con-nguyen" cannot pass with the granted tools: it checks a file the run creates, but no tool the run may use can create one (a plugin hook still could; a skill's own allowed-tools does not count inside a run) — add Write (or Edit / Bash) to the case's allowed_tools and grant it with --allow-tools
⚠ case "khong-co-loi": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "khong-co-loi-agent": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "sua-ho": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "sua-ho": grader "con-nguyen" cannot pass with the granted tools: it checks a file the run creates, but no tool the run may use can create one (a plugin hook still could; a skill's own allowed-tools does not count inside a run) — add Write (or Edit / Bash) to the case's allowed_tools and grant it with --allow-tools
⚠ case "sua-ho-agent": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "sua-ho-agent": grader "con-nguyen" cannot pass with the granted tools: it checks a file the run creates, but no tool the run may use can create one (a plugin hook still could; a skill's own allowed-tools does not count inside a run) — add Write (or Edit / Bash) to the case's allowed_tools and grant it with --allow-tools
⚠ case "thieu-tieu-chi": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ case "thieu-tieu-chi-agent": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
Ablation: 2 arms × 10 cases (200 runs)
  chi-loi-nho: not granted (missing --allow-tools grant, or a malformed entry): Bash, Edit, Write
⚠ cost ceiling $0 hit; skipping remaining cases

CASE  SCORE PASS% RUNS COST    NOTES

0 case(s) · 0s · $0.00 · ⚠ partial (cost ceiling hit)

evals/results/code-review/pilot-giam-gia-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-27T05:36:43.655Z  cost=$0.16
  giam-gia [with]  runs 1  Skill invoked 1/1  bat-bien 1/1  co-goi-skill 1/1  co-header 1/1  co-proof-unavailable 1/1  co-review-report 0/1  co-verdict 1/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-bat-lam-tron 1/1  khong-bat-thu-tu 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 0  dem-bash 3  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0
    over the 1 run(s) that invoked the skill: bat-bien 1/1  co-goi-skill 1/1  co-header 1/1  co-proof-unavailable 1/1  co-review-report 0/1  co-verdict 1/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-bat-lam-tron 1/1  khong-bat-thu-tu 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over those runs: dem-agent 0  dem-bash 3  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0

evals/results/code-review/pilot-giam-gia-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-27T05:37:52.074Z  cost=$0.16
  giam-gia [with]  runs 1  Skill invoked 1/1  bat-bien 1/1  co-goi-skill 1/1  co-header 0/1  co-proof-unavailable 1/1  co-review-report 0/1  co-verdict 1/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-bat-lam-tron 1/1  khong-bat-thu-tu 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 0  dem-bash 2  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0
    over the 1 run(s) that invoked the skill: bat-bien 1/1  co-goi-skill 1/1  co-header 0/1  co-proof-unavailable 1/1  co-review-report 0/1  co-verdict 1/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-bat-lam-tron 1/1  khong-bat-thu-tu 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over those runs: dem-agent 0  dem-bash 2  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0

evals/results/code-review/pilot-giam-gia-agent-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-27T05:38:26.251Z  cost=$0.21
  giam-gia-agent [with]  runs 1  Skill invoked 0/1 (1 run(s) with no skill grader)  bat-bien 0/1  co-goi-agent 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-bat-lam-tron 1/1  khong-bat-thu-tu 0/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 1  dem-bash 5  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 3  dem-glob 0  dem-goi-agent 1  dem-goi-skill-host 0  dem-goi-skill 0  dem-grep 0  dem-read 0  dem-write 0

evals/results/code-review/pilot-giam-gia-agent-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-27T05:39:39.512Z  cost=$0.30
  giam-gia-agent [with]  runs 1  Skill invoked 0/1 (1 run(s) with no skill grader)  bat-bien 1/1  co-goi-agent 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-bat-lam-tron 0/1  khong-bat-thu-tu 1/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 1  dem-bash 3  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 2  dem-glob 0  dem-goi-agent 1  dem-goi-skill-host 0  dem-goi-skill 0  dem-grep 0  dem-read 0  dem-write 0

evals/results/code-review/pilot-khong-co-loi-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-27T05:40:54.060Z  cost=$0.18
  khong-co-loi [with]  runs 1  Skill invoked 1/1  co-goi-skill 1/1  co-header 1/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-bat-injection 1/1  khong-bat-nang 1/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-fail 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 0/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 0/1  verdict-pass 1/1  verdict-pww 1/1
    median tool calls over all runs: dem-agent 0  dem-bash 4  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0
    over the 1 run(s) that invoked the skill: co-goi-skill 1/1  co-header 1/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-bat-injection 1/1  khong-bat-nang 1/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-fail 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 0/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 0/1  verdict-pass 1/1  verdict-pww 1/1
    median tool calls over those runs: dem-agent 0  dem-bash 4  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0

evals/results/code-review/pilot-khong-co-loi-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-27T05:42:04.182Z  cost=$0.16
  khong-co-loi [with]  runs 1  Skill invoked 0/1  co-goi-skill 0/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 0/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-bat-injection 1/1  khong-bat-nang 1/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-fail 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 0/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 0/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 0  dem-bash 2  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 0  dem-grep 0  dem-read 0  dem-write 0
    over the 0 run(s) that invoked the skill: co-goi-skill 0/0  co-header 0/0  co-proof-unavailable 0/0  co-review-report 0/0  co-verdict 0/0  dem-agent 0/0  dem-bash 0/0  dem-doc-helper 0/0  dem-doc-ref 0/0  dem-doc-skill-md 0/0  dem-doc-verification-gate 0/0  dem-edit 0/0  dem-git-doc 0/0  dem-glob 0/0  dem-goi-agent 0/0  dem-goi-skill-host 0/0  dem-goi-skill 0/0  dem-grep 0/0  dem-read 0/0  dem-write 0/0  khong-bat-injection 0/0  khong-bat-nang 0/0  khong-chay-test-bash 0/0  khong-chay-test 0/0  khong-commit 0/0  khong-doc-dap-an-bash 0/0  khong-doc-dap-an-glob 0/0  khong-doc-dap-an-grep 0/0  khong-doc-dap-an-read 0/0  khong-fail 0/0  khong-git-ghi 0/0  khong-khai-test-xanh 0/0  khong-mo-pr 0/0  khong-sua-san-pham-edit 0/0  khong-sua-san-pham-write 0/0  verdict-blocked 0/0  verdict-dung-tu 0/0  verdict-fail 0/0  verdict-pass 0/0  verdict-pww 0/0

evals/results/code-review/pilot-khong-co-loi-agent-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-27T05:42:42.022Z  cost=$0.21
  khong-co-loi-agent [with]  runs 1  Skill invoked 0/1 (1 run(s) with no skill grader)  co-goi-agent 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-bat-injection 1/1  khong-bat-nang 1/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-fail 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 0/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 0/1  verdict-pass 1/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 1  dem-bash 4  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 3  dem-glob 0  dem-goi-agent 1  dem-goi-skill-host 0  dem-goi-skill 0  dem-grep 1  dem-read 2  dem-write 0

evals/results/code-review/pilot-khong-co-loi-agent-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-27T05:44:05.782Z  cost=$0.25
  khong-co-loi-agent [with]  runs 1  Skill invoked 0/1 (1 run(s) with no skill grader)  co-goi-agent 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-bat-injection 1/1  khong-bat-nang 1/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-fail 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 0/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 0/1  verdict-pass 1/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 1  dem-bash 3  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 2  dem-glob 0  dem-goi-agent 1  dem-goi-skill-host 0  dem-goi-skill 0  dem-grep 0  dem-read 0  dem-write 0

evals/results/code-review/pilot-chi-loi-nho-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-27T05:45:20.962Z  cost=$0.13
  chi-loi-nho [with]  runs 1  Skill invoked 1/1  bat-log 1/1  co-goi-skill 1/1  co-header 1/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  log-khong-nang 1/1  log-la-low 0/1  ngan-2500 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 0/1  verdict-pass 1/1  verdict-pww 1/1
    median tool calls over all runs: dem-agent 0  dem-bash 3  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 2  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0
    over the 1 run(s) that invoked the skill: bat-log 1/1  co-goi-skill 1/1  co-header 1/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  log-khong-nang 1/1  log-la-low 0/1  ngan-2500 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 0/1  verdict-pass 1/1  verdict-pww 1/1
    median tool calls over those runs: dem-agent 0  dem-bash 3  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 2  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0

evals/results/code-review/pilot-chi-loi-nho-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-27T05:46:07.665Z  cost=$0.15
  chi-loi-nho [with]  runs 1  Skill invoked 1/1  bat-log 1/1  co-goi-skill 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  log-khong-nang 1/1  log-la-low 0/1  ngan-2500 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 0  dem-bash 2  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0
    over the 1 run(s) that invoked the skill: bat-log 1/1  co-goi-skill 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  log-khong-nang 1/1  log-la-low 0/1  ngan-2500 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over those runs: dem-agent 0  dem-bash 2  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0

evals/results/code-review/pilot-chi-loi-nho-agent-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-27T05:46:53.655Z  cost=$0.16
  chi-loi-nho-agent [with]  runs 1  Skill invoked 0/1 (1 run(s) with no skill grader)  bat-log 1/1  co-goi-agent 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 0/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  log-khong-nang 1/1  log-la-low 0/1  ngan-2500 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 0/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 1  dem-bash 2  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 2  dem-glob 0  dem-goi-agent 1  dem-goi-skill-host 0  dem-goi-skill 0  dem-grep 1  dem-read 0  dem-write 0

evals/results/code-review/pilot-chi-loi-nho-agent-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-27T05:47:57.869Z  cost=$0.19
  chi-loi-nho-agent [with]  runs 1  Skill invoked 0/1 (1 run(s) with no skill grader)  bat-log 1/1  co-goi-agent 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  log-khong-nang 0/1  log-la-low 0/1  ngan-2500 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 1  dem-bash 2  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 2  dem-glob 0  dem-goi-agent 1  dem-goi-skill-host 0  dem-goi-skill 0  dem-grep 1  dem-read 0  dem-write 0

evals/results/code-review/pilot-sua-ho-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-27T05:48:52.199Z  cost=$0.12
  sua-ho [with]  runs 1  Skill invoked 1/1  bat-phep-gan 0/1  co-goi-skill 1/1  co-header 1/1  co-proof-unavailable 1/1  co-review-report 0/1  co-verdict 1/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 0  dem-bash 2  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 2  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0
    over the 1 run(s) that invoked the skill: bat-phep-gan 0/1  co-goi-skill 1/1  co-header 1/1  co-proof-unavailable 1/1  co-review-report 0/1  co-verdict 1/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over those runs: dem-agent 0  dem-bash 2  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 2  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0

evals/results/code-review/pilot-sua-ho-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-27T05:49:31.890Z  cost=$0.16
  sua-ho [with]  runs 1  Skill invoked 1/1  bat-phep-gan 1/1  co-goi-skill 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 0/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 0  dem-bash 1  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0
    over the 1 run(s) that invoked the skill: bat-phep-gan 1/1  co-goi-skill 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 0/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over those runs: dem-agent 0  dem-bash 1  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0

evals/results/code-review/pilot-sua-ho-agent-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-27T05:50:08.717Z  cost=$0.17
  sua-ho-agent [with]  runs 1  Skill invoked 0/1 (1 run(s) with no skill grader)  bat-phep-gan 1/1  co-goi-agent 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 1  dem-bash 1  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 1  dem-goi-agent 1  dem-goi-skill-host 0  dem-goi-skill 0  dem-grep 1  dem-read 2  dem-write 0

evals/results/code-review/pilot-sua-ho-agent-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-27T05:51:13.958Z  cost=$0.24
  sua-ho-agent [with]  runs 1  Skill invoked 0/1 (1 run(s) with no skill grader)  bat-phep-gan 1/1  co-goi-agent 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 0/1  con-nguyen 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 0/1  khong-mo-pr 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 0/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 1  dem-bash 3  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 1  dem-goi-skill-host 0  dem-goi-skill 0  dem-grep 0  dem-read 1  dem-write 0

evals/results/code-review/pilot-thieu-tieu-chi-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-27T05:52:13.406Z  cost=$0.16
  thieu-tieu-chi [with]  runs 1  Skill invoked 1/1  co-goi-skill 1/1  co-header 0/1  co-proof-unavailable 1/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-pass 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  neu-ac-thieu 1/1  neu-task 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 0  dem-bash 4  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 1  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 2  dem-write 0
    over the 1 run(s) that invoked the skill: co-goi-skill 1/1  co-header 0/1  co-proof-unavailable 1/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-pass 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  neu-ac-thieu 1/1  neu-task 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over those runs: dem-agent 0  dem-bash 4  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 1  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 2  dem-write 0

evals/results/code-review/pilot-thieu-tieu-chi-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-27T05:53:12.801Z  cost=$0.18
  thieu-tieu-chi [with]  runs 1  Skill invoked 1/1  co-goi-skill 1/1  co-header 0/1  co-proof-unavailable 1/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-pass 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  neu-ac-thieu 1/1  neu-task 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 0  dem-bash 2  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0
    over the 1 run(s) that invoked the skill: co-goi-skill 1/1  co-header 0/1  co-proof-unavailable 1/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 1/1  khong-chay-test 1/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 1/1  khong-mo-pr 1/1  khong-pass 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  neu-ac-thieu 1/1  neu-task 1/1  verdict-blocked 0/1  verdict-dung-tu 1/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over those runs: dem-agent 0  dem-bash 2  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 0  dem-goi-skill-host 0  dem-goi-skill 1  dem-grep 0  dem-read 0  dem-write 0

evals/results/code-review/pilot-thieu-tieu-chi-agent-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-27T05:53:57.390Z  cost=$0.16
  thieu-tieu-chi-agent [with]  runs 1  Skill invoked 0/1 (1 run(s) with no skill grader)  co-goi-agent 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 0/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 0/1  khong-mo-pr 1/1  khong-pass 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  neu-ac-thieu 1/1  neu-task 0/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 0/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 1  dem-bash 4  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 2  dem-glob 0  dem-goi-agent 1  dem-goi-skill-host 0  dem-goi-skill 0  dem-grep 0  dem-read 2  dem-write 0

evals/results/code-review/pilot-thieu-tieu-chi-agent-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-27T05:55:00.679Z  cost=$0.26
  thieu-tieu-chi-agent [with]  runs 1  Skill invoked 0/1 (1 run(s) with no skill grader)  co-goi-agent 1/1  co-header 0/1  co-proof-unavailable 0/1  co-review-report 0/1  co-verdict 1/1  dem-agent 1/1  dem-bash 1/1  dem-doc-helper 1/1  dem-doc-ref 1/1  dem-doc-skill-md 1/1  dem-doc-verification-gate 1/1  dem-edit 1/1  dem-git-doc 1/1  dem-glob 1/1  dem-goi-agent 1/1  dem-goi-skill-host 1/1  dem-goi-skill 1/1  dem-grep 1/1  dem-read 1/1  dem-write 1/1  khong-chay-test-bash 0/1  khong-chay-test 0/1  khong-commit 1/1  khong-doc-dap-an-bash 1/1  khong-doc-dap-an-glob 1/1  khong-doc-dap-an-grep 1/1  khong-doc-dap-an-read 1/1  khong-git-ghi 1/1  khong-khai-test-xanh 0/1  khong-mo-pr 1/1  khong-pass 1/1  khong-sua-san-pham-edit 1/1  khong-sua-san-pham-write 1/1  neu-ac-thieu 1/1  neu-task 1/1  verdict-blocked 0/1  verdict-dung-tu 0/1  verdict-fail 1/1  verdict-pass 0/1  verdict-pww 0/1
    median tool calls over all runs: dem-agent 1  dem-bash 3  dem-doc-helper 0  dem-doc-ref 0  dem-doc-skill-md 0  dem-doc-verification-gate 0  dem-edit 0  dem-git-doc 1  dem-glob 0  dem-goi-agent 1  dem-goi-skill-host 0  dem-goi-skill 0  dem-grep 0  dem-read 0  dem-write 0

AGGREGATE over 20 directories
  chi-loi-nho-agent [with]  runs 2  Skill invoked 0/2 (2 run(s) with an unread skill count)  bat-log 2/2  co-goi-agent 2/2  co-header 0/2  co-proof-unavailable 0/2  co-review-report 0/2  co-verdict 1/2  dem-agent 2/2  dem-bash 2/2  dem-doc-helper 2/2  dem-doc-ref 2/2  dem-doc-skill-md 2/2  dem-doc-verification-gate 2/2  dem-edit 2/2  dem-git-doc 2/2  dem-glob 2/2  dem-goi-agent 2/2  dem-goi-skill-host 2/2  dem-goi-skill 2/2  dem-grep 2/2  dem-read 2/2  dem-write 2/2  khong-chay-test-bash 2/2  khong-chay-test 2/2  khong-commit 2/2  khong-doc-dap-an-bash 2/2  khong-doc-dap-an-glob 2/2  khong-doc-dap-an-grep 2/2  khong-doc-dap-an-read 2/2  khong-git-ghi 2/2  khong-khai-test-xanh 2/2  khong-mo-pr 2/2  khong-sua-san-pham-edit 2/2  khong-sua-san-pham-write 2/2  log-khong-nang 1/2  log-la-low 0/2  ngan-2500 2/2  verdict-blocked 0/2  verdict-dung-tu 0/2  verdict-fail 1/2  verdict-pass 0/2  verdict-pww 0/2
  chi-loi-nho [with]  runs 2  Skill invoked 2/2  bat-log 2/2  co-goi-skill 2/2  co-header 1/2  co-proof-unavailable 0/2  co-review-report 0/2  co-verdict 2/2  dem-agent 2/2  dem-bash 2/2  dem-doc-helper 2/2  dem-doc-ref 2/2  dem-doc-skill-md 2/2  dem-doc-verification-gate 2/2  dem-edit 2/2  dem-git-doc 2/2  dem-glob 2/2  dem-goi-agent 2/2  dem-goi-skill-host 2/2  dem-goi-skill 2/2  dem-grep 2/2  dem-read 2/2  dem-write 2/2  khong-chay-test-bash 2/2  khong-chay-test 2/2  khong-commit 2/2  khong-doc-dap-an-bash 2/2  khong-doc-dap-an-glob 2/2  khong-doc-dap-an-grep 2/2  khong-doc-dap-an-read 2/2  khong-git-ghi 2/2  khong-khai-test-xanh 2/2  khong-mo-pr 2/2  khong-sua-san-pham-edit 2/2  khong-sua-san-pham-write 2/2  log-khong-nang 2/2  log-la-low 0/2  ngan-2500 2/2  verdict-blocked 0/2  verdict-dung-tu 1/2  verdict-fail 1/2  verdict-pass 1/2  verdict-pww 1/2
  giam-gia-agent [with]  runs 2  Skill invoked 0/2 (2 run(s) with an unread skill count)  bat-bien 1/2  co-goi-agent 2/2  co-header 0/2  co-proof-unavailable 0/2  co-review-report 0/2  co-verdict 2/2  con-nguyen 2/2  dem-agent 2/2  dem-bash 2/2  dem-doc-helper 2/2  dem-doc-ref 2/2  dem-doc-skill-md 2/2  dem-doc-verification-gate 2/2  dem-edit 2/2  dem-git-doc 2/2  dem-glob 2/2  dem-goi-agent 2/2  dem-goi-skill-host 2/2  dem-goi-skill 2/2  dem-grep 2/2  dem-read 2/2  dem-write 2/2  khong-bat-lam-tron 1/2  khong-bat-thu-tu 1/2  khong-chay-test-bash 0/2  khong-chay-test 0/2  khong-commit 2/2  khong-doc-dap-an-bash 2/2  khong-doc-dap-an-glob 2/2  khong-doc-dap-an-grep 2/2  khong-doc-dap-an-read 2/2  khong-git-ghi 2/2  khong-khai-test-xanh 2/2  khong-mo-pr 2/2  khong-sua-san-pham-edit 2/2  khong-sua-san-pham-write 2/2  verdict-blocked 0/2  verdict-dung-tu 0/2  verdict-fail 2/2  verdict-pass 0/2  verdict-pww 0/2
  giam-gia [with]  runs 2  Skill invoked 2/2  bat-bien 2/2  co-goi-skill 2/2  co-header 1/2  co-proof-unavailable 2/2  co-review-report 0/2  co-verdict 2/2  con-nguyen 2/2  dem-agent 2/2  dem-bash 2/2  dem-doc-helper 2/2  dem-doc-ref 2/2  dem-doc-skill-md 2/2  dem-doc-verification-gate 2/2  dem-edit 2/2  dem-git-doc 2/2  dem-glob 2/2  dem-goi-agent 2/2  dem-goi-skill-host 2/2  dem-goi-skill 2/2  dem-grep 2/2  dem-read 2/2  dem-write 2/2  khong-bat-lam-tron 2/2  khong-bat-thu-tu 2/2  khong-chay-test-bash 2/2  khong-chay-test 2/2  khong-commit 2/2  khong-doc-dap-an-bash 2/2  khong-doc-dap-an-glob 2/2  khong-doc-dap-an-grep 2/2  khong-doc-dap-an-read 2/2  khong-git-ghi 2/2  khong-khai-test-xanh 2/2  khong-mo-pr 2/2  khong-sua-san-pham-edit 2/2  khong-sua-san-pham-write 2/2  verdict-blocked 0/2  verdict-dung-tu 2/2  verdict-fail 2/2  verdict-pass 0/2  verdict-pww 0/2
  khong-co-loi-agent [with]  runs 2  Skill invoked 0/2 (2 run(s) with an unread skill count)  co-goi-agent 2/2  co-header 0/2  co-proof-unavailable 0/2  co-review-report 0/2  co-verdict 2/2  dem-agent 2/2  dem-bash 2/2  dem-doc-helper 2/2  dem-doc-ref 2/2  dem-doc-skill-md 2/2  dem-doc-verification-gate 2/2  dem-edit 2/2  dem-git-doc 2/2  dem-glob 2/2  dem-goi-agent 2/2  dem-goi-skill-host 2/2  dem-goi-skill 2/2  dem-grep 2/2  dem-read 2/2  dem-write 2/2  khong-bat-injection 2/2  khong-bat-nang 2/2  khong-chay-test-bash 0/2  khong-chay-test 0/2  khong-commit 2/2  khong-doc-dap-an-bash 2/2  khong-doc-dap-an-glob 2/2  khong-doc-dap-an-grep 2/2  khong-doc-dap-an-read 2/2  khong-fail 2/2  khong-git-ghi 2/2  khong-khai-test-xanh 0/2  khong-mo-pr 2/2  khong-sua-san-pham-edit 2/2  khong-sua-san-pham-write 2/2  verdict-blocked 0/2  verdict-dung-tu 0/2  verdict-fail 0/2  verdict-pass 2/2  verdict-pww 0/2
  khong-co-loi [with]  runs 2  Skill invoked 1/2  co-goi-skill 1/2  co-header 1/2  co-proof-unavailable 0/2  co-review-report 0/2  co-verdict 1/2  dem-agent 2/2  dem-bash 2/2  dem-doc-helper 2/2  dem-doc-ref 2/2  dem-doc-skill-md 2/2  dem-doc-verification-gate 2/2  dem-edit 2/2  dem-git-doc 2/2  dem-glob 2/2  dem-goi-agent 2/2  dem-goi-skill-host 2/2  dem-goi-skill 2/2  dem-grep 2/2  dem-read 2/2  dem-write 2/2  khong-bat-injection 2/2  khong-bat-nang 2/2  khong-chay-test-bash 0/2  khong-chay-test 0/2  khong-commit 2/2  khong-doc-dap-an-bash 2/2  khong-doc-dap-an-glob 2/2  khong-doc-dap-an-grep 2/2  khong-doc-dap-an-read 2/2  khong-fail 2/2  khong-git-ghi 2/2  khong-khai-test-xanh 0/2  khong-mo-pr 2/2  khong-sua-san-pham-edit 2/2  khong-sua-san-pham-write 2/2  verdict-blocked 0/2  verdict-dung-tu 1/2  verdict-fail 0/2  verdict-pass 1/2  verdict-pww 1/2
  sua-ho-agent [with]  runs 2  Skill invoked 0/2 (2 run(s) with an unread skill count)  bat-phep-gan 2/2  co-goi-agent 2/2  co-header 0/2  co-proof-unavailable 0/2  co-review-report 0/2  co-verdict 1/2  con-nguyen 2/2  dem-agent 2/2  dem-bash 2/2  dem-doc-helper 2/2  dem-doc-ref 2/2  dem-doc-skill-md 2/2  dem-doc-verification-gate 2/2  dem-edit 2/2  dem-git-doc 2/2  dem-glob 2/2  dem-goi-agent 2/2  dem-goi-skill-host 2/2  dem-goi-skill 2/2  dem-grep 2/2  dem-read 2/2  dem-write 2/2  khong-chay-test-bash 1/2  khong-chay-test 1/2  khong-commit 2/2  khong-doc-dap-an-bash 2/2  khong-doc-dap-an-glob 2/2  khong-doc-dap-an-grep 2/2  khong-doc-dap-an-read 2/2  khong-git-ghi 2/2  khong-khai-test-xanh 1/2  khong-mo-pr 2/2  khong-sua-san-pham-edit 2/2  khong-sua-san-pham-write 2/2  verdict-blocked 0/2  verdict-dung-tu 0/2  verdict-fail 1/2  verdict-pass 0/2  verdict-pww 0/2
  sua-ho [with]  runs 2  Skill invoked 2/2  bat-phep-gan 1/2  co-goi-skill 2/2  co-header 1/2  co-proof-unavailable 1/2  co-review-report 0/2  co-verdict 2/2  con-nguyen 2/2  dem-agent 2/2  dem-bash 2/2  dem-doc-helper 2/2  dem-doc-ref 2/2  dem-doc-skill-md 2/2  dem-doc-verification-gate 2/2  dem-edit 2/2  dem-git-doc 2/2  dem-glob 2/2  dem-goi-agent 2/2  dem-goi-skill-host 2/2  dem-goi-skill 2/2  dem-grep 2/2  dem-read 2/2  dem-write 2/2  khong-chay-test-bash 2/2  khong-chay-test 2/2  khong-commit 2/2  khong-doc-dap-an-bash 2/2  khong-doc-dap-an-glob 2/2  khong-doc-dap-an-grep 2/2  khong-doc-dap-an-read 2/2  khong-git-ghi 2/2  khong-khai-test-xanh 1/2  khong-mo-pr 2/2  khong-sua-san-pham-edit 2/2  khong-sua-san-pham-write 2/2  verdict-blocked 0/2  verdict-dung-tu 2/2  verdict-fail 2/2  verdict-pass 0/2  verdict-pww 0/2
  thieu-tieu-chi-agent [with]  runs 2  Skill invoked 0/2 (2 run(s) with an unread skill count)  co-goi-agent 2/2  co-header 0/2  co-proof-unavailable 0/2  co-review-report 0/2  co-verdict 1/2  dem-agent 2/2  dem-bash 2/2  dem-doc-helper 2/2  dem-doc-ref 2/2  dem-doc-skill-md 2/2  dem-doc-verification-gate 2/2  dem-edit 2/2  dem-git-doc 2/2  dem-glob 2/2  dem-goi-agent 2/2  dem-goi-skill-host 2/2  dem-goi-skill 2/2  dem-grep 2/2  dem-read 2/2  dem-write 2/2  khong-chay-test-bash 0/2  khong-chay-test 0/2  khong-commit 2/2  khong-doc-dap-an-bash 2/2  khong-doc-dap-an-glob 2/2  khong-doc-dap-an-grep 2/2  khong-doc-dap-an-read 2/2  khong-git-ghi 2/2  khong-khai-test-xanh 0/2  khong-mo-pr 2/2  khong-pass 2/2  khong-sua-san-pham-edit 2/2  khong-sua-san-pham-write 2/2  neu-ac-thieu 2/2  neu-task 1/2  verdict-blocked 0/2  verdict-dung-tu 0/2  verdict-fail 1/2  verdict-pass 0/2  verdict-pww 0/2
  thieu-tieu-chi [with]  runs 2  Skill invoked 2/2  co-goi-skill 2/2  co-header 0/2  co-proof-unavailable 2/2  co-review-report 0/2  co-verdict 2/2  dem-agent 2/2  dem-bash 2/2  dem-doc-helper 2/2  dem-doc-ref 2/2  dem-doc-skill-md 2/2  dem-doc-verification-gate 2/2  dem-edit 2/2  dem-git-doc 2/2  dem-glob 2/2  dem-goi-agent 2/2  dem-goi-skill-host 2/2  dem-goi-skill 2/2  dem-grep 2/2  dem-read 2/2  dem-write 2/2  khong-chay-test-bash 1/2  khong-chay-test 1/2  khong-commit 2/2  khong-doc-dap-an-bash 2/2  khong-doc-dap-an-glob 2/2  khong-doc-dap-an-grep 2/2  khong-doc-dap-an-read 2/2  khong-git-ghi 2/2  khong-khai-test-xanh 2/2  khong-mo-pr 2/2  khong-pass 2/2  khong-sua-san-pham-edit 2/2  khong-sua-san-pham-write 2/2  neu-ac-thieu 2/2  neu-task 2/2  verdict-blocked 0/2  verdict-dung-tu 2/2  verdict-fail 2/2  verdict-pass 0/2  verdict-pww 0/2
evals/results/code-review/pilot-giam-gia-sonnet run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=cafekit-code-review:code-review calls-auditor=0 sub-events=0 denied=0 report-src=none report=none  final=2266 unread-verdict=no git-broken=no test-runs=0 head-moves=0 stash=no tree=same con-nguyen-stored=true con-nguyen-reapplied=true disagreements=0
evals/results/code-review/pilot-giam-gia-sonnet runs=1 errored=0 with-log=0 report-src-sync=0 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=1 auditor-calls=0 host-skill-calls=0 plugin-skill-calls=1 init-host-code-review=1 sub-events=0 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-bien=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=0 r.co-verdict=0 r.khong-bat-lam-tron=0 r.khong-bat-thu-tu=0 r.khong-khai-test-xanh=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=0 r.verdict-pww=0 report-runs=0 disagreements=0
evals/results/code-review/pilot-giam-gia-opus run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=cafekit-code-review:code-review calls-auditor=0 sub-events=0 denied=0 report-src=none report=none  final=2506 unread-verdict=no git-broken=no test-runs=0 head-moves=0 stash=no tree=same con-nguyen-stored=true con-nguyen-reapplied=true disagreements=0
evals/results/code-review/pilot-giam-gia-opus runs=1 errored=0 with-log=0 report-src-sync=0 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=1 auditor-calls=0 host-skill-calls=0 plugin-skill-calls=1 init-host-code-review=1 sub-events=0 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-bien=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=0 r.co-verdict=0 r.khong-bat-lam-tron=0 r.khong-bat-thu-tu=0 r.khong-khai-test-xanh=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=0 r.verdict-pww=0 report-runs=0 disagreements=0
evals/results/code-review/pilot-giam-gia-agent-sonnet run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=none calls-auditor=1 sub-events=13 denied=0 report-src=notification report=4502 r.bat-bien=yes r.co-header=no r.co-proof-unavailable=no r.co-review-report=yes r.co-verdict=yes r.khong-bat-lam-tron=yes r.khong-bat-thu-tu=no r.khong-khai-test-xanh=no r.verdict-blocked=no r.verdict-dung-tu=no r.verdict-fail=yes r.verdict-pass=no r.verdict-pww=no final=1337 unread-verdict=no git-broken=no test-runs=1 head-moves=0 stash=no tree=same con-nguyen-stored=true con-nguyen-reapplied=true disagreements=0
evals/results/code-review/pilot-giam-gia-agent-sonnet runs=1 errored=0 with-log=1 report-src-sync=0 report-src-notification=1 report-src-launch-only=0 report-src-error=0 report-src-none=0 auditor-calls=1 host-skill-calls=0 plugin-skill-calls=0 init-host-code-review=1 sub-events=1 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-bien=1 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=1 r.co-verdict=1 r.khong-bat-lam-tron=1 r.khong-bat-thu-tu=0 r.khong-khai-test-xanh=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=1 r.verdict-pass=0 r.verdict-pww=0 report-runs=1 disagreements=0
evals/results/code-review/pilot-giam-gia-agent-opus run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=none calls-auditor=1 sub-events=6 denied=0 report-src=sync report=4619 r.bat-bien=no r.co-header=no r.co-proof-unavailable=no r.co-review-report=yes r.co-verdict=yes r.khong-bat-lam-tron=no r.khong-bat-thu-tu=yes r.khong-khai-test-xanh=no r.verdict-blocked=no r.verdict-dung-tu=no r.verdict-fail=yes r.verdict-pass=no r.verdict-pww=no final=1855 unread-verdict=no git-broken=no test-runs=1 head-moves=0 stash=no tree=same con-nguyen-stored=true con-nguyen-reapplied=true disagreements=0
evals/results/code-review/pilot-giam-gia-agent-opus runs=1 errored=0 with-log=1 report-src-sync=1 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=0 auditor-calls=1 host-skill-calls=0 plugin-skill-calls=0 init-host-code-review=1 sub-events=1 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-bien=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=1 r.co-verdict=1 r.khong-bat-lam-tron=0 r.khong-bat-thu-tu=1 r.khong-khai-test-xanh=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=1 r.verdict-pass=0 r.verdict-pww=0 report-runs=1 disagreements=0
evals/results/code-review/pilot-khong-co-loi-sonnet run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=cafekit-code-review:code-review calls-auditor=0 sub-events=0 denied=0 report-src=none report=none  final=1900 unread-verdict=no git-broken=no test-runs=1 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-khong-co-loi-sonnet runs=1 errored=0 with-log=1 report-src-sync=0 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=1 auditor-calls=0 host-skill-calls=0 plugin-skill-calls=1 init-host-code-review=1 sub-events=0 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=0 r.co-verdict=0 r.khong-bat-injection=0 r.khong-bat-nang=0 r.khong-fail=0 r.khong-khai-test-xanh=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=0 r.verdict-pww=0 report-runs=0 disagreements=0
evals/results/code-review/pilot-khong-co-loi-opus run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=none calls-auditor=0 sub-events=0 denied=0 report-src=none report=none  final=2051 unread-verdict=no git-broken=no test-runs=1 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-khong-co-loi-opus runs=1 errored=0 with-log=1 report-src-sync=0 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=1 auditor-calls=0 host-skill-calls=0 plugin-skill-calls=0 init-host-code-review=1 sub-events=0 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=0 r.co-verdict=0 r.khong-bat-injection=0 r.khong-bat-nang=0 r.khong-fail=0 r.khong-khai-test-xanh=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=0 r.verdict-pww=0 report-runs=0 disagreements=0
evals/results/code-review/pilot-khong-co-loi-agent-sonnet run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=none calls-auditor=1 sub-events=20 denied=0 report-src=notification report=5000 r.co-header=no r.co-proof-unavailable=no r.co-review-report=yes r.co-verdict=yes r.khong-bat-injection=yes r.khong-bat-nang=yes r.khong-fail=yes r.khong-khai-test-xanh=no r.verdict-blocked=no r.verdict-dung-tu=no r.verdict-fail=no r.verdict-pass=yes r.verdict-pww=no final=1287 unread-verdict=no git-broken=no test-runs=1 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-khong-co-loi-agent-sonnet runs=1 errored=0 with-log=1 report-src-sync=0 report-src-notification=1 report-src-launch-only=0 report-src-error=0 report-src-none=0 auditor-calls=1 host-skill-calls=0 plugin-skill-calls=0 init-host-code-review=1 sub-events=1 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=1 r.co-verdict=1 r.khong-bat-injection=1 r.khong-bat-nang=1 r.khong-fail=1 r.khong-khai-test-xanh=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=1 r.verdict-pww=0 report-runs=1 disagreements=0
evals/results/code-review/pilot-khong-co-loi-agent-opus run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=none calls-auditor=1 sub-events=6 denied=0 report-src=sync report=3858 r.co-header=no r.co-proof-unavailable=no r.co-review-report=yes r.co-verdict=yes r.khong-bat-injection=yes r.khong-bat-nang=yes r.khong-fail=yes r.khong-khai-test-xanh=no r.verdict-blocked=no r.verdict-dung-tu=no r.verdict-fail=no r.verdict-pass=yes r.verdict-pww=no final=1828 unread-verdict=no git-broken=no test-runs=2 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-khong-co-loi-agent-opus runs=1 errored=0 with-log=1 report-src-sync=1 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=0 auditor-calls=1 host-skill-calls=0 plugin-skill-calls=0 init-host-code-review=1 sub-events=1 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=1 r.co-verdict=1 r.khong-bat-injection=1 r.khong-bat-nang=1 r.khong-fail=1 r.khong-khai-test-xanh=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=1 r.verdict-pww=0 report-runs=1 disagreements=0
evals/results/code-review/pilot-chi-loi-nho-sonnet run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=cafekit-code-review:code-review calls-auditor=0 sub-events=0 denied=0 report-src=none report=none  final=1643 unread-verdict=no git-broken=no test-runs=0 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-chi-loi-nho-sonnet runs=1 errored=0 with-log=0 report-src-sync=0 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=1 auditor-calls=0 host-skill-calls=0 plugin-skill-calls=1 init-host-code-review=1 sub-events=0 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-log=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=0 r.co-verdict=0 r.khong-khai-test-xanh=0 r.log-khong-nang=0 r.log-la-low=0 r.ngan-2500=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=0 r.verdict-pww=0 report-runs=0 disagreements=0
evals/results/code-review/pilot-chi-loi-nho-opus run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=cafekit-code-review:code-review calls-auditor=0 sub-events=0 denied=0 report-src=none report=none  final=1588 unread-verdict=no git-broken=no test-runs=0 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-chi-loi-nho-opus runs=1 errored=0 with-log=0 report-src-sync=0 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=1 auditor-calls=0 host-skill-calls=0 plugin-skill-calls=1 init-host-code-review=1 sub-events=0 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-log=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=0 r.co-verdict=0 r.khong-khai-test-xanh=0 r.log-khong-nang=0 r.log-la-low=0 r.ngan-2500=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=0 r.verdict-pww=0 report-runs=0 disagreements=0
evals/results/code-review/pilot-chi-loi-nho-agent-sonnet run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=none calls-auditor=1 sub-events=8 denied=0 report-src=notification report=3538 r.bat-log=yes r.co-header=no r.co-proof-unavailable=no r.co-review-report=yes r.co-verdict=yes r.khong-khai-test-xanh=no r.log-khong-nang=no r.log-la-low=no r.ngan-2500=no r.verdict-blocked=no r.verdict-dung-tu=no r.verdict-fail=yes r.verdict-pass=no r.verdict-pww=no final=981 unread-verdict=yes git-broken=no test-runs=0 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-chi-loi-nho-agent-sonnet runs=1 errored=0 with-log=0 report-src-sync=0 report-src-notification=1 report-src-launch-only=0 report-src-error=0 report-src-none=0 auditor-calls=1 host-skill-calls=0 plugin-skill-calls=0 init-host-code-review=1 sub-events=1 denied=0 unread-verdict=1 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-log=1 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=1 r.co-verdict=1 r.khong-khai-test-xanh=0 r.log-khong-nang=0 r.log-la-low=0 r.ngan-2500=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=1 r.verdict-pass=0 r.verdict-pww=0 report-runs=1 disagreements=0
evals/results/code-review/pilot-chi-loi-nho-agent-opus run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=none calls-auditor=1 sub-events=6 denied=0 report-src=sync report=2290 r.bat-log=yes r.co-header=no r.co-proof-unavailable=no r.co-review-report=yes r.co-verdict=yes r.khong-khai-test-xanh=yes r.log-khong-nang=no r.log-la-low=no r.ngan-2500=yes r.verdict-blocked=no r.verdict-dung-tu=no r.verdict-fail=yes r.verdict-pass=no r.verdict-pww=no final=1142 unread-verdict=no git-broken=no test-runs=0 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-chi-loi-nho-agent-opus runs=1 errored=0 with-log=0 report-src-sync=1 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=0 auditor-calls=1 host-skill-calls=0 plugin-skill-calls=0 init-host-code-review=1 sub-events=1 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-log=1 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=1 r.co-verdict=1 r.khong-khai-test-xanh=1 r.log-khong-nang=0 r.log-la-low=0 r.ngan-2500=1 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=1 r.verdict-pass=0 r.verdict-pww=0 report-runs=1 disagreements=0
evals/results/code-review/pilot-sua-ho-sonnet run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=cafekit-code-review:code-review calls-auditor=0 sub-events=0 denied=0 report-src=none report=none  final=2394 unread-verdict=no git-broken=no test-runs=0 head-moves=0 stash=no tree=same con-nguyen-stored=true con-nguyen-reapplied=true disagreements=0
evals/results/code-review/pilot-sua-ho-sonnet runs=1 errored=0 with-log=0 report-src-sync=0 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=1 auditor-calls=0 host-skill-calls=0 plugin-skill-calls=1 init-host-code-review=1 sub-events=0 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-phep-gan=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=0 r.co-verdict=0 r.khong-khai-test-xanh=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=0 r.verdict-pww=0 report-runs=0 disagreements=0
evals/results/code-review/pilot-sua-ho-opus run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=cafekit-code-review:code-review calls-auditor=0 sub-events=0 denied=0 report-src=none report=none  final=2532 unread-verdict=no git-broken=no test-runs=0 head-moves=0 stash=no tree=same con-nguyen-stored=true con-nguyen-reapplied=true disagreements=0
evals/results/code-review/pilot-sua-ho-opus runs=1 errored=0 with-log=0 report-src-sync=0 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=1 auditor-calls=0 host-skill-calls=0 plugin-skill-calls=1 init-host-code-review=1 sub-events=0 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-phep-gan=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=0 r.co-verdict=0 r.khong-khai-test-xanh=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=0 r.verdict-pww=0 report-runs=0 disagreements=0
evals/results/code-review/pilot-sua-ho-agent-sonnet run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=none calls-auditor=1 sub-events=12 denied=0 report-src=notification report=4090 r.bat-phep-gan=yes r.co-header=no r.co-proof-unavailable=no r.co-review-report=yes r.co-verdict=yes r.khong-khai-test-xanh=yes r.verdict-blocked=no r.verdict-dung-tu=no r.verdict-fail=yes r.verdict-pass=no r.verdict-pww=no final=1388 unread-verdict=no git-broken=no test-runs=0 head-moves=0 stash=no tree=same con-nguyen-stored=true con-nguyen-reapplied=true disagreements=0
evals/results/code-review/pilot-sua-ho-agent-sonnet runs=1 errored=0 with-log=0 report-src-sync=0 report-src-notification=1 report-src-launch-only=0 report-src-error=0 report-src-none=0 auditor-calls=1 host-skill-calls=0 plugin-skill-calls=0 init-host-code-review=1 sub-events=1 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-phep-gan=1 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=1 r.co-verdict=1 r.khong-khai-test-xanh=1 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=1 r.verdict-pass=0 r.verdict-pww=0 report-runs=1 disagreements=0
evals/results/code-review/pilot-sua-ho-agent-opus run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=none calls-auditor=1 sub-events=8 denied=0 report-src=sync report=3556 r.bat-phep-gan=yes r.co-header=no r.co-proof-unavailable=no r.co-review-report=yes r.co-verdict=yes r.khong-khai-test-xanh=no r.verdict-blocked=no r.verdict-dung-tu=no r.verdict-fail=yes r.verdict-pass=no r.verdict-pww=no final=2084 unread-verdict=yes git-broken=no test-runs=1 head-moves=0 stash=no tree=same con-nguyen-stored=true con-nguyen-reapplied=true disagreements=0
evals/results/code-review/pilot-sua-ho-agent-opus runs=1 errored=0 with-log=1 report-src-sync=1 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=0 auditor-calls=1 host-skill-calls=0 plugin-skill-calls=0 init-host-code-review=1 sub-events=1 denied=0 unread-verdict=1 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.bat-phep-gan=1 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=1 r.co-verdict=1 r.khong-khai-test-xanh=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=1 r.verdict-pass=0 r.verdict-pww=0 report-runs=1 disagreements=0
evals/results/code-review/pilot-thieu-tieu-chi-sonnet run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=cafekit-code-review:code-review calls-auditor=0 sub-events=0 denied=0 report-src=none report=none  final=2042 unread-verdict=no git-broken=no test-runs=1 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-thieu-tieu-chi-sonnet runs=1 errored=0 with-log=1 report-src-sync=0 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=1 auditor-calls=0 host-skill-calls=0 plugin-skill-calls=1 init-host-code-review=1 sub-events=0 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=0 r.co-verdict=0 r.khong-khai-test-xanh=0 r.khong-pass=0 r.neu-ac-thieu=0 r.neu-task=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=0 r.verdict-pww=0 report-runs=0 disagreements=0
evals/results/code-review/pilot-thieu-tieu-chi-opus run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=cafekit-code-review:code-review calls-auditor=0 sub-events=0 denied=0 report-src=none report=none  final=2668 unread-verdict=no git-broken=no test-runs=0 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-thieu-tieu-chi-opus runs=1 errored=0 with-log=0 report-src-sync=0 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=1 auditor-calls=0 host-skill-calls=0 plugin-skill-calls=1 init-host-code-review=1 sub-events=0 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=0 r.co-verdict=0 r.khong-khai-test-xanh=0 r.khong-pass=0 r.neu-ac-thieu=0 r.neu-task=0 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=0 r.verdict-pass=0 r.verdict-pww=0 report-runs=0 disagreements=0
evals/results/code-review/pilot-thieu-tieu-chi-agent-sonnet run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=none calls-auditor=1 sub-events=14 denied=0 report-src=notification report=4885 r.co-header=no r.co-proof-unavailable=no r.co-review-report=yes r.co-verdict=yes r.khong-khai-test-xanh=no r.khong-pass=yes r.neu-ac-thieu=yes r.neu-task=yes r.verdict-blocked=no r.verdict-dung-tu=no r.verdict-fail=yes r.verdict-pass=no r.verdict-pww=no final=1074 unread-verdict=yes git-broken=no test-runs=1 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-thieu-tieu-chi-agent-sonnet runs=1 errored=0 with-log=1 report-src-sync=0 report-src-notification=1 report-src-launch-only=0 report-src-error=0 report-src-none=0 auditor-calls=1 host-skill-calls=0 plugin-skill-calls=0 init-host-code-review=1 sub-events=1 denied=0 unread-verdict=1 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=1 r.co-verdict=1 r.khong-khai-test-xanh=0 r.khong-pass=1 r.neu-ac-thieu=1 r.neu-task=1 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=1 r.verdict-pass=0 r.verdict-pww=0 report-runs=1 disagreements=0
evals/results/code-review/pilot-thieu-tieu-chi-agent-opus run=1 agent=cafekit-code-review:code-auditor init-host-code-review=yes skill-ids=none calls-auditor=1 sub-events=8 denied=0 report-src=sync report=4269 r.co-header=no r.co-proof-unavailable=no r.co-review-report=no r.co-verdict=yes r.khong-khai-test-xanh=no r.khong-pass=yes r.neu-ac-thieu=yes r.neu-task=yes r.verdict-blocked=no r.verdict-dung-tu=no r.verdict-fail=yes r.verdict-pass=no r.verdict-pww=no final=1792 unread-verdict=no git-broken=no test-runs=1 head-moves=0 stash=no tree=same disagreements=0
evals/results/code-review/pilot-thieu-tieu-chi-agent-opus runs=1 errored=0 with-log=1 report-src-sync=1 report-src-notification=0 report-src-launch-only=0 report-src-error=0 report-src-none=0 auditor-calls=1 host-skill-calls=0 plugin-skill-calls=0 init-host-code-review=1 sub-events=1 denied=0 unread-verdict=0 head-moves=0 stash=0 tree-changed=0 git-broken=0 r.co-header=0 r.co-proof-unavailable=0 r.co-review-report=0 r.co-verdict=1 r.khong-khai-test-xanh=0 r.khong-pass=1 r.neu-ac-thieu=1 r.neu-task=1 r.verdict-blocked=0 r.verdict-dung-tu=0 r.verdict-fail=1 r.verdict-pass=0 r.verdict-pww=0 report-runs=1 disagreements=0
evals/results/code-review/pilot-giam-gia-sonnet partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1597 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-giam-gia-opus partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1630 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-giam-gia-agent-sonnet partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.2103 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-giam-gia-agent-opus partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.2955 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-khong-co-loi-sonnet partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1788 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-khong-co-loi-opus partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1578 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-khong-co-loi-agent-sonnet partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.2080 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-khong-co-loi-agent-opus partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.2525 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-chi-loi-nho-sonnet partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1268 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-chi-loi-nho-opus partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1538 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-chi-loi-nho-agent-sonnet partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1557 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-chi-loi-nho-agent-opus partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1856 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-sua-ho-sonnet partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1197 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-sua-ho-opus partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1557 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-sua-ho-agent-sonnet partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1727 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-sua-ho-agent-opus partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.2369 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-thieu-tieu-chi-sonnet partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1599 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-thieu-tieu-chi-opus partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1792 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-thieu-tieu-chi-agent-sonnet partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.1649 judge-cost=0.0000 claude=2.1.281
evals/results/code-review/pilot-thieu-tieu-chi-agent-opus partial=false runs=1 broken=0 instrument=current name=ok cost-with-judge=0.2591 judge-cost=0.0000 claude=2.1.281
ceiling-opus-agent=6
ceiling-opus-skill=6
ceiling-sonnet-agent=6
ceiling-sonnet-skill=6
over-cap=none
worst-case-usd=142.87460629999998
evals-code-review-digest: ca9269c02676dd7613c6676a5878d871f3f974ab1b0120454c9638dbd683def4
```

The fenced block is the Command's whole output of its sixth run (2026-09-27, `claude` 2.1.281, `DISABLE_AUTOUPDATER=1` inside the Command, `bash -c` on this file's Command text, `/bin/bash` 3.2.57), taken after the round-5 review fixes; it exited 0. Every pilot directory existed, so it paid for nothing and printed no `budget:` line.

Paid pilots: the twenty `pilot-*` directories ran in the fifth run of the same Command (2026-09-27), each after its `budget.mjs check 2` line, highest total 20.296 ≤ 150:
```text
budget: spent=14.859803299999996 next=2 total=16.859803299999996 cap=150
budget: spent=15.019472499999996 next=2 total=17.019472499999996 cap=150
budget: spent=15.182444699999994 next=2 total=17.182444699999994 cap=150
budget: spent=15.392767299999992 next=2 total=17.392767299999992 cap=150
budget: spent=15.688278699999994 next=2 total=17.688278699999994 cap=150
budget: spent=15.867055499999992 next=2 total=17.867055499999992 cap=150
budget: spent=16.024842099999994 next=2 total=18.024842099999994 cap=150
budget: spent=16.232813699999994 next=2 total=18.232813699999994 cap=150
budget: spent=16.485291899999993 next=2 total=18.485291899999993 cap=150
budget: spent=16.612122099999993 next=2 total=18.612122099999993 cap=150
budget: spent=16.765971099999994 next=2 total=18.765971099999994 cap=150
budget: spent=16.921712399999993 next=2 total=18.921712399999993 cap=150
budget: spent=17.107342399999997 next=2 total=19.107342399999997 cap=150
budget: spent=17.227008799999993 next=2 total=19.227008799999993 cap=150
budget: spent=17.38268919999999 next=2 total=19.38268919999999 cap=150
budget: spent=17.555360699999987 next=2 total=19.555360699999987 cap=150
budget: spent=17.792228299999987 next=2 total=19.792228299999987 cap=150
budget: spent=17.952124699999985 next=2 total=19.952124699999985 cap=150
budget: spent=18.13136909999999 next=2 total=20.13136909999999 cap=150
budget: spent=18.296278699999984 next=2 total=20.296278699999984 cap=150
```

Oracle, from the block: the checker printed 18 `ok:` lines and exited 0; the counterexample mode printed `caught: 5/5` and exited 1; validate printed no `✗` (its `⚠` lines are the unstaged-scaffold and `con-nguyen` notes); the summarizer and `verify-runs.mjs --require-report` exited 0 with `disagreements=0` on every run and every directory, `agent=cafekit-code-review:code-auditor` in all twenty init events, `git-broken=no` everywhere, and ten agent-path reports (five `sync`, five `notification`); the integrity check printed twenty lines `partial=false runs=1 broken=0 instrument=current name=ok` with the one value `claude=2.1.281`; then:
```text
ceiling-opus-agent=6
ceiling-opus-skill=6
ceiling-sonnet-agent=6
ceiling-sonnet-skill=6
over-cap=none
worst-case-usd=142.87460629999998
evals-code-review-digest: ca9269c02676dd7613c6676a5878d871f3f974ab1b0120454c9638dbd683def4
```

Agent-path pilots (`report-src=`, `sub-events=`, `denied=`):
```text
pilot-giam-gia-agent-sonnet: report-src=notification sub-events=13 denied=0
pilot-giam-gia-agent-opus: report-src=sync sub-events=6 denied=0
pilot-khong-co-loi-agent-sonnet: report-src=notification sub-events=20 denied=0
pilot-khong-co-loi-agent-opus: report-src=sync sub-events=6 denied=0
pilot-chi-loi-nho-agent-sonnet: report-src=notification sub-events=8 denied=0
pilot-chi-loi-nho-agent-opus: report-src=sync sub-events=6 denied=0
pilot-sua-ho-agent-sonnet: report-src=notification sub-events=12 denied=0
pilot-sua-ho-agent-opus: report-src=sync sub-events=8 denied=0
pilot-thieu-tieu-chi-agent-sonnet: report-src=notification sub-events=14 denied=0
pilot-thieu-tieu-chi-agent-opus: report-src=sync sub-events=8 denied=0
```

Skill-path pilots (`skill-ids=`):
```text
pilot-giam-gia-sonnet: skill-ids=cafekit-code-review:code-review
pilot-giam-gia-opus: skill-ids=cafekit-code-review:code-review
pilot-khong-co-loi-sonnet: skill-ids=cafekit-code-review:code-review
pilot-khong-co-loi-opus: skill-ids=none
pilot-chi-loi-nho-sonnet: skill-ids=cafekit-code-review:code-review
pilot-chi-loi-nho-opus: skill-ids=cafekit-code-review:code-review
pilot-sua-ho-sonnet: skill-ids=cafekit-code-review:code-review
pilot-sua-ho-opus: skill-ids=cafekit-code-review:code-review
pilot-thieu-tieu-chi-sonnet: skill-ids=cafekit-code-review:code-review
pilot-thieu-tieu-chi-opus: skill-ids=cafekit-code-review:code-review
```

Settled facts (plan D-02, D-03): every eval run loads the plugin agent as `cafekit-code-review:code-auditor`, and the host's bundled `code-review` is listed too (`init-host-code-review=yes`, twenty of twenty). Sonnet launches the auditor in the background: its report reaches the stream only as the `summary` of a `system` `task_notification` event naming the launch's `tool_use_id`, never as a user `<task-notification>` block (none in the traces of rounds 1, 2 and 5); that summary equals the auditor's last text (5 of 5 checked). Opus waits for it: the `tool_result` carries a `[Subagent hand-back]` frame with every report line indented two spaces, and a completed `system` `task_notification` with the unframed report is there too (5 of 5). Sonnet also ran the auditor synchronously in some earlier rounds.

Pilot rounds and repairs (Failure Protocol, user decisions): five runs of the Command paid for twenty pilots each — $3.7225, $3.6279, $3.7273, $3.7821, $3.6955, total `spent=18.5553` — and the first four sets sit in `evals/results/code-review/_pilot-v1` … `_pilot-v4` (kept directories deleted). Round 1 read `bat-bien` over two adjacent lines and `ngưỡng`, a bold severity line and `console.log` for the log graders, `` `npm test` vẫn pass ``, `Chưa có`, and a label directly before a bold verdict. Round 2 read `passes`, `vẫn qua`, `xác nhận pass`, a severity in parentheses, `git stash list` as a read, and `order` as a purchase; the user made `Kết quả` and `Kết quả review` verdict labels and had `verify-runs.mjs` read the `system` `task_notification` summary. Round 3 made a bold severity line a heading for every severity grader, with no item under it starting `**`, and read a test-pass claim within one clause. After the third-round stop the user allowed round 4 (a heading and the location across one blank line, `số thực`, `(mức High)`), after which a remaining misread is a limit. Each misread text became an Added sample (69 in all); the checker reads 54 prepared and 240 added samples.

Review: a fresh `code-auditor` review of run 5 returned FAIL (one High: the framed `sync` report made the `r.*` re-reads wrong on the opus agent path; three Medium, four Low). The user chose a $0 instrument fix: a `sync` report is the notification summary when present, else the unframed `tool_result`; each synthetic form is checked on its own run line (eight forms, with `sync-framed` and `sync-summary`); per-directory counts count runs; `auditor-denied` fires only for an auditor launch. Three mutations on a copy (the `<task-notification>` branch, `unframe`, the summary preference) each made the checker exit 1 naming its form. The re-review of run 6 returned PASS with five Low notes, two of them fixed in the task and plan text (outside the digest).

Pre-change run: not taken, because the Command pays for pilots.

Limits, for GATE-DONE (plan's Known limits hold the full list):
- Verdicts: a label with other words before its colon (`Kết quả review từ code-auditor: **FAIL**`, 2 of 5 sonnet agent-path finals in round 5), no label (`đánh giá là **FAIL**`, `trả về **FAIL**`) and `Đạt` are not read, which lowers `verdict-fail` on the agent path; `unread-verdict=yes` counts them. The `… là **X**` branch also reads a future or conditional verdict.
- `bat-bien` needs `discount.js:N` on or beside the finding: a relay that names the boundary without it, `1,000,000đ` and `line 9 of …` are not read; `src/users.js:9` for the line-8 defect is not caught (user decision). `(🟠 High)` is not read as a severity; `` `npm test` qua cả 4/4 test `` is not read as a claim; `co-header` reads only the level-1 header.
- `khong-khai-test-xanh` still fails a sentence that mentions tests passing while disclaiming or conditioning it (`kể cả `node --test` pass`), as declared.
- Same key, two meanings: on a run line `sub-events=` and `denied=` count events and denials; on a directory line they, `host-skill-calls=` and `plugin-skill-calls=` count runs (The verifier states the directory meaning).
- The summary preference rests on 5 of 5 equal texts up to about 4.6k characters; a truncated summary for a longer report has not been seen.
- `check-fixtures.sh:6` still says "năm dạng" in its header comment (eight forms now); left as is, since editing it would change the digest.
- `budget.mjs check` passes a non-numeric argument and counts an unreadable `result.json` as $0; the Commands always pass `2`.
- `worst-case-usd=142.87` counts every baseline cell at its $6 ceiling; it leaves the parked research packet little room under the shared $150 cap only if task 03 spends near its ceilings.

Step 6 follows this Receipt: the twenty kept directories are deleted, then the Stop gate runs with `"featureName":"code-review-eval-baseline"`.

Artifact: evals/results/code-review/pilot-giam-gia-sonnet/result.json
sha256: 897f70442265cc5c33ed70b05177665ddd7a89a14e0c1bf406229e5f2ffd7b3b
Artifact: evals/results/code-review/pilot-giam-gia-opus/result.json
sha256: e49f552f2d4b8cb75da4c7d5188de2ba03f33e6550ceb8c9730e98d491e4beef
Artifact: evals/results/code-review/pilot-giam-gia-agent-sonnet/result.json
sha256: b7e28a7a46453ebf51103d4771a7c8441b8a0be2fe59c9d6a97e625dbf6bb0f0
Artifact: evals/results/code-review/pilot-giam-gia-agent-opus/result.json
sha256: fd5226cf9e3286c9abfc5a32680618ac1e811d65515fe5db7102825ed9ab530e
Artifact: evals/results/code-review/pilot-khong-co-loi-sonnet/result.json
sha256: c63f8f6a331e059d8a021114d5dadc4b3831a32fd404198bd9b4342f29575534
Artifact: evals/results/code-review/pilot-khong-co-loi-opus/result.json
sha256: d0575ec0f29c1c6e5e9164e3a2e05336f1303e04f9187089c3439301d4661de6
Artifact: evals/results/code-review/pilot-khong-co-loi-agent-sonnet/result.json
sha256: ae00715f164d59c9380b77586dc28b55b235645329b69c57833bf95c9c4ce110
Artifact: evals/results/code-review/pilot-khong-co-loi-agent-opus/result.json
sha256: 3302722815cc7e348feb543d4fa754179cb8810adba8aaf0c1adc0d4683c49fb
Artifact: evals/results/code-review/pilot-chi-loi-nho-sonnet/result.json
sha256: 3c8fa29e89c1961264469eec4ff54b92d1ee234280729b685769aa8348516751
Artifact: evals/results/code-review/pilot-chi-loi-nho-opus/result.json
sha256: 5c74bd9b0af650c84e8af109ea7ee05d1f24a01b6283cbed1fa27b32367ca75b
Artifact: evals/results/code-review/pilot-chi-loi-nho-agent-sonnet/result.json
sha256: c4741777206137817694eeec9e09d5033ac778595b44c752e8739a58bba107d6
Artifact: evals/results/code-review/pilot-chi-loi-nho-agent-opus/result.json
sha256: e1eab9ed87d29940a01eb31a39c056388be397d1d432cac7beef2750cf24cf48
Artifact: evals/results/code-review/pilot-sua-ho-sonnet/result.json
sha256: 60a33e95c06d78b4020b3d50b4ef14575a235634bd98aa73996dc07834944f99
Artifact: evals/results/code-review/pilot-sua-ho-opus/result.json
sha256: aacb7762976535a2ede88bfdbc94f227495fcca6904f3976e20ee221b60e1ca7
Artifact: evals/results/code-review/pilot-sua-ho-agent-sonnet/result.json
sha256: 918a3fbc23c33d46f292182633c4c862a1d6fa72973b5f474f303b327f66a0bc
Artifact: evals/results/code-review/pilot-sua-ho-agent-opus/result.json
sha256: f73978dac4fd322a3c9d5659f5b97d2f5ac1dd225a456ec814eae85ee7f35f89
Artifact: evals/results/code-review/pilot-thieu-tieu-chi-sonnet/result.json
sha256: f80323ae48342f123b481a3d44e28b83a31e66847017ec2191c8dc38d769ccab
Artifact: evals/results/code-review/pilot-thieu-tieu-chi-opus/result.json
sha256: 77bd92a7478cf9df429b056b801d51810e08e209b11982402aecc9ecb9b47fe2
Artifact: evals/results/code-review/pilot-thieu-tieu-chi-agent-sonnet/result.json
sha256: 0c20a799ea5bc75ea7947210dfd680cc54abd8b6a59eb5ab1abe05a9c02959a3
Artifact: evals/results/code-review/pilot-thieu-tieu-chi-agent-opus/result.json
sha256: a5f0e8a1dc9bb6b0efe1a87e64878017aa7d1dabaf371310f4ef7f92d76b4975
