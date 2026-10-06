# CafeKit Remake 9–10/10 — Execution Plan

> Ngày chốt: 2026-08-10
> Nguồn: audit độc lập trên harness, đọc 26 file trọng yếu / 5.156 dòng.
> Phạm vi: `specs`, `develop`, `test`, `code-review`, workflow policy, state và completion gates.
> Trạng thái: chưa triển khai. Không xem các checklist trong file này là bằng chứng hoàn thành.

## 1. Mục tiêu

Đưa workflow remake từ khoảng **6.5–7/10** lên **9–10/10** bằng hai kết quả đồng thời:

1. Gate máy không thể nhận thất bại, marker rỗng hoặc approval giả làm bằng chứng PASS.
2. Direct và Standard không bị kéo vào ceremony của Critical.

Nguyên tắc đích:

- Simple by default.
- Transparent always.
- Powerful on demand.
- Prose, executable policy và tests phải mô tả cùng một workflow.
- Model mạnh đảm nhiệm reasoning; machine chỉ giữ invariant có thể kiểm tra xác định.

## 2. Kết luận audit

| Khía cạnh | Điểm hiện tại | Nguyên nhân chính |
|---|---:|---|
| Nguyên tắc thiết kế | 8/10 | Lane và evidence direction đúng |
| Correctness của executable gate | 5/10 | Receipt và flash có đường bypass |
| Đồng nhất skill/runtime | 5.5/10 | Prose và policy khác nhau |
| Giảm ceremony/thời gian | 6/10 | Standard vẫn gần Critical |
| Phù hợp model mạnh hiện nay | 7/10 | Reasoning tốt nhưng bị policy trùng và hardcode |
| Tổng thể | **6.5–7/10** | Chưa đủ điều kiện 9–10/10 |

### 2.1 Finding đã xác nhận

1. `validateCanonicalReceipt()` chấp nhận receipt có `Exit: 1` vì chỉ kiểm tra sự tồn tại của `Exit:`.
2. Flash task có thể được promote và finalize chỉ bằng marker `Verification: PASS`.
3. `user_approved: true` đang được coi là authorization để downgrade Critical.
4. Active-spec resolver chỉ lấy directory `in_progress` đầu tiên rồi dừng.
5. Skill nói Critical delegation là risk-driven nhưng executable policy hardcode bốn agent.
6. Standard được mô tả là bounded nhưng develop/validator vẫn yêu cầu registry và task packet gần như Critical.
7. `--auto` vừa được mô tả như auto-approve vừa bị cấm tạo `user_approved`.
8. Receipt parsing bị copy giữa policy và gate.
9. Verdict của test và review chưa có một adapter chuẩn hóa chung.

### 2.2 Finding cần benchmark hoặc quyết định threat model

- Fail-open của hook khi JSON/state lỗi có phù hợp runtime threat model không.
- Session-state path/todo injection có cần redaction thêm không.
- Tollgate fingerprint có gây false cache trong flow thực tế không.
- Standard bounded bundle tối thiểu có đủ cho các feature một task không.

## 3. Principle học từ reference

### Giữ và áp dụng

- Core rule ngắn, chỉ chứa invariant.
- Một skill sở hữu một workflow.
- Chi tiết routing/state nằm trong authority reference hoặc executable module dùng chung.
- Gate tỷ lệ thuận với risk.
- Read-only và Direct đi thẳng.
- Files-first source of truth; index/cache là projection có thể rebuild.
- Routing theo capability và risk thực tế, không theo fixed agent chain.
- Verification theo blast radius rồi đối chiếu acceptance criteria.
- Parallelism chỉ khi dependency và file ownership cho phép.

### Không port nguyên trạng

- Không bê nguyên `ak-plan` hoặc `ak-cook`.
- Không bắt mọi task phải có plan, tester, debugger, reviewer và project manager.
- Không giữ nhiều approval checkpoint trước khi artifact được test.
- Không đưa UI publishing, HTML styling hoặc runtime workaround vào core skill.
- Không dùng keyword mơ hồ để tự bật auto/parallel.
- Không dùng line count, task count hoặc model strength làm proxy duy nhất cho risk.

## 4. Kiến trúc đích

```text
Request
  -> LanePolicy
  -> ActiveSpecResolver
  -> SpecGate
  -> TaskLoop
  -> Test + Review
  -> ReceiptValidator
  -> StateSync
  -> Completion
```

### Machine sở hữu

- Lane/risk snapshot và version.
- Downgrade authorization có provenance.
- Active-spec resolution duy nhất.
- Approval state transition.
- Registry/disk synchronization khi lane yêu cầu.
- Receipt parsing với `exitCode === 0`.
- Flash finite-state machine.
- Test/review verdict normalization.
- Safe path, reachability và security boundary.

### Model sở hữu

- Brainstorm/research depth.
- Requirements và design.
- Implementation và trade-off.
- Test depth theo blast radius.
- Có cần inspector/auditor/diagram/docs mở rộng hay không.
- Giải thích blocker và đề xuất escalation.

## 5. Artifact profile theo lane

| Lane | Artifact bắt buộc | Verification | Delegation |
|---|---|---|---|
| Direct | Không spec/state; receipt gọn trong response hoặc task hiện có | Targeted command + diff self-check | Không mặc định |
| Standard | `spec.json`, `requirements.md`, `design.md`, một feature receipt | Focused tests + một combined closeout review | Chỉ khi có capability/risk cần thiết |
| Critical | Full durable state, task packets/registry, strict receipts | Blast-radius suite + independent audit | Risk-driven obligations |

Quyết định đề xuất: **Standard không bắt task registry/research/implementation-notes mặc định**. Nếu một feature cần DAG nhiều task hoặc durable handoff, escalate thành Critical hoặc bật task bundle có chủ đích.

## 6. P0 — Đóng các bypass correctness

### P0.1 Một canonical receipt validator

Files dự kiến:

- `packages/spec/src/claude/scripts/workflow-policy.cjs`
- `packages/spec/src/claude/hooks/spec-gate.cjs`
- Các test receipt/gate tương ứng trong package spec

Checklist:

- [ ] Parse `Exit:` thành số; chỉ `0` là success.
- [ ] Nếu dùng `Result:`, chỉ literal `PASS` được chấp nhận.
- [ ] Reject receipt có cả `Verification: PASS` và outcome thất bại/mâu thuẫn.
- [ ] Command phải có giá trị, không chỉ có label.
- [ ] Base và Head phải có giá trị hợp lệ theo contract đã chọn.
- [ ] Artifact hash bắt buộc khi task khai báo artifact.
- [ ] `spec-gate.cjs` gọi validator dùng chung; xóa implementation regex copy.

Acceptance:

- `Exit: 1`, `Exit: -1`, `Exit: abc`, thiếu command, thiếu provenance và marker-only đều fail.
- Receipt hợp lệ với `Exit: 0` pass.

### P0.2 Flash state machine fail-closed

Files dự kiến:

- `packages/spec/src/claude/scripts/workflow-policy.cjs`
- `packages/spec/src/claude/skills/develop/SKILL.md`
- `packages/spec/src/claude/skills/test/SKILL.md`
- Test flash policy/state

Checklist:

- [ ] Chỉ canonical receipt hợp lệ mới được promote.
- [ ] `Verification: PASS` đơn lẻ không đặt `readyForSync=true`.
- [ ] `sync-finalize` gọi lại receipt validator, không chỉ kiểm tra prefix.
- [ ] `FLASH_UNVERIFIED` luôn giữ dependency blocked.
- [ ] State transition không hợp lệ phải trả blocker rõ ràng.

### P0.3 Active-spec resolver dùng chung

Files dự kiến:

- `packages/spec/src/claude/scripts/spec-state.cjs`
- `packages/spec/src/claude/hooks/spec-gate.cjs`
- Module resolver dùng chung phù hợp cấu trúc hiện có
- Test nhiều active specs

Checklist:

- [ ] Resolver nhận explicit feature/spec path khi mutation đã có target.
- [ ] Nếu không có target và có nhiều active specs, block với danh sách candidate.
- [ ] Không dùng “first directory wins”.
- [ ] Gate và state command dùng cùng resolver.

### P0.4 Authorization có provenance

Files dự kiến:

- `packages/spec/src/claude/scripts/workflow-policy.cjs`
- `packages/spec/src/claude/templates/spec-state.json`
- Runtime/approval adapter liên quan
- Test lane downgrade

Checklist:

- [ ] Xóa `user_approved` khỏi downgrade authorization synonyms.
- [ ] Không tin boolean do model tự ghi trong spec.
- [ ] Persist `override_receipt` gồm automatic lane, requested lane, risks, source và timestamp/session identity khả dụng.
- [ ] Không có receipt hợp lệ: chỉ được giữ nguyên lane hoặc escalate.

## 7. P1 — Tạo single source of truth

### P1.1 Persist workflow policy snapshot

Schema đích đề xuất:

```json
{
  "workflow_policy": {
    "version": "1",
    "lane": "Standard",
    "automatic_lane": "Standard",
    "risks": [],
    "artifact_profile": "bounded",
    "proof_obligations": [],
    "actor_needs": [],
    "override_receipt": null
  }
}
```

Checklist:

- [ ] Specs classify và persist đúng một lần tại boundary.
- [ ] Develop/validator/gate consume snapshot, không tự downgrade/reclassify.
- [ ] Downstream chỉ được escalate nếu phát hiện risk mới.
- [ ] Legacy `execution_tier` chỉ có adapter read-only; không emit/branch mới.

### P1.2 Policy trả obligations, không trả agent sequence

Thay:

```text
inspector -> implementer -> test-runner -> code-auditor
```

Bằng:

```text
needsInspection
needsExecutionProof
needsIndependentAudit
needsDurableTaskState
```

Skill/runtime hiện tại chọn actor khả dụng để thỏa obligation. Main session vẫn có thể tự thực hiện khi không cần independence.

### P1.3 Chuẩn hóa verdict

Canonical verdict đề xuất:

- `PASS`
- `FAIL`
- `BLOCKED`
- `PARTIAL`
- `NO_TESTS`

Checklist:

- [ ] Có một adapter từ test result sang ship decision.
- [ ] Chỉ `PASS` được phép hoàn tất.
- [ ] `PARTIAL` và `NO_TESTS` giữ trạng thái chưa hoàn tất.
- [ ] `BLOCKED` có blocker và không tự retry vô hạn.

### P1.4 Chốt semantics của `--auto`

Contract đề xuất:

> `--auto` tự generate và agent-validate artifacts, sau đó dừng ở một explicit user approval gate. Nó không tự đặt `user_approved` và không đồng nghĩa ready.

Checklist:

- [ ] Xóa mọi câu “auto-approved”.
- [ ] Completion message phản ánh chính xác ready/paused state.
- [ ] Nếu muốn truly non-interactive mode, thiết kế authorization riêng; không tái dùng `--auto`.

## 8. P2 — Giảm ceremony và context cost

### Specs

- [ ] Core `SKILL.md` chỉ giữ routing, phase contract, stop conditions và completion handoff.
- [ ] Chuyển EARS details, diagrams, discovery modes, scoring và templates sang lazy references.
- [ ] Direct không tạo spec.
- [ ] Standard chỉ tạo bounded artifacts.
- [ ] Critical mới tạo task registry/DAG/research khi risk cần.

Mục tiêu định hướng: `specs/SKILL.md` khoảng 150–220 dòng; line count không phải acceptance criterion.

### Develop

- [ ] Bỏ mandatory implementation notes; đổi thành `--notes` opt-in.
- [ ] Không hardcode delegation chain.
- [ ] Specific-task mode không auto-chain.
- [ ] Một owner duy nhất cho test/review closeout để tránh double-run.
- [ ] Docs checkpoint chỉ chạy khi có docs impact thực tế.

Mục tiêu định hướng: `develop/SKILL.md` khoảng 140–200 dòng.

### Test và review

- [ ] Test sở hữu execution proof.
- [ ] Review sở hữu correctness/security/spec compliance, không giả execution proof.
- [ ] Review depth theo risk/blast radius, không chỉ theo task count.
- [ ] Dùng chung verdict adapter và receipt schema.

### Taxonomy cleanup

- [ ] Lane là execution authority duy nhất.
- [ ] `Light | Standard | Deep` chỉ là legacy adapter.
- [ ] Cynefin chỉ tư vấn discovery/spike, không điều khiển ceremony độc lập.
- [ ] Task score không còn là mandatory workflow gate.

## 9. File-change map

| File/nhóm | Nội dung thay đổi |
|---|---|
| `scripts/workflow-policy.cjs` | Receipt parser, lane snapshot, obligations, approval provenance, verdict adapter |
| `hooks/spec-gate.cjs` | Dùng shared resolver/validator; bỏ regex copy; xử lý ambiguity |
| `scripts/spec-state.cjs` | Dùng shared active-spec resolver và fingerprint đầy đủ |
| `scripts/task-scaffold-guard.cjs` | Chỉ chỉnh nếu artifact profile cần lane-aware behavior |
| `scripts/state.cjs` | Redaction/fingerprint sau khi benchmark xác nhận nhu cầu |
| `templates/spec-state.json` | Thêm `workflow_policy`; chuẩn hóa casing/schema |
| `skills/specs/SKILL.md` | Lane artifact profiles, `--auto`, progressive disclosure |
| `skills/develop/SKILL.md` | Consume policy snapshot, bỏ fixed chain/mandatory notes |
| `skills/test/SKILL.md` | Canonical execution verdict và receipt |
| `skills/code-review/SKILL.md` | Canonical review verdict, không claim execution |
| Tests | Mutation matrix và E2E cho Direct/Standard/Critical |

## 10. Benchmark bắt buộc

### Security/correctness matrix

- [ ] Receipt `Exit: 1` bị reject.
- [ ] Receipt outcome mâu thuẫn bị reject.
- [ ] Marker-only flash không promote.
- [ ] Hai active specs không bị chọn nhầm.
- [ ] Critical downgrade không có runtime receipt bị reject.
- [ ] Path escape và phantom file vẫn fail-closed.

### Workflow E2E

- [ ] Direct task không tạo spec/state/agent ceremony.
- [ ] Standard feature đi hết flow với bounded artifacts, không dead-end vì thiếu registry.
- [ ] Critical feature giữ task traceability, strict evidence và independent audit.
- [ ] Specific-task mode dừng sau một task.
- [ ] `--auto` dừng tại user approval đúng như contract.

### Live model benchmark

Chạy cùng đề và cùng checkout cho các model đã chọn. Lưu riêng:

- thời gian hoàn thành;
- số tool calls;
- số lần hỏi user;
- số agent/delegation;
- artifact được tạo;
- false block;
- gate bypass;
- acceptance-criteria coverage;
- kết quả hidden validator.

Không cho model thấy oracle hoặc kết quả run khác. Failure do role/permission/harness phải phân loại là infrastructure blocked, không tính thành model-quality failure.

## 11. Điều kiện đạt 9–10/10

- [ ] 0 gate bypass trong adversarial receipt/flash/approval matrix.
- [ ] 0 phantom completion.
- [ ] 0 nhầm active spec.
- [ ] Prose, executable policy và behavioral tests cùng một contract.
- [ ] Direct không tạo ceremony ngoài targeted evidence.
- [ ] Standard không bị ép chạy full Critical bundle.
- [ ] Critical giữ 100% requirement traceability và strict proof.
- [ ] Không còn fixed agent chain trong executable policy.
- [ ] Không còn duplicate receipt validator.
- [ ] Live benchmark chứng minh giảm thời gian/tool rounds mà không giảm correctness.

## 12. Trình tự commit đề xuất

1. `fix: enforce canonical verification receipts`
2. `fix: make flash completion fail closed`
3. `fix: resolve active specs without first-match ambiguity`
4. `refactor: persist workflow policy and approval provenance`
5. `refactor: replace fixed delegation with proof obligations`
6. `refactor: align standard lane artifact profile`
7. `refactor: slim specs and develop workflows`
8. `test: add workflow policy adversarial benchmark matrix`

Mỗi commit phải có focused tests riêng. Chỉ đánh dấu checklist sau khi có command, exit status và artifact/diff evidence thực tế.

## 13. Ngoài phạm vi hiện tại

- Không xóa domain skills chỉ dựa trên audit 26 file.
- Không port toàn bộ reference corpus.
- Không đánh giá CI/CD hoặc GitHub status trong plan này.
- Không coi model mạnh là lý do giảm security boundary.
- Không đổi public command/namespace nếu chưa có quyết định migration riêng.

## 14. Quyết định cần chốt trước P1

1. Chấp nhận đề xuất Standard bounded bundle không task registry mặc định hay không.
2. Runtime nào phát hành downgrade approval receipt có provenance; nếu chưa có, tạm thời cấm Critical downgrade ở executable boundary.
