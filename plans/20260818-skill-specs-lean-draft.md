# Draft skill specs v3 (lean) — trình duyệt tại cửa C2

> Ba file dưới đây là bản đề xuất thay cho `packages/spec/src/claude/skills/specs/` hiện tại.
> Sau khi user duyệt: tách thành file thật + cập nhật các test tham chiếu SKILL.md (việc riêng).
> Nguồn quyết định: `plans/20260818-essence-specs-process-first.md`. Tổng 216 dòng / ngân sách 550.

---

## File 1: `SKILL.md` (78 dòng)

````markdown
---
name: specs
description: Đưa một ý tưởng feature qua ba cửa — chốt scope, review thù địch, nghiệm thu bằng bằng chứng — rồi bẻ thành task nhỏ thực thi được. Dùng khi feature đủ lớn để cần kế hoạch; việc nhỏ một-hai file thì làm thẳng, không cần skill này.
---

# Specs — quy trình process-first

> **DRAFT v3 (2026-08-18)** — chờ duyệt tại cửa C2 trước khi swap vào `packages/spec/src/claude/skills/specs/`.
> Nguồn quyết định: `plans/20260818-essence-specs-process-first.md`.

Chất lượng đến từ quy trình và phán xét; sự trung thực đến từ bằng chứng — và con người chỉ đứng ở ba cửa. Skill này mô tả quy trình; máy chỉ giữ hai kiểm tra nhỏ nêu ở mục "Lằn ranh máy". Mọi thứ khác là phán xét của model và của người.

## Bước 0 — Có đáng viết plan không?

Chi phí kế hoạch tỉ lệ với kích thước việc. Sửa một bug rõ nguyên nhân, đổi một config, thêm một hàm nhỏ: làm thẳng, kèm bằng chứng khi xong. Chỉ đi tiếp các bước dưới khi việc chạm nhiều file/chủ đề, có lựa chọn kiến trúc, hoặc cần nhiều phiên/nhiều agent.

## Ba cửa con người

Con người quyết đúng ba lần; ngoài ba cửa này, agent tự chạy và không hỏi.

| Cửa | Khi nào | Con người quyết gì |
|---|---|---|
| **C1 — Scope** | trước khi viết plan | Chọn MỞ RỘNG / GIỮ / CẮT sau khi agent trả lời 3 câu scope |
| **C2 — Findings** | sau adversarial review | Nhận / bỏ / sửa từng finding (đã lọc, dedupe, cap 15) |
| **C3 — Done** | khi khai hoàn thành | Nhìn bằng chứng thật (lệnh + output), đóng dấu |

## Flow chuẩn

### 1. Scope Challenge → cửa C1

Trước khi viết một dòng plan, trả lời ngắn gọn ba câu:

1. **Codebase đã có gì sẵn?** — grep/đọc để tìm phần tái dùng được; nêu `file:dòng`.
2. **Change set tối thiểu là gì?** — tách phần bắt buộc khỏi nice-to-have.
3. **Có dấu hiệu phình không?** — chạm >8 file, >2 class/service mới, >3 nhóm việc là tín hiệu tự chất vấn.

Trình ba câu trả lời cho user kèm câu hỏi một lần: *MỞ RỘNG / GIỮ / CẮT?* Sau khi user chọn, scope được tôn trọng đến hết vòng đời plan — lo ngại về scope được nêu đúng một lần, tại đây (luật A1). Nếu giữa chừng phát hiện scope sai thật sự, quay lại C1 với bằng chứng, không tự nới.

### 2. Viết plan

Theo khung trong `references/templates.md`. Ba luật chi phối:

- **A2 — nhỏ đến mức một lượt đọc giữ nổi.** Mỗi task ≤ ~5 file sở hữu, một outcome, một lệnh evidence chạy được. Plan vượt ~1.200 dòng thì tách. Mỗi task xong phải có thứ chạy được — không có task "chỉ chuẩn bị". (Ngưỡng 5 file là mức cho worker song song; một model mạnh chạy long-horizon có thể ôm nhiều hơn, nhưng plan vượt ngưỡng đọc vẫn phải tách.)
- **A3 — một sự thật, một chỗ.** Mọi danh sách, quyết định, ngưỡng số sống ở đúng một file; nơi khác tham chiếu bằng đường dẫn, không copy. Đây là bài học đắt nhất của kernel cũ: một enum bị copy 5 chỗ đã tạo ra 9 vòng review churn.
- **A4 — file là sự thật.** `plan.md` + task files là canonical; mọi index/state machine chỉ là cache rebuild được từ file. Hand-edit là hợp lệ, không phải mối đe doạ.

Khi viết, mọi khẳng định về codebase kèm địa chỉ `file:dòng` (luật B1) — claim không kiểm được thì gắn `[CHƯA KIỂM]` để vòng review xử lý.

### 3. Review → cửa C2

Theo `references/review.md`. Tóm tắt: reviewer là **context mới** không thừa kế gì từ tác giả, prompt thù địch, mỗi finding phải có bằng chứng grep được; finding thiếu địa chỉ bị loại không xét. Findings cap 15, dedupe, xếp theo severity, rồi đưa user quyết từng cái tại C2.

Tối đa **2 vòng review trước dòng code đầu tiên** (luật B4). Từ vòng 3, finding phải kèm bằng chứng runtime. Vòng sửa không được làm plan to ra trừ khi finding chứng minh thiếu hụt thật — hai vòng liên tiếp chỉ-thêm là tín hiệu tách hoặc hoãn phần đó.

Sau **mỗi** lần sửa plan (do review hay do đổi ý): chạy consistency sweep — đọc lại toàn bộ file trong plan, lập danh sách delta, truy quét tên cũ/giả định cũ trên mọi file (luật B3, thủ tục trong review.md). Còn mâu thuẫn thì plan chưa sẵn sàng.

### 4. Thực thi

Làm một task một lúc, đúng scope task. Xong task nào, chạy đúng lệnh Evidence của task đó và **dán output thật** vào task file — lệnh, exit code, kết quả. Task song song thì mỗi worker một nhóm file riêng, không hai writer trên cùng file trong cùng wave.

### 5. Nghiệm thu → cửa C3

"Done" là kết luận rút ra từ bằng chứng, không phải lời khai (luật C-1). Một task done cần: lệnh đã chạy + exit code + output dán trong task file, không placeholder. User nhìn bằng chứng và đóng dấu. Hook máy (dưới) chặn các trường hợp receipt rỗng hoặc giả — nhưng hook là lưới cuối, không thay mắt người ở flow tương tác.

Báo cáo tiến độ trong khi chạy cũng theo luật này: chỉ báo việc trỏ được vào một tool result trong phiên hiện tại; việc chưa kiểm thì nói rõ là chưa kiểm.

## Lằn ranh máy — đúng hai kiểm tra, không hơn

1. **Done-gate (Stop hook, `spec-gate.cjs`):** task chuyển done phải có receipt trong task file — fenced command block, exit code thật, không placeholder `{{...}}`. Receipt chứa `Exit: 1` hay marker `PASS` trần đều bị chặn.
2. **Content-hash freshness (`spec-authoring-digest.cjs`):** verdict "đã review/validated" bị trói vào hash nội dung file tại thời điểm review. Sửa một byte sau đó → hash lệch → trạng thái tự hết hiệu lực. Hash là toán, không phải văn — trích dẫn bịa được, hash thì không.

Ngoài hai điểm này, không có schema validation nội dung nào. Nếu thấy cần thêm một check máy, đi qua luật C-2 trước.

## Bảo trì bộ luật (C-2)

- Muốn thêm bất kỳ bước/luật/check mới vào quy trình này: trả lời được *"nó chặn sự cố nào đã xảy ra thật?"* — kèm trích dẫn. Không trả lời được thì không thêm.
- Chiều ngược lại: mỗi lần đổi model chính, audit lại bộ luật — luật viết cho model cũ có thể đang chủ động làm hại model mới (prompt là per-model artifact).
- Giọng văn khi sửa file này: nói điều mình muốn ở âm lượng bình thường, kèm lý do; không thêm CẤM/PHẢI viết hoa dồn dập — nhấn mạnh lạm phát gây over-triggering trên model hiện tại.
````

## File 2: `references/review.md` (60 dòng)

````markdown
# Review kế hoạch — B1-B4 và cửa C2

Mục tiêu của review không phải là khen plan hay, mà là tìm cho ra chỗ plan sai trước khi code trả giá. Mọi phán xét ở đây do model làm; thứ giữ cho phán xét đó trung thực là **luật bằng chứng**.

## B1 — Luật bằng chứng

- Mọi finding phải kèm ít nhất một địa chỉ `đường/dẫn/file:dòng` lấy từ grep/đọc thật trên codebase hiện tại. **Finding thiếu địa chỉ bị loại thẳng, không xét đúng sai** — vì lý lẽ nghe xuôi mà không có địa chỉ chính là "citation theater".
- Khi plan nói sửa một hàm/interface: đếm và **liệt kê** mọi nơi gọi nó (`grep -rn`). Không chấp nhận "update all callers" — phải là "7 caller, gồm: ...". Quá 10 thì liệt kê 10 đầu + tổng số.
- Địa chỉ bịa vẫn lọt qua regex — nên reviewer phải chạy lệnh thật, và verdict cuối bị trói vào content-hash (lằn ranh máy trong SKILL.md), thứ duy nhất không bịa được.

## Bốn vai kiểm chứng

Mỗi reviewer mang một vai, với việc cụ thể phải làm:

| Vai | Kiểm gì | Cách làm |
|---|---|---|
| **Fact Checker** | Path, symbol, endpoint, config key trong plan có tồn tại không | grep/glob từng claim; output: VERIFIED (file:dòng) / FAILED / UNVERIFIED |
| **Flow Tracer** | Claim hành vi ("X gọi Y trước Z") có đúng call path không | đọc code path thật từ entrypoint; chỉ ra early return, async ordering bị bỏ sót |
| **Scope Auditor** | State mới thêm có đúng lifetime không (request/session/global) | grep mọi nơi khởi tạo; tìm state trùng chức năng đã có sẵn |
| **Contract Verifier** | Đổi interface có tính đủ consumer không | đếm + liệt kê caller, test, re-export, config, CLI help |

Độ sâu co theo kích thước plan — không kiểm mọi thứ với plan nhỏ:

| Số nhóm việc | Reviewer | Vai kích hoạt | Ngân sách kiểm |
|---|---|---|---|
| 1-2 | 2 | Fact Checker | ~5 claim/nhóm |
| 3-5 | 3 | + Contract Verifier | ~10 claim/nhóm |
| 6+ | 4 | đủ 4 vai | 15+ claim/nhóm |

## B2 — Red team: người lạ xé kế hoạch

- Reviewer là **context hoàn toàn mới** — session/subagent khác, không thừa kế hội thoại của tác giả. Đây là điều kiện cứng: tác giả tự soát đã được chứng minh là mù với contradiction của chính mình (9 vòng liên tiếp), còn fresh-context bắt được 3 Critical trong một lượt.
- Mỗi reviewer nhận một lens thù địch kèm một vai kiểm chứng ở trên:
  - *Security Adversary* — auth bypass, injection, lộ dữ liệu.
  - *Failure Mode Analyst* — race, mất dữ liệu, crash giữa hai bước ghi, recovery.
  - *Assumption Destroyer* — phụ thuộc ngầm, "chắc là chạy được", error path thiếu.
  - *Scope & Complexity Critic* — over-engineering, abstraction sớm, phần cắt được.
- Khung prompt cho reviewer: *"Bạn là reviewer thù địch, nhiệm vụ là phá plan này. Đọc các file sau [đường dẫn]. Với mỗi lỗ hổng: chỉ đúng vị trí trong plan, mô tả kịch bản thất bại cụ thể, xếp Critical/High/Medium, và kèm bằng chứng `file:dòng` từ codebase thật. Bỏ qua nhận xét văn phong."*
- Gom kết quả: dedupe mạnh tay, xếp theo severity, **cap 15 findings**. Nhiều hơn 15 nghĩa là plan cần tách, không phải cần danh sách dài hơn.

## Cửa C2 — người quyết từng finding

Trình bảng findings (severity, vị trí, kịch bản, bằng chứng, đề xuất sửa) cho user với ba lựa chọn mỗi finding: **nhận / bỏ / sửa đề xuất**. Áp các finding được nhận vào plan. Không tự áp trước khi user quyết.

## B3 — Consistency sweep (sau mọi lần sửa plan)

Sửa một chỗ mà quên bốn chỗ nhắc lại là bệnh đã giết plan tiền nhiệm. Thủ tục:

1. Đọc lại **toàn bộ** file trong plan — không chỉ file vừa sửa.
2. Lập danh sách delta của lần sửa này: tên đổi, field đổi, giả định bị bỏ, thứ tự/ownership đổi.
3. Search từng delta trên mọi file: tên cũ, giả định cũ, bản copy prose của thứ vừa đổi.
4. Reconcile hết; ghi một dòng kết quả (`files reread / deltas / stale fixed / còn mâu thuẫn: N`).

Còn mâu thuẫn chưa xử được → plan **chưa được tuyên bố sẵn sàng**, kể cả khi user đã duyệt findings.

## B4 — Điều kiện dừng vòng review

- Tối đa **2 vòng** trước dòng code đầu tiên. Review là để bắt lỗi chặn-code, không phải để plan tiệm cận hoàn hảo — hoàn hảo trên giấy đã được chứng minh là ảo giác (9 vòng, 0 dòng code, vẫn FAIL).
- Từ vòng 3: mọi finding phải kèm bằng chứng **runtime** (test chạy, lệnh chạy), không chỉ lý lẽ trên văn bản.
- Vòng sửa không được tăng kích thước plan (dòng, số quyết định) trừ khi finding chứng minh thiếu hụt thật. Hai vòng liên tiếp chỉ-thêm → tách hoặc hoãn cụm đó, quay lại C1 nếu cần.
````

## File 3: `references/templates.md` (78 dòng)

````markdown
# Khung plan, task và evidence

File là sự thật (A4): thư mục plan dưới đây là toàn bộ state. Không có registry máy nào là authority; công cụ nào cần index thì build từ file và rebuild được bất cứ lúc nào.

## Cấu trúc thư mục

```
plans/<YYYYMMDD>-<slug>/
├── plan.md            # tổng quan + quyết định C1 + bảng task
└── task-NN-<slug>.md  # một file một task, một owner
```

## Khung `plan.md` (giữ dưới ~80 dòng)

```markdown
# <Tên feature>

## Quyết định scope (C1 — <ngày>)
- Đã có sẵn: <phần tái dùng, kèm file:dòng>
- Tối thiểu: <phần bắt buộc>
- User chọn: MỞ RỘNG / GIỮ / CẮT — <một dòng lý do>

## Ngoài phạm vi
- <mỗi dòng một thứ cố tình không làm, để khỏi bàn lại>

## Task
| # | Task | Owner file chính | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| 01 | <tên> | src/... | - | pending |

## Review log
- Vòng 1 (<ngày>): N findings, user nhận X bỏ Y — sweep sạch.
```

## Khung task (`task-NN-*.md`, giữ dưới ~60 dòng)

```markdown
# Task NN — <outcome một câu>

## Scope
- Trong: <hành vi chính xác>
- Ngoài: <thứ dễ lấn sang nhưng không làm>

## File
- Sửa: src/a.ts, src/b.ts        # ≤ ~5 file sở hữu (A2)
- Đọc thêm: src/c.ts

## Acceptance
- <điều kiện đo được, không phải "hoạt động tốt">

## Evidence
Lệnh: `npm test -- --grep "export csv"`
<sau khi chạy, dán receipt thật vào đây — xem mẫu dưới>
```

## Receipt evidence — thế nào là đạt

Receipt là output thật của phiên hiện tại, dán nguyên văn. Mẫu đạt:

````markdown
## Evidence
```
$ npm test -- --grep "export csv"
  ✓ exports selected rows as csv (41ms)
  2 passing
Exit: 0
```
Result: PASS — 2/2 test, đã kiểm file xuất bằng `head out.csv`.
````

Không đạt (hook máy chặn, và người tại C3 cũng phải chặn):

- `Verification: PASS` trần, không có block lệnh nào — lời khai, không phải bằng chứng.
- Block lệnh có `Exit: 1` nhưng vẫn ghi PASS — bằng chứng thất bại không phải bằng chứng thành công.
- Còn placeholder `{{command}}` / `{{output}}` — khung chưa được điền.
- Output dán từ phiên trước / từ trí nhớ — bằng chứng phải tươi, chạy trong phiên khai done.

Một câu để nhớ khi viết receipt: *nếu người đọc không thể tự chạy lại đúng lệnh này và so kết quả, thì đó chưa phải bằng chứng.*
````
