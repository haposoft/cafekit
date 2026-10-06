# Plan: OpenCode Self-Contained Install

## Goal
Khi user chọn install platform `opencode`, installer chỉ tạo `.opencode/` (cộng `AGENTS.md` root). Không tạo `.claude/`. Khi cài cả 2 platform, mỗi folder tự lập, content được rewrite-on-copy tương ứng.

## Constraints
- Không động `.claude/` flow của Claude Code (giữ backward-compat hoàn toàn).
- Không ép user opencode-only phải cài hooks (opencode chưa hỗ trợ Claude hook protocol).
- Rewrite content thực hiện tại copy-time, không runtime detection (KISS).

## Blast Radius
- `packages/spec/bin/install.js` — sửa registry, helpers, copy paths, rewrite scope.
- `packages/spec/CHANGELOG.md` — entry breaking change.
- Không cần đụng skill/rule source — rewrite-on-copy xử trong installer.

## Design Decisions

### D1. Path layout opencode-only
| Asset | Trước | Sau |
|---|---|---|
| commands | `.opencode/commands/` | giữ |
| agents | `.opencode/agents/` | giữ |
| AGENTS.md | root | giữ |
| cafekit.json | `.opencode/cafekit.json` | giữ |
| ROUTING.md | `.opencode/ROUTING.md` | giữ |
| **skills** | `.claude/skills/` | **`.opencode/skills/`** |
| **rules** | `.claude/rules/` | **`.opencode/rules/`** |
| **references** | `.claude/references/` | **`.opencode/references/`** |
| **scripts** | `.claude/scripts/` | **`.opencode/scripts/`** |
| **runtime.json** | `.claude/runtime.json` | **`.opencode/runtime.json`** |
| **.gitignore** | `.claude/.gitignore` | **`.opencode/.gitignore`** |

Hooks: opencode KHÔNG nhận hooks (opencode chưa có hook protocol Claude-compat). Hiện tại đã vậy → giữ.

### D2. Content rewrite policy
Khi `platformKey === 'opencode'`, mọi text content được copy đều đi qua `normalizeOpenCodeBody` mở rộng:

```
.claude/agents/      → .opencode/agents/
.claude/commands/    → .opencode/commands/
.claude/skills/      → .opencode/skills/
.claude/rules/       → .opencode/rules/
.claude/scripts/     → .opencode/scripts/
.claude/references/  → .opencode/references/
.claude/runtime.json → .opencode/runtime.json
.claude/ROUTING.md   → .opencode/ROUTING.md
.claude/             → .opencode/   (catch-all, áp dụng cuối cùng cho path lẻ)
CLAUDE.md            → AGENTS.md
```

Phạm vi áp dụng:
- skill files (.md, .mdx, .txt) trong `copyRecursive` → cần variant transform-aware.
- agent reference manuals (debugger/) trong `copyRecursive` → cùng.
- scripts (.cjs) → cần rewrite (chứa usage string + `process.cwd()/.claude/skills` hardcode).
- rules (`copyAdditionalRules`) → cần rewrite.
- ROUTING.md (`copyRoutingFile`) → cần rewrite (catch-all `.claude/` → `.opencode/`).
- commands template substitution (`createOpenCodeSkillCommandContent` line 383) → đổi hardcode `.claude/skills/` thành `${platform.skillsRef}` đã có sẵn.
- AGENTS.md (`createOpenCodeAgentsContent`) → bổ sung rewrite path.

### D3. Helper refactor
- Thêm `copyRecursiveWithTransform(src, dest, transform, options)` — như `copyRecursive` nhưng đọc file text qua `transform(content, relPath)` rồi write. File binary (non-utf8) fallback copy as-is theo extension.
- Đơn giản: detect `.md`/`.mdx`/`.txt`/`.cjs`/`.js`/`.json`/`.sh` → text. Còn lại copy as-is.
- Bỏ special-case `getClaudeSupportTargetDir` → `getRuntimeSupportTargetDir(platformKey, subdir) = path.join(PLATFORMS[platformKey].folder, subdir)`. Đổi tên cho rõ; chỉnh các callsite.

### D4. Migration cũ
User opencode đã từng cài → folder `.claude/` tồn tại trên repo của họ. Plan này **KHÔNG** tự xoá `.claude/` cũ (an toàn). Chỉ tạo `.opencode/` đầy đủ. README sẽ note: nếu đã cài opencode trước 0.8.18, có thể xoá thủ công `.claude/` sau khi upgrade. CHANGELOG ghi breaking change.

### D5. Bumping version
Bump `packages/spec/package.json` version `0.8.17` → `0.8.18` để mark breaking. (Hỏi user nếu chắc.)

## Execution Order

### Phase 1 — Installer changes (single file: install.js)
1. Update `PLATFORMS.opencode`: `skillsDir='.opencode/skills'`, `skillsRef='.opencode/skills'`.
2. Rename `getClaudeSupportTargetDir` → `getRuntimeSupportTargetDir`; remove opencode branch. Update all callsites.
3. Expand `normalizeOpenCodeBody` with full path rewrite map (D2).
4. Refactor `copyRecursive` users for opencode to use `copyRecursiveWithTransform`:
   - `copyRecursive(specSkillSrc, specSkillDest, options)` → transform variant when opencode.
   - `copyRecursive(skillSource, skillDest, options)` (required skills loop).
   - `copyRecursive(refsSource, refsDest, options)` (debugger refs).
   - `copyRecursive(scriptsSourceDir, scriptsDest, options)` (scripts).
5. Update `copyOpenCodeSharedRuntimeFiles`: target base `.opencode/` thay `.claude/`. Rewrite content `runtime.json` (no `.claude` refs there expected) and `.gitignore` (no refs).
6. Update `createOpenCodeSkillCommandContent`: replace hardcoded `.claude/skills/...` với `${command.skillsRef}/${command.skillName}/SKILL.md`. Cần truyền `skillsRef` vào call.
7. Update `copyRoutingFile`: khi opencode, apply `normalizeOpenCodeBody` (đã catch `.claude/` → `.opencode/`).
8. Update `copyAdditionalRules` (rules) similarly.
9. Update `createOpenCodeAgentsContent` (AGENTS.md): chain qua `normalizeOpenCodeBody` để catch path mới.
10. Inline docs (printed instructions) ở final report — đổi `.claude/skills/` thành đường dẫn động `platform.skillsRef`.

### Phase 2 — CHANGELOG + version
- Bump version to 0.8.18.
- CHANGELOG entry `## [0.8.18] - 2026-05-26` với section "Changed (breaking)".

### Phase 3 — Test thực tế
1. Tạo `tmp/test-opencode/`, copy/symlink cần thiết, chạy installer chỉ opencode → assert:
   - `.opencode/` chứa: commands, agents, skills, rules, scripts, references, runtime.json, ROUTING.md, cafekit.json, .gitignore.
   - Root: AGENTS.md.
   - KHÔNG có `.claude/`.
   - Spot-check 1 skill body chứa `.opencode/scripts/...` (đã rewrite).
   - Spot-check 1 script (`generate-skill-catalog.cjs`) chứa `process.cwd(), '.opencode'` (đã rewrite).
2. Tạo `tmp/test-claude/`, chạy installer chỉ claude → assert:
   - `.claude/` đầy đủ, nội dung không rewrite.
   - KHÔNG có `.opencode/`.
3. Tạo `tmp/test-both/`, chạy installer chọn cả 2 → assert:
   - Cả `.claude/` và `.opencode/` tồn tại.
   - Skills duplicate giữa 2 folder (đây là tradeoff đã document).

Test bằng node script tự dựng, no manual prompt — gọi installer với env `CAFEKIT_PLATFORM=opencode` nếu có flag; nếu chưa, pipe stdin "2\n" (opencode = option 2).

### Phase 4 — Cleanup task list + receipt
Update task tracker, in báo cáo với commands chạy và outputs.

## Risk Register
| Rủi ro | Mitigation |
|---|---|
| Rewrite false-positive (vd. literal `.claude` trong comment lịch sử) | Chỉ rewrite prefix `.claude/<known-subdir>` + final catch-all. Test spot-check. |
| Script `generate-skill-catalog.cjs` lệch path tại runtime | Rewrite-on-copy đảm bảo bản trong `.opencode/scripts/` đọc `.opencode/skills/`. |
| `runtime.json` shared config bị tách → user phải config 2 lần | Document trong CHANGELOG. Future: skill-level discovery có thể auto-detect runtime dir. |
| Existing opencode users có `.claude/` cũ | Đã document trong CHANGELOG; không tự xoá. |
| Test temp dir cần symlink src/ | Dùng `node bin/install.js` với absolute path; cwd = temp; bin script đọc `__dirname` cho source. OK. |

## Unresolved Questions
1. Bump version 0.8.18 OK hay user muốn 0.9.0 (semantic-major vì breaking)?
2. Có cần tự động print warning khi detect `.claude/` cũ tồn tại lúc cài opencode-only (gợi ý xoá)?
3. Docs site (`cafekit-web`) có cần update song song không, hay tách commit?
