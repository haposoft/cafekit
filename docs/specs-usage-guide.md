# Hướng dẫn sử dụng `cf:specs` — process-first planning

`cf:specs` biến một ý tưởng thành một packet có thể đọc, review và thực thi
bằng Markdown thuần. Layout chính là `specs/<feature>/plan.md` kèm các file
`task-NN-<slug>.md` nằm cạnh nó. Luồng mới không dạy registry cũ; phần đó chỉ
còn ở legacy adapter.

## Routing thích ứng theo risk

Luôn phân loại material risk trước khi chọn workflow; cách người dùng gọi một
việc là “nhỏ” hoặc “routine” không được hạ risk floor đã quan sát.

| Route | Điều kiện |
|---|---|
| Làm trực tiếp | Chỉ khi cause và change đều clear, isolated, reversible, `routine`, và likely giới hạn trong một hoặc hai file |
| GATE-SCOPE/GATE-REVIEW | Còn user-owned observable choice; hỏi và giữ phần bị ảnh hưởng ở `blocked` |
| Brainstorm | Có material competing technical designs, sau khi user-owned choices đã chốt |
| Một Specs packet | Material work không đủ điều kiện Direct và không phải Brainstorm-only exploration |
| Split Specs | Có từ ba independent subsystem trở lên; mỗi subsystem có outcome, boundary và verification/deployment path tự đi qua lifecycle |

Risk floor tối thiểu:

- `critical`: auth/secrets/privacy; destructive/irreversible hoặc nguy cơ mất,
  hỏng dữ liệu; money/privilege/safety; production-state mutation.
- `elevated`: cross-component contract, compatibility, concurrency, external
  integration, hoặc installed/runtime behavior.
- `routine`: chỉ khi không có signal `critical` hay `elevated`.

## Brainstorm thích ứng

Brainstorm mặc định giữ proportional: phân loại Direct trước mọi analysis
overlay, sau đó yêu cầu non-direct mới chọn độ sâu Standard hoặc Deep nhỏ nhất
đủ dùng. Chỉ parse control trong leading control segment. Ba exact flag
single-use `--deep`, `--visual`, `--advice` có thể kết hợp theo mọi thứ tự;
unknown hoặc duplicate leading `--*` phải dừng với usage và không thực hiện hành
động. `--` kết thúc control; dùng `/cf:brainstorm -- --dry-run` khi nội dung
literal bắt đầu bằng flag.

`--deep` chỉ tăng độ sâu cho non-direct analysis. `--visual` chỉ đổi cách trình
bày và fallback về text. `--advice` chỉ gọi brainstormer tư vấn sau khi đã có
material choice. Context gửi external visual tool hoặc adviser phải được minimize
và redact trước; hai overlay không được write, approve, persist, dispatch hay
complete công việc. Output mặc định ở chat; ghi file cần explicit user authority.
Output Brainstorm không phải live proof, cũng không tạo approval hoặc execution
authority cho Specs/Develop.

## Ba cổng quyết định

| Cổng | Khi nào | Quyết định của người dùng |
|---|---|---|
| GATE-SCOPE | Trước khi viết plan | EXPAND, KEEP hoặc CUT |
| GATE-REVIEW | Sau adversarial review | Accept, reject, hoặc revise từng finding |
| GATE-DONE | Sau execution | Chấp nhận completion từ output và receipts hiện tại |

Chỉ hỏi ở ba cổng này. Nếu evidence mới làm scope sai, quay lại GATE-SCOPE thay vì tự
nới phạm vi âm thầm.

## Luồng chính

1. Scout repo trước khi viết kế hoạch: tìm code đã có, callers, tests, exports,
   file thật và bất kỳ điểm tái sử dụng nào.
2. Viết `plan.md` như một index ngắn: quyết định GATE-SCOPE, acceptance criteria kiểu
   EARS, explicit exclusions, và bảng task.
3. Review adversarially từ fresh context, dedupe finding, cap danh sách ở 15,
   và dừng sau tối đa hai vòng giấy.
4. Execute một task chưa bị block tại một thời điểm: đổi `Status:` sang
   `in_progress`, implement đúng Outcome và Acceptance, rồi chạy verification
   thật.
5. Ghi inline canonical `## Receipt`, đổi `Status:` sang `done`, rồi sync trạng
   thái hiện tại thay vì mô tả điều chưa xảy ra.

## Packet chuẩn

```text
specs/<feature>/
├── plan.md
├── task-01-<slug>.md
└── task-NN-<slug>.md
```

### `plan.md`

- GATE-SCOPE scope decision và explicit exclusions.
- EARS acceptance criteria có ID ổn định.
- Bảng task: mỗi criterion phải map tới ít nhất một task và một proof command.

## Coverage profile

Một Specs route giữ đúng một bảng canonical trong `plan.md`, mỗi row là một
externally observable outcome:

| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Kết quả người dùng hoặc hệ thống quan sát được | Mọi kind liên quan | Mọi surface material | State và action | Risk floor và evidence | Tập `source`/`installed`/`live` cần chứng minh |

Change kinds là tập nhiều giá trị; kind hoặc surface chưa có tên dùng
`other:<verbatim>` thay vì bị bỏ qua. Mỗi task có `## Coverage` và chỉ tham
chiếu các `CP-NN` mình sở hữu; không copy profile sang task. Obligations chỉ
union trong affected rows/tasks. Sau scope, outcome, criteria, ownership,
dependency, risk hoặc proof delta đã được chấp nhận, rederive affected CP rows
trước khi derive task status.

## Ambiguity và task status

| State | Hành động bắt buộc | Hệ quả status |
|---|---|---|
| `none` | Tiếp tục | Có thể vào `pending` khi các blocker khác đã đóng |
| `examples-needed` | Thêm ví dụ chỉ để làm rõ rule đã quyết định; nếu ví dụ đổi observable behavior thì promote sang `decision-needed` | Không tự chọn product outcome |
| `decision-needed` | Hỏi người dùng tại GATE-SCOPE/GATE-REVIEW | Affected task giữ `blocked` |
| `design-needed` | Sau khi user-owned decision đã chốt, chuyển material competing designs sang Brainstorm | Chưa author implementation choice trong task |

`pending` nghĩa là semantic contract và reachability đã biết, chưa có nghĩa
proof đã chạy. `done` chỉ hợp lệ khi required execution evidence hiện tại PASS
và inline Receipt canonical đầy đủ.

### `task-NN-<slug>.md`

- Một `Status:` duy nhất.
- Một outcome, một owner, một verification plan.
- Một `## Coverage` tham chiếu chính xác các `CP-NN` của task.
- Một canonical `## Receipt` ở cuối file khi task đã done.

## Proof lifecycle

`Required proof` trong CP row là planned level set, không phải evidence đã chạy.
Với từng level cần thiết, task map named probe và reachability tương ứng; một
command có thể chạy nhiều level probes nếu từng probe được nêu rõ.

- `UNKNOWN` command/caller/environment reachability giữ task ở `blocked`.
- Known nhưng chưa chạy required proof vẫn có thể ở `pending`.
- Missing, failed hoặc unavailable required evidence chặn `done` và GATE-DONE.
- `source`, `installed` và `live` độc lập; PASS ở level này không promote level
  khác. Source/static checks chỉ chứng minh written contract, không chứng minh
  live-model adherence.

## Structural speed và wall-clock

Direct gate, một CP row cho mỗi outcome, affected-row union, giới hạn paper
review và split theo independent subsystem giúp giảm ceremony theo cấu trúc.
Chúng không phải số đo thời gian. CafeKit chưa đo wall-clock generation time và
không công bố SLA cho Specs. Đề xuất recorder/benchmark ban đầu tại
`specs/specs-session-timing-benchmark/plan.md` đã được người dùng CUT và lưu làm tư liệu tại
`specs/archive/specs-session-timing-benchmark-v2-cut-20260826/plan.md`; không có
kết quả timing hay execution Receipt nào được tạo.

## Test proof handoff

Với process-first packet, `cf:test` đọc byte hiện tại của `plan.md` và flat
`task-NN-*.md`, chạy đúng Command cùng từng Named probe trong Verification Plan,
rồi trả một machine handoff `test-proof-v1`. Test không ghi `Status:` hay inline
`## Receipt`; Develop controller là writer duy nhất sau khi payload và review đều
literal `PASS`.

Payload dùng closed schema gồm target, bốn verdict canonical, command/exit/counts,
Base/Head provenance, proof level, expected/observed, reachability, artifacts,
branches, raw output, redactions và stable SHA-256 digest. Unknown field/verdict,
zero-test, required skip, duplicate/missing branch, stale Head, unsafe redaction,
hoặc `PASS_WITH_WARNINGS` đều không đóng task. `source`, `installed`, `live` vẫn
tách biệt; source/static PASS không chứng minh live adherence.

Test memory chỉ là context read-only. Proof không tự cài dependency, không tạo
project-local report/cache/auth state, chỉ cleanup exact Test-owned temp nằm ngoài
project, và báo tracked/untracked/ignored drift của project command riêng với
Head. Authenticated UI proof phải bind vào HTTPS/localhost origin, identity,
permission và action scope; cross-origin redirect hoặc destructive production
action thiếu fresh consent sẽ `BLOCKED`. Cookie, token, credential và scoped PII
phải được redact khỏi command, network, log, screenshot và report.

Human report chỉ tóm tắt verdict, command/exit, counts, reachability, proof level,
drift và next action; full JSON/raw log không bị chép vào report. Đây là contract
cấu trúc, không phải benchmark thời gian hay tuyên bố model live đã tuân thủ.

Legacy feature có `spec.json`, nested task hoặc receipt riêng tiếp tục dùng
separate-receipt adapter cũ. Test không tìm hoặc tạo separate receipt cho flat
process-first task, và không migrate hai layout trong lúc proof.

### Receipt canonical

````markdown
## Receipt

Verification: PASS
Command: pnpm test -- --filter example
Exit: 0
Base: <runtime-derived base commit>
Head: <runtime-derived tree digest or commit>
```text
$ pnpm test -- --filter example
PASS example.test.ts
Tests: 3 passed, 3 total
```
````

Receipt không hợp lệ nếu thiếu fenced output, thiếu `Exit: 0`, thiếu `Base` /
`Head`, có placeholder, hoặc chỉ là một câu PASS rỗng.

## Develop và Sync

- `cf:develop <feature>` tái dùng GATE-SCOPE/GATE-REVIEW đã duyệt, chọn task đầu tiên có
  dependency hợp lệ theo thứ tự trong `plan.md`, rồi tiếp tục tuần tự tới blocker
  thật hoặc GATE-DONE. Không hỏi lại ở mỗi task.
- `cf:develop <feature> task-NN-<slug>.md` chỉ làm đúng task được chỉ định,
  không chạm sibling và dừng ngay sau sync thành công.
- Trạng thái `paused`, `blocked`, dependency không hợp lệ, nhiều task
  `in_progress`, hoặc concurrent drift đều fail-stop. Một task `in_progress` bị
  gián đoạn chỉ resume phần Acceptance còn thiếu và phải chạy proof mới.
- `--parallel` chỉ dùng worktree tách biệt, tích hợp đủ commit range và owned-path
  tree; SHA handoff của worker không thay thế runtime `Head` trong Receipt.
- `--flash` giữ task ở `in_progress` với `FLASH_UNVERIFIED`, không chain và không
  được promote cho tới một lần non-Flash rõ ràng chạy fresh canonical proof.
- Trước GATE-DONE, Develop lặp lại proof của Receipt stale cho tới khi hai lần capture
  `Head` liên tiếp giống nhau và mọi task `done` cùng bind vào `Head` hiện tại.
- Các số như số test, số named probe, số file và line budget là structural
  metrics, không phải đo wall-clock hay cam kết tốc độ. Source/installed checks
  cũng không chứng minh hành vi model thật; live-model adherence là
  `[UNVERIFIED]` nếu chưa có host invocation.
- `cf:sync` chỉ cập nhật observed state của task file và receipt.
- `sync-finalize` chỉ dùng để promote một task flash/unverified sau khi có fresh
  canonical PASS.

## Legacy compatibility

Nếu một feature đã có `spec.json`, nested `tasks/task-R*.md`, hoặc receipt
riêng, hãy giữ nó trên legacy adapter đang cài sẵn. Phần legacy có thể tiếp tục
giữ `spec.json`, `task_registry`, `planning_depth`, `assurance_level`, `lane`,
`execution_tier`, và `semantic_model`, nhưng các field này không thuộc v3
packet mới.

## Tham chiếu

- Mẫu packet và receipt: `packages/spec/src/claude/skills/specs/references/templates.md`
- Quy tắc review: `packages/spec/src/claude/skills/specs/references/review.md`
