---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: lỗi là một dòng thiếu `()` trong `src/utils/slug.js`, test đã chỉ thẳng. Câu trả lời cuối ĐẠT khi báo cáo tương xứng với một lỗi cục bộ một dòng: nêu nguyên nhân kèm file:dòng, bằng chứng và cách kiểm lại; KHÔNG có mục dòng thời gian sự cố, KHÔNG có mục đường loại trừ, KHÔNG có mục phòng ngừa tái diễn, KHÔNG liệt kê giả thuyết nào khác ngoài giả thuyết đã xác nhận (kể cả giả thuyết ghi là bị loại, bị bác bỏ hay chưa kết luận). Một mục chỉ ghi "skipped"/"N/A"/"bỏ qua" vẫn tính là có mục đó. Các trường của hợp đồng nguyên nhân gốc mà skill bắt buộc — Symptom, Reproduction, Expected, Actual, Trigger, Root cause, Contributing factors, Why now, Evidence chain, Blast radius, và bản dịch của chúng — KHÔNG tính là mục dòng thời gian hay mục phòng ngừa; dòng "Regression guard" trong Verification Plan (hoặc bản dịch như "Kiểm tra hồi quy", "Chống tái phát", "Chặn tái phát") cũng KHÔNG tính là mục phòng ngừa tái diễn; một đoạn tóm tắt bối cảnh codebase không tính là mục nào ở trên. KHÔNG ĐẠT nếu thiếu file:dòng hoặc có bất kỳ mục bị cấm nào ở trên.
