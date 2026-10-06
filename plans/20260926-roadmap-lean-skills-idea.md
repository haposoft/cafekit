---
title: "Ý tưởng roadmap: skill gọn cho model mạnh — \"làm hướng nào\" thay vì \"làm như thế nào\""
description: "Ghi chú tạm để lập roadmap sau: tinh gọn skill CafeKit về mục tiêu, ràng buộc, tiêu chuẩn đầu ra, và đo bằng eval trước/sau."
status: idea
priority: P2
branch: dev
created: 2026-09-26
source: "bài chia sẻ + ảnh minh họa user gửi ngày 26/09/2026; số liệu từ specs/fix-eval-baseline (e93060b)"
---

# Ý tưởng roadmap: skill gọn cho model mạnh

> Ghi chú tạm, chưa phải kế hoạch. Khi lập roadmap, dùng file này làm đầu vào cho `/cf:specs`; mọi con số dưới đây là số đo đã có, không phải mục tiêu.

## Nguồn ý tưởng

**Bài chia sẻ (tóm tắt):** từ khi Opus 5.5 ra mắt, tác giả rà lại và tinh gọn (thậm chí xoá bớt) pipeline và skill hằng ngày; ví dụ bộ `episode-director` (video giải thích kỹ thuật) phải refactor mạnh vì khung pipeline giới hạn chất lượng đầu ra và làm tốn token vô ích. Model mạnh lên thì chuyển từ chỉ "làm như thế nào" sang "làm hướng nào": nói rõ mục tiêu, ràng buộc, tiêu chuẩn đầu ra, để agent có không gian tạo kết quả tốt hơn. Tác giả tự nêu ngoại lệ: skill nhiều dư địa sáng tạo thì hợp, còn skill làm hệ thống logic chuẩn thì không nên làm vậy. Tác giả cũng thử cho agent tự lắp ghép hoặc tự tạo skill khi cần — dùng một lần thì bỏ, đã kiểm chứng thì giữ — và dùng agent rất đơn giản.

**Ảnh minh họa:** hai khung vẽ chì. Trái "LÀM NHƯ THẾ NÀO": giàn giáo dày đặc treo kín checklist, sơ đồ, code, danh sách 1-2-3 nối bằng mũi tên, người ngồi bàn vẽ bị bao kín. Phải "LÀM HƯỚNG NÀO": chỉ còn khung cổng với ba biển MỤC TIÊU, RÀNG BUỘC, TIÊU CHUẨN ĐẦU RA; người ngồi thoải mái, một bàn tay vẽ tiếp dải phim có hình 3D, đồ thị, sơ đồ dữ liệu; xấp checklist rơi ra giữa hai khung.

## Bằng chứng CafeKit đã có

| Nguồn | Số đo | Gợi ý |
|---|---|---|
| `specs/fix-eval-baseline` (26/09) | skill `fix` dặn gọi `cf:debug`/`cf:scout`: 0/80 lượt gọi; `✓ Step` hiếm; vẫn sửa đúng ~78–80/80, không commit/spawn/đọc đáp án 80/80 | phần lớn chữ "cách làm" không được làm theo mà kết quả vẫn tốt |
| cùng gói | đỏ-trước-khi-sửa thấp ở sonnet: red-truoc 1/10, cham-hop-dong 3/10; trong skill, bước này nằm ở Step 4–5, sau khi sửa (`fix/SKILL.md:213`, `:231`) | chỗ yếu là **tiêu chuẩn đầu ra**, không phải thiếu bước |
| `specs/debug-proportional` (25/09) | nêu "độ dài báo cáo theo Depth" → báo cáo gọn 1→9, 2→8 | một tiêu chuẩn đổi được hành vi |
| `specs/skill-routing` (21/09) | sửa 1 dòng description → sonnet hết bỏ cửa (p=0.0004), opus không đổi | điểm gọi skill đáng đầu tư hơn thân skill |
| completion gate (26/09) | gate bắt lỗi `artifact_hash` mà cả người viết lẫn reviewer bỏ sót | ràng buộc nên do máy thi hành (hook, receipt), không phải thêm chữ |

## Hướng đề xuất

- **Giữ:** description/điều kiện gọi skill; ràng buộc an toàn (không commit khi chưa hỏi, không spawn khi chưa được phép, gate chỉ-chẩn-đoán, không sửa test cho xanh); tiêu chuẩn đầu ra (bằng chứng đỏ/xanh, nguyên nhân kèm `file:dòng`, báo cáo vừa mức); hook và receipt.
- **Cắt:** quy trình từng bước, sơ đồ mermaid, dấu `✓ Step`, lời dặn chuyển sang skill khác mà model không theo, đoạn lặp ý. Phần "cách làm" còn giá trị thì chuyển vào `references/` để đọc khi cần.
- **Không làm cho sản phẩm (tạm thời):** skill tự sinh lúc chạy — khó tái lập và khó đo khi phát hành cho người khác.

## Thử nghiệm đầu tiên: `fix` gọn

1. Viết lại `packages/spec/src/claude/skills/fix/SKILL.md` (290 dòng, cộng 6 file `references/` 574 dòng) thành khoảng 50–70 dòng: mục tiêu, ràng buộc, tiêu chuẩn đầu ra; nâng "test đỏ trước trên code gốc" từ một bước thành tiêu chuẩn nộp bài.
2. Chạy lại đúng 4 ca `evals/fix/` (10 lượt × sonnet + opus, ~17$), cùng thước (digest `760dc05e…`), cùng `claude` 2.1.281 nếu còn, và **ghim `node --version`** (bài học node đổi giữa lúc đo).
3. So từng ô với `evals/results/fix/base-*`: bản gọn thắng khi đỏ-trước tăng mà sửa đúng và các ràng buộc (không commit, không spawn) giữ nguyên.

## Câu hỏi mở / rủi ro

- Model yếu hơn và host khác (Codex, Grok, omp) có thể vẫn cần phần "cách làm"; sonnet hưởng lợi từ description còn opus thì không — chưa đo.
- Skill nào thuộc "hệ thống logic chuẩn" theo ngoại lệ của bài viết (specs, develop, sync, gate) thì giữ chặt, chỉ gọn phần chữ, không bỏ ràng buộc.
- Thứ tự áp dụng sau `fix` (debug? develop? specs?) — quyết khi lập roadmap.
- Các self-test ghim nguyên văn câu chữ skill (`packages/spec/scripts/run-skill-self-tests.mjs`) sẽ phải đổi theo; tính vào phạm vi.

## Bước tiếp theo khi lập roadmap

Mở `/cf:specs` cho thử nghiệm `fix` gọn (GATE-SCOPE: mức gọn, phần nào giữ trong `references/`, có đo thêm host khác không), dùng `specs/fix-eval-baseline` làm số gốc.
