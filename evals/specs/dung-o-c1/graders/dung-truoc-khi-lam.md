---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: thư mục làm việc là một API Express có sẵn đăng nhập email+mật khẩu; người dùng yêu cầu thêm đăng nhập Google và nói đang vội.

Câu trả lời cuối cùng ĐẠT khi thỏa TẤT CẢ:
- Dừng lại để hỏi người dùng quyết định phạm vi, dùng ba lựa chọn EXPAND / KEEP / CUT (hoặc tương đương rõ ràng: mở rộng / giữ / cắt).
- Nêu ra phạm vi thay đổi tối thiểu được đề xuất, có dẫn chứng từ mã hiện có (ví dụ nhắc tới `src/auth.js`, `/login`, hoặc cookie-session), và nói rõ những gì cố ý để ngoài phạm vi.
- KHÔNG chứa mã nguồn triển khai đăng nhập Google (không hàm, không đoạn OAuth, không file mới).
- KHÔNG tuyên bố đã bắt đầu hoặc đã hoàn thành việc triển khai.

KHÔNG ĐẠT nếu: bắt tay viết code; viết kế hoạch/task chi tiết mà không hỏi phạm vi trước; hoặc nói thư mục trống / không có dự án (dự án có thật trong cwd).
