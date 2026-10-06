# Bàn giao: ghép skill `ui-ux` của evondevKit vào cafekit

Ngày 05/10/2026. Worktree `feat/ui-ux-skill` tạo từ `dev` (659b705). Trạng thái: **mới điều tra, chưa mở gói Specs, chưa sửa source**. Bro quyết định **giữ `ui-ux-pro-max`**, thêm skill mới bên cạnh.

## Nguồn

- Repo: https://github.com/evondev/evondevKit — thư mục `skills/ui-ux/`, plugin bản 0.3.13, commit `6465d4c37506b0b21823c24d557d61fbc60ca51a` (04/10/2026), MIT (Copyright (c) 2026 Tuấn Trần).
- Lấy lại: `gh repo clone evondev/evondevKit <tmp> -- --depth 1` rồi `git -C <tmp> checkout 6465d4c` nếu upstream đã đổi.
- Kích thước: 17.049 dòng = SKILL.md 487, `references/*.md` 5.209, `components/` 3.470, `layouts/` 2.858, `scripts/probe.mjs` 4.447 + `lint-skill.mjs` 216 (Node, cần Playwright), `tokens.css` 362.

## Việc cần làm (đề xuất, chốt ở GATE-SCOPE)

Tạo mới:
1. `packages/spec/src/claude/skills/ui-ux/` — chép nguyên `skills/ui-ux/` upstream + file `LICENSE` vào cùng thư mục. Không dịch, không sửa luật, giữ tên thư mục tạm `evon-*`.
2. `.../ui-ux/scripts/package.json` — khai `playwright` theo mẫu `skills/pptx/scripts/package.json`; installer tự `npm install` + `playwright install chromium` (`bin/phases/skills-setup.js:96-100`, `bin/lib/skill-deps.js:186`). `probe.mjs` tìm Playwright ở thư mục script (`loadPlaywright`) nên không sửa code.

Sửa:
3. `.../ui-ux/SKILL.md` **chỉ frontmatter**: `name: cf:ui-ux` (catalog bắt `cf:<tên thư mục>`, `generate-skill-catalog.cjs:122-130`), `description` tiếng Anh ngắn, `when_to_use`, `category: frontend`, `keywords`, `license: MIT`, `user-invocable: true`, `metadata` ghi tác giả gốc + bản + URL + commit. Đoạn `description` tiếng Việt gốc (1.020 ký tự, sát trần host 1024) chuyển xuống thân. Trong skill không có chữ `/evon:ui-ux` (chỉ README upstream có).
4. `packages/spec/src/claude/migration-manifest.json`: thêm `ui-ux` vào `skills.required` (hoặc bundle mới — Bro chưa chốt; khuyên required vì bundle mới cần mở đường ống `select-skill-bundles.js` + test khóa cứng `optional-skill-inventory.test.js:56`).
5. `skills/ui-ux-pro-max/SKILL.md`: cắt "layout, design systems" khỏi `when_to_use` để hai skill không tranh nhau.
6. `packages/spec/CHANGELOG.md` (chưa có mục Unreleased, bản mới nhất 0.16.8) và `docs/project-changelog.md`.

Tùy chọn (Bro chưa chốt):
7. Test nhỏ `bin/__tests__/ui-ux-skill.test.js` theo mẫu `orca-skill.test.js:189` (name đúng, manifest có, package.json có playwright).
8. `lint-skill.mjs` ghim `const skillDir = "skills/ui-ux"` theo cwd (dòng 16) và so với HEAD bằng git → chạy từ `packages/spec/src/claude`, hoặc vá một dòng, hoặc không dùng.
9. EXPAND: trỏ agent `agents/ui-ux-designer.md` (dòng 26-31 đang gọi `search.py` của pro-max) sang `cf:ui-ux`; thêm một dòng UI vào `.claude/rules/skill-domain-routing.md`. Website `cafekit-web` liệt kê skill ở `src/components/docs/catalog-visuals.tsx:7`, `skill-overview.tsx:41`, `src/services/workflows.json:43`.

## Kiểm sau khi chép

1. `cd packages/spec && pnpm test` (dự đoán không vỡ: không test nào khóa nguyên danh sách `required`; chỉ `route` không có, `orca` phải có, bundles đúng nhóm tài liệu).
2. `node src/claude/scripts/generate-skill-catalog.cjs --skills src/claude/skills` → thấy `cf:ui-ux`, không diagnostic.
3. Cài thử vào **thư mục tạm** (`install.js` không có `--cwd`, chạy sai chỗ là cài đè repo), xác nhận Playwright được tải.
4. Chạy `probe.mjs` lên một trang thật (ví dụ `references/layouts/app-kanban.html` qua `python3 -m http.server`).
5. Eval đo tỉ lệ host gọi `cf:ui-ux` (câu nên gọi và không nên gọi) — gói sau.

## Số đo đã có

`ui-ux-pro-max` được dùng thật trên máy Bro: Claude Code 5 phiên (printshop 07/09, 08/09, 25/09; radar-insight 04/10; live-trans 05/10, model tự chọn qua Skill tool), Codex 12 phiên chạy `search.py` (~126 lệnh; printshop, ngeax, gamify, live-trans). Câu tra cứu: dashboard/console (evondev phủ), landing page, game lobby, terminal CLI dark (evondev không phủ). Vì thế giữ cả hai.

## Lưu ý

- Hook của phiên chạy ở worktree này chỉ canh `specs/` của chính nó; gói `lean-fix-debug` ở repo gốc chưa commit nên không theo sang.
- Thêm evondev là thêm Playwright + Chromium lúc cài, dù chọn cách nào.
- Memory chi tiết của phiên điều tra nằm ở `~/.claude/projects/-Users-nghialuutrung-Desktop-cafekit/memory/evondev-ui-ux-integration-investigation.md` (phiên ở worktree này không tự nạp).
