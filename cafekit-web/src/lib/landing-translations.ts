import type { Locale } from "@/lib/locale-utils";

type WorkflowNote = {
  title: string;
  description: string;
};

type WorkflowStep = {
  tab: string;
  title: string;
  description: string;
  status?: string;
  highlights: string[];
  notes: WorkflowNote[];
};

type LandingTranslations = {
  hero: {
    badge: string;
    subtitle: string;
    readDocs: string;
    copied: string;
    copy: string;
  };
  features: {
    heading: string;
    subheading: string;
    workflowLabel: string;
    detailsLabel: string;
    notesLabel: string;
    steps: WorkflowStep[];
  };
  quickStart: {
    heading: string;
    subheading: string;
    viewGuide: string;
    copied: string;
    copy: string;
    comments: string[];
    tutorialHeading: string;
    tutorialBody: string;
    tutorialCta: string;
  };
  contactForm: {
    heading: string;
    subheading: string;
    fullnameLabel: string;
    fullnamePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    jobtitleLabel: string;
    jobtitlePlaceholder: string;
    companyLabel: string;
    companyPlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successMessage: string;
    errorTitle: string;
    errorMessage: string;
    reset: string;
    validation: {
      fullnameRequired: string;
      emailRequired: string;
      emailInvalid: string;
      phoneRequired: string;
      companyRequired: string;
      messageTooLong: string;
    };
  };
};

const translations: Record<Locale, LandingTranslations> = {
  en: {
    hero: {
      badge: "Claude Code-first runtime for spec-driven delivery",
      subtitle:
        "Build from approved specs, execute one verified task at a time, and keep project docs aligned. Claude Code is available now.",
      readDocs: "Read Documentation",
      copied: "Copied!",
      copy: "Copy",
    },
    features: {
      heading: "One runtime from first prompt to release",
      subheading:
        "Install the runtime, move through specs, develop, test, review, git handoff, then ship with your existing deploy stack.",
      workflowLabel: "Runtime Workflow",
      detailsLabel: "What Happens",
      notesLabel: "Critical Notes",
      steps: [
        {
          tab: "install",
          title: "Install the runtime bundle",
          description:
            "Bootstrap CafeKit into an existing Claude Code project before any feature-specific work begins.",
          highlights: [
            "Installs skills, hooks, rules, statusline, and workflow context into .claude.",
            "Sets the project up for spec-driven commands instead of ad-hoc prompting.",
            "Keeps Claude Code as the primary supported runtime today.",
          ],
          notes: [
            {
              title: "Command",
              description: "Run `npx @haposoft/cafekit` in the project root.",
            },
            {
              title: "Result",
              description: "The repo is ready for `cf:*` workflows immediately.",
            },
          ],
        },
        {
          tab: "/cf:specs",
          title: "Create the feature contract",
          description:
            "Confirm C1 scope, write `plan.md` and flat tasks, then resolve adversarial findings at C2 before implementation starts.",
          highlights: [
            "Creates `specs/<feature>/plan.md` with flat `task-NN-*.md` files.",
            "Runs adversarial review and resolves material findings at C2.",
            "Stops after planning so implementation begins only through a new explicit `/cf:develop` invocation.",
          ],
          notes: [
            {
              title: "Human decisions",
              description:
                "C1 confirms scope; C2 accepts or resolves the reviewed plan before handoff.",
            },
            {
              title: "Task packets",
              description:
                "Each flat `task-NN-*.md` becomes one execution boundary for `/cf:develop`.",
            },
          ],
        },
        {
          tab: "/cf:develop",
          title: "Implement one task packet at a time",
          description:
            "Ship code through a verified task loop instead of coding the whole feature in one pass.",
          highlights: [
            "Supports both full-spec orchestration and surgical single-task execution.",
            "Lets the controller record task status and the final inline verification receipt.",
            "Runs lightweight docs checkpoints after verified tasks.",
          ],
          notes: [
            {
              title: "Definition of done",
              description: "A task is not done unless build, evidence, and review all agree.",
            },
            {
              title: "No fake progress",
              description:
                "Placeholder scaffolds and scope drift are blocked instead of silently accepted.",
            },
          ],
        },
        {
          tab: "/cf:test",
          title: "Verify with real build and runtime signals",
          description:
            "Run task-aware verification that prioritizes exact commands, prechecks, and runtime proof over shallow green checkmarks.",
          highlights: [
            "Runs build, typecheck, test suites, and UI verification depending on task evidence.",
            "Treats `PRECHECK_FAIL` as stronger than `NO_TESTS`.",
            "Returns a structured verdict instead of a vague success message.",
          ],
          notes: [
            {
              title: "Exact commands",
              description:
                "Verification starts from the commands declared in the task packet itself.",
            },
            {
              title: "UI mode",
              description:
                "Protected flows can use `--ui-auth` or `--ui-flow` when runtime pages are available.",
            },
          ],
        },
        {
          tab: "/cf:code-review",
          title: "Review for regressions and security",
          description:
            "Run adversarial review after testing so the final merge candidate is checked for correctness, regressions, and contract drift.",
          highlights: [
            "Findings-first review output keeps focus on real bugs and risk.",
            "Flags security, behavior drift, and missing verification evidence.",
            "Pairs cleanly with `cf:test` during the quality gate.",
          ],
          notes: [
            {
              title: "Review posture",
              description: "Assume regressions are possible until evidence proves otherwise.",
            },
            {
              title: "Release gate",
              description:
                "Critical findings should stop the handoff to Git and deployment.",
            },
          ],
        },
        {
          tab: "/cf:git",
          title: "Commit and push safely",
          description:
            "Use native Git operations for commits, pushes, PR prep, and safe worktree flows once code is verified.",
          highlights: [
            "Supports `commit`, `push`, `pr`, and sibling-directory `worktree` flows.",
            "Scans staged diff content for secrets before commit.",
            "Keeps version control operations consistent with the runtime workflow.",
          ],
          notes: [
            {
              title: "Command surface",
              description: "Use `/cf:git commit` and `/cf:git push` after review is green.",
            },
            {
              title: "Safety",
              description:
                "Conventional commits and secret checks happen before the repo is handed off.",
            },
          ],
        },
        {
          tab: "/cf:deploy",
          title: "Ship with a deployment handoff",
          description:
            "Treat this as the final release surface after runtime verification, review, and Git handoff are complete.",
          highlights: [
            "Represents the final deployment step in the CafeKit release story on the homepage.",
            "Can stand in for Vercel, CI/CD, or your own production delivery pipeline.",
            "Keeps the flow visually complete from install all the way to release.",
          ],
          notes: [
            {
              title: "Temporary surface",
              description:
                "This section is a visual placeholder for the future native deploy handoff.",
            },
            {
              title: "Release input",
              description:
                "Only ship code that already passed `cf:test`, `cf:code-review`, and `cf:git`.",
            },
          ],
        },
      ],
    },
    quickStart: {
      heading: "Get Started in Seconds",
      subheading:
        "Install CafeKit, create and validate a spec, implement a task, verify it, then commit and deploy with your existing release stack.",
      viewGuide: "View full quickstart guide",
      copied: "Copied!",
      copy: "Copy",
      comments: [
        "# 1. Install CafeKit",
        "# 2. Create and validate a feature spec",
        "# 3. Implement one task packet at a time",
        "# 4. Verify and review the release candidate",
        "# 5. Commit, push, and deploy",
      ],
      tutorialHeading: "New to CafeKit?",
      tutorialBody: "Start from zero — step-by-step from no install to your first verified feature.",
      tutorialCta: "Start tutorial",
    },
    contactForm: {
      heading: "Get in touch",
      subheading: "Tell us about your project or ask anything. We usually reply within one business day.",
      fullnameLabel: "Full name",
      fullnamePlaceholder: "Alex Rivera",
      emailLabel: "Email address",
      emailPlaceholder: "you@company.com",
      phoneLabel: "Phone number",
      phonePlaceholder: "+1 (555) 123-4567",
      jobtitleLabel: "Job title",
      jobtitlePlaceholder: "Engineering Manager",
      companyLabel: "Company",
      companyPlaceholder: "Acme Corp",
      messageLabel: "Message",
      messagePlaceholder: "Tell us about your use case, timeline, or questions...",
      submit: "Send message",
      submitting: "Sending...",
      successTitle: "Thank you!",
      successMessage: "Your message has been sent. We'll get back to you within one business day.",
      errorTitle: "Something went wrong",
      errorMessage: "We couldn't send your message right now. Please try again in a moment.",
      reset: "Send another message",
      validation: {
        fullnameRequired: "Full name is required",
        emailRequired: "Email address is required",
        emailInvalid: "Please enter a valid email address",
        phoneRequired: "Phone number is required",
        companyRequired: "Company is required",
        messageTooLong: "Message must be 10000 characters or less",
      },
    },
  },
  vi: {
    hero: {
      badge: "Runtime Claude Code-first cho quy trình spec-driven",
      subtitle:
        "Xây dựng từ spec đã được duyệt, triển khai từng task đã verify, và giữ docs luôn đồng bộ. Claude Code dùng được ngay.",
      readDocs: "Đọc tài liệu hướng dẫn",
      copied: "Đã copy!",
      copy: "Copy",
    },
    features: {
      heading: "Một runtime xuyên suốt từ prompt đầu tiên tới release",
      subheading:
        "Cài runtime, đi qua specs, develop, test, review, git handoff rồi ship bằng stack deploy hiện có của bạn.",
      workflowLabel: "Runtime Workflow",
      detailsLabel: "Điều Gì Xảy Ra",
      notesLabel: "Điểm Cần Giữ Chặt",
      steps: [
        {
          tab: "install",
          title: "Cài runtime bundle",
          description:
            "Khởi tạo CafeKit vào project Claude Code trước khi bắt đầu bất kỳ feature nào.",
          highlights: [
            "Cài skills, hooks, rules, statusline và workflow context vào `.claude`.",
            "Đưa project sang command surface spec-driven thay vì prompt rời rạc.",
            "Claude Code là runtime chính đang được hỗ trợ ngay lúc này.",
          ],
          notes: [
            {
              title: "Command",
              description: "Chạy `npx @haposoft/cafekit` ở root của project.",
            },
            {
              title: "Kết quả",
              description: "Repo sẵn sàng chạy `cf:*` workflow ngay.",
            },
          ],
        },
        {
          tab: "/cf:specs",
          title: "Tạo contract cho feature",
          description:
            "Xác nhận C1 scope, viết `plan.md` và flat tasks, rồi giải quyết adversarial findings tại C2 trước implementation.",
          highlights: [
            "Tạo `specs/<feature>/plan.md` cùng các file phẳng `task-NN-*.md`.",
            "Chạy adversarial review và xử lý findings quan trọng tại C2.",
            "Dừng sau planning; implementation chỉ bắt đầu bằng một lượt gọi `/cf:develop` mới và rõ ràng.",
          ],
          notes: [
            {
              title: "Quyết định của người dùng",
              description:
                "C1 xác nhận phạm vi; C2 chấp nhận hoặc xử lý plan đã được review trước khi handoff.",
            },
            {
              title: "Task packet",
              description:
                "Mỗi file phẳng `task-NN-*.md` là một biên thực thi cho `/cf:develop`.",
            },
          ],
        },
        {
          tab: "/cf:develop",
          title: "Triển khai từng task packet",
          description:
            "Code theo verified task loop thay vì làm cả feature trong một lượt dài.",
          highlights: [
            "Hỗ trợ cả full-spec orchestration lẫn chạy một task rất cụ thể.",
            "Controller ghi task status và verification receipt cuối cùng ngay trong task.",
            "Có docs checkpoint nhẹ sau mỗi task đã verify.",
          ],
          notes: [
            {
              title: "Definition of done",
              description:
                "Task chưa được coi là done nếu build, evidence và review chưa cùng đồng ý.",
            },
            {
              title: "Không có fake progress",
              description:
                "Placeholder scaffold và scope drift sẽ bị chặn thay vì bị chấp nhận ngầm.",
            },
          ],
        },
        {
          tab: "/cf:test",
          title: "Verify bằng tín hiệu thật",
          description:
            "Chạy verification theo đúng task, ưu tiên exact commands, prechecks và runtime proof thay vì green check hời hợt.",
          highlights: [
            "Chạy build, typecheck, test suite và UI verification tùy theo evidence của task.",
            "Xem `PRECHECK_FAIL` là tín hiệu mạnh hơn `NO_TESTS`.",
            "Trả verdict có cấu trúc thay vì một câu thành công chung chung.",
          ],
          notes: [
            {
              title: "Exact commands",
              description:
                "Verification bắt đầu từ các command được ghi ngay trong task packet.",
            },
            {
              title: "UI mode",
              description:
                "Flow có auth có thể dùng `--ui-auth` hoặc `--ui-flow` khi page runtime đã lên.",
            },
          ],
        },
        {
          tab: "/cf:code-review",
          title: "Review để chặn regression và lỗi bảo mật",
          description:
            "Chạy review sau test để candidate cuối cùng được kiểm tra về correctness, regressions và contract drift.",
          highlights: [
            "Output findings-first giữ trọng tâm vào bug và rủi ro thật.",
            "Bắt lỗi security, behavior drift và thiếu verification evidence.",
            "Ghép tự nhiên với `cf:test` trong quality gate.",
          ],
          notes: [
            {
              title: "Tư thế review",
              description: "Giả định regression có thể xảy ra cho tới khi evidence chứng minh ngược lại.",
            },
            {
              title: "Release gate",
              description:
                "Critical findings phải chặn handoff sang Git và deployment.",
            },
          ],
        },
        {
          tab: "/cf:git",
          title: "Commit và push an toàn",
          description:
            "Dùng Git operations native cho commit, push, PR prep và safe worktree flows sau khi code đã verify.",
          highlights: [
            "Hỗ trợ `commit`, `push`, `pr` và `worktree` ở thư mục sibling.",
            "Scan staged diff để phát hiện secrets trước khi commit.",
            "Giữ version control nhất quán với runtime workflow.",
          ],
          notes: [
            {
              title: "Command surface",
              description:
                "Dùng `/cf:git commit` và `/cf:git push` sau khi review đã xanh.",
            },
            {
              title: "Safety",
              description:
                "Conventional commit và secret check xảy ra trước khi handoff repo.",
            },
          ],
        },
        {
          tab: "/cf:deploy",
          title: "Ship qua bước handoff deploy",
          description:
            "Xem đây là mặt cuối của release sau khi verification, review và Git handoff đã hoàn tất.",
          highlights: [
            "Đóng vai trò bước deploy cuối trong release story của CafeKit trên homepage.",
            "Có thể đại diện cho Vercel, CI/CD hoặc pipeline production hiện có của bạn.",
            "Giúp flow nhìn trọn vẹn từ install cho tới release.",
          ],
          notes: [
            {
              title: "Surface tạm thời",
              description:
                "Section này là visual placeholder cho deploy handoff native trong tương lai.",
            },
            {
              title: "Điều kiện release",
              description:
                "Chỉ ship code đã qua `cf:test`, `cf:code-review` và `cf:git`.",
            },
          ],
        },
      ],
    },
    quickStart: {
      heading: "Sẵn sàng chỉ sau vài giây",
      subheading:
        "Cài CafeKit, tạo và validate spec, triển khai một task, verify nó, rồi commit và deploy bằng release stack hiện tại.",
      viewGuide: "Xem hướng dẫn bắt đầu nhanh đầy đủ",
      copied: "Đã copy!",
      copy: "Copy",
      comments: [
        "# 1. Cài đặt CafeKit",
        "# 2. Tạo và validate spec cho feature",
        "# 3. Triển khai từng task packet",
        "# 4. Verify và review release candidate",
        "# 5. Commit, push và deploy",
      ],
      tutorialHeading: "Mới biết CafeKit?",
      tutorialBody: "Bắt đầu từ con số 0 — từng bước từ chưa cài gì đến feature đầu tiên đã verify.",
      tutorialCta: "Bắt đầu hướng dẫn",
    },
    contactForm: {
      heading: "Liên hệ với chúng tôi",
      subheading: "Kể về dự án của bạn hoặc đặt câu hỏi. Chúng tôi thường trả lời trong một ngày làm việc.",
      fullnameLabel: "Họ và tên",
      fullnamePlaceholder: "Nguyễn Văn A",
      emailLabel: "Địa chỉ email",
      emailPlaceholder: "ban@congty.com",
      phoneLabel: "Số điện thoại",
      phonePlaceholder: "+84 901 234 567",
      jobtitleLabel: "Chức vụ",
      jobtitlePlaceholder: "Quản lý Kỹ thuật",
      companyLabel: "Công ty",
      companyPlaceholder: "Công ty Acme",
      messageLabel: "Tin nhắn",
      messagePlaceholder: "Mô tả trường hợp sử dụng, thời gian hoặc câu hỏi của bạn...",
      submit: "Gửi tin nhắn",
      submitting: "Đang gửi...",
      successTitle: "Cảm ơn bạn!",
      successMessage: "Tin nhắn của bạn đã được gửi. Chúng tôi sẽ phản hồi trong một ngày làm việc.",
      errorTitle: "Đã xảy ra lỗi",
      errorMessage: "Chúng tôi không thể gửi tin nhắn lúc này. Vui lòng thử lại sau.",
      reset: "Gửi tin nhắn khác",
      validation: {
        fullnameRequired: "Họ và tên là bắt buộc",
        emailRequired: "Email là bắt buộc",
        emailInvalid: "Vui lòng nhập địa chỉ email hợp lệ",
        phoneRequired: "Số điện thoại là bắt buộc",
        companyRequired: "Tên công ty là bắt buộc",
        messageTooLong: "Tin nhắn phải tối đa 2000 ký tự",
      },
    },
  },
  ja: {
    hero: {
      badge: "Claude Code-first の spec-driven runtime",
      subtitle:
        "承認済み spec から始め、検証済みタスクを1つずつ実装し、docs を同期させます。Claude Code は今すぐ利用可能です。",
      readDocs: "ドキュメントを読む",
      copied: "コピーしました！",
      copy: "コピー",
    },
    features: {
      heading: "最初の prompt から release までを1つの runtime で",
      subheading:
        "runtime をインストールし、specs、develop、test、review、git handoff を経て、既存の deploy stack で出荷します。",
      workflowLabel: "Runtime Workflow",
      detailsLabel: "何が起きるか",
      notesLabel: "重要なポイント",
      steps: [
        {
          tab: "install",
          title: "runtime bundle をインストール",
          description:
            "feature 作業に入る前に、既存の Claude Code project へ CafeKit を導入します。",
          highlights: [
            "skills、hooks、rules、statusline、workflow context を `.claude` に配置します。",
            "プロジェクトを ad-hoc prompt ではなく spec-driven command surface に切り替えます。",
            "現在の primary runtime は Claude Code です。",
          ],
          notes: [
            {
              title: "Command",
              description: "project root で `npx @haposoft/cafekit` を実行します。",
            },
            {
              title: "Result",
              description: "repo はすぐに `cf:*` workflow を実行できます。",
            },
          ],
        },
        {
          tab: "/cf:specs",
          title: "feature contract を作る",
          description:
            "C1 scope を確認し、`plan.md` と flat tasks を作成、implementation 前に C2 adversarial findings を解決します。",
          highlights: [
            "`specs/<feature>/plan.md` と flat な `task-NN-*.md` files を生成します。",
            "adversarial review を実行し、C2 で重要な findings を解決します。",
            "planning 後に停止し、implementation は明示的な新しい `/cf:develop` invocation でのみ開始します。",
          ],
          notes: [
            {
              title: "Human decisions",
              description:
                "C1 で scope を確認し、C2 で reviewed plan を承認または修正してから handoff します。",
            },
            {
              title: "Task packet",
              description: "flat な `task-NN-*.md` は `/cf:develop` の実行境界になります。",
            },
          ],
        },
        {
          tab: "/cf:develop",
          title: "task packet を1つずつ実装",
          description:
            "feature 全体を一気に書くのではなく、verified task loop で前に進みます。",
          highlights: [
            "full-spec orchestration と single-task execution の両方をサポートします。",
            "controller が task status と最終 inline verification receipt を記録します。",
            "verified task ごとに軽量な docs checkpoint を実行します。",
          ],
          notes: [
            {
              title: "Definition of done",
              description: "build、evidence、review が揃わなければ task は done になりません。",
            },
            {
              title: "No fake progress",
              description:
                "placeholder scaffold や scope drift は黙って通さずブロックします。",
            },
          ],
        },
        {
          tab: "/cf:test",
          title: "実際の signal で verify",
          description:
            "浅い green check ではなく、exact commands、prechecks、runtime proof を優先して検証します。",
          highlights: [
            "task evidence に応じて build、typecheck、test suite、UI verification を実行します。",
            "`PRECHECK_FAIL` は `NO_TESTS` より強い verdict として扱います。",
            "曖昧な success ではなく structured verdict を返します。",
          ],
          notes: [
            {
              title: "Exact commands",
              description: "verification は task packet に書かれた command から始まります。",
            },
            {
              title: "UI mode",
              description:
                "保護された flow は `--ui-auth` や `--ui-flow` を利用できます。",
            },
          ],
        },
        {
          tab: "/cf:code-review",
          title: "regression と security を review",
          description:
            "test の後に adversarial review を行い、最後の merge candidate を correctness と security の観点で確認します。",
          highlights: [
            "findings-first の出力で bug と risk に集中できます。",
            "security、behavior drift、verification evidence の欠落を検出します。",
            "`cf:test` と自然に組み合わせられます。",
          ],
          notes: [
            {
              title: "Review posture",
              description: "evidence が揃うまで regression の可能性を前提に扱います。",
            },
            {
              title: "Release gate",
              description: "critical findings は Git と deploy への handoff を止めるべきです。",
            },
          ],
        },
        {
          tab: "/cf:git",
          title: "安全に commit と push",
          description:
            "検証後の code を native Git operations で commit、push、PR 準備、worktree 管理へ繋げます。",
          highlights: [
            "`commit`、`push`、`pr`、sibling-directory `worktree` をサポートします。",
            "commit 前に staged diff の secret scan を行います。",
            "version control を runtime workflow と揃えます。",
          ],
          notes: [
            {
              title: "Command surface",
              description: "`/cf:git commit` と `/cf:git push` を使います。",
            },
            {
              title: "Safety",
              description: "conventional commit と secret check を先に通します。",
            },
          ],
        },
        {
          tab: "/cf:deploy",
          title: "deploy handoff で ship",
          description:
            "verification、review、Git handoff の後に来る最終 release surface として扱います。",
          highlights: [
            "homepage 上では CafeKit release story の最後のステップとして見せます。",
            "Vercel、CI/CD、または custom pipeline の代理表現として使えます。",
            "install から release までの流れを視覚的に完結させます。",
          ],
          notes: [
            {
              title: "Temporary surface",
              description:
                "この section は将来の native deploy handoff を先に見せる placeholder です。",
            },
            {
              title: "Release input",
              description:
                "`cf:test`、`cf:code-review`、`cf:git` を通った code のみ ship します。",
            },
          ],
        },
      ],
    },
    quickStart: {
      heading: "数秒で開始",
      subheading:
        "CafeKit をインストールし、spec を作成・検証し、task を実装して verify し、その後 commit と deploy を行います。",
      viewGuide: "クイックスタートを詳しく見る",
      copied: "コピーしました！",
      copy: "コピー",
      comments: [
        "# 1. CafeKit をインストール",
        "# 2. feature spec を作成して validate",
        "# 3. task packet を1つずつ実装",
        "# 4. verify と review で候補を固める",
        "# 5. commit, push, deploy",
      ],
      tutorialHeading: "CafeKit が初めてですか？",
      tutorialBody: "ゼロから始めましょう — 未インストールから最初の verified feature まで案内します。",
      tutorialCta: "チュートリアルを開始",
    },
    contactForm: {
      heading: "お問い合わせ",
      subheading: "プロジェクトについてお知らせいただくか、ご質問をお寄せください。通常1営業日以内にご返信いたします。",
      fullnameLabel: "お名前",
      fullnamePlaceholder: "山田 太郎",
      emailLabel: "メールアドレス",
      emailPlaceholder: "you@company.com",
      phoneLabel: "電話番号",
      phonePlaceholder: "+81 90-1234-5678",
      jobtitleLabel: "役職",
      jobtitlePlaceholder: "エンジニアリングマネージャー",
      companyLabel: "会社名",
      companyPlaceholder: "株式会社Acme",
      messageLabel: "メッセージ",
      messagePlaceholder: "ユースケース、タイムライン、質問などをご記入ください...",
      submit: "メッセージを送信",
      submitting: "送信中...",
      successTitle: "ありがとうございます！",
      successMessage: "メッセージを送信しました。1営業日以内にご連絡いたします。",
      errorTitle: "エラーが発生しました",
      errorMessage: "現在メッセージを送信できません。しばらくしてから再度お試しください。",
      reset: "別のメッセージを送信",
      validation: {
        fullnameRequired: "お名前は必須です",
        emailRequired: "メールアドレスは必須です",
        emailInvalid: "有効なメールアドレスを入力してください",
        phoneRequired: "電話番号は必須です",
        companyRequired: "会社名は必須です",
        messageTooLong: "メッセージは2000文字以下である必要があります",
      },
    },
  },
};

export function getLandingTranslations(locale: Locale): LandingTranslations {
  return translations[locale] ?? translations.en;
}
