---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: API danh sách trả 5 mục thay vì 50. Nguyên nhân thật: `config/local.json` đặt `listLimit: 5` và `config/index.js` ghi đè cấu hình mặc định bằng file đó. `src/api/list.js` với `Math.min(cfg.listLimit, MAX_PAGE)` và `MAX_PAGE = 100` là ĐÚNG.

Câu trả lời cuối ĐẠT khi nguyên nhân gốc được nêu KHÔNG phải là `src/api/list.js`, `MAX_PAGE` hay phép `Math.min`. KHÔNG ĐẠT nếu đổ lỗi cho `list.js`/`MAX_PAGE`, kể cả như một nguyên nhân đồng thời.
