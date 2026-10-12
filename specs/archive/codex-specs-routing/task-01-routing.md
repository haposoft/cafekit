# Task 01 — Đo lại 6 ca định tuyến specs

Status: done

## Outcome
6 ca định tuyến specs có 10 lượt mới (bản chiếu hiện tại) và 5 lượt đối chứng không ghi chú mỗi ca; bộ kiểm tái hiện mọi số ghim của lượt cũ, đo kết quả, gác cổng, plan thừa, đọc skill và `tra-loi-thang` ở ba nhánh; báo cáo nói từng ca ghi chú có gây hồi quy định tuyến không.

## Scope
- In:
  - `evals/codex/manifest.json`: thêm `develop` vào `loadedSkills` của `specs/develop-auth` (D-04 của `plan.md`), không đổi gì khác; `node evals/codex/check-rooms.mjs` exit 0 sau khi sửa (bản chụp trước: `~/Desktop/cafekit-codex-eval/check-rooms-before-routing.txt`; chỉ được khác ở dòng liên quan develop-auth, nêu trong báo cáo).
  - Chạy 6 ca × 10 lượt mới bằng `node evals/codex/run.mjs --run --only specs/<ca> --out ~/Desktop/cafekit-codex-eval/specs-routing/<ca>/<n>` (home sạch, không `--user-home`).
  - Đối chứng: `git worktree add <tmp> 7304cdd1`, chép manifest đã sửa vào worktree (để develop-auth có `cf-develop`), chạy 6 ca × 5 lượt từ worktree đó vào `~/Desktop/cafekit-codex-eval/specs-routing-control/<ca>/<n>`; xoá worktree sau khi chạy.
  - Lượt lỗi: đổi tên `<n>` → `<n>.attempt-k`, chạy lại vào `<n>` trống; trần 100 lần gọi gồm cả hai nhánh và attempt.
  - Giám khảo: sửa tối thiểu `llm-judge-prompt.mjs` (`loadDataset`), `llm-judge.mjs`, `llm-judge-check.mjs` để thêm nhóm `routing` (lượt mới) và `routing-control` (đối chứng) cho `tra-loi-thang` của `sua-typo`, `khong-kich-hoat`; không gán vào nhóm `new`; prompt, cờ, hash, hiệu chuẩn giữ nguyên; sau khi chạy giám khảo, output `llm-judge-check.mjs` giống hệt bản chụp trước khi sửa trừ các dòng nhóm mới và dòng `cost:`.
  - `evals/codex/routing-check.mjs [--log-root <dir>] [--control-root <dir>] [--old-root <dir>]` (mặc định `specs-routing`, `specs-routing-control`, `batch-all/specs` dưới `~/Desktop/cafekit-codex-eval`):
    - điều kiện lượt mới và đối chứng như `remeasure-check.mjs` (status `completed`, home sạch, `C-clean-home-5d`, model/effort, capture `valid`, prompt đúng ca; attempt hợp lệ → lỗi); liệt kê lượt bị loại; thiếu → `<arm> <ca>: runs k/n`, exit 1;
    - `self-check`: đo nhánh `old` và đòi khớp mọi số ghim ở mục Self-check của `plan.md`; lệch → `self-check: FAIL <ca> <chỉ số> <đo> != <ghim>`, exit 1;
    - mỗi ca × nhánh một dòng `<ca> <arm>: <done|unchanged|stopped-wrong> k/n; overgate-final k/n; overgate-any k/n; asked-stopped k/n; extra-artifacts k/n; skill-read k/n; note-loaded k/n; overgate-in-read k/m` theo D-01, D-02, D-04 (`old` của `develop-auth` in `invalid (no cf-develop)` sau phần số);
    - `<ca> <arm>: tra-loi-thang k/n (judge, uncalibrated)` cho hai ca chỉ trả lời, từ cache; thiếu → exit 1;
    - áp D-03/D-04, in `regression: <ca>…` hoặc `regression: none`, `watch: <ca>…` hoặc `watch: none`, `calls: c/100`, `verdict: MEASURED`; exit 0.
  - Báo cáo `evals/codex/report-specs-routing.md`: bảng ba nhánh theo ca, luật đã áp, `develop-auth` (sửa manifest, so Claude chỉ tham khảo), trích ngắn 1 lượt cho mỗi ca hồi quy hoặc theo dõi, giới hạn (nhánh old khác runner và home, giám khảo uncalibrated cho thước specs, n=10/5, CLI).
- Out: sửa skill/bản chiếu/thước khác; ca khác; đo Claude.

## Coverage
- CP-01

## Ownership
- Create: `evals/codex/routing-check.mjs`, `evals/codex/report-specs-routing.md`
- Modify: `evals/codex/manifest.json` (một mục `loadedSkills`), `evals/codex/llm-judge-prompt.mjs`, `evals/codex/llm-judge.mjs`, `evals/codex/llm-judge-check.mjs` (chỉ thêm nhóm)
- Read: `evals/codex/run.mjs`, `evals/codex/room.mjs`, `evals/codex/check-rooms.mjs`, `evals/codex/grade.mjs`, `evals/codex/remeasure-check.mjs`, `evals/codex/specs-check.mjs`, `evals/lean/compare.mjs`, `evals/specs/*/case.yaml`, `evals/specs/*/fixture/`, `packages/spec/bin/lib/codex-install.js`

## Steps
1. Chụp output `llm-judge-check.mjs`; sửa manifest, `check-rooms.mjs` exit 0; thêm nhóm giám khảo; viết `routing-check.mjs`; chạy với `--log-root` và `--control-root` rỗng → `self-check: PASS` rồi exit 1 vì thiếu lượt.
2. Chạy 60 lượt mới; chạy 30 lượt đối chứng từ worktree, xoá worktree.
3. Chạy `llm-judge.mjs --run --only routing` và `--only routing-control`; so output giám khảo với bản chụp.
4. Chạy lệnh kiểm; viết báo cáo.
5. Commit đúng các file task bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, không push).

## Acceptance
- AC-01: `self-check: PASS`; đủ dòng ba nhánh × 6 ca; bốn dòng `tra-loi-thang` mới và đối chứng (cũ in từ cache); `regression:`; `watch:`; `verdict: MEASURED`; `check-rooms.mjs` exit 0; output giám khảo nhóm cũ giống bản chụp; phiên Claude tự đọc `workspace` của 3 lượt mới bất kỳ và tin cuối của 3 lượt, khớp số in ra.

## Dependencies
- none

## Verification Plan
- Command: `node evals/codex/routing-check.mjs`
- Named probe: `self-check: PASS`; dòng `<ca> new:`, `<ca> control:`, `<ca> old:`; `tra-loi-thang`; `regression:`; `watch:`; `calls:`; `verdict: MEASURED`.
- Reachability: nhật ký ở `~/Desktop/cafekit-codex-eval/specs-routing*/`; chạy model cần pane Codex không sandbox; giám khảo cần đăng nhập Claude.
- Oracle: exit 0, `self-check: PASS`, `verdict: MEASURED`.
- Counterexample: `--old-root` trỏ bản chép lượt cũ có `workspace/README.md` của `sua-nho-lam-luon/1` đổi ngược `nội bộ` → `nôi bộ` → `self-check: FAIL sua-nho-lam-luon done 9 != 10`, exit 1; `--log-root` thiếu một lượt → `new <ca>: runs 9/10`, exit 1.
- Artifacts: `evals/codex/report-specs-routing.md` (commit); nhật ký giữ ngoài repo.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/routing-check.mjs
Exit: 0
Base: 6a53fd60563158adbd12c393fca87c4903396c76
Head: d0f00f4d3376cd9048d68234ecdaedb8085fa416ed69ae61b385223d34b3fe27
```text
self-check: PASS
sua-typo new: unchanged 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10
sua-typo new: tra-loi-thang 10/10 (judge, uncalibrated)
khong-kich-hoat new: unchanged 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10
khong-kich-hoat new: tra-loi-thang 10/10 (judge, uncalibrated)
lam-thang-doi-ten new: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 6/10; note-loaded 6/10
lam-thang-xoa-module new: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 1/10; note-loaded 1/10
sua-nho-lam-luon new: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10
develop-auth new: stopped-wrong 0/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10
sua-typo control: unchanged 5/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 0/5; note-loaded 0/5
sua-typo control: tra-loi-thang 5/5 (judge, uncalibrated)
khong-kich-hoat control: unchanged 5/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 0/5; note-loaded 0/5
khong-kich-hoat control: tra-loi-thang 5/5 (judge, uncalibrated)
lam-thang-doi-ten control: done 5/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 0/5; note-loaded 0/5
lam-thang-xoa-module control: done 5/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 2/5; note-loaded 0/5
sua-nho-lam-luon control: done 5/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 0/5; note-loaded 0/5
develop-auth control: stopped-wrong 0/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 0/5; note-loaded 0/5
sua-typo old: unchanged 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10
sua-typo old: tra-loi-thang 10/10 (judge, uncalibrated)
khong-kich-hoat old: unchanged 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10
khong-kich-hoat old: tra-loi-thang 10/10 (judge, uncalibrated)
lam-thang-doi-ten old: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 4/10; skill-read 3/10; note-loaded 0/10
lam-thang-xoa-module old: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 4/10; skill-read 1/10; note-loaded 0/10
sua-nho-lam-luon old: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10
develop-auth old: stopped-wrong 8/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 4/10; note-loaded 0/10; invalid (no cf-develop)
regression: none
watch: lam-thang-doi-ten skill-read 6/10 vs control 0/5; delta 6/10
cli_version: 0.162.1
calls: 90/100
verdict: MEASURED
```

Kiểm độc lập (phiên Claude): counterexample 1 (đổi ngược README `sua-nho-lam-luon/1` trên bản chép lượt cũ) → `self-check: FAIL sua-nho-lam-luon done 9 != 10`, exit 1; counterexample 2 (bản chép lượt mới thiếu `sua-typo/10`) → `new sua-typo: runs 9/10`, exit 1; `check-rooms.mjs` exit 0; diff manifest chỉ thêm `develop` vào develop-auth; đọc tay `lam-thang-doi-ten/4` (src+test có formatCustomerName, không còn fmtName), `lam-thang-xoa-module/7` (module và test đã gỡ), `sua-nho-lam-luon/2` (không còn 'nôi bộ'), `develop-auth/3` (sửa src và task, kết thúc bằng câu hỏi GATE-DONE), `sua-typo/5` — khớp số in ra. Theo dõi (không phải hồi quy): `lam-thang-doi-ten` skill-read 6/10 so với đối chứng 0/5, không lượt nào gác cổng hay tạo plan.
