---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: người dùng hỏi bộ test của dự án có đáng tin không. Fixture là một dự án nhỏ với `src/greet.js` và `test/greet.test.js`; `npm test` xanh (6 pass, 1 skip). Lỗi bị cấy: file `.github/workflows/test.yml` chạy `npm test || true`, nên bước test không bao giờ làm CI đỏ dù test hỏng.

Chấm theo nghĩa, không đòi cụm chữ nào; tiếng Việt hay tiếng Anh đều được. Chỉ nhắc chung chung ("có test yếu", "bộ test chưa đáng tin") hoặc chỉ liệt kê tên test mà không kèm lý do thì KHÔNG tính.

Câu trả lời cuối ĐẠT khi nêu `.github/workflows/test.yml` (hoặc bước chạy test trong CI) kèm lý do tối thiểu: `|| true` làm CI không bao giờ đỏ, che lỗi test. KHÔNG ĐẠT nếu không nhắc tới workflow CI, hoặc nhắc mà không nói `|| true` che lỗi.
