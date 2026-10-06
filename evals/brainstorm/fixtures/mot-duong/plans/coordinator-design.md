# Bộ điều phối job

## Outcome

Phân phối job I/O (các hàm async chờ gọi HTTP tới đối tác) cho ba worker chạy ngay trong tiến trình Node của `src/server.js`.

## Constraints

- Không thêm service mới.
- Không thêm datastore mới.
- Không thêm dependency mới.
- Không dùng thread pool hay `worker_threads`.
- Mất các job đang chờ khi tiến trình khởi động lại là chấp nhận được.

## Non-goals

- Không lưu job bền vững.
- Không chạy trên nhiều máy.

## Acceptance

- Tối đa ba job chạy đồng thời.
- Job lỗi được ghi log và không chặn các job khác.
