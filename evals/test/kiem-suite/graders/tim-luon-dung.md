---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: người dùng hỏi bộ test của dự án có đáng tin không. Fixture là một dự án nhỏ với `src/greet.js` và `test/greet.test.js`; `npm test` xanh (6 pass, 1 skip). Test bị cấy: «greet giữ nguyên tên có dấu tiếng Việt». Test này gọi `greet(...)` rồi chỉ chạy `assert.ok(true)`, nên assert không phụ thuộc kết quả của `greet`: test chỉ hỏng khi `greet` ném lỗi, còn trả sai thì vẫn xanh.

Chấm theo nghĩa, không đòi cụm chữ nào; tiếng Việt hay tiếng Anh đều được. Chỉ nhắc chung chung ("có test yếu", "bộ test chưa đáng tin") hoặc chỉ liệt kê tên test mà không kèm lý do thì KHÔNG tính.

Câu trả lời cuối ĐẠT khi nêu đúng test «greet giữ nguyên tên có dấu tiếng Việt» kèm lý do tối thiểu: assert luôn đúng, không kiểm kết quả của `greet`. KHÔNG ĐẠT nếu không nêu test này, hoặc nêu mà không có lý do đó.
