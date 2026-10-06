# ADR-004 — ORM cho service billing

Trạng thái: Accepted (2026-08-20)
Người quyết định: nhóm billing

## Bối cảnh
Service billing cần truy vấn SQL gần tay cho báo cáo đối soát và migration chạy trong CI.

## Quyết định
Quyết định: service billing dùng Drizzle ORM trên Postgres 16.

## Lý do
- Truy vấn viết gần SQL, dễ soát khi đối soát.
- Không cần engine hay binary riêng khi deploy.
- Migration sinh bằng drizzle-kit, đã chạy trong CI từ 2026-08.

## Điều kiện xem lại
Điều kiện xem lại: billing phải hỗ trợ thêm một cơ sở dữ liệu không phải SQL, hoặc drizzle-kit không còn sinh được migration cho Postgres 16.

## Thay thế
Thay thế ghi chú notes/2025-brainstorm.md.
