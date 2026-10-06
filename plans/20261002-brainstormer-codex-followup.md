# Ghi chú: phần Codex còn lại của brainstormer (để sau)

Ngày: 2026-10-02. Nguồn: hai gói đã đóng là `specs/brainstorm-repair/` và `specs/brainstorm-followup/` (6 commit trên `dev`, chưa push). Ghi chú này chưa phải kế hoạch: muốn làm thì mở `/cf:specs`.

## 1. Câu entry gate của agent mới liệt kê 3 route, còn skill có 4

- Câu trong agent ở `packages/spec/src/claude/agents/brainstormer.md:25-27`: "If the controller has not identified whether the work is feature delivery, an explicitly authorized fix, or non-bug exploration, request that routing context instead of guessing."
- Phía skill có 4 route, thêm `diagnosis-only bug work` (`packages/spec/src/claude/skills/brainstorm/SKILL.md:156-157`). Câu mô tả mới của agent (`brainstormer.md:8`) cũng đã có đủ 4 route.
- Hệ quả khi controller báo route "diagnosis-only bug work": agent không thấy route này trong danh sách của mình, có thể hỏi lại routing context, mất thêm một lượt. Về an toàn thì vẫn ổn, vì hard gate của agent vẫn đòi root cause có bằng chứng.
- Vì sao chưa sửa: câu này bị test Codex ghim nguyên văn, mà file test nằm ngoài phạm vi task 02 của gói repair (ghi ở Known limits trong `specs/brainstorm-repair/plan.md`).
  - `packages/spec/bin/__tests__/codex-native.test.js:874`: check `specialist-routing` đòi đúng chuỗi một dòng (bản Codex đã gộp xuống dòng).
  - `packages/spec/bin/__tests__/codex-native.test.js:2529`: mutation `specialist-routing-context-removed`, với `from:` là đúng chuỗi ba dòng như đang ngắt trong nguồn.
- Cách sửa nhỏ nhất:
  1. Sửa câu trong `brainstormer.md` thành "feature delivery, an explicitly authorized fix, diagnosis-only bug work, or non-bug exploration". Giữ dấu phẩy, vì scan fix-dispatch chỉ quét SKILL.md.
  2. Sửa chuỗi ở `codex-native.test.js:874` cho khớp câu mới.
  3. Sửa `from:` ở `codex-native.test.js:2529` cho khớp đúng cách ngắt dòng mới trong nguồn. Nếu không khớp, mutation sẽ ném lỗi vì không tìm thấy chuỗi.
  4. Chạy `cd packages/spec && node --test bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js` (đòi `# fail 0`) và `node scripts/run-skill-self-tests.mjs`.
- Lần thử trước: mình đã sửa riêng `brainstormer.md` thì package tests ra `fail=1`, phải hoàn lại. Lần sau phải sửa cả câu nguồn và hai chỗ ghim trong cùng một thay đổi.

## 2. Bản Codex nhận mọi thay đổi nhưng chưa được đo

- Bản Codex của agent được sinh từ cùng nguồn: `convertCodexAgentContent` ở `packages/spec/bin/lib/codex-install.js:307-320` lấy `description` và thân từ `brainstormer.md`. Vì vậy câu "Tell it which route applies; …", dòng `Relay:` và nhãn tiếng Anh đều sang Codex.
- Bộ đo `evals/brainstorm` chỉ chạy Claude Code (`claude` 2.1.286). Chưa có lượt nào trên Codex.
- Muốn đo thì cần một harness Codex tương đương. Chưa ước được chi phí.

## Liên quan

- Điểm lệch giữa gọi đích danh `brainstormer` và `--advice` (`SKILL.md:155-165`) đã ghi ở Known limits của gói repair, không thuộc Codex.
