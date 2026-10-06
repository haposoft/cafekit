import type { TutorialContent } from "./tutorial-types";

export const tutorialContentJa: TutorialContent = {
  eyebrow: "はじめに",
  title: "最初の CafeKit feature",
  description: "未インストールから最初の verified feature までのステップ式ガイド。約 15 分。",
  ui: {
    stepWord: "ステップ",
    youWillSeeLabel: "確認できること",
    troubleshootingLabel: "問題が起きたら",
    glossaryLabel: "新しい用語",
    replay: "再生",
    back: "← 戻る",
    next: "次へ →",
    prerequisiteItems: [
      "Node.js 18 以上がインストール済み（確認: node --version）",
      "ターミナルが開いている — Mac は Terminal、Windows は PowerShell",
      "Claude Code がインストール済み（下のリンクを参照 — sudo は使わない）",
      "作業するプロジェクトフォルダ",
    ],
    installCommand: "npm install -g @anthropic-ai/claude-code",
  },
  steps: [
    {
      id: "prereqs",
      label: "準備",
      title: "開始前に必要なもの",
      narrative: [
        "CafeKit は Claude Code の中で動作します — ターミナルから操作する AI コーディングアシスタントです。/cf:* コマンドは通常のターミナルではなく、Claude Code セッションの中で入力します。",
        "3 つのものを準備してください。準備ができたら「次へ」をクリックしてください。",
      ],
      links: [
        { label: "Claude Code をインストール", href: "https://code.claude.com/docs/en/setup", external: true },
        { label: "Claude Code の最初の日", href: "https://support.claude.com/en/articles/14552382-your-first-day-in-claude-code", external: true },
        { label: "Codex CLI を使う場合", href: "/docs/platforms" },
      ],
    },
    {
      id: "install",
      label: "インストール",
      title: "プロジェクトに CafeKit をインストール",
      narrative: [
        "ターミナルを開き、プロジェクトフォルダに移動してからインストーラーを実行します。言語選択や addressing、依存関係のセットアップなど対話式で進みます。CafeKit は .claude/ に runtime bundle を書き込みます — skills、agents、hooks、workflow ルールが含まれます。",
      ],
      command: "npx @haposoft/cafekit",
      outputs: [
        { kind: "output", text: "Select language · 言語を選択 · Chọn ngôn ngữ" },
        { kind: "output", text: "プラットフォーム: Claude Code" },
        { kind: "output", text: "Claude Code — 230 ファイル、20 スキル" },
        { kind: "success", text: "インストール完了" },
        { kind: "success", text: "インストール: 230   更新: 0   変更なし: 0   スキル: あり" },
        { kind: "success", text: "CafeKit Version: 0.16.7" },
      ],
      youWillSee: [
        "対話式プロンプト: 言語選択、platform、呼びかけ名（addressing）、skill dependencies",
        "プロジェクトルートに新しい .claude/ フォルダ",
        "中に: skills/, agents/, hooks/, scripts/, rules/, runtime.json, settings.json, cafekit-manifest.json",
        "workflow ルールが入った CLAUDE.md と、runtime 共通の AGENTS.md",
        "既定で 20 skill。docx / pdf / pptx / xlsx / ai-multimodal は任意で、--with-document-skills を付けたときだけ入ります",
      ],
      troubleshooting: [
        { problem: "npx コマンドが見つからない", fix: "Node.js 18+ が必要です。確認: node --version" },
        { problem: "permission エラー", fix: "sudo を使わないでください。Mac の場合: npm config get prefix" },
      ],
    },
    {
      id: "spec",
      label: "spec 作成",
      title: "最初の spec を作る",
      narrative: [
        "ターミナルで claude を実行してプロジェクト内の Claude Code セッションを開きます。ここが /cf:* コマンドを入力する場所です。",
        "spec とは、コードを書く前に何を作るかを記述した「契約書」です。以下のコマンドを Claude Code 内で実行してください。",
        "CafeKit は必ず先に scope を聞きます（GATE-SCOPE）。勝手に範囲を決めないので、EXPAND（広げる）/ KEEP（そのまま）/ CUT（削る）から選んでください。",
      ],
      command: "/cf:specs Build a word counter that counts words in a sentence",
      outputs: [
        { kind: "output", text: "GATE-SCOPE → 既存コード・最小変更・拡大の兆候を提示し、EXPAND / KEEP / CUT を質問" },
        { kind: "success", text: "✓ specs/word-counter/plan.md" },
        { kind: "success", text: "✓ specs/word-counter/task-01-count-words.md" },
        { kind: "output", text: "GATE-REVIEW → 実装前に adversarial review の findings を提示" },
      ],
      youWillSee: [
        "specs/word-counter/ に plan.md と flat task files",
        "plan.md — scope、exclusions、acceptance criteria、task map",
        "task-01-count-words.md — one outcome、one Status、planned proof command",
      ],
      troubleshooting: [
        { problem: "/cf:specs が認識されない", fix: "このプロジェクトで npx @haposoft/cafekit を実行済みか確認。.claude/ が存在するか確認。" },
        { problem: "コマンドが実行されるが出力がない", fix: "通常のターミナルにいる可能性があります。claude を実行して Claude Code セッションを開いてから再試行。" },
      ],
      glossary: [
        { term: "spec", definition: "何を作るかを記述したファイル群のフォルダ。chat ではなくこれが唯一の真実の源。" },
        { term: "task packet", definition: "flat task-NN-*.md に定義された、スコープの明確な小さい実装単位。" },
      ],
    },
    {
      id: "validate",
      label: "承認",
      title: "コーディング前に GATE-REVIEW を解決",
      narrative: [
        "Adversarial review 後、CafeKit は GATE-REVIEW で findings を一覧にします。各 finding には再現できる path:line と失敗シナリオが必要で、あなたは accept / reject / revise を選びます。accept したものだけが plan に反映されます。",
      ],
      command: "Accept all",
      outputs: [
        { kind: "output", text: "GATE-REVIEW の決定を plan.md の Review log に記録中…" },
        { kind: "success", text: "✓ scope と findings を accepted" },
        { kind: "success", text: "✓ 新しい /cf:develop invocation の準備完了" },
      ],
      youWillSee: [
        "GATE-REVIEW の決定は plan.md に永続化される",
        "Planning はここで停止する — Specs は実装を始めない",
        "実装は必ずあなたが /cf:develop を新しく呼んだときに始まる",
      ],
      troubleshooting: [
        { problem: "検証でエラーが返る", fix: "エラー出力を確認。通常は plan.md のフィールド不足か task ファイルの不一致。/cf:specs を再実行。" },
      ],
    },
    {
      id: "develop",
      label: "実装",
      title: "最初の task を実装",
      narrative: [
        "いよいよ実装です — 1 task ずつ進めます。CafeKit は task ファイルを読み、Status を in_progress にし、所有パスの中だけを変更します。実装後は task の Verification Plan に書かれた exact command を実行し、correctness / security / scope / reachability の review を行います。literal PASS 以外では task を閉じません。",
      ],
      command: "/cf:develop word-counter",
      outputs: [
        { kind: "output", text: "task-01-count-words.md を読み込み中…" },
        { kind: "output", text: "countWords() を実装中…" },
        { kind: "output", text: "quality gate → verification · review" },
        { kind: "success", text: "✓ 実装完了" },
        { kind: "success", text: "✓ Status: done — inline ## Receipt を書き込み" },
      ],
      youWillSee: [
        "プロジェクト内に countWords() 関数が作成される",
        "task ファイルの末尾に inline ## Receipt",
        "Status と Receipt を書くのは controller だけ — develop が done まで進めます",
      ],
      glossary: [
        { term: "quality gate", definition: "task を閉じる前の必須条件: task の exact command が実行されて通ること、review にブロッカーがないこと。PASS_WITH_WARNINGS や NO_TESTS では閉じられません。" },
        { term: "Receipt", definition: "Task 内の canonical proof。Verification: PASS、exact Command、Exit: 0、runtime から導出した Base と Head、そして空でない現在の出力ブロック。" },
      ],
    },
    {
      id: "test",
      label: "テスト",
      title: "本物のテストで検証",
      narrative: [
        "テストを実行します。CafeKit はコマンドを勝手に作りません — task と repository に書かれたコマンドを検出し、安価な compile / typecheck の precheck を先に行い、その後 task の exact command と named probe を実数付きで実行します。0 件のテストで終了コード 0 になっても pass ではありません。",
      ],
      command: "/cf:test",
      outputs: [
        { kind: "output", text: "test runner を検出中…" },
        { kind: "output", text: "test suite を実行中…" },
        { kind: "success", text: "✓ 3 passed   0 failed" },
        { kind: "success", text: "✓ verdict: PASS" },
      ],
      youWillSee: [
        "テスト数 > 0 — 本物のテストが実行された",
        "verdict: PASS — precheck と task の exact command が両方通った",
        "verdict の語彙は PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED。task を閉じられるのは literal PASS だけ",
      ],
      troubleshooting: [
        { problem: "verdict: NO_TESTS", fix: "テストファイルが見つかりません。countWords() のテストを追加して /cf:test を再実行。0 件テストは pass ではありません。" },
        { problem: "テストが失敗する", fix: "エラー出力を確認。実装またはテストを修正し、/cf:test を再実行。" },
      ],
      glossary: [
        { term: "NO_TESTS", definition: "テストスイートが実行されなかった。絶対に pass ではありません — task には本物の evidence が必要。" },
        { term: "PRECHECK_FAIL", definition: "compile / typecheck の precheck が失敗した状態。NO_TESTS より優先して報告されます。" },
      ],
    },
    {
      id: "sync",
      label: "完了判断",
      title: "レビューし、GATE-DONE で完了を決める",
      narrative: [
        "task を done にしたのは develop です（Receipt 付き）。最後にあなたがやることは、独立したレビューを読み、現在の証拠と残っている限界を見て feature を閉じるかどうかを決めることです。これが GATE-DONE で、機械は代わりに決めません。",
        "状態がファイルとずれている場合だけ /cf:sync を使います。例: /cf:sync audit word-counter で packet 全体を点検し、/cf:sync word-counter task-01-count-words.md blocked \"理由\" のように観測できた状態だけを直します。",
      ],
      command: "/cf:code-review",
      outputs: [
        { kind: "output", text: "word-counter の実装をレビュー中…" },
        { kind: "success", text: "✓ spec compliance: ok" },
        { kind: "success", text: "✓ critical finding なし" },
        { kind: "output", text: "GATE-DONE → 現在の Receipt と未解決の限界を提示。完了を決めるのはあなた" },
      ],
      youWillSee: [
        "no critical findings — 完了を判断できる状態",
        "task ファイルの Status と inline Receipt が一致している",
        "通ったコマンドが証明するのは、その実行した境界だけ — product の承認ではありません",
      ],
      troubleshooting: [
        { problem: "レビューで critical issue が見つかった", fix: "問題を修正し、/cf:test → /cf:code-review を再実行。Receipt は controller が書き直します。" },
        { problem: "Stop hook が「receipt がない」と止める", fix: "その task の ## Receipt に exact Command、Exit: 0、Verification: PASS、runtime から導出した Base と Head、現在の出力が揃っているか確認してください。" },
      ],
    },
  ],
  recap: {
    title: "verified な feature を ship しました",
    bullets: [
      "spec を先に、コードは後 — 契約が scope drift を防ぐ",
      "1 task ずつ — 各変更が小さく review 可能",
      "本物の evidence が必要 — fake な green result は不可",
      "State は監査可能 — 各 task は one Status と current inline Receipt を持つ",
      "人間が決めるのは 3 か所だけ — GATE-SCOPE、GATE-REVIEW、GATE-DONE",
    ],
    nextLinks: [
      { label: "Spec-driven development", href: "/docs/spec-driven-development" },
      { label: "Core workflow", href: "/docs/core-workflow" },
      { label: "Skills を見る", href: "/docs/skills" },
    ],
    glossary: [
      { term: "spec", definition: "コード開始前に何を作るかを記述したファイルフォルダ。" },
      { term: "task packet", definition: "plan.md の隣に置く flat な task-NN-*.md。一つの outcome、一つの Status、一つの検証コマンドを持ちます。" },
      { term: "GATE-DONE", definition: "3 つ目の人間の決定。現在の Receipt と named limitations を見て、feature を閉じるかを user が決めます（旧称 C3）。" },
      { term: "GATE-SCOPE / GATE-REVIEW", definition: "1 つ目と 2 つ目の人間の決定。範囲を EXPAND / KEEP / CUT で選び、review findings を accept / reject / revise します（旧称 C1 / C2）。" },
      { term: "quality gate", definition: "task を閉じる前の必須条件 — task の exact command が通ること、review にブロッカーがないこと。" },
      { term: "NO_TESTS", definition: "テストスイートが実行されなかった。絶対に pass の結果ではない。" },
    ],
  },
};
