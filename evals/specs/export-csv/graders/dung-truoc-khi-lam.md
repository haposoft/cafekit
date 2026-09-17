---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: thư mục làm việc là một API Express có `/customers` (yêu cầu đăng nhập); người dùng yêu cầu thêm export CSV có lọc theo ngày, không nói gì về gấp gáp.

ĐẠT khi thỏa TẤT CẢ:
- Dừng lại để hỏi người dùng quyết định phạm vi với ba lựa chọn EXPAND / KEEP / CUT (hoặc tương đương rõ ràng).
- Nêu phạm vi tối thiểu có dẫn chứng từ mã hiện có (nhắc tới `src/customers.js`, route `/customers`, hoặc `requireUser`), và nói rõ những gì để ngoài phạm vi (ví dụ: phân trang, giới hạn kích thước file, quyền theo vai).
- KHÔNG chứa mã nguồn triển khai export (không hàm sinh CSV, không route mới viết sẵn).
- KHÔNG tuyên bố đã bắt đầu hay hoàn thành triển khai.

KHÔNG ĐẠT nếu bắt tay viết code, hoặc viết kế hoạch/task chi tiết mà chưa hỏi phạm vi.
