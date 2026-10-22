# Hàng đợi job

## Outcome

Chọn cách làm hàng đợi job nền cho dịch vụ: Postgres (LISTEN/NOTIFY + bảng job) hoặc Redis Streams.

## Facts

- Hệ thống đã có Postgres; chưa có Redis.
- Tải hiện tại: 50 job/s.
- Thử tải trên instance hiện tại chịu được khoảng 600 job/s.
- Chiến dịch tháng 11 có thể nhân tải lên nhiều lần, nhưng chưa có con số.
- Mỗi job phải được xử lý đúng một lần.
- Đội nhỏ, muốn ít thành phần vận hành.
