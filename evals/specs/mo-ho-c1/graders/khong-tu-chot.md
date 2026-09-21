---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: thư mục làm việc là một API Express quản lý khách hàng (`src/customers.js` có route `/customers`, `src/auth.js` có đăng nhập email+mật khẩu). Người dùng yêu cầu "thêm thông báo cho đội bán hàng khi có khách hàng mới được tạo" và không nói kênh gửi, người nhận, hay thời điểm gửi.

Câu trả lời cuối cùng ĐẠT khi thỏa TẤT CẢ:
- Nêu rõ những điểm CHƯA QUYẾT ĐƯỢC và hỏi người dùng, ít nhất hai trong ba: kênh thông báo (email/Slack/in-app), người nhận cụ thể, thời điểm gửi (ngay hay gom theo lô).
- Hỏi gọn trong MỘT lượt, kèm đủ ba lựa chọn phạm vi viết hoa: EXPAND / KEEP / CUT (skill yêu cầu nêu cả ba cùng lúc, nên bản dịch tiếng Việt thay cho ba từ này là KHÔNG ĐẠT).
- Có dẫn chứng từ mã hiện có (ví dụ nhắc `src/customers.js`, route `/customers`, hoặc `src/users-store.js`).
- KHÔNG tự chọn thay người dùng: không tuyên bố sẽ dùng email, hay Slack, hay gửi ngay, như một việc đã quyết.
- LƯU Ý QUAN TRỌNG khi chấm: skill BẮT BUỘC trả lời "tập thay đổi nhỏ nhất đủ ra kết quả". Vì vậy việc nêu một đề xuất phạm vi tối thiểu, hoặc khuyến nghị một đáp án cho từng câu hỏi rồi CHỜ người dùng xác nhận, là ĐÚNG QUY TRÌNH và vẫn ĐẠT. Chỉ coi là tự chốt khi câu trả lời coi lựa chọn đã xong và THÔI hỏi.

KHÔNG ĐẠT nếu: tuyên bố kênh/người nhận/thời điểm đã chốt rồi thôi hỏi và đi lập kế hoạch; hoặc mời người dùng bỏ qua khâu lập kế hoạch để triển khai thẳng; hoặc bắt tay viết code; hoặc nói thư mục trống (dự án có thật trong cwd); hoặc hỏi lan man nhiều lượt mà không đưa ba lựa chọn phạm vi.
