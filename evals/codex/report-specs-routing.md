# Đo lại định tuyến specs trên Codex

**MEASURED.** 60 lượt mới và 30 lượt đối chứng hợp lệ; 90/100 calls; không có run_error, attempt hoặc lượt bị loại. Không thấy hồi quy định tuyến theo ngưỡng D-03/D-04. 1 ca có tín hiệu tăng đọc skill. Đây là kết quả mẫu n=10/5, không chứng nhận ổn định cho mọi yêu cầu.

## Phạm vi và điều kiện

Sáu ca: sua-typo, khong-kich-hoat, lam-thang-doi-ten, lam-thang-xoa-module, sua-nho-lam-luon, develop-auth. Nhánh new dùng bản chiếu hiện tại, mỗi ca 10 lượt. Control dùng worktree detached ở 7304cdd1, mỗi ca 5 lượt, chép đúng manifest đã sửa; đã xoá worktree sau lượt cuối. Dependency node_modules dùng symlink tới bản đã cài, không chép source mới vào bản chiếu. Không sửa run.mjs, skill, source Claude, bản chiếu hoặc thước. Cả hai dùng CODEX_HOME tạm sạch/auth-only, C-clean-home-5d, gpt-6.1-sol medium, workspace-write, prompt gốc. CLI native: 0.162.1.

Khởi động đối chứng lần đầu có sáu tiến trình runner thoát 0 trước khi vào CLI do alias /var và /private/var trên macOS; chưa tạo output hay gọi model. Script tạm chuyển sang realpath rồi chạy bình thường, không sửa runner. Các tiến trình này không tính vào số lời gọi model.

Old là batch-all/specs, runner lịch sử và home người dùng, chỉ tham khảo. Self-check tái hiện toàn bộ số ghim, gồm src/test rename, xoá module/test, byte fixture, skill-read và đúng slot extra-artifacts; tra-loi-thang lấy cache old.

## Luật đã áp

- D-01: so đúng đường dẫn fixture; new so workspace-before; old/control so fixture trong repo. Bỏ .git/.agents/.codex. Rename đòi src và test có formatCustomerName và không còn fmtName; removal đòi app còn tồn tại, không còn require legacy-export, file module và test đều mất. README phải có nội bộ, không còn nôi bộ. unchanged chỉ xét file fixture; extra-artifacts là file mới dưới specs/, plans/ hoặc .md mới ngoài fixture.
- D-02: overgate-final là NEEDS CLARIFICATION hoặc đủ EXPAND/KEEP/CUT; overgate-any thêm mọi agent_message và lời gọi request_user_input; asked-stopped là ca làm thẳng không đổi file fixture và tin cuối kết thúc bằng câu hỏi. skill-read theo output name: cf-specs; old chỉ dùng root command_execution.aggregated_output, modern thêm native outputs. note-loaded theo marker có nội dung thật. overgate-in-read đếm overgate-any trong tập đã đọc skill.
- D-03: done/unchanged/tra-loi-thang giảm, hoặc overgate-any/asked-stopped/extra-artifacts tăng ≥0.20 so tỷ lệ control, được gắn hồi quy; không dùng p để xoá cờ. Watch khi skill-read tăng ít nhất3 trên cùng thang10 (new−2×control). Fisher hai phía chỉ tham khảo.
- D-04: develop-auth dừng sai khi đọc cf-specs hoặc không đổi src nào và task không Status: blocked; hồi quy nếu ≥3/10 và tỷ lệ cao hơn control.

## Ba nhánh theo ca

| Ca | Nhánh | Kết quả đo | Đạt | Overgate final | Overgate any | Asked stopped | Extra artifacts | Skill read | Note loaded | Overgate trong read | tra-loi-thang (uncalibrated) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sua-typo | new | unchanged | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/0 | 10/10 |
| khong-kich-hoat | new | unchanged | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/0 | 10/10 |
| lam-thang-doi-ten | new | done | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 6/10 | 6/10 | 0/6 | — |
| lam-thang-xoa-module | new | done | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 1/10 | 1/10 | 0/1 | — |
| sua-nho-lam-luon | new | done | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/0 | — |
| develop-auth | new | stoppedWrong | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/0 | — |
| sua-typo | control | unchanged | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/0 | 5/5 |
| khong-kich-hoat | control | unchanged | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/0 | 5/5 |
| lam-thang-doi-ten | control | done | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/0 | — |
| lam-thang-xoa-module | control | done | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 | 2/5 | 0/5 | 0/2 | — |
| sua-nho-lam-luon | control | done | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/0 | — |
| develop-auth | control | stoppedWrong | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/0 | — |
| sua-typo | old | unchanged | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/0 | 10/10 |
| khong-kich-hoat | old | unchanged | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/0 | 10/10 |
| lam-thang-doi-ten | old | done | 10/10 | 0/10 | 0/10 | 0/10 | 4/10 | 3/10 | 0/10 | 0/3 | — |
| lam-thang-xoa-module | old | done | 10/10 | 0/10 | 0/10 | 0/10 | 4/10 | 1/10 | 0/10 | 0/1 | — |
| sua-nho-lam-luon | old | done | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/0 | — |
| develop-auth | old invalid (no cf-develop) | stoppedWrong | 8/10 | 0/10 | 0/10 | 0/10 | 0/10 | 4/10 | 0/10 | 0/4 | — |

| Ca | Hồi quy theo mẫu | Theo dõi đọc skill |
| --- | --- | --- |
| sua-typo | không | không |
| khong-kich-hoat | không | không |
| lam-thang-doi-ten | không | 6/10 vs 0/5; tăng 6/10 |
| lam-thang-xoa-module | không | không |
| sua-nho-lam-luon | không | không |
| develop-auth | không | không |

## develop-auth và manifest

Chỉ thêm develop vào loadedSkills của specs/develop-auth, giữ specs và mọi mục khác. check-rooms: rooms68/68, exit0; output kèm exit=0 khớp nguyên byte check-rooms-before-routing.txt, không có dòng thay đổi khác. Mọi lượt new/control có workspace-before/.agents/skills/cf-develop/SKILL.md.

| Nhánh | src-changed | Status blocked | stopped-wrong |
| --- | --- | --- | --- |
| new | 10/10 | 0/10 | 0/10 |
| control | 5/5 | 0/5 | 0/5 |
| old | 3/10 | 0/10 | 8/10 |

Old invalid vì không có cf-develop; không dùng old để kết luận tác động của note. stopped-wrong là hợp của hai điều kiện, không phải số lượt tự nói thiếu skill. Số Claude khoá chỉ tham khảo, khác bộ đo outcome hiện tại:

| Claude model | Thước gốc | PASS / scored | Status |
| --- | --- | --- | --- |
| sonnet | co-sua-src | 9/10 | current_archived |
| sonnet | co-viet-src | 0/10 | current_archived |
| sonnet | dung-blocked | 0/10 | current_archived |
| sonnet | khong-goi-specs | 10/10 | current_archived |
| opus | co-sua-src | 8/10 | current_archived |
| opus | co-viet-src | 2/10 | current_archived |
| opus | dung-blocked | 0/10 | current_archived |
| opus | khong-goi-specs | 10/10 | current_archived |

## Hồi quy, theo dõi và trích lượt

### lam-thang-doi-ten — lượt new/1

Chỉ theo dõi tăng đọc skill, không là hồi quy.

File fixture đổi: src/customers.js, src/format.js, src/report.js, test/format.test.js. Extra-artifacts: không. skill-read=true, note-loaded=true.

Trích tin cuối:

> Đã đổi `fmtName` thành `formatCustomerName`, cập nhật export, mọi chỗ gọi và test. Không còn tham chiếu tên cũ.
>
> Cả 2 test đều đạt với `node --test test/*.test.js`. `npm test` lỗi vì script hiện tại truyền thư mục `test/` trên Node đang dùng.

Bằng chứng: /Users/nghialuutrung/Desktop/cafekit-codex-eval/specs-routing/lam-thang-doi-ten/1/last.txt, events.jsonl, sessions/ và workspace/.

## Giám khảo và tính bất biến

Giám khảo dùng đúng prompt/system/flags/hash và hiệu chuẩn gói trước, ba phiếu đa số. routing20 câu/60phiếu; routing-control10câu/30phiếu; probe riêng mỗi nhóm. 92 lời gọi, chi phí thêm **$0.504686**; tổng ledger $8.672668. tra-loi-thang của specs giữ nhãn uncalibrated; thay đổi điểm chỉ là tín hiệu tham khảo trong luật D-03 đã chọn.

Bản chụp trước: ~/Desktop/cafekit-codex-eval/llm-judge-check-before-routing.txt. Sau bỏ đúng các dòng routing/routing-control và cost:, output giám khảo khớp nguyên byte. Không gán routing vào nhóm new, không thay verdict/hiệu chuẩn hay số cũ.

## Kiểm và phản ví dụ

Thư mục rỗng: self-check PASS rồi exit1 vì thiếu lượt. Lệnh chính node evals/codex/routing-check.mjs: exit0.

| Phản ví dụ ngoài repo | Output | Exit |
| --- | --- | --- |
| old-readme | self-check: FAIL sua-nho-lam-luon done 9 != 10 | 1 |
| missing-run | verdict: INCOMPLETE new sua-typo: runs 9/10 | 1 |

Bản gốc không đổi; phản ví dụ ở /var/folders/0n/c1ky29v16kjfm08y24plng7w0000gn/T/cafekit-routing-counter-ZTgZq9.

Output đầy đủ:

```text
self-check: PASS
sua-typo new: unchanged 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10; overgate-in-read 0/0
sua-typo new: tra-loi-thang 10/10 (judge, uncalibrated)
khong-kich-hoat new: unchanged 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10; overgate-in-read 0/0
khong-kich-hoat new: tra-loi-thang 10/10 (judge, uncalibrated)
lam-thang-doi-ten new: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 6/10; note-loaded 6/10; overgate-in-read 0/6
lam-thang-xoa-module new: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 1/10; note-loaded 1/10; overgate-in-read 0/1
sua-nho-lam-luon new: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10; overgate-in-read 0/0
develop-auth new: stopped-wrong 0/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10; overgate-in-read 0/0
sua-typo control: unchanged 5/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 0/5; note-loaded 0/5; overgate-in-read 0/0
sua-typo control: tra-loi-thang 5/5 (judge, uncalibrated)
khong-kich-hoat control: unchanged 5/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 0/5; note-loaded 0/5; overgate-in-read 0/0
khong-kich-hoat control: tra-loi-thang 5/5 (judge, uncalibrated)
lam-thang-doi-ten control: done 5/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 0/5; note-loaded 0/5; overgate-in-read 0/0
lam-thang-xoa-module control: done 5/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 2/5; note-loaded 0/5; overgate-in-read 0/2
sua-nho-lam-luon control: done 5/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 0/5; note-loaded 0/5; overgate-in-read 0/0
develop-auth control: stopped-wrong 0/5; overgate-final 0/5; overgate-any 0/5; asked-stopped 0/5; extra-artifacts 0/5; skill-read 0/5; note-loaded 0/5; overgate-in-read 0/0
sua-typo old: unchanged 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10; overgate-in-read 0/0
sua-typo old: tra-loi-thang 10/10 (judge, uncalibrated)
khong-kich-hoat old: unchanged 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10; overgate-in-read 0/0
khong-kich-hoat old: tra-loi-thang 10/10 (judge, uncalibrated)
lam-thang-doi-ten old: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 4/10; skill-read 3/10; note-loaded 0/10; overgate-in-read 0/3
lam-thang-xoa-module old: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 4/10; skill-read 1/10; note-loaded 0/10; overgate-in-read 0/1
sua-nho-lam-luon old: done 10/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 0/10; note-loaded 0/10; overgate-in-read 0/0
develop-auth old: stopped-wrong 8/10; overgate-final 0/10; overgate-any 0/10; asked-stopped 0/10; extra-artifacts 0/10; skill-read 4/10; note-loaded 0/10; overgate-in-read 0/4; invalid (no cf-develop)
Fisher sua-typo/unchanged: p=1.0000000 (reference)
Fisher sua-typo/overgateAny: p=1.0000000 (reference)
Fisher sua-typo/askedStopped: p=1.0000000 (reference)
Fisher sua-typo/extra: p=1.0000000 (reference)
Fisher sua-typo/llm: p=1.0000000 (reference)
Fisher khong-kich-hoat/unchanged: p=1.0000000 (reference)
Fisher khong-kich-hoat/overgateAny: p=1.0000000 (reference)
Fisher khong-kich-hoat/askedStopped: p=1.0000000 (reference)
Fisher khong-kich-hoat/extra: p=1.0000000 (reference)
Fisher khong-kich-hoat/llm: p=1.0000000 (reference)
Fisher lam-thang-doi-ten/done: p=1.0000000 (reference)
Fisher lam-thang-doi-ten/overgateAny: p=1.0000000 (reference)
Fisher lam-thang-doi-ten/askedStopped: p=1.0000000 (reference)
Fisher lam-thang-doi-ten/extra: p=1.0000000 (reference)
Fisher lam-thang-xoa-module/done: p=1.0000000 (reference)
Fisher lam-thang-xoa-module/overgateAny: p=1.0000000 (reference)
Fisher lam-thang-xoa-module/askedStopped: p=1.0000000 (reference)
Fisher lam-thang-xoa-module/extra: p=1.0000000 (reference)
Fisher sua-nho-lam-luon/done: p=1.0000000 (reference)
Fisher sua-nho-lam-luon/overgateAny: p=1.0000000 (reference)
Fisher sua-nho-lam-luon/askedStopped: p=1.0000000 (reference)
Fisher sua-nho-lam-luon/extra: p=1.0000000 (reference)
Fisher develop-auth/stoppedWrong: p=1.0000000 (reference)
regression: none
watch: lam-thang-doi-ten skill-read 6/10 vs control 0/5; delta 6/10
cli_version: 0.162.1
calls: 90/100
verdict: MEASURED
```

## Giới hạn

- n=10/5, không ngẫu nhiên hoá thời gian chạy; nhánh old khác runner/home. Đối chứng tốt hơn so old nhưng không bảo đảm quy mọi khác biệt cho một câu note.
- Thước giám khảo specs uncalibrated. Không đo Claude mới; baseline develop-auth khác bộ đo trên đĩa nên chỉ tham khảo.
- skill-read/note-loaded chỉ chứng minh output chứa nội dung, không chứng minh model tuân thủ. Regex gác cổng và câu hỏi không bao quát mọi cách hỏi; giữ đúng định nghĩa đã khoá.
- unchanged chỉ xét file fixture; khong-kich-hoat không có fixture nên phép đó là tập rỗng. Extra-artifacts bổ sung specs/plans/.md, không chứng nhận không tạo file ngoài mọi đường dẫn khác.
- Skills toàn cục ~/.agents/skills vẫn có thể thấy. Nhật ký/cache chỉ trên máy này, không sửa ~/.codex hoặc ~/.agents.
- Việc đọc workspace3lượt và tin cuối3lượt của phiên Claude thuộc GATE-DONE; chưa giả nhận đã thực hiện.

Không có câu hỏi chưa giải quyết trong phạm vi đo.
