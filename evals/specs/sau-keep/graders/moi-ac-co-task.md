---
type: llm
focus: { source: file, path: specs/google-login/plan.md }
weight: 1
---

Nội dung dưới đây là file `plan.md` mà trợ lý vừa viết cho tính năng đăng nhập Google, sau khi người dùng chọn KEEP.

ĐẠT khi thỏa TẤT CẢ:
- Có bảng tiêu chí chấp nhận với ID dạng `AC-01`, `AC-02`… và MỌI ID đó được một hàng của bảng `## Tasks` nhận.
- Ô Criteria được phép liệt kê rời (`AC-01, AC-02, AC-03`) HOẶC viết gọn dạng dải (`AC-01..AC-06`, `AC-01…AC-07`). Một dải phủ hết các ID đã khai là ĐẠT — đừng đòi từng ID xuất hiện nguyên chữ.
- Bảng `## Tasks` có cột `Priority` với giá trị P1/P2/P3.
- Có mục `## Decisions` ghi lựa chọn và lý do, không phải chỗ trống hay placeholder.
- Phạm vi ghi lại quyết định KEEP của người dùng và nêu phần cố ý để ngoài phạm vi.

KHÔNG ĐẠT nếu: có ID chấp nhận nằm ngoài mọi dải và mọi danh sách, tức không task nào nhận; thiếu cột Priority; `## Decisions` chỉ còn placeholder dạng `<...>`; hoặc file chỉ là khung mẫu chưa điền.
