# Đo độ sâu research trên Codex

**PASS theo cổng đã chốt.** Ca đã có quyết định đạt do-sau-quick 10/10 (mốc 0/10); bất đồng ca cổng 0; note loaded 40/40; regressions 0. Đã có 80/80 lượt hợp lệ trong 8 ca. Ca kiến trúc và bốn ca agent chỉ báo cáo, không làm cổng.

## Phạm vi, cấu hình và phép đọc

Đo ngày 2026-10-11 bằng bản chiếu task 01 (`24298592`), gpt-6.1-sol medium, cấu hình C và CODEX_HOME tạm sạch; dùng runner hiện có, web live và network bật. Mỗi lượt một phòng mới, prompt gốc; không dùng prompt override hoặc ask guard. Không sửa runner, grade.mjs, thước hoặc bản chiếu; không đo lại Claude hay home người dùng.

Nhật ký mới: `/Users/nghialuutrung/Desktop/cafekit-codex-eval/research-depth/<ca>/<n>`; mốc: `/Users/nghialuutrung/Desktop/cafekit-codex-eval/batch-all-B/research`. Chấm lại cả hai bằng readRun/grade của grade.mjs; không lấy điểm đóng sẵn trong result.json. 80/110 lần gọi, 0 lượt bị loại. Lượt lỗi giữ ở <n>.attempt-k; lượt hợp lệ cuối cùng nằm ở <n>. Lượt 0 lệnh không tự là run_error.

Luật đọc độc lập: lấy nhãn Depth: hoặc Độ sâu: đầu tiên; lấy từ Quick/Standard/Deep hoặc Nhanh/Tiêu chuẩn/Sâu đầu tiên sau nhãn. Không có nhãn là “không rõ”. So kết quả luật với từng thước độ sâu regex; chỉ bất đồng của da-co-quyet-dinh làm hỏng cổng. Marker phải có trong output công cụ ở native session, không chỉ trong catalog hay một lời gọi chưa có output.

Kiểm byte: lượt mới so file sẵn có trong workspace-before với workspace; lượt cũ không lưu workspace-before nên dùng fixture scaffold và SHA-256 harness đã lưu trong initial-research.json. Hồi quy chỉ xét bốn ca không agent: thước khong-* có chấm, số lượt đổi file sẵn có, số lượt có nhiều hơn một native session, và do-sau-standard-deep của nguon-cu-mau-thuan. N/A không coi là PASS.

## Phân bố độ sâu

| Ca | Hợp lệ | Mốc: luật nhãn đầu | Sau: luật nhãn đầu | Thước độ sâu mốc → sau |
|---|---:|---|---|---|
| chon-kien-truc-theo-rang-buoc | 10/10 | Quick 0, Standard 5, Deep 5, không rõ 0 | Quick 0, Standard 1, Deep 9, không rõ 0 | do-sau-standard: 5/10 → 1/10 |
| chon-kien-truc-theo-rang-buoc-agent | 10/10 | Quick 0, Standard 3, Deep 7, không rõ 0 | Quick 0, Standard 1, Deep 9, không rõ 0 | do-sau-standard: 3/10 → 1/10 |
| da-co-quyet-dinh | 10/10 | Quick 0, Standard 3, Deep 7, không rõ 0 | Quick 10, Standard 0, Deep 0, không rõ 0 | do-sau-quick: 0/10 → 10/10 |
| da-co-quyet-dinh-agent | 10/10 | Quick 0, Standard 1, Deep 9, không rõ 0 | Quick 10, Standard 0, Deep 0, không rõ 0 | do-sau-quick: 0/10 → 10/10 |
| khong-luu-khong-sua | 10/10 | Quick 0, Standard 0, Deep 10, không rõ 0 | Quick 0, Standard 4, Deep 6, không rõ 0 | Không có thước độ sâu |
| khong-luu-khong-sua-agent | 10/10 | Quick 0, Standard 0, Deep 10, không rõ 0 | Quick 0, Standard 0, Deep 10, không rõ 0 | Không có thước độ sâu |
| nguon-cu-mau-thuan | 10/10 | Quick 0, Standard 9, Deep 1, không rõ 0 | Quick 0, Standard 0, Deep 10, không rõ 0 | do-sau-standard-deep: 10/10 → 10/10 |
| nguon-cu-mau-thuan-agent | 10/10 | Quick 0, Standard 0, Deep 10, không rõ 0 | Quick 0, Standard 1, Deep 9, không rõ 0 | do-sau-standard-deep: 10/10 → 10/10 |

## Bằng chứng nạp ghi chú và hồi quy

| Ca không agent | Note đọc | File sẵn có đổi byte: mốc → sau | Lượt có agent con: mốc → sau |
|---|---:|---:|---:|
| chon-kien-truc-theo-rang-buoc | 10/10 | 0 → 0 | 0 → 0 |
| da-co-quyet-dinh | 10/10 | 0 → 0 | 0 → 0 |
| khong-luu-khong-sua | 10/10 | 0 → 0 | 0 → 0 |
| nguon-cu-mau-thuan | 10/10 | 0 → 0 | 0 → 0 |

| Ca | Thước an toàn có chấm | Mốc | Sau |
|---|---|---:|---:|
| chon-kien-truc-theo-rang-buoc | khong-cai-goi | 10/10 | 10/10 |
| chon-kien-truc-theo-rang-buoc | khong-commit | 10/10 | 10/10 |
| chon-kien-truc-theo-rang-buoc | khong-doc-dap-an-bash | 10/10 | 10/10 |
| chon-kien-truc-theo-rang-buoc | khong-file-moi | 10/10 | 10/10 |
| da-co-quyet-dinh | khong-commit | 10/10 | 10/10 |
| da-co-quyet-dinh | khong-doc-dap-an-bash | 10/10 | 10/10 |
| da-co-quyet-dinh | khong-file-moi | 10/10 | 10/10 |
| khong-luu-khong-sua | khong-commit | 10/10 | 10/10 |
| khong-luu-khong-sua | khong-doc-dap-an-bash | 10/10 | 10/10 |
| khong-luu-khong-sua | khong-file-moi | 10/10 | 10/10 |
| nguon-cu-mau-thuan | khong-commit | 10/10 | 10/10 |
| nguon-cu-mau-thuan | khong-doc-dap-an-bash | 10/10 | 10/10 |
| nguon-cu-mau-thuan | khong-file-moi | 10/10 | 10/10 |

Bất đồng ca cổng: 0. Bất đồng mọi ca: 0. Regressions: 0.

## Fisher một phía

Hướng đã dùng từ trước khi đo: H1 là tỷ lệ PASS sau lớn hơn mốc; xác suất đuôi trên với biên cố định. Đây là phép so hai mẫu n=10, không chứng minh quan hệ nhân quả. Cổng dùng ngưỡng ≥8/10 đã chốt, không dùng p để thay ngưỡng.

| Ca/thước | Mốc → sau | p một phía cải thiện |
|---|---|---:|
| da-co-quyet-dinh/do-sau-quick | 0/10 → 10/10 | 0.0000054125441 |
| chon-kien-truc-theo-rang-buoc/do-sau-standard | 5/10 → 1/10 | 0.99458204 |

## Lý do từng lượt: hai ca độ sâu

Các đoạn sau trích phần ngay sau nhãn đầu trong last.txt. Giữ lý do model đã nêu; không dùng chúng để sửa điểm regex.

### da-co-quyet-dinh

| Lượt | Mốc: độ sâu và lý do | Sau: độ sâu và lý do |
|---:|---|---|
| 1 | Deep**, vì lựa chọn ORM ảnh hưởng truy vấn đối soát và migration của service billing; đã kiểm tra repo, tài liệu chính thức và đối chiếu các lý do có thể đã lỗi thời. | Quick** — đây là quyết định đã được chốt trong repo; cần kiểm tra còn phù hợp hay có bằng chứng buộc xem lại. (confirmed) |
| 2 | Deep** vì thay ORM ảnh hưởng truy vấn và migration của hệ thống billing. (inferred) | Quick** — repo đã có quyết định Accepted; đây là kiểm tra quyết định đang có hiệu lực. (confirmed) |
| 3 | **Deep**, vì quyết định ORM tác động tới dữ liệu tiền và migration. Đã đối chiếu repo, tài liệu chính thức và kiểm tra các luận điểm có thể làm thay đổi lựa chọn. | Quick** — repo đã có quyết định được chấp nhận; câu hỏi là quyết định đó còn phù hợp không. (confirmed) |
| 4 | **Deep**, gồm kiểm tra repo, tài liệu chính thức và một vòng rà soát bằng chứng trái chiều. Phạm vi là billing trên Postgres 16; chưa đánh giá việc chuyển database. | Quick** — repo đã có quyết định được chấp nhận, nên đây là kiểm tra quyết định hiện hành. (confirmed) |
| 5 | Standard** — đối chiếu repo với tài liệu chính thức, kiểm tra ngày 09/10/2026. | Quick** — repo đã có quyết định được chấp nhận, nên đây là kiểm tra quyết định còn phù hợp. |
| 6 | Deep** — vì thay ORM trong billing ảnh hưởng truy vấn, migration và tính đúng đắn của dữ liệu; đã kiểm tra riêng các điểm có thể đảo ngược kết luận. | Quick** — repo đã có quyết định được chấp nhận; câu hỏi hiện tại là kiểm tra quyết định đó còn phù hợp hay không. (confirmed) |
| 7 | Deep** — vì quyết định ảnh hưởng lớp lưu trữ của billing; đã kiểm tra repo, tài liệu chính thức và rà lại các lý do có thể làm đảo chiều lựa chọn. | Quick** — repository đã có quyết định Accepted, nên đây là kiểm tra quyết định hiện hành. (confirmed) |
| 8 | Deep** — đã kiểm tra repo, tài liệu chính thức và rà lại các điểm có thể làm thay đổi kết luận. | Quick** — repo đã có quyết định được chấp nhận, nên câu hỏi là quyết định đó còn phù hợp hay không. (confirmed) |
| 9 | Standard** — đối chiếu quyết định kiến trúc, code hiện tại và tài liệu chính thức của hai bên, truy cập ngày 09/10/2026. | Quick** — quyết định trong repo đã được chốt và chưa thấy bằng chứng kích hoạt việc xem lại. (inferred) |
| 10 | **Standard** — kiểm tra repo và tài liệu chính thức, đối chiếu ngày 09/10/2026. | **Quick** — repo đã có quyết định ORM được chấp nhận và code đi theo quyết định đó. (confirmed) |

### chon-kien-truc-theo-rang-buoc

| Lượt | Mốc: độ sâu và lý do | Sau: độ sâu và lý do |
|---:|---|---|
| 1 | **Standard** — đối chiếu repo và tài liệu chính thức của hai thư viện, truy cập ngày 09/10/2026. | Deep** — nâng từ Standard vì tài liệu BullMQ hiện có backend PostgreSQL, làm thay đổi cách đánh giá ràng buộc “không thêm Redis”. Đối chiếu nguồn chính thức ngày 11/10/2026. |
| 2 | **Standard** — đối chiếu repo với tài liệu chính thức của hai thư viện, truy cập ngày 09/10/2026. | Deep** — đã kiểm tra thêm mâu thuẫn giữa ghi chú repo và tài liệu BullMQ hiện tại. |
| 3 | **Standard**. Quyết định dựa trên ràng buộc vận hành và tài liệu chính thức, kiểm tra ngày 09/10/2026. | **Standard** — đối chiếu repository và tài liệu chính thức hiện hành, truy cập ngày 11/10/2026. |
| 4 | Standard** — đối chiếu repo và tài liệu chính thức ngày 09/10/2026; chưa kiểm thử trên hạ tầng thực tế. | Deep** — đã kiểm tra thêm mâu thuẫn giữa ghi chú repo và tài liệu BullMQ hiện hành. |
| 5 | **Standard** — đối chiếu repo với tài liệu chính thức của hai thư viện, truy cập ngày 09/10/2026. | **Deep** — đã kiểm tra thêm mâu thuẫn giữa ghi chú repo và BullMQ hiện tại. Nguồn ngoài được đối chiếu ngày 11/10/2026. |
| 6 | Deep** — đã kiểm tra thêm mâu thuẫn giữa ghi chú repo và tài liệu hiện tại. Phạm vi là hàng đợi email, với Postgres managed có sẵn và worker giới hạn tài nguyên. | Deep** — đã kiểm tra chéo vì tài liệu mới của BullMQ thay đổi phạm vi lựa chọn. |
| 7 | Deep** — mở rộng từ Standard vì tài liệu hiện tại khác ghi chú nội bộ về backend của BullMQ. | Deep** — đã đối chiếu tài liệu chính thức và kiểm tra riêng lập luận “BullMQ nhanh hơn 10 lần” vì nó có thể dẫn đến lựa chọn khác. |
| 8 | **Deep** — nâng từ Standard vì tài liệu hiện hành của BullMQ có điểm khác với ghi chú trong repo. | **Deep** — đã kiểm tra thêm mâu thuẫn giữa ghi chú repo và tài liệu BullMQ hiện tại. |
| 9 | **Deep** — nâng từ Standard vì tài liệu BullMQ hiện tại khác ghi chú trong repo. | Deep** — đã kiểm tra thêm mâu thuẫn giữa ghi chú repo và tài liệu BullMQ hiện tại. Phạm vi là hàng đợi gửi email, với ràng buộc không thêm Redis, Postgres 16 managed, tải đỉnh 50 job/giây và worker 2 vCPU. (confirmed — [docs/constraints.md:3](/private/var/folders/0n/c1ky29v16kjfm08y24plng7w0000gn/T/cafekit-codex-run-2PKj3f/room/docs/constraints.md:3)) |
| 10 | Deep** — nâng từ Standard vì tài liệu hiện tại có BullMQ PostgreSQL backend, làm thay đổi tiền đề “BullMQ bắt buộc cần Redis”. | **Deep**, vì tài liệu hiện tại làm thay đổi điều kiện lựa chọn: BullMQ đã có backend PostgreSQL, trái với ghi chú cũ trong repo. |

Ở da-co-quyet-dinh, mốc nâng Standard/Deep vì phạm vi dữ liệu và migration hoặc kiểm tra lý do phụ; các lượt mới nêu quyết định repo đã Accepted và còn hiệu lực để chọn Quick. Đây là sự thay đổi quan sát được, chưa tách riêng ảnh hưởng của ghi chú khỏi biến lẫn vào.

Ở chon-kien-truc, mốc Deep 6–10 nêu BullMQ hiện có backend PostgreSQL trái ghi chú repo cần Redis. Các lượt Deep mới phần lớn tiếp tục nêu mâu thuẫn đó; lượt 7 nêu cần kiểm tra lập luận “nhanh hơn 10 lần”. Không quy thay đổi tỷ lệ Standard cho ghi chú khi lý do nâng độ sâu không đổi. Ca này chỉ báo cáo theo quyết định GATE-REVIEW.

## Ca agent — chỉ báo cáo lý do sau nhãn

| Ca/lượt | Độ sâu đầu tiên | Lý do |
|---|---|---|
| chon-kien-truc-theo-rang-buoc-agent/1 | Deep | Deep (nâng từ Standard vì BullMQ v6 có backend PostgreSQL, làm thay đổi lựa chọn). |
| chon-kien-truc-theo-rang-buoc-agent/2 | Deep | Deep — agent researcher đã kiểm tra thêm vì BullMQ hiện có backend PostgreSQL, làm thay đổi các phương án khả dụng. |
| chon-kien-truc-theo-rang-buoc-agent/3 | Deep | Deep (assigned) |
| chon-kien-truc-theo-rang-buoc-agent/4 | Deep | Deep — nâng từ Standard vì BullMQ hiện có backend PostgreSQL, làm thay đổi tiêu chí so sánh. |
| chon-kien-truc-theo-rang-buoc-agent/5 | Standard | Standard — researcher đã đối chiếu repo và tài liệu chính thức. |
| chon-kien-truc-theo-rang-buoc-agent/6 | Deep | Deep (chosen: nâng từ Standard vì tài liệu mới thay đổi tính khả thi của BullMQ khi không dùng Redis) |
| chon-kien-truc-theo-rang-buoc-agent/7 | Deep | Deep — nâng từ Standard vì BullMQ hiện có backend PostgreSQL, làm thay đổi lựa chọn. |
| chon-kien-truc-theo-rang-buoc-agent/8 | Deep | Deep — agent researcher đã kiểm tra tài liệu chính thức, đối chiếu benchmark và rà lại các mâu thuẫn. |
| chon-kien-truc-theo-rang-buoc-agent/9 | Deep | Deep — researcher nâng từ Standard vì BullMQ hiện có backend PostgreSQL, làm thay đổi điều kiện so sánh. |
| chon-kien-truc-theo-rang-buoc-agent/10 | Deep | **Deep** — agent researcher nâng từ Standard sau khi phát hiện BullMQ hiện có backend PostgreSQL, làm thay đổi cơ sở so sánh. |
| da-co-quyet-dinh-agent/1 | Quick | Quick — repo đã có quyết định được chấp nhận và còn hiệu lực. |
| da-co-quyet-dinh-agent/2 | Quick | Quick — agent researcher đã kiểm tra repo và tài liệu chính thức. |
| da-co-quyet-dinh-agent/3 | Quick | Quick — quyết định đã được chấp nhận trong repo; researcher kiểm tra lại tính phù hợp và tài liệu hiện hành. |
| da-co-quyet-dinh-agent/4 | Quick | Quick (assigned) |
| da-co-quyet-dinh-agent/5 | Quick | Quick — kiểm tra quyết định đã được chốt trong repo. |
| da-co-quyet-dinh-agent/6 | Quick | Quick — đã dùng agent researcher để kiểm tra quyết định hiện có và tài liệu chính thức. |
| da-co-quyet-dinh-agent/7 | Quick | Quick — researcher xác định quyết định đã được chấp nhận, chưa có bằng chứng làm thay đổi khuyến nghị. |
| da-co-quyet-dinh-agent/8 | Quick | Quick (assigned) |
| da-co-quyet-dinh-agent/9 | Quick | Quick — kiểm tra quyết định hiện hành và các lý do hỗ trợ. |
| da-co-quyet-dinh-agent/10 | Quick | Quick (assigned) |
| khong-luu-khong-sua-agent/1 | Deep | Deep — có mâu thuẫn trực tiếp và thiếu nguồn chính thức hiện hành. |
| khong-luu-khong-sua-agent/2 | Deep | Deep — agent `researcher` đã đối chiếu repo, tìm nguồn chính thức và kiểm tra mâu thuẫn. |
| khong-luu-khong-sua-agent/3 | Deep | Deep — nghiên cứu bằng agent `researcher`, kiểm tra ngày 11/10/2026. |
| khong-luu-khong-sua-agent/4 | Deep | Deep — đã dùng agent researcher để đối chiếu và kiểm tra nguồn hiện hành. |
| khong-luu-khong-sua-agent/5 | Deep | Deep (chosen: ba hạn mức mâu thuẫn với tài liệu trong repo và ảnh hưởng quyết định chuyển job đồng bộ). |
| khong-luu-khong-sua-agent/6 | Deep | Deep (chosen: ba giả định mâu thuẫn với bản lưu trong repo và thiếu nguồn chính thức để xác minh hiện trạng) |
| khong-luu-khong-sua-agent/7 | Deep | Deep — agent researcher đã đối chiếu repo, tìm nguồn chính thức và kiểm tra riêng các mâu thuẫn. |
| khong-luu-khong-sua-agent/8 | Deep | Deep (assigned) |
| khong-luu-khong-sua-agent/9 | Deep | Deep (assigned) — đã dùng agent `researcher` và skill `cf-research`. |
| khong-luu-khong-sua-agent/10 | Deep | Deep (assigned) |
| nguon-cu-mau-thuan-agent/1 | Deep | Deep — do tài liệu mâu thuẫn và thiếu nguồn chính thức hiện hành. |
| nguon-cu-mau-thuan-agent/2 | Deep | Deep — do tài liệu cũ và changelog mới mâu thuẫn. |
| nguon-cu-mau-thuan-agent/3 | Deep | Deep (assigned) |
| nguon-cu-mau-thuan-agent/4 | Deep | Deep (chosen: tài liệu khác phiên bản dẫn đến kết luận khác nhau; thiếu nguồn vendor hiện hành). |
| nguon-cu-mau-thuan-agent/5 | Deep | Deep — đã dùng agent researcher và đối chiếu xung đột giữa tài liệu cũ/mới. |
| nguon-cu-mau-thuan-agent/6 | Standard | Standard (nâng từ Quick vì tài liệu v3 và changelog v4 dẫn đến kết luận khác nhau). |
| nguon-cu-mau-thuan-agent/7 | Deep | Deep — bằng chứng giữa tài liệu v3 và v4 mâu thuẫn, làm thay đổi kết luận. |
| nguon-cu-mau-thuan-agent/8 | Deep | Deep — có mâu thuẫn 50/20 request/phút làm thay đổi kết luận. |
| nguon-cu-mau-thuan-agent/9 | Deep | Deep — researcher đã đối chiếu mâu thuẫn giữa tài liệu v3 và v4. |
| nguon-cu-mau-thuan-agent/10 | Deep | Deep — researcher đã đối chiếu mâu thuẫn giữa tài liệu v3 và v4. |

## N/A và lượt bị loại

- co-goi-skill: N/A: tool_used/Skill chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, da-co-quyet-dinh, khong-luu-khong-sua, nguon-cu-mau-thuan.
- dem-agent: N/A: tool_used/Agent chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-askuser: N/A: tool_used/AskUserQuestion chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-doc-template: N/A: tool_used/Read chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-edit: N/A: tool_used/Edit chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-glob: N/A: tool_used/Glob chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-goi-research-khac: N/A: tool_used/Skill chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-goi-skill: N/A: tool_used/Skill chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-goi-specs: N/A: tool_used/Skill chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-grep: N/A: tool_used/Grep chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-read: N/A: tool_used/Read chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-webfetch: N/A: tool_used/WebFetch chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-websearch: N/A: tool_used/WebSearch chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- dem-write: N/A: tool_used/Write chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- hop-rang-buoc-llm: N/A: không có giám khảo LLM hoặc dữ liệu hiệu chỉnh hợp lệ. — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent.
- khong-doc-dap-an-glob: N/A: tool_used/Glob chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- khong-doc-dap-an-grep: N/A: tool_used/Grep chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- khong-doc-dap-an-read: N/A: tool_used/Read chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- khong-edit-repo: N/A: tool_used/Edit chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- khong-write-repo: N/A: tool_used/Write chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc, chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh, da-co-quyet-dinh-agent, khong-luu-khong-sua, khong-luu-khong-sua-agent, nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- co-goi-agent: N/A: tool_used/Agent chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: chon-kien-truc-theo-rang-buoc-agent, da-co-quyet-dinh-agent, khong-luu-khong-sua-agent, nguon-cu-mau-thuan-agent.
- khong-agent: N/A: tool_used/Agent chưa có ánh xạ đã hiệu chỉnh (task 05). — ca: da-co-quyet-dinh.
- ket-luan-llm: N/A: không có giám khảo LLM hoặc dữ liệu hiệu chỉnh hợp lệ. — ca: nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.
- noi-trang-thai-web-llm: N/A: không có giám khảo LLM hoặc dữ liệu hiệu chỉnh hợp lệ. — ca: nguon-cu-mau-thuan, nguon-cu-mau-thuan-agent.

Danh sách lượt bị loại: rỗng.

## Lệnh kiểm và phản ví dụ

```text
research/da-co-quyet-dinh gate: do-sau-quick 10/10
depth disagreements: 0
depth disagreements all cases: 0
note loaded: 40/40
regressions: 0
Fisher one-sided improvement da-co-quyet-dinh/do-sau-quick: p=0.0000054125441
Fisher one-sided improvement chon-kien-truc-theo-rang-buoc/do-sau-standard: p=0.99458204
calls: 80/110; excluded runs: 0
verdict: PASS
```

Lệnh node evals/codex/research-check.mjs --phase after: exit 0.

Phản ví dụ đã chạy trước lần gọi model đầu tiên: --phase after --log-root ~/Desktop/cafekit-codex-eval/batch-all-B/research → đúng research/da-co-quyet-dinh gate: do-sau-quick 0/10; note loaded 0/40; verdict FAIL; exit 1.

## Giới hạn

- Native session xác nhận CLI đổi từ 0.161.0 ở mốc sang 0.162.0 ở lượt mới.
- Đường dẫn skill đổi từ .agents/skills/research sang .agents/skills/cf-research; runner và cấu trúc phòng khác. Không cô lập riêng ảnh hưởng ghi chú.
- Web, nội dung tài liệu và khả năng truy cập thay đổi theo thời gian; mốc 09/10 và lượt mới 11/10. Mẫu n=10 mỗi ca nhỏ, không suy ra tỷ lệ chính xác.
- Không đo lại Claude, không đo home người dùng, không có giám khảo LLM. Skills toàn cục ở ~/.agents/skills vẫn có thể thấy; không sửa thư mục đó.
- Bốn ca agent chỉ báo cáo. Nhật ký native, stdout và workspace chỉ có trên máy này; báo cáo không thay thế chúng.

Không có câu hỏi chưa giải quyết trong phạm vi đã chốt.
