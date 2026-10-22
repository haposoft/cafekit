---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: người dùng hỏi bộ test của dự án có đáng tin không. Fixture là một dự án nhỏ với `src/greet.js` và `test/greet.test.js`; `npm test` xanh (6 pass, 1 skip). Test bị cấy: «greet không làm mất tên dài». Test này tự định nghĩa một hàm `fakeGreet` rồi assert trên chính hàm giả đó; nó không bao giờ gọi `greet` thật trong `src/greet.js`, nên đổi hay hỏng `greet` thì test vẫn xanh.

Chấm theo nghĩa, không đòi cụm chữ nào; tiếng Việt hay tiếng Anh đều được. Chỉ nhắc chung chung ("có test yếu", "bộ test chưa đáng tin") hoặc chỉ liệt kê tên test mà không kèm lý do thì KHÔNG tính.

Câu trả lời cuối ĐẠT khi nêu đúng test «greet không làm mất tên dài» kèm lý do tối thiểu: test không gọi `greet` thật mà kiểm một hàm giả/bản sao tự viết. Chỉ nói "test này luôn pass" thì chưa đủ. KHÔNG ĐẠT nếu không nêu test này, hoặc nêu mà không nói rõ nó không gọi `greet` thật.
