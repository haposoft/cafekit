# order-report

Dựng câu truy vấn báo cáo đơn hàng. Chỉ sắp xếp được theo `name`, `created_at`, `total`.
`direction` chỉ nhận `"desc"` (chữ thường); mọi giá trị khác, kể cả bỏ trống, là tăng dần.
`limit` là số nguyên dương dạng thập phân; mặc định 50, tối đa 200.
