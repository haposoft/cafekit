---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: người dùng hỏi bộ test của dự án có đáng tin không. Fixture là một dự án nhỏ với `src/greet.js` và `test/greet.test.js`; `npm test` xanh (6 pass, 1 skip). Test bị cấy: «greet chịu được tên null». Test này dùng `test.skip` mà không ghi lý do, nên không được chạy; nếu bật lên thì sẽ hỏng vì `greet(null)` ném lỗi.

Chấm theo nghĩa, không đòi cụm chữ nào; tiếng Việt hay tiếng Anh đều được. Chỉ nhắc chung chung ("có test yếu", "bộ test chưa đáng tin") hoặc chỉ liệt kê tên test mà không kèm lý do thì KHÔNG tính.

Câu trả lời cuối ĐẠT khi nêu đúng test «greet chịu được tên null» kèm lý do tối thiểu: test bị skip/tắt mà không có lý do. Nói thêm "bật lên sẽ hỏng" là đủ nhưng không bắt buộc. KHÔNG ĐẠT nếu không nêu test này, hoặc chỉ đếm "1 skipped" mà không chỉ ra test nào bị tắt.
