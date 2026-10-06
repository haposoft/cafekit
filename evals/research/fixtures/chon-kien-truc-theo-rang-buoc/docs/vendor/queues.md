# Ghi chú hai thư viện hàng đợi (bản lưu 2026-09)

## BullMQ
- Cần Redis 6.2 trở lên.
- Hỗ trợ ưu tiên, lặp lịch, giới hạn tốc độ.

## pg-boss
- Chạy trên Postgres 13 trở lên, dùng SKIP LOCKED; không cần dịch vụ thêm.
- Hỗ trợ lặp lịch, thử lại, hàng đợi chết (dead letter).
