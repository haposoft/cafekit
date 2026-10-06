# Đo hiệu năng (2026-09-20)

- Chỉ mục `products_search_idx` (GIN trên `search_vector`) đã có từ bản 1.2.
- p95 của `GET /search` đo được: 850 ms ở 40 request/giây.
