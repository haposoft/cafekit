# Bản Vẽ Thiết Kế: Khởi Tạo Worktree (Worktree Blueprint)

Worktree là chìa khóa để phát triển các tính năng song song mà không dẫm đạp lên nhau. Hapo Agent dùng chính Bash Shell của Local OS để thi triển, tránh phụ thuộc vào JS runtime.

## Kịch Bản Tạo Môi Trường Tách Biệt (Clean-Room Blueprint)

### Bước 1: Trích Xuất Thông Tin Repository (Native Git)
Kêu gọi lệnh Bash để kiểm tra thư mục gốc:
```bash
git rev-parse --show-toplevel
git branch --show-current
```
*-> Giả sử top-level path là `/path/to/project` và current là `dev`.* Worktree mới tạo nhánh from the current branch, trừ khi User chỉ định nhánh gốc khác. Nếu `git branch --show-current` rỗng (detached HEAD), dừng lại và hỏi User nhánh gốc.

### Bước 2: Nhận Diện & Định Tên Nhánh (Slugifier)
Tuỳ theo `<feature-description>`, hãy sinh ra một cái tên nhánh dạng Kebab-case.
- Bắt đầu phải là Type: `feat/`, `fix/`, `refactor/`, `chore/`...
- Nối tiếp là Tên ngắn (<= 50 text): `feat/add-auth-system`.
*Lưu ý: Nếu User chủ động gõ tên có sẵn mã Jira (TD-1234) hoặc tên tuyệt đối thì bỏ qua prefix Type.*

### Bước 3: Khởi Sinh Worktree (Sibling Pattern)
**Mặc định luôn là cấp Sibling (`../`)**: skill không bao giờ tự tạo worktree lồng bên trong repo. Một đường dẫn lồng (dưới `.claude/worktrees/` đã bị ignore) chỉ chấp nhận khi chính người dùng hoặc công cụ host đã đặt tên và tạo ra nó; khi còn worktree lồng, không chạy `git clean -fdx` ở root repo vì nó xoá cả thư mục bị ignore.

Lối tắt tùy chọn (không bắt buộc, không phải điều kiện): `claude --worktree`, Orca, Herdr. Chỉ cần `git` (thêm `rsync` cho Bước 4); máy không có công cụ nào khác vẫn làm đủ mọi bước.

Cấu trúc lệnh Bash thực thi:
```bash
export REPO_HOME=$(git rev-parse --show-toplevel)
export REPO_NAME=$(basename $REPO_HOME)
export BASE_BRANCH="${BASE_BRANCH:-$(git branch --show-current)}"
export BRANCH_NAME="feat/add-auth"

# Sanitize folder path (thay / thành - để tránh lỗi subfolder nếu k cần thiết)
export SAFE_FOLDER_NAME="${REPO_NAME}-${BRANCH_NAME//\//-}"
export TARGET_DIR="$REPO_HOME/../$SAFE_FOLDER_NAME"


# Không che lỗi của git bằng `||`: hai tình huống đầu phải DỪNG và hỏi người dùng, không chạy tiếp, không tự chọn.
if [ -e "$TARGET_DIR" ]; then
  echo "Thư mục $TARGET_DIR đã tồn tại — hỏi người dùng, không chạy tiếp"
elif git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  echo "Nhánh $BRANCH_NAME đã tồn tại — hỏi người dùng: dùng lại nhánh đó (git worktree add \"$TARGET_DIR\" \"$BRANCH_NAME\") hay đặt tên khác; không chạy tiếp"
else
  git worktree add -b "$BRANCH_NAME" "$TARGET_DIR" "$BASE_BRANCH"
fi
```
Nhánh đã tồn tại thì KHÔNG tự gắn worktree vào nó: nhánh cũ có thể có gốc khác `$BASE_BRANCH`, trái luật "tạo từ nhánh hiện tại".

### Bước 4: Tự Động Hóa Môi Trường (Hydration)
Bộ cài CafeKit thêm `.claude/`, `.codex/`, `.agents/` vào `.gitignore`, nên `git worktree add` không mang theo hook, skill và rule. Chép những thư mục đang có ở repo gốc mà worktree mới còn thiếu, bỏ log, session state, worktree lồng của agent và môi trường cài cục bộ:
```bash
for dir in .claude .codex .agents; do
  if [ -d "$REPO_HOME/$dir" ] && [ ! -e "$TARGET_DIR/$dir" ]; then
    rsync -a --exclude 'session-state/' --exclude 'worktrees/' --exclude '.logs/' --exclude 'node_modules/' --exclude '.venv/' "$REPO_HOME/$dir/" "$TARGET_DIR/$dir/"
    echo "hydrated $dir"
  fi
done
```
Sau đó, tại `$TARGET_DIR` mới, bạn phải tự scan (bằng `ls` hoặc `find`) để tìm file cấu trúc và cài đặt:
- Nếu tìm thấy `.env.example`, tự chạy `cp .env.example .env`.
- Nếu tìm thấy `bun.lockb` / `bun.lock`: Chạy `bun install`.
- Nếu tìm thấy `pnpm-lock.yaml`: Chạy `pnpm install`.
- Nếu tìm thấy `package-lock.json`: Chạy `npm install`.

### Bước 5: Báo Cáo Chuyển Giao
Sau khi chạy hoàn thiện qua Native Bash, xuất báo cáo cho Tướng Lĩnh.
Nội dung thông báo (Mẫu):
> "✅ Worktree được khởi tạo thành công tại thư mục Sibling: `/path/to/.../project-feat-auth`, nhánh `feat/auth` tạo từ `dev`. Đã chép `.claude/` (các dòng `hydrated`). Môi trường npm và .env đã được setup. Để bắt đầu code, vui lòng mở một phiên agent mới tại đường dẫn đó, để hook của worktree này chỉ canh gói specs của chính nó."

Mỗi worktree chỉ giữ một gói specs đang mở; phiên agent mới bắt đầu ngay trong thư mục worktree đó.

## Vòng đời worktree: liệt kê, gỡ, dọn
Mục tiêu: không bao giờ mất việc chưa lưu. Thư mục `.claude/`, `.codex/`, `.agents/` do Bước 4 chép sang là bản sao dùng lại được, nên không tính là việc chưa lưu; mọi thứ khác bị ignore (ví dụ `.env` đã sửa, kể cả `.env` chép từ `.env.example` ở Bước 4) thì có và phải hỏi.

- **Liệt kê:** `git worktree list --porcelain`. Mục có dòng `prunable` là thư mục đã mất.
- **Gỡ `<dir>`:** chạy hai lệnh kiểm trước, rồi mới gỡ:
  ```bash
  git -C <dir> status --porcelain --ignored   # bỏ qua các mục dưới .claude/ .codex/ .agents/ đã chép
  git -C <dir> log --oneline <base>..HEAD      # <base> = nhánh worktree được tạo từ đó, hoặc nhánh tích hợp
  ```
  Cả hai trống → `git worktree remove <dir>` (không `--force`). Có bất cứ dòng nào → hiện ra và hỏi; chỉ gỡ sau khi người dùng gõ đúng `remove <tên-thư-mục>`.
- **Dọn mục `prunable`:** `git worktree prune`. Không bao giờ `rm -rf` một thư mục worktree.
- **Nhánh:** xoá bằng `git branch -d <nhánh>`; "đã merge" nghĩa là nhánh có trong `git branch --merged <base>`. Chỉ dùng `-D` sau khi người dùng gõ đúng `delete <tên-nhánh>`.

