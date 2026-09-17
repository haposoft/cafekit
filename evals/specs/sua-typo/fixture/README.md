# Sổ tay khách hàng — API (phiên bản nôi bộ)

API Express nhỏ quản lý danh bạ khách hàng cho đội bán hàng nội bộ.

- Đăng nhập bằng email + mật khẩu (`POST /login`), phiên lưu bằng cookie ký.
- CRUD khách hàng ở `/customers`, yêu cầu đã đăng nhập.
- Test: `npm test` (node --test).
