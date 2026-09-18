import type { TutorialContent } from "./tutorial-types";

export const tutorialContentVi: TutorialContent = {
  eyebrow: "Bắt đầu",
  title: "Feature đầu tiên với CafeKit",
  description: "Hướng dẫn từng bước từ chưa cài gì đến feature đầu tiên đã verify. Khoảng 15 phút.",
  ui: {
    stepWord: "Bước",
    youWillSeeLabel: "Bạn sẽ thấy",
    troubleshootingLabel: "Nếu gặp vấn đề",
    glossaryLabel: "Từ mới",
    replay: "Chạy lại",
    back: "← Quay lại",
    next: "Tiếp theo →",
    prerequisiteItems: [
      "Node.js 18 trở lên (kiểm tra: node --version)",
      "Terminal đang mở — Terminal trên Mac, PowerShell trên Windows",
      "Claude Code đã cài (xem link bên dưới — ĐỪNG dùng sudo)",
      "Một thư mục dự án để làm việc",
    ],
    installCommand: "npm install -g @anthropic-ai/claude-code",
  },
  steps: [
    {
      id: "prereqs",
      label: "Chuẩn bị",
      title: "Bạn cần gì trước khi bắt đầu",
      narrative: [
        "CafeKit chạy bên trong Claude Code — một AI coding assistant bạn điều khiển từ terminal. Các lệnh /cf:* được gõ TRONG phiên Claude Code, không phải trong terminal thông thường.",
        "Chuẩn bị 3 thứ sau. Khi đã xong, quay lại đây và bấm Tiếp theo.",
      ],
      links: [
        { label: "Cài Claude Code", href: "https://code.claude.com/docs/en/setup", external: true },
        { label: "Ngày đầu với Claude Code", href: "https://support.claude.com/en/articles/14552382-your-first-day-in-claude-code", external: true },
        { label: "Dùng Codex CLI?", href: "/docs/platforms" },
      ],
    },
    {
      id: "install",
      label: "Cài đặt",
      title: "Cài CafeKit vào dự án",
      narrative: [
        "Mở terminal, vào thư mục dự án của bạn rồi chạy lệnh cài đặt. Trình cài đặt sẽ hỏi bạn vài câu (ngôn ngữ, xưng hô, cài dependencies). CafeKit ghi runtime bundle vào .claude/ — gồm skills, agents, hooks và quy tắc workflow.",
      ],
      command: "npx @haposoft/cafekit",
      outputs: [
        { kind: "output", text: "Select language · 言語を選択 · Chọn ngôn ngữ" },
        { kind: "output", text: "Chọn (các) nền tảng cần cài" },
        { kind: "output", text: "Claude Code — 230 tệp, 20 skill" },
        { kind: "output", text: "Bạn muốn AI gọi bạn là gì?" },
        { kind: "success", text: "Cài đặt hoàn tất" },
        { kind: "success", text: "Đã cài: 230   Đã cập nhật: 0   Không đổi: 0   Skill: có" },
        { kind: "success", text: "CafeKit Version: 0.16.7" },
      ],
      youWillSee: [
        "Các bước tương tác: chọn ngôn ngữ, nền tảng, xưng hô, cài skill dependencies",
        "Thư mục .claude/ mới xuất hiện trong project root",
        "Bên trong: skills/, agents/, hooks/, scripts/, rules/, runtime.json, settings.json, cafekit-manifest.json",
        "File CLAUDE.md chứa quy tắc workflow, và AGENTS.md dùng chung cho mọi runtime",
        "Mặc định 20 skill. Nhóm tài liệu (docx, pdf, pptx, xlsx, ai-multimodal) là tuỳ chọn, chỉ cài khi thêm --with-document-skills",
      ],
      troubleshooting: [
        { problem: "Không tìm thấy lệnh npx", fix: "Cần Node.js 18+. Kiểm tra: node --version" },
        { problem: "Lỗi permission khi cài", fix: "Không dùng sudo. Trên Mac kiểm tra: npm config get prefix" },
      ],
    },
    {
      id: "spec",
      label: "Tạo spec",
      title: "Tạo spec đầu tiên",
      narrative: [
        "Mở phiên Claude Code trong project bằng cách chạy claude trong terminal. Bây giờ bạn đang ở trong Claude Code — đây là nơi gõ các lệnh /cf:*.",
        "Spec là bản hợp đồng mô tả điều bạn muốn xây dựng TRƯỚC khi code. Chạy lệnh dưới đây trong Claude Code.",
        "CafeKit luôn hỏi phạm vi trước (GATE-SCOPE): nó cho bạn xem cái đã có, tập thay đổi nhỏ nhất đủ ra kết quả, và dấu hiệu công việc đang phình ra — rồi mới hỏi bạn chọn EXPAND (mở rộng), KEEP (giữ nguyên) hay CUT (cắt bớt). Nó không tự quyết thay bạn.",
      ],
      command: "/cf:specs Build a word counter that counts words in a sentence",
      outputs: [
        { kind: "output", text: "GATE-SCOPE → cái đã có, thay đổi nhỏ nhất, dấu hiệu phình → EXPAND / KEEP / CUT?" },
        { kind: "success", text: "✓ specs/word-counter/plan.md" },
        { kind: "success", text: "✓ specs/word-counter/task-01-count-words.md" },
        { kind: "output", text: "GATE-REVIEW → trình findings của adversarial review trước khi implement" },
      ],
      youWillSee: [
        "Thư mục specs/word-counter/ với plan.md và flat task files",
        "plan.md — scope, exclusions, acceptance criteria và task map",
        "task-01-count-words.md — một outcome, một Status và planned proof command",
      ],
      troubleshooting: [
        { problem: "/cf:specs không được nhận diện", fix: "Đảm bảo đã chạy npx @haposoft/cafekit trong project này. Kiểm tra .claude/ tồn tại." },
        { problem: "Lệnh chạy nhưng không có output", fix: "Bạn có thể đang ở terminal thường, không phải phiên Claude Code. Chạy claude trước rồi thử lại." },
      ],
      glossary: [
        { term: "spec", definition: "Thư mục chứa các file mô tả cần xây dựng gì. Đây là nguồn sự thật — không phải chat." },
        { term: "task packet", definition: "Đơn vị implement nhỏ, có phạm vi rõ ràng, định nghĩa trong flat task-NN-*.md." },
      ],
    },
    {
      id: "validate",
      label: "Duyệt",
      title: "Giải quyết GATE-REVIEW trước khi code",
      narrative: [
        "Sau adversarial review, CafeKit liệt kê các finding tại GATE-REVIEW. Mỗi finding phải có path:line tái lập được và một kịch bản hỏng cụ thể; bạn chọn chấp nhận, bác bỏ, hoặc sửa lại. Chỉ finding được chấp nhận mới đi vào plan.",
      ],
      command: "Accept all",
      outputs: [
        { kind: "output", text: "ghi quyết định GATE-REVIEW vào Review log của plan.md…" },
        { kind: "success", text: "✓ scope và findings đã được chấp nhận" },
        { kind: "success", text: "✓ sẵn sàng cho invocation /cf:develop mới" },
      ],
      youWillSee: [
        "Quyết định GATE-REVIEW được lưu bền vững trong plan.md",
        "Planning dừng tại đây — Specs không bao giờ tự bắt đầu implement",
        "Implement chỉ bắt đầu khi chính bạn gõ /cf:develop",
      ],
      troubleshooting: [
        { problem: "Validation trả về lỗi", fix: "Đọc kỹ output lỗi. Thường do thiếu trường trong plan.md hoặc task file không khớp. Chạy lại /cf:specs để tạo mới." },
      ],
    },
    {
      id: "develop",
      label: "Code",
      title: "Implement task đầu tiên",
      narrative: [
        "Bây giờ mới implement — từng task một. CafeKit đọc file task, đặt Status thành in_progress, và chỉ sửa trong những đường dẫn task đó sở hữu. Code xong, nó chạy đúng lệnh ghi trong Verification Plan của task rồi review về correctness, security, scope và reachability. Chỉ literal PASS mới đóng được task.",
      ],
      command: "/cf:develop word-counter",
      outputs: [
        { kind: "output", text: "đang đọc task-01-count-words.md…" },
        { kind: "output", text: "đang implement countWords()…" },
        { kind: "output", text: "quality gate → verification · review" },
        { kind: "success", text: "✓ implement hoàn thành" },
        { kind: "success", text: "✓ Status: done — đã ghi inline ## Receipt" },
      ],
      youWillSee: [
        "Hàm countWords() được tạo trong project",
        "Một mục ## Receipt nằm cuối file task",
        "Chỉ controller được ghi Status và Receipt — develop đưa task tới done",
      ],
      glossary: [
        { term: "quality gate", definition: "Điều kiện để đóng task: đúng lệnh trong task chạy và pass, review không còn lỗi chặn. PASS_WITH_WARNINGS hay NO_TESTS đều không đóng được." },
        { term: "Receipt", definition: "Proof chuẩn trong task: Verification: PASS, đúng Command, Exit: 0, Base và Head suy từ runtime, và khối output hiện tại không rỗng." },
      ],
    },
    {
      id: "test",
      label: "Test",
      title: "Verify bằng test thật",
      narrative: [
        "Chạy test. CafeKit không tự bịa lệnh: nó phát hiện lệnh từ file task và từ repo, chạy precheck compile/typecheck rẻ tiền nếu dự án có, rồi chạy đúng lệnh của task cùng các named probe với số liệu thật. Một lệnh thoát 0 trong khi chạy 0 test KHÔNG phải là pass.",
      ],
      command: "/cf:test",
      outputs: [
        { kind: "output", text: "đang nhận diện test runner…" },
        { kind: "output", text: "đang chạy test suite…" },
        { kind: "success", text: "✓ 3 passed   0 failed" },
        { kind: "success", text: "✓ verdict: PASS" },
      ],
      youWillSee: [
        "Số lượng test > 0 — test thật đã chạy",
        "verdict: PASS — precheck và đúng lệnh của task đều qua",
        "Bộ verdict là PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED; chỉ literal PASS mới đóng được task",
      ],
      troubleshooting: [
        { problem: "verdict: NO_TESTS", fix: "Không tìm thấy file test. Thêm test cho countWords() và chạy lại /cf:test. Zero test không phải pass." },
        { problem: "Tests fail", fix: "Đọc output lỗi. Fix implementation hoặc test rồi chạy lại /cf:test." },
      ],
      glossary: [
        { term: "NO_TESTS", definition: "Không có test suite nào chạy. KHÔNG phải kết quả pass — task cần evidence thật." },
        { term: "PRECHECK_FAIL", definition: "Precheck compile/typecheck hỏng. Được báo ưu tiên hơn NO_TESTS." },
      ],
    },
    {
      id: "sync",
      label: "Quyết định",
      title: "Review, rồi quyết ở GATE-DONE",
      narrative: [
        "Task đã được develop đặt thành done kèm Receipt. Việc còn lại của bạn là đọc một review độc lập, nhìn bằng chứng hiện tại và những giới hạn còn lại, rồi quyết định feature đã xong hay chưa. Đó là GATE-DONE — không lệnh nào quyết thay bạn.",
        "Chỉ dùng /cf:sync khi trạng thái file bị lệch: /cf:sync audit word-counter soát cả packet, còn /cf:sync word-counter task-01-count-words.md blocked \"lý do\" chỉ ghi lại trạng thái quan sát được, không tạo ra proof.",
      ],
      command: "/cf:code-review",
      outputs: [
        { kind: "output", text: "đang review implementation word-counter…" },
        { kind: "success", text: "✓ spec compliance: ok" },
        { kind: "success", text: "✓ không có critical finding" },
        { kind: "output", text: "GATE-DONE → trình Receipt hiện tại và các giới hạn chưa giải quyết; bạn là người quyết" },
      ],
      youWillSee: [
        "no critical findings — đủ cơ sở để bạn quyết hoàn thành",
        "Status và inline Receipt của task khớp nhau",
        "Một lệnh pass chỉ chứng minh đúng ranh giới nó đã chạy — không phải sự phê duyệt sản phẩm",
      ],
      troubleshooting: [
        { problem: "Review tìm thấy critical issues", fix: "Fix các vấn đề, chạy lại /cf:test rồi /cf:code-review. Receipt do controller ghi lại." },
        { problem: "Stop hook báo task done thiếu receipt", fix: "Kiểm tra mục ## Receipt của task có đủ: đúng Command, Exit: 0, Verification: PASS, Base và Head suy từ runtime, và output hiện tại." },
      ],
    },
  ],
  recap: {
    title: "Bạn vừa ship một feature đã verify",
    bullets: [
      "Spec trước, code sau — hợp đồng ngăn scope drift",
      "Từng task một — mỗi thay đổi nhỏ và có thể review",
      "Cần evidence thật — không có kết quả xanh giả",
      "State luôn audit được — mỗi task có đúng một Status và một inline Receipt hiện tại",
      "Con người chỉ quyết ở đúng ba chỗ — GATE-SCOPE, GATE-REVIEW, GATE-DONE",
    ],
    nextLinks: [
      { label: "Spec-driven development", href: "/docs/spec-driven-development" },
      { label: "Workflow chính", href: "/docs/core-workflow" },
      { label: "Xem các skills", href: "/docs/skills" },
    ],
    glossary: [
      { term: "spec", definition: "Thư mục file mô tả cần xây dựng gì trước khi code bắt đầu." },
      { term: "task packet", definition: "File task-NN-*.md nằm phẳng cạnh plan.md: một outcome, một trường Status, một lệnh xác minh." },
      { term: "GATE-DONE", definition: "Cửa quyết định thứ ba của con người (tên cũ: C3): user cân nhắc Receipt hiện tại và các giới hạn đã nêu để quyết đóng feature." },
      { term: "GATE-SCOPE / GATE-REVIEW", definition: "Hai cửa đầu (tên cũ: C1 / C2): chọn EXPAND / KEEP / CUT cho phạm vi, rồi chấp nhận / bác bỏ / sửa từng finding." },
      { term: "quality gate", definition: "Điều kiện đóng task: đúng lệnh của task chạy qua và review không còn lỗi chặn." },
      { term: "NO_TESTS", definition: "Không có test suite nào chạy. Không bao giờ là kết quả pass." },
    ],
  },
};
