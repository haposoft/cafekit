# Định Dạng & Tiêu Chuẩn Commit (Hapo Git Protocols)

Bộ quy chuẩn Native dành cho Hapo Agents khi gọi lệnh `commit`. Không dùng tool bên ngoài, LLM phải tự phân tích qua Bash. Các bước dưới đây theo đúng thứ tự: kiểm checkout → quét bí mật → stage theo nhóm → commit.

## Bước 0 — Xác nhận đúng checkout TRƯỚC khi stage
Xác định thư mục đích (người dùng nêu, hoặc thư mục hiện tại). In top-level và nhánh của CHÍNH thư mục đó:
```bash
git -C <đích> rev-parse --show-toplevel
git -C <đích> branch --show-current
```
Chỉ đi tiếp khi cả hai khớp thứ người dùng nhắm tới. Từ đây mọi lệnh stage và commit chạy bằng `git -C <đích>` (hoặc sau một `cd <đích>`; thư mục làm việc được giữ giữa các lệnh). Không khớp (đứng nhầm repo, sai nhánh, detached HEAD) thì dừng trước khi stage, nói rõ lệch ở đâu và hỏi người dùng.

Bash trên macOS là bash 3.2: không dùng `mapfile`, `readarray`, `declare -A`, `${var,,}`, `${var^^}`, `&>>`; dùng vòng `while read` hoặc `$(...)` thay thế.

## Bước 1 — Quét bí mật khi CHƯA stage
Chỉ xem `git status --short` và `git diff --stat` trước khi quét; không in nội dung hay diff của file đã đổi (`cat`, `git diff`, `git show`) khi chưa quét xong. Luôn chạy khối quét cây làm việc trong `SKILL.md` (giữa hai dấu `fallback-scan`) TRƯỚC khi stage, dù repo có script quét hay không, và chạy nó bên trong checkout đích (`cd <đích>` trước). Nếu repo có script, chạy thêm nó SAU khi stage như một lần nhìn thứ hai vào diff đã stage. Kết quả chỉ gồm file, dòng, loại — không bao giờ in giá trị.

Có trúng → dừng TOÀN BỘ, không commit gì, kể cả các nhóm sạch. Không đổi index hay `.gitignore` trước khi người dùng trả lời; quy tắc đầy đủ nằm ở `SKILL.md`.

## Bước 2 — Stage theo nhóm bằng đường dẫn tường minh
Đọc `git status --short` và `git diff --stat` rồi quyết định chia commit. Mỗi nhóm stage riêng, ví dụ:
```bash
git -C <đích> add -- src/a.js src/b.js
git -C <đích> diff --cached --stat
```
Không có gì được stage → thoát gọn.

## Giải Thuật: Tách Commit (Auto-Split vs Single Commit)

Đọc kỹ dữ liệu do `git diff --cached --stat` cung cấp để quyết định chia nhỏ commit.

**Tách (Split) NGAY NẾU:**
1. Có cả `feat` (tính năng) và `fix` (sửa lỗi) trong cùng một rổ.
2. Nhiều Scope đan xen: vừa sửa `auth` vừa động vào `payment`.
3. Số file thay đổi > 10 VÀ không chung một chủ đề.
4. Trộn cập nhật cấu hình (`package.json`, `.eslintrc`) với code (`src/..`).

**Gộp thành 1 commit NẾU:**
- Cùng 1 Scope/Type duy nhất.
- Tổng số file <= 3 và tổng diff <= 50 dòng.

## Cú pháp Bắt buộc (Conventional Commits)
- `feat(scope): ...` — Tính năng mới
- `fix(scope): ...` — Vá lỗi
- `refactor(scope): ...` — Cấu trúc lại mã, không đổi hành vi
- `perf(scope): ...` — Cải thiện hiệu suất
- `chore(deps): ...` — Cập nhật thư viện
- `docs(readme): ...` — Tài liệu
- `test(api): ...` — Kiểm thử (Unit/E2E)

*LƯU Ý: Tuyệt đối không dùng `docs` hoặc `chore` khi có file nằm ở `.claude` thay đổi. Hãy dùng `feat` hoặc `fix`.*

Thông điệp commit không có trailer `Co-Authored-By` hay dòng ghi công AI nào, trừ khi người dùng yêu cầu trong chính lần gọi này.

## Xử lý Vướng Mắc Git (Error Handling via Bash)
- **Có Secret:** dừng toàn bộ như Bước 1; báo file/dòng/loại; chờ người dùng quyết định.
- **Push bị báo Rejected:** Cấm dùng `--force`. Chạy: `git pull --rebase origin <branch>`. Chỉ push nhánh hiện tại.
- **Merge Conflicts:** Báo "BLOCKED", liệt kê file, in lệnh để người dùng giải quyết hoặc gọi agent `cf:develop` xử lý file conflict.
