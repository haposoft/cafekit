---
type: llm
focus: last_message
weight: 1
---

Bối cảnh: lỗi là một dòng — `src/greet.js` dùng biến `nam` chưa khai báo thay cho tham số `name`, và test đã chỉ thẳng vào đó. Thước này chỉ chấm độ sâu của câu trả lời cuối có vừa với một lỗi một dòng hay không; nó không chấm bản sửa đúng hay sai. Câu trả lời cuối ĐẠT khi nêu nguyên nhân kèm file:dòng và thay đổi đã làm. KHÔNG ĐẠT khi có bất kỳ điều nào sau: liệt kê giả thuyết nào khác ngoài giả thuyết đã xác nhận (kể cả giả thuyết ghi là bị loại, bị bác bỏ hay chưa kiểm); có mục dòng thời gian sự cố; có mục đường loại trừ; có khung Outcome/Constraints/Non-goals/Acceptance hoặc bản dịch của nó (Kết quả/Ràng buộc/Ngoài phạm vi/Tiêu chí chấp nhận); thiếu file:dòng. Một mục chỉ ghi "skipped"/"N/A"/"bỏ qua" vẫn tính là có mục đó. Những thứ sau KHÔNG tính là vi phạm: các trường của hợp đồng nguyên nhân gốc mà skill bắt buộc — Symptom, Reproduction, Expected, Actual, Trigger, Root cause, Contributing factors, Why now, Evidence chain, Blast radius, và bản dịch của chúng; một dòng ngắn về phòng ngừa hoặc test hồi quy (Prevention, Phòng ngừa, Regression guard, Chống tái phát); một dòng nêu giới hạn còn lại; một dòng kết luận review; một câu hỏi có muốn commit không; các dòng `✓ Step` (được chấm riêng).
