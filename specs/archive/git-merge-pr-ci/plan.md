# cf:git merge-pr kèm theo dõi CI (gói 3a/5)
Specs-Contract: process-first-ready-v1

Lộ trình chung: `plans/20261021-cfk-ref-borrow-roadmap.md` (gói 3, GATE-SCOPE 2026-10-21: KEEP, tách 5 gói con; thiếu năng lực không cần eval gốc; trần eval cả gói 3 là $100).

## Scope decision (GATE-SCOPE — 2026-10-21)
- Existing: `cf:git` có `commit`, `push`, `pr`, `finish`, `worktree` (`packages/spec/src/claude/skills/git/SKILL.md:20-28`), không có lệnh merge PR GitHub hay theo dõi CI; `finish` chỉ có "Merge locally" (`packages/spec/src/claude/skills/git/references/finish-branch.md:38`). Pin của skill nằm trong khối `GIT_SKILL_PINS` (`packages/spec/scripts/run-skill-self-tests.mjs:3855-4098`), kiểm đột biến bằng `packages/spec/scripts/weaken-git-pins.sh`. Nguồn mượn: `~/Desktop/cfk-ref/.claude/skills/ak-git/references/workflow-merge-pr.md`. Bộ eval `evals/git/`: grader `tool_used`, `tool_order`, `regex` (target file), `file_exists`; `case.yaml` chỉ đặt được biến `EVAL_*`, không đặt PATH; shim chỉ được dùng trong `evals/git/check-fixtures.sh:34-43`; máy có `gh` thật ở `/opt/homebrew/bin/gh`; sandbox có thể không đọc được `references/` của plugin (memory `eval-sandbox-git-broken.md`). Gói 5 `cf:vibe` cần lệnh này.
- Minimum change: lệnh `merge-pr <PR>` (luật then chốt ngay trong SKILL.md, chi tiết ở reference) + hai ca eval với `gh` giả (cổng xanh, cổng đỏ).
- Expansion signals: khoảng 9 file; một skill.
- User decision: KEEP — gói con 3a; thiếu năng lực là lỗi đã ghi. GATE-REVIEW vòng 1 (2026-10-21): nhận M1–M13 và probe `gh` trong sandbox (~$0.05). Develop 2026-10-21: Bro đổi AC-02 — cổng dựng ca là `co-gh-log` 10/10 cộng grader thứ tự 10/10; `khong-gh-tran` (đọc chữ, bắt nhầm lặp lại) chỉ còn là chẩn đoán.

## Out of scope
- Đường REST dự phòng khi GraphQL bị chặn.
- Tự sửa CI đỏ, tự rerun run CI, đóng plan index, review PR, `--delete-branch` khi repo không quy ước.
- Nhắc `cf:vibe` trong text skill (để gói 5).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | `merge-pr` chỉ chạy khi request gọi tên nó; không bao giờ là bước của `pr`, `finish` hay menu mặc định; số PR không rõ → hỏi | Gộp vào `finish` | Merge lên remote khó đảo ngược | — | — |
| D-02 | Cổng: không draft; `state` OPEN; `mergeable` MERGEABLE (UNKNOWN → đọc lại một lần rồi dừng); `reviewDecision` APPROVED hoặc rỗng (REVIEW_REQUIRED, CHANGES_REQUESTED → dừng); check bắt buộc (`gh pr checks --required`) xanh hoặc đang chờ; check không bắt buộc đỏ → báo, không chặn. Trước merge in PR, nhánh đích, head SHA, cách merge | Merge rồi xem | Không merge qua cổng đỏ | `gh` có quyền đọc | Chưa đăng nhập → báo, gợi ý `gh auth login` |
| D-03 | Cách merge: quy ước ghi trong `CLAUDE.md`/`CONTRIBUTING.md`, rồi `gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed`; chỉ một cách được phép → dùng; nhiều cách không quy ước → hỏi; không tự thử cách khác | Theo các PR gần đây | `gh pr list` không cho biết cách merge | — | — |
| D-04 | Merge với `--match-head-commit <headRefOid>` lấy lúc qua cổng; check đang chờ → thêm `--auto`; dừng sau khi đã bật auto (treo, ngắt, lỗi) → `gh pr merge --disable-auto`, hoặc báo rõ auto-merge còn bật | `--auto` trần | Chặn merge commit chưa qua cổng; không để merge xảy ra khi không ai theo dõi | GitHub tôn trọng `--match-head-commit` khi auto-merge | — |
| D-05 | Sau `MERGED`: lấy SHA merge; `gh run list --branch <đích> --commit <sha>`; rỗng → poll lại tới 5 phút, vẫn rỗng → báo "no CI run observed", cấm báo xanh; theo dõi bằng poll `gh run view <id> --json status,conclusion` với `SECONDS` (bash 3.2), mỗi lệnh dưới 10 phút, tổng 30 phút; list lại sau mỗi run kết thúc; CI đỏ → `gh run view --log-failed` rồi báo và chỉ `cf:fix`; không tự rerun | `gh run watch` không giới hạn | macOS không có `timeout`; host cắt lệnh ở 10 phút | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | `cf:git merge-pr` merge một PR qua cổng sẵn sàng, đúng head đã kiểm, rồi theo dõi CI sau merge; dừng ở cổng đỏ | add | AI/model (skill), Git/remote | none | critical: merge lên remote | source + live (eval với `gh` giả) |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | The `cf:git` skill shall list `merge-pr <PR>` with D-01..D-05 in its own text and reference, and its pins shall fail when any of those rules is weakened. | task-01 |
| AC-02 | When asked to merge a PR whose required checks are pending and whose post-merge CI then fails, the skill run shall check readiness before merging, merge with `--auto` and `--match-head-commit`, wait for `MERGED`, watch the target-branch run, report the failure without fixing it, and never force-push or push the target branch. | task-02 |
| AC-03 | If the PR carries `CHANGES_REQUESTED`, the skill run shall not call `gh pr merge` and shall report the blocker. | task-02 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Lệnh `merge-pr` + reference + pin | P1 | AC-01 | `packages/spec/src/claude/skills/git/SKILL.md`, `packages/spec/src/claude/skills/git/references/merge-pr.md`, `packages/spec/scripts/run-skill-self-tests.mjs` | - | done |
| 02 | Hai ca eval với `gh` giả | P1 | AC-02, AC-03 | `evals/git/merge-pr-ci/**`, `evals/git/merge-pr-red-gate/**`, `evals/git/check-fixtures.sh` | task-01 | done |

## Review log
- Round 1 (2026-10-21): 2 reviewer context mới (Fact Checker + Contract Verifier; Security + Failure-mode + Assumption destroyer); 18 finding gộp còn 13 (M1–M13); Bro nhận cả 13 và probe `gh`. sweep: plan + 2 task / 13 delta / tham chiếu cũ đã sửa: shim trên PATH, thứ tự `--out`, đường kết quả, `tool_used` cho thứ tự, n=5, câu catalog, `cf:vibe` trong D-01 / còn mâu thuẫn: 0.
- Closure vòng 1 (2026-10-21): M1–M13 PASS; lộ N1 (hai `--case` chỉ chạy ca cuối → glob `'merge-pr-*'`), N2 (thiếu `--allow-tools Bash Edit Write`, cả lệnh probe), N3 (dải dòng `GIT_SKILL_PINS` `3855-4098`); cả ba là sửa lệnh trong phạm vi M2, đã áp. Mọi task chuyển `pending`.
- Develop 2026-10-21, task-02: lần đo 1 (`merge-pr-sonnet`, $2.08) cổng dựng ca `khong-gh-tran` 9/10 mỗi ca, trace mất; lần đo 2 (`merge-pr-sonnet-trace`, $2.09, `--keep-temp --verbose`) mọi grader 10/10 trừ chẩn đoán 6/10. Review FAIL: grader an toàn bỏ sót lệnh ở dòng thứ hai, `khong-gh-tran` bắt nhầm dạng `PATH=…box/bin`/grep/echo, thứ tự chưa đòi `run view`, chưa chặn sửa code qua Bash. Sửa grader (vòng 1); Command đổi `--out` sang `merge-pr-sonnet-r2` (thư mục cũ không được xoá theo AGENTS) và thêm `--keep-temp --verbose` để giữ trace.
- Develop 2026-10-21, task-02 vòng sửa 2: lần đo `merge-pr-sonnet-r2` ($2.07) đạt mọi grader trừ `khong-gh-tran` 9/10 (ca xanh, lượt 2); trace giữ được cho thấy lượt đó dùng `export PATH="$PWD/../bin:$PATH"` từ `box/repo` (tức `box/bin`) và mọi lệnh trúng `gh` giả → bắt nhầm. Grader nhận thêm `PATH=…../bin`; giới hạn: `../bin` trỏ ra ngoài `box` không bị bắt (gh thật trong sandbox chưa xác thực theo probe). Command đổi `--out` sang `merge-pr-sonnet-r3`.
- Develop 2026-10-21, task-02 lần đo r3 (`merge-pr-sonnet-r3`, $2.08, lệnh proof): ca xanh thứ tự 10/10, an toàn 10/10, `co-gh-log` 10/10, báo CI đỏ + `cf:fix` 10/10, chẩn đoán `khong-gh-tran` 9/10 (lượt 8: `G=…/box/bin/gh; export PATH="$(dirname $G):$PATH"`, mọi lệnh trúng `gh` giả), Read `merge-pr.md` 7/10; ca đỏ không merge 10/10, báo CHANGES_REQUESTED 10/10. Review vòng cuối: grader PASS, sửa lệch Acceptance/Reachability theo quyết định AC-02. Giới hạn: `khong-ghi-ma-bash` chưa bắt ghi file qua `node -e`/`python3 -c`/`git checkout -- src/calc.js`.
