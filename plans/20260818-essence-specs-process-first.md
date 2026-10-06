# Tinh tuý — Specs theo quy trình và con người

> Chưng cất 2026-08-18 từ: kernel CafeKit (~15-20k dòng, 700 test), ak-plan (~2.800 dòng prose),
> 9 bài học trả giá (audit 07/2026 → 9-round churn 08/2026), research ngoài (SDD, LLM-judge, task decomposition),
> và tài liệu chính chủ Anthropic về hành vi model 2026 (Fable 5 / Opus 5 migration + prompt-audit guide).
> Nguyên tắc chưng cất: mỗi luật phải trỏ được về một sự cố thật hoặc một bằng chứng thật. Không luật phòng xa.
> Bản đối chiếu chi tiết: `~/Desktop/cafekit-ref/plans/260817-2045-cafekit-specs-lean-review-authority/` (research 01-03).

## Triết lý (một câu)

**Chất lượng đến từ quy trình và phán xét; sự trung thực đến từ bằng chứng — và con người chỉ đứng ở ba cửa.**

## Ba cửa con người (không hơn)

Quy-trình-và-con-người chết vì hai thái cực: con người duyệt mọi thứ (nghẽn) hoặc không duyệt gì (AI tự tung).
Con người đứng đúng 3 chỗ, mỗi chỗ một quyết định gọn:

| Cửa | Khi nào | Con người quyết gì |
|---|---|---|
| **C1 — Scope** | Trước khi viết plan | Chọn MỞ RỘNG / GIỮ / CẮT sau khi AI trả lời 3 câu (đã có gì sẵn? tối thiểu là gì? có dấu hiệu phình?) |
| **C2 — Findings** | Sau adversarial review | Nhận/bỏ/sửa từng finding (đã lọc, dedupe, cap) |
| **C3 — Done** | Khi khai hoàn thành | Nhìn bằng chứng thật (lệnh + output), đóng dấu |

Ngoài 3 cửa: AI tự chạy, không hỏi.

## Mười luật

### Nhóm A — Viết kế hoạch

**A1. Scope chốt một lần.** Sau C1, không bàn lại scope ở mọi bước sau; lo ngại scope được nêu đúng một lần tại C1.
*Nguồn: ak scope-challenge; chữa bệnh 9-round mỗi vòng đẻ thêm contract (C14→C15→C16). Được docs Opus 5/Fable 5 xác nhận: "task scope expansion" vẫn là failure mode cần chặn bằng lời dặn.*

**A2. Nhỏ đến mức một lượt đọc giữ nổi.** Task ≤ ~5 file sở hữu, 1 outcome, 1 lệnh evidence. Plan > ~1.200 dòng hoặc > 8 contract → tách. Mỗi task xong phải có thứ chạy được. Ngưỡng ~5 file là khuyến nghị cho worker nhỏ/song song; model đỉnh chạy long-horizon có thể nới, nhưng plan quá ngưỡng đọc vẫn phải tách.
*Nguồn: L1 (spec 4.078 dòng tự mâu thuẫn); model rớt <25% accuracy trên patch >~107 dòng đa file.*

**A3. Một sự thật, một chỗ.** Mọi danh sách/enum/quyết định sống ở đúng một file; nơi khác tham chiếu, không copy.
*Nguồn: L1 — C15 enum drift ở 5 vị trí.*

**A4. File là sự thật.** Markdown con người đọc/sửa được là canonical; mọi index/state đều rebuild được từ file. Hand-edit không bao giờ là mối đe doạ — chỉ cần reindex.
*Nguồn: ak files-first; đảo cực khỏi spec.json-authority để thoát schema-kernel.*

### Nhóm B — Kiểm tra kế hoạch

**B1. Claim phải có địa chỉ.** Mọi khẳng định về codebase kèm `file:dòng` grep được. Không viết "update all callers" — phải đếm và liệt kê. Finding không địa chỉ = loại, không xét đúng sai.
*Nguồn: ak verification-roles + evidence auto-reject.*

**B2. Người lạ xé kế hoạch.** Reviewer là context mới, không thừa kế gì từ tác giả, prompt thù địch. Số reviewer & độ sâu co theo kích thước (1-2 phase → 2; 6+ → 4). Findings cap 15, dedupe, xếp severity → đưa về C2.
*Nguồn: ak red-team; chứng thực nội bộ — Codex fresh-context bắt 3 Critical mà tác giả mù 9 vòng. Docs Fable 5 xác nhận: "separate fresh-context verifier sub-agents tend to outperform self-critique".*

**B3. Sửa đâu, soát cả nhà.** Sau mỗi lần sửa plan: đọc lại toàn bộ file, lập danh sách delta (tên đổi, giả định bỏ, thứ tự đổi), truy quét tên cũ/giả định cũ trên mọi file. Còn mâu thuẫn → chưa được tuyên bố sẵn sàng.
*Nguồn: ak consistency-sweep; chữa đúng bệnh sửa-1-chỗ-sót-4-chỗ.*

**B4. Tối đa 2 vòng review trước dòng code đầu tiên.** Từ vòng 3, mọi finding phải kèm bằng chứng runtime. Vòng remediation không được làm plan to ra (dòng, contract) trừ khi finding chứng minh thiếu hụt thật; 2 vòng liên tiếp chỉ-thêm → tách hoặc hoãn phần đó.
*Nguồn: L3 + L8 — design trong chân không 9 vòng, 0 dòng code.*

### Nhóm C — Hoàn thành

**C-1. Xong = bằng chứng, không phải lời khai.** "Done" cần: lệnh đã chạy + exit code + output thật dán vào task, không placeholder. Con người nhìn bằng chứng tại C3.
*Nguồn: moat CafeKit; thực nghiệm "lời dặn đã cấm mà lỗi vẫn xảy ra" → prose một mình không đủ. Docs Fable 5 xác nhận: fabricated status reports vẫn tồn tại trên model mạnh nhất ("nearly eliminated" = baseline khác 0).*
*Ngoại lệ máy duy nhất được giữ (ĐÃ CHỐT 2026-08-18): hook kiểm receipt tồn tại + exit code + so content-hash (~200 dòng, gồm `spec-authoring-digest.cjs` 151 dòng đã có). Hash là toán, không phải văn — trích-dẫn-bịa không qua được. Docs chính chủ đồng thuận: "Enforce in code what can be enforced in code".*

**C-2. Nghi lễ phải trích dẫn sự cố — và phải có hạn dùng.** Muốn thêm bất kỳ bước/luật/check mới: phải trả lời "cái này chặn sự cố NÀO đã xảy ra thật?" Không trả lời được → không thêm. Chiều ngược lại: mỗi lần đổi model, audit lại bộ luật — luật đúng với model cũ có thể đang chủ động phá model mới (prompt là per-model artifact).
*Nguồn: giải phẫu spec firewall — phần lớn 16 contract sinh từ phòng xa; prompt-audit guide chính chủ: "re-audit at every model release".*

## Những gì cố tình VỨT (quan trọng ngang phần giữ)

**Vứt từ CafeKit:** schema exact-key validation từng object; epoch/attempt/repair_round machinery; ownership pairwise scan bằng máy; policy engine 2 trục (thay bằng bảng co giãn ở B2 + cửa C1); spec.json làm authority; digest-chain/generation/lineage tự chế (git là ledger).

**Vứt từ ak-plan:** `--html` editorial + watercolor illustration; wiki/GitHub publishing; kongming advisory mode; cross-plan dependency graph; plans.db kanban/dashboard; global scope; chế độ `--two`. Đó là feature, không phải tinh tuý — và chính ak-plan phình 608 dòng SKILL vì chúng.

## Giọng văn khi hiện thực (theo prompt-audit guide chính chủ)

- Nói chính xác điều mình muốn, ở âm lượng bình thường — không CAPS/CẤM/PHẢI dồn dập; nhấn mạnh lạm phát gây over-triggering trên model 2026.
- Mỗi luật kèm lý do ngay cạnh (bộ luật này đã làm sẵn qua dòng "Nguồn:").
- Cấm-đoán chỉ giữ khi failure còn tái hiện trên model hiện tại; cấm điều model không định làm có thể mồi nó làm điều đó.
- Bỏ mọi câu "double-check your answer" khi chạy Opus 5+ (model tự verify; lời dặn gây over-verification).
- Không hiển thị đếm-ngược token cho agent (gây context anxiety).

## Hình dạng hiện thực (ngân sách kích thước — chiến lược strangler ĐÃ CHỐT)

Viết skill mới trước, kernel để nguyên chạy song song; kernel chỉ gỡ sau khi skill mới dogfood đạt thước đo.

```
skills/specs/ (viết lại)
├── SKILL.md            ~150 dòng   # triết lý + 3 cửa + 10 luật + flow chính
├── references/
│   ├── review.md       ~120 dòng   # B1-B4: vai kiểm chứng, personas, sweep, cap
│   └── templates.md    ~80 dòng    # khung plan/task tối giản (A2), ví dụ evidence
└── hook giữ nguyên     ~200 dòng   # C-1: spec-gate receipt + spec-authoring-digest
─────────────────────────────────────
Tổng mới ≤ ~550 dòng  (so với ~15-20k hiện tại; ~2.800 của ak)
```

Bản draft đầu tiên: `plans/20260818-skill-specs-lean/` (đi qua đúng cửa C2 — user duyệt trước khi swap vào `packages/spec`).

## Thước đo thành công của bản chưng cất

1. Một feature vừa (3-5 task) đi từ ý tưởng → plan → review → code với **≤ 3 lần con người phải quyết**.
2. Không sự cố false-done nào lọt qua C3 trong tháng đầu dogfood (đo bằng spot-check).
3. Không luật mới nào được thêm mà thiếu trích dẫn sự cố (C-2) — đếm được trong git history.
4. Sửa một luật = sửa đúng 1 file (A3), không lan.
