# Specs v2 — Remake Blueprint

> North Star: implementer mới chỉ đọc spec và source anchors vẫn biết behavior,
> boundary, contracts, negative paths và proof cần có; không phải đoán quyết
> định product hay architecture.

Blueprint này mô tả contract Specs v2 theo source hiện tại. Nó không phải
release receipt hay claim full-suite green.

## Mô hình policy

Specs v2 có hai axis độc lập và persist cả hai trong `spec.json`:

| Axis | Giá trị | Ý nghĩa |
|---|---|---|
| `planning_depth` | `None`, `Compact`, `Full` | Mức durable authoring và topology artifact. |
| `assurance_level` | `Routine`, `Elevated`, `Strict` | Độ sâu review, counterexample và independent assurance. |

`Direct`, `Standard`, `Critical` chỉ là compatibility lanes. Source hiện tại
derive `Strict` thành `Critical`, `None + Routine` thành `Direct`, các tổ hợp
còn lại thành `Standard`. `execution_tier` chỉ là legacy read adapter;
`fast/standard/deep` không phải taxonomy canonical.

Risk có thể tăng assurance mà không tăng planning depth. Nhu cầu
decomposition có thể tăng planning depth mà không bịa thêm risk.
Canonical authoring chỉ cung cấp hai axis, `classified_minimum`, normalized
`risks`; `version` nhận diện v2.1. Reclassify trước persistence. Sau persistence,
same-feature baseline monotonic và không hỗ trợ downgrade đến khi có trusted
issuer; baseline không lây sang feature khác hoặc thay project minimum.

## Artifact topology

- `None`: không tạo durable spec, registry, research, task, phase, report hay receipt.
- `Compact`: core mặc định chỉ có `spec.json`, `requirements.md`, `design.md`.
- `Full`: bắt đầu bằng cùng core ba file; không tự động sinh ceremony.
- `research.md`: chỉ có khi uncertainty, external fact hoặc repository grounding
  cần durable record. Kết luận implementation-facing phải được chốt lại trong
  requirements/design.
- `tasks/`: chỉ có khi tồn tại boundary thật về ownership, dependency, durable
  transition, separate proof hoặc parallel coordination.
- Phase chỉ là nhóm task ID nhẹ trong `spec.json` cho complex Full graph. Không
  tạo `phase-*.md`, không copy task prose, không thay DAG edges.

Artifact bị cấm trong authoring bundle gồm `init.json`, `spec-state.json`,
`hydration.md`, `phase-*.md`, shorthand task filename và `feature-receipt.md` sớm.

## Adaptive authoring

Requirements nêu outcomes, scope/non-goals và acceptance đo được. User Story,
rationale hay scenario prose chỉ xuất hiện khi user workflow, error flow hoặc ví dụ
cụ thể giúp loại ambiguity; không là boilerplate bắt buộc.

Design Compact chỉ giữ boundary, typed anchors, decisions/invariants và
verification. Full bổ sung contract, flow, data, error/recovery, security hay migration
chỉ khi feature thật sự chạm boundary đó. Xóa optional heading không dùng.

Design có đúng một `## Verification Definitions`. Canonical syntax là một dòng
`- **Vn**: Criterion RN.M; Decision refs D/I/C; Method ...; Expected ...;
Negative/failure ...; Reachability/grounding ...`. Đây là syntax parser thật;
không thay bằng table hay V heading.

## Task plan

Task ưu tiên vertical outcome slice qua real runtime entrypoint. Chỉ tách ngang
khi dependency, ownership hoặc proof boundary yêu cầu. Mỗi task ngắn gọn gồm:

1. Outcome.
2. Scope.
3. Anchors and Ownership.
4. Changes, kể cả negative paths liên quan.
5. Acceptance map tới exact `RN.M`.
6. Dependencies.
7. Verification Plan: V ID, task role, command/inspection, expected result,
   negative-path disposition và runtime reachability.

Typed anchors dùng `ID | Type | Target | Role`; type hợp lệ là `file`, `symbol`,
`command`, `route`, `schema`, `contract`, `artifact`, `external`. File anchors đứng
trước; ID unique toàn spec. Design dùng `A-D-NN`; task-owned anchor dùng
namespace `A-R{requirement}-{sequence}-NN`.

Task ownership table duy nhất dùng sáu cột `ID | Type | Target | Role | Access |
Action`. `read/read` consume target tồn tại; `write/modify|delete` own target tồn
tại; `write/create` own target mới với parent/boundary đã ground. Mỗi `RN.M` có
một implementation owner. Proof subject implement criterion; verifier own proof
criterion/artifact riêng, reference V ID và không duplicate Acceptance của subject.

Task plan không chứa receipt fields, Base/Head, verdict, provenance, effort hay risk
table rỗng. Execution ghi receipt riêng cho từng task; `feature-receipt.md` chỉ được
tạo ở final feature closeout.

## Ba gate bổ sung nhau

1. `validate-spec-output.cjs`: structural consistency trên final bytes.
2. `spec-ground.cjs`: factual grounding bắt buộc của paths, symbols, commands,
   anchors và reachability; recompute deterministic, không sinh receipt.
3. Whole-spec LLM review: duyệt graph scope → acceptance → design/contracts →
   tasks → verification, rồi thử counterexample cụ thể.

Routine vẫn phải review whole-spec graph và ít nhất một counterexample liên quan
cho mỗi changed behavior. Elevated thêm targeted adversarial checks. Strict chạy
full red-team và cần host-hook-observed allowlisted reviewer event. Đây là
honest-agent guardrail, không phải host attestation hoặc security boundary.

Exit 0 chỉ chứng minh checks mà tool đã implement; không tự chứng minh semantic
quality, product correctness hay executable behavior. Chỉ set
`ready_for_implementation=true` sau khi artifact/graph/negative paths/verification
đồng nhất, semantic review hoàn tất và deterministic gates pass trên final bytes.
Đây là technical readiness, không phải user approval và không tự gọi Develop.

## Platform acceptance

Claude Code và Codex là hai acceptance target chính cho semantic authoring parity của
Specs v2. OpenCode vẫn là runtime được CafeKit hỗ trợ; blueprint này không
xóa hay hạ thấp claim hỗ trợ đó.

## Benchmark contract

Corpus Specs v2 phải record `planning_depth`, `assurance_level` và legacy `lane` để
không collapse hai axis thành một nhãn. Source `b1.v1` hiện chỉ validate
top-level `lane` và reject additional task fields. Trước khi có schema migration,
frozen experiment lưu hai axis trong sidecar/adjudication metadata được hash cùng
run; không claim harness đã enforce axis fields.

Live baseline/treatment receipts và semantic acceptance phải có evidence riêng.
Blueprint không biến validator pass, contract test hay scaffold output thành rollout
readiness.

## Unresolved questions

- Khi nào `b1.v1` sẽ migrate schema để validate hai axis trực tiếp thay vì frozen
  sidecar?
