# Demo CafeKit — Khách hàng

> Buổi họp: trao đổi tình hình dùng AI trong phát triển phần mềm + demo CafeKit & Hapo AI Hub.
> Người demo: Nghĩa. Mục tiêu: cho khách thấy **khác biệt rõ rệt giữa DÙNG và KHÔNG DÙNG CafeKit**.
> Chủ đề: **Kahoot MVP** — game quiz real-time (chủ đề câu hỏi: về AI).
>
> **Hình thức demo (đã chốt):** chỉ **show quá trình build + kết quả chạy trên máy mình**. KHÔNG cho khách join chơi. Trọng tâm = cho khách thấy **CafeKit dẫn dắt cả quá trình** (spec → develop → test), app chạy được là phần thưởng cuối.
>
> **Quyết định đã chốt:** Primary color = **navy `#0A3D62`** · Ngôn ngữ hệ thống/output = **日本語** · Quiz = **về AI** · Không khách join · Nghĩa tự build để có "quá trình" thật.

---

## 0. Thông điệp cốt lõi (nói 1 câu)

> "AI viết code nhanh thì ai cũng có. CafeKit làm cho AI **lập kế hoạch như senior, chia việc, và không được phép nói 'xong' khi chưa có bằng chứng** — đúng nỗi lo lớn nhất của enterprise: AI tự tin nhưng sai âm thầm."

Khách (tài chính) coi trọng: công bằng, đúng đắn, audit được, bảo mật.

**Câu chốt cuối demo:** "Without CafeKit, **you** must remember to ask everything and verify it yourself. With CafeKit, **it** asks you, lists the risks itself, and proves the work before it dares say done."

---

# PHẦN 1 — CHỐT TRƯỚC KHI DEMO (pre-define outputs)

Lý do: nếu không khoá design trước, AI tự bịa màu/layout mỗi lần một khác → demo thiếu nhất quán + A/B không công bằng. Khoá design tokens = output đẹp đoán trước được, đồng thời khoe được CafeKit nhận design làm **canonical contract**.

## 1.1 Brand & Logo
- Tên app: **"QuizHub"**.
- Logo: emoji/SVG đơn giản — ⚡ hoặc 🎯. Không cầu kỳ (MVP).

## 1.2 Color palette (quyết định "đẹp")
- **Primary (đã chốt):** navy `#0A3D62`.
- **4 màu đáp án (kinh điển, kèm shape):**
  - 🔺 Đỏ `#E21B3C` · 🔷 Xanh `#1368CE` · 🔶 Vàng `#D89E00` · 🟩 Lục `#26890C`
- **Background:** gradient navy nhạt · **Text:** trắng trên nền màu.

## 1.3 Typography
- Font: **Inter** hoặc **Montserrat** (sans, đậm, đọc xa rõ trên máy chiếu).
- Câu hỏi ≥ 32px · đáp án vừa · leaderboard nổi bật.

## 1.4 Screens / Layout
- **Host screen** (landscape): câu hỏi + đồng hồ + số người đã trả lời + leaderboard.
- **Player screen** (portrait): chỉ 4 nút đáp án to (màu + shape), KHÔNG hiện chữ câu hỏi (giống Kahoot thật).
- **Join screen**: ô nhập PIN + nickname.
- *Demo trên 1 máy: host 1 tab + 2-3 tab player do Nghĩa tự mở để mô phỏng nhiều người chơi (khách không join).*

## 1.5 Component style
- Đáp án = 4 nút full-width, màu + shape ở góc, bo tròn, hiệu ứng nhấn.
- Leaderboard = top 5, animation nhảy hạng.

## 1.6 Product rules (định hình output — chốt luôn)
- Số câu: **5** (chủ đề về AI) · Timer: **20s/câu** · PIN: **6 chữ số**.
- Scoring: **base 1000 + bonus theo tốc độ** (trả lời nhanh điểm cao hơn).
- Nickname ≤ 12 ký tự, chống trùng.

## 1.7 Scope MVP — KHOÁ CHẶT (chống phình live)
**CÓ:** tạo/seed 1 quiz (5 câu) · host start → PIN · player join (PIN+nickname) · phát câu hỏi có timer · gửi đáp án · chấm điểm theo tốc độ · leaderboard giữa câu + cuối · sync real-time.
**KHÔNG (v2):** DB/lưu lâu dài (dùng in-memory) · tài khoản/auth · editor quiz · ảnh trong câu hỏi · reconnect phức tạp · scale nhiều phòng.

## 1.8 Stack đề xuất
- **Backend:** Node + Express + Socket.IO, state in-memory (Map các room). KHÔNG DB.
- **Frontend:** Vanilla HTML/JS + Socket.IO client (robust, build nhanh, ít vỡ live). *(Vite+React+Tailwind nếu muốn đẹp hơn, build lâu hơn.)*
- **Test:** `node:test` built-in hoặc vitest — bắt ca: trả lời sau hết giờ, chấm điểm đồng thời, tie-break.
- **Chạy demo:** 1 laptop của Nghĩa — host 1 tab + vài tab player tự mở để mô phỏng. Không cần wifi/khách join.

## 1.9 Edge case vibe-code dễ sót (CafeKit spec sẽ bắt)
1. **Trả lời SAU khi hết giờ** → phải từ chối (fairness)  ← điểm nhấn
2. **Hai player trả lời đồng thời** (race) → chấm điểm/xếp hạng đúng, không double-count
3. Nickname trùng
4. Player vào giữa câu hỏi (late join)
5. PIN sai / phòng không tồn tại
6. Hoà điểm → tie-break leaderboard
7. Gửi đáp án 2 lần cho cùng 1 câu
8. Host/player disconnect (ít nhất graceful)

---

# PHẦN 2 — DESIGN BRIEF DÁN SẴN

Chuẩn bị sẵn đoạn này. Dán **kèm vào prompt** ở CẢ Path A và Path B (để A/B công bằng — cùng input):

```
Design constraints (lock as canonical):
- Brand: "QuizHub", logo emoji ⚡, clean modern style.
- Primary color #0A3D62 (navy). Answer colors: red #E21B3C (triangle),
  blue #1368CE (diamond), yellow #D89E00 (circle), green #26890C (square).
- Font: Inter, bold, large for projector readability.
- Host screen = landscape (question + timer + answered count + leaderboard).
- Player screen = mobile portrait, 4 large color+shape answer buttons only.
- Join screen = PIN (6 digits) + nickname (max 12 chars).
- Rules: 5 questions about AI, 20s each, score = 1000 base + speed bonus.
- Stack: Node + Express + Socket.IO, in-memory state, no DB, no auth.
- UI text language: Japanese.
```

> Mẹo: muốn khoe thêm design power của CafeKit → chạy `/hapo:frontend-design` hoặc `/hapo:ui-ux-pro-max` TRƯỚC specs để AI đề xuất palette. Cho buổi live, chốt sẵn như trên nhanh & chắc hơn.

---

# PHẦN 3 — CÁC BƯỚC GÕ VÀO CLAUDE CODE

## 🅰️ Path A — KHÔNG CafeKit (thư mục `before/`)

Gõ tuần tự, mỗi dòng là 1 lần nhập:

```
1)  Build an MVP of a real-time quiz game like Kahoot (5 questions about AI).
    Host creates a room with a PIN, players join with PIN + nickname,
    show 5 questions (20s each), score by speed, show a leaderboard.
    [DÁN Design constraints — Phần 2 — vào đây]

2)  Run it.

3)  It crashed, fix the error.            (lặp lại mỗi khi lỗi)

4)  What happens if a player answers after time runs out?   (phải TỰ NHỚ hỏi)

5)  Write some tests.                      (phải TỰ đòi)
```

**Điểm cần chỉ ra:** AI nhảy thẳng vào code, không plan, không hỏi lại, không tự test. Gánh nặng nhớ-đủ dồn lên **người dùng**. AI vẫn báo "Done".

## 🅱️ Path B — CÓ CafeKit (thư mục `after/`, đã set `language: 日本語`)

```
1)  /hapo:question What is the project structure?       (tuỳ chọn — mở màn)

2)  /hapo:specs MVP of a real-time quiz game like Kahoot (5 questions about AI)
    [DÁN Design constraints — Phần 2 — vào đây]

    → CafeKit hỏi lại, chọn:
       • Creation Mode   → "Auto (→ Tasks)"
       • Japanese mirror → "Yes"
       • Scope (nếu hỏi) → "in-memory, no auth, no DB"

3)  /hapo:develop kahoot-mvp        (tên feature CafeKit in ra ở cuối bước 2)

4)  /hapo:test                      (evidence gate — đỏ thì AI tự sửa, không cho "done")

5)  /hapo:code-review

6)  /hapo:git
```

**Điểm cần chỉ ra:** AI tự hỏi gate, tự liệt kê edge case (gồm "sau hết giờ"), tự test, tự audit. Người dùng chỉ **quyết định ở gate + duyệt**.

---

# PHẦN 4 — KỊCH BẢN DIỄN THỰC TẾ (đã build xong cả 2 phía — ~30-35 phút)

> ⚠️ **Đã đo thời gian thật:** Path B `/hapo:specs` mất ~30 phút, `/hapo:develop` mất ~1h37. **KHÔNG live-build lại** — cả `before/` và `after/` đã build + verify sẵn. Live chỉ chạy phần NHANH + CHẮC (test, app), phần "quá trình" kể bằng lời + mở artifact có sẵn.

| Phần | Phút | Nội dung | Live hay show sẵn? |
|---|---|---|---|
| 0. Mở đầu | 3 | Vấn đề: AI vibe-code & nỗi lo enterprise | nói |
| 1. Path A | 5 | Kể quá trình 20', mở code có sẵn, chỉ bug governance-CSS | show sẵn (không build lại) |
| 2. Path B — governance | 8 | Mở sẵn `requirements.md` + `red-team-report.md` + `spec.json` | show sẵn |
| 3. Path B — evidence | 5 | Chạy `npm test` + `npm run test:e2e` | **LIVE** (nhanh, chắc) |
| 4. Payoff | 8 | Mở app đã chạy, chơi thử 1 ván | **LIVE** |
| 5. Hapo AI Hub + Q&A | 8 | Provider, token, đóng | nói |

### PHẦN 0 — Mở đầu (3')
> "Hôm nay tôi không chứng minh AI viết được code — ai cũng biết. Tôi chứng minh: để AI tự do viết một hệ thống real-time thì những lỗi nguy hiểm nhất bị giấu đi, và CafeKit ép nó lộ ra + sửa + chứng minh."

### PHẦN 1 — Path A: kể lại quá trình (5', không build lại)
Mở `before/` (code đã có), kể lại bằng lời: "~20 phút, 8 lần tôi phải tự nhắc AI — thêm câu hỏi lên phone, làm responsive, thêm QR — AI tự gây 4 bug rồi tự sửa". Mở nhanh 1 dòng CSS: chữ **"governance" lọt vào mã màu** (`#5b7governance`) — cười nhẹ, đúng chủ đề. Chốt: "cuối cùng không còn 1 test nào trong repo."

### PHẦN 2 — Path B: mở governance artifacts (8', không chạy `/hapo:specs` lại)
Mở sẵn trong editor, lướt nhanh, không đọc hết:
- `specs/quizhub-realtime-quiz/requirements.md` — chỉ vào vài dòng EARS có ID (`R1.4`, `R4.3`...) liệt kê đúng "trả lời sau hết giờ", "tie-break".
- `specs/quizhub-realtime-quiz/reports/red-team-report.md` — chỉ vào 1-2 finding thật: **host authorization** (ai cũng start được game), **stored XSS qua nickname**. Nhấn: "đây là AI tự tìm ra lỗ hổng bảo mật trước khi code, không phải sau khi bị hack."
- `spec.json` — chỉ `task_registry` (8 task, tất cả `done`) + `validation.status: completed`.

### PHẦN 3 — Path B: evidence gate (5', LIVE)
Terminal ở `~/demo/after`:
```bash
npm test          # 21/21 pass, ~1s
npm run test:e2e  # E2E PASS, ~2-5s — chỉ ra dòng tie-break "carol=0 dave=0 phân định bằng tốc độ"
```
> "21 test + 1 kịch bản end-to-end, chạy thật ngay đây, không phải slide."

### PHẦN 4 — Payoff: chơi thử (8', LIVE)
```bash
cd ~/demo/after && npm start     # hoặc PORT=<cổng đã chốt> npm start
```
Mở host tab (`/`) + 2-3 tab player (`/join`) trên cùng máy → chơi 1 ván 5 câu về AI → leaderboard live.

### PHẦN 5 — Hapo AI Hub + Q&A (8')
Provider gateway (`provider.hapo.work`), quản lý token tập trung, RTK tiết kiệm 60-90%. Q&A.

---

## 4b — Đánh giá thật sau khi build xong cả 2 phía

| Chỉ số | Path A | Path B |
|---|---|---|
| Thời gian | ~20 phút, 8 prompt lòng vòng | ~30' specs + ~1h37 develop (AI tự chạy phần lớn) |
| Test còn lại | **0** | **21 unit + 1 E2E**, chạy xanh |
| Bug tự gây | 4 (governance-CSS, dup PORT crash, emoji lọt dù cấm, sai dependency) | vài lỗi nhỏ **tự bắt + tự sửa trong quy trình**, ghi lại minh bạch |
| Bảo mật | không xét | red-team tự tìm: host-authorization, stored-XSS, DoS idle-room — sửa trước khi code xong |
| Trung thực khi xong | báo "Done" dù thiếu | tự nêu rõ "chưa verify visual/a11y trên browser" |

**Trục so sánh đúng cho khách tài chính (không phải "app nào chạy được" — cả 2 đều chạy):**
> "Cùng ra 1 app chạy được. Nhưng cái nào bạn **DÁM đưa lên production** một hệ thống tài chính?"

---

# PHẦN 5 — SO SÁNH A/B (slide-ready)

| Tiêu chí | 🅰️ Không CafeKit | 🅱️ Có CafeKit |
|---|---|---|
| User nhập | 1 prompt thô + thúc rời rạc | `/hapo:specs` + trả lời gate + duyệt phase |
| Ai nhớ edge case | **User** (dễ quên) | **CafeKit** (tự liệt kê EARS) |
| Kiến trúc | Không có plan | design.md + sơ đồ |
| Số lệnh chính | ~1 + n lần sửa vặt | `question → specs → develop → test → code-review → git` |
| Test | User phải tự đòi | Bắt buộc, gate chặn |
| "Xong" | AI tự tuyên bố | Phải có proof |
| Chia việc | Một đống | R0→R4 task rõ owner |
| Output | Code rời | Code + spec.json + tasks + report (audit) |
| Vai trò user | Thợ nhắc việc | Người duyệt/quyết định |

## 5b — Path A thực tế (quan sát từ lần build thật — DÙNG LÀM ĐIỂM NHẤN)

> App `before/` chạy được + đẹp, NHƯNG **quá trình** mới là điểm bán. Đây là bằng chứng thật, không dàn dựng.

- **~18-20 phút AI churn + ~8 lượt prompt** sau build đầu để "hoàn thành" → user tự lái từng bước (thêm câu hỏi lên phone, responsive PC/mobile, center layout, QR code...).
- **Bug AI tự gây rồi tự sửa:**
  - CSS typo `color: #5b7governance` — chữ **"governance" lọt thẳng vào mã màu** (mỉa mai đúng chủ đề demo — nên chiếu lên).
  - **Duplicate `const PORT`** → server **crash**, phải sửa.
  - Emoji 🏆 lọt vào `play.js` **dù prompt đã dặn "no emoji"**.
  - Sai dependency `lucide-static` → phải đổi `lucide`.
- **Test = ad-hoc rồi XOÁ.** `socket.io-client` cài `--no-save` → bị `npm prune` nuốt giữa chừng → cài lại. File test viết ở `/tmp` rồi `rm`. **Net: 0 test còn lại trong repo, 0 evidence trail.**
- **AI tự quyết** (phone buttons-only) → user phải đảo lại sau.
- User phải **chụp ảnh để debug**; 1 "lỗi" báo (PIN not found) thực ra **đúng behavior** — user lạc vì không có hướng dẫn.

**Câu nói khi diễn:** "App chạy được. Nhưng tôi mất 20 phút, gõ 8 lần, AI tự gây 4 bug rồi tự sửa, và cuối cùng **không còn một test nào**. Thậm chí chữ 'governance' lọt vào CSS. Với hệ thống tài chính, 'nhìn có vẻ chạy' không phải là 'đã chứng minh đúng'."

> ⚙️ Dọn nhẹ trước demo (KHÔNG sửa logic): `npm prune` để bỏ `socket.io-client` thừa. Giữ nguyên mọi thứ khác — kể cả việc thiếu test — làm điểm so sánh.

---

# PHẦN 6 — CHUẨN BỊ & CHỐNG LỖI LIVE

> ✅ Đã build + verify xong cả `before/` và `after/`. Việc còn lại là **dọn kỹ thuật** + **tập kịch bản**, không phải build thêm.

1. **Dọn cổng trước giờ họp:**
   ```bash
   lsof -i :3000 -sTCP:LISTEN   # kiểm tra cổng có bị chiếm không
   lsof -i :3005 -sTCP:LISTEN   # cổng đang test — dừng process cũ nếu còn chạy
   ```
   Chốt 1 cổng cụ thể, test lại `npm start` sạch trước giờ họp — tránh vướng process cũ từ lúc test.
2. **Restart sạch** cả 2 server (không để room/PIN cũ còn tồn tại từ lúc test lẫn vào lúc live).
3. **Mở sẵn trong tab/editor** trước khi bắt đầu: `before/` (code + chỗ CSS bug), `after/specs/quizhub-realtime-quiz/requirements.md`, `red-team-report.md`, `spec.json`, terminal ở `after/`.
4. **Quay video backup** 1 lượt: `npm test` xanh → `npm run test:e2e` xanh → chơi 1 ván. Phòng khi live lỗi mạng/máy.
5. ⚠️ **Kiểm tra lại `.claude/settings.json`** ở cả `before/` và `after/` không lộ trên màn hình lúc chuyển tab (chứa token thật).
6. **Tập nói phần "quá trình"** bằng lời tự nhiên (không đọc lại transcript) — 3 điểm nhấn: bug governance-CSS ở Path A, red-team bắt XSS/DoS ở Path B, evidence gate không cho "Done" khi chưa xanh.

---

# PHẦN 7 — CHECKLIST TRƯỚC GIỜ HỌP (build đã xong — đây là việc còn lại)

- [x] `before/` build + verify xong (chạy được, có bug governance-CSS làm điểm nhấn).
- [x] `after/` build + verify xong (spec + 21 test + E2E đều pass, red-team report có sẵn).
- [ ] ⚠️ Kiểm tra `.claude/settings.json` ở cả 2 thư mục không lộ token khi chuyển tab lúc demo.
- [ ] Dọn cổng: `lsof -i :3000`/`:3005`, dừng process cũ, chốt 1 cổng cho demo.
- [ ] Restart sạch server (không còn room/PIN cũ từ lúc test).
- [ ] Mở sẵn trong tab: `requirements.md`, `red-team-report.md`, `spec.json`, terminal ở `after/`.
- [ ] Quay video backup (`npm test` xanh → `npm run test:e2e` xanh → chơi 1 ván).
- [ ] Mở sẵn 2-3 tab player trên máy để mô phỏng nhiều người chơi.
- [ ] Tập nói phần "quá trình" (không đọc lại transcript).
- [ ] In/mở sẵn bảng so sánh Phần 4b (trục "dám lên production không").
- [ ] Zoom font terminal to, tắt notification.

---

# PHẦN 8 — Q&A KHÁCH HAY HỎI

- "Chạy được trên codebase cũ/lớn?" → `/hapo:docs --reconstruct` cho legacy.
- "Ngoài Claude Code?" → OpenCode đầy đủ, Cursor coming soon.
- "Data có ra ngoài?" → qua Hapo AI Hub gateway, kiểm soát tập trung.
- "Tốn token?" → RTK 60-90%.
- "Team chưa quen quy trình?" → hook ép tuân thủ tự động, không cần kỷ luật thủ công.
- "Real-time scale thế nào?" → MVP in-memory; v2 thêm Redis/DB (đã ghi out-of-scope).

---

## Quyết định đã chốt
1. Màu primary: **navy `#0A3D62`**.
2. Ngôn ngữ hệ thống/output spec/test/UI: **日本語**.
3. Khách KHÔNG join — chỉ show quá trình build + chạy kết quả trên máy Nghĩa.
4. Chủ đề 5 câu quiz: **về AI**.
5. Không nhờ Claude build pre-bake — **Nghĩa tự build** để nắm "quá trình" thật.
