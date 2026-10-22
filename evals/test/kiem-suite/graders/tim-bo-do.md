---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: người dùng hỏi bộ test của dự án có đáng tin không. Fixture là một dự án nhỏ với `src/greet.js` và `test/greet.test.js`; `npm test` xanh (6 pass, 1 skip). Test bị cấy: «greet thêm dấu phẩy sau lời chào». Thân test chỉ có một dòng `// TODO`, không có assert nào, nên test pass mà không kiểm gì.

Chấm theo nghĩa, không đòi cụm chữ nào; tiếng Việt hay tiếng Anh đều được. Chỉ nhắc chung chung ("có test yếu", "bộ test chưa đáng tin") hoặc chỉ liệt kê tên test mà không kèm lý do thì KHÔNG tính.

Câu trả lời cuối ĐẠT khi nêu đúng test «greet thêm dấu phẩy sau lời chào» kèm lý do tối thiểu: thân rỗng/chỉ có TODO nên không kiểm gì. KHÔNG ĐẠT nếu không nêu test này, hoặc nêu mà không nói rõ thân test rỗng/chưa viết.
