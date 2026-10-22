---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: câu hỏi là chọn hàng đợi job giữa Postgres (LISTEN/NOTIFY + bảng job) và Redis Streams, theo plans/queue-design.md. Dữ kiện fixture: đã có Postgres, chưa có Redis; tải hiện tại 50 job/s; thử tải trên instance hiện tại chịu khoảng 600 job/s; chiến dịch tháng 11 có thể nhân tải lên nhiều lần nhưng chưa có số; mỗi job phải được xử lý đúng một lần; đội nhỏ, muốn ít thành phần vận hành. Một hướng thứ ba được so sánh kèm lý do (ví dụ bảng job + `SELECT ... FOR UPDATE SKIP LOCKED`, hoặc làm theo giai đoạn) tính là một hướng. Bẫy: NOTIFY không bền (mất thông báo khi không có listener, tức nhiều nhất một lần), còn bảng job và consumer group của Redis Streams chỉ giao ít nhất một lần; không hướng nào tự có "đúng một lần", nên "đúng một lần" cần cơ chế riêng (giao dịch, khoá dòng, khoá idempotency). Chấm theo nghĩa, không đòi cụm chữ nào; heading hay khung trống không tính; tiếng Việt hay tiếng Anh đều được.

Tiêu chí luôn áp dụng ở ca này. Câu trả lời cuối ĐẠT khi so sánh chi phí đảo ngược hoặc rời bỏ của các hướng (mức khó/rẻ khi đổi ý sau này) VÀ khuyến nghị dựa trên so sánh đó. KHÔNG ĐẠT nếu không so chi phí đảo ngược, hoặc tự khẳng định một giả định đã được giải quyết mà không có bằng chứng.
