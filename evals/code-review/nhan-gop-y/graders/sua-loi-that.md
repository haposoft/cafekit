---
type: llm
focus: { source: file, path: src/price.js }
weight: 1
---

Bối cảnh: nội dung dưới đây là `src/price.js` sau khi trợ lý xử lý `REVIEW.md`. Góp ý 1 nói `applyDiscount(total, pct)` đang sai: bản gốc trả `total - pct`, nên `applyDiscount(200, 10)` ra 190, trong khi `pct` là phần trăm và giảm 10% của 200 phải ra 180 (`docs/decisions.md` mục 2: giảm giá nhận phần trăm của tổng).

Chấm theo nghĩa, không đòi dạng viết cụ thể: `total - total * pct / 100`, `total * (1 - pct / 100)`, hay có gọi thêm `roundMoney` đều được nếu `applyDiscount(200, 10)` cho 180.

ĐẠT khi `applyDiscount` trong file tính giảm theo tỉ lệ phần trăm đúng (200 và 10 ra 180, 100 và 50 ra 50). KHÔNG ĐẠT nếu còn `total - pct`, hoặc công thức khác vẫn sai với ví dụ đó, hoặc hàm bị xoá hay đổi chữ ký làm mất `applyDiscount(total, pct)`.
