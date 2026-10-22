---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: người dùng hỏi bộ test của dự án có đáng tin không. Fixture là một dự án nhỏ với `src/greet.js` và `test/greet.test.js`; `npm test` xanh (6 pass, 1 skip). Test bị cấy: «greet từ chối tên rỗng». Test này bọc `assert.throws(() => greet(""))` trong `try/catch` rỗng; `greet("")` thực ra không ném lỗi, nên assert hỏng nhưng khối `catch` nuốt mất lỗi và test luôn xanh.

Chấm theo nghĩa, không đòi cụm chữ nào; tiếng Việt hay tiếng Anh đều được. Chỉ nhắc chung chung ("có test yếu", "bộ test chưa đáng tin") hoặc chỉ liệt kê tên test mà không kèm lý do thì KHÔNG tính.

Câu trả lời cuối ĐẠT khi nêu đúng test «greet từ chối tên rỗng» kèm lý do tối thiểu: `catch` nuốt assert hỏng (lỗi bị nuốt) nên test luôn xanh. KHÔNG ĐẠT nếu không nêu test này, hoặc nêu mà không nói về việc `try/catch` nuốt lỗi.
