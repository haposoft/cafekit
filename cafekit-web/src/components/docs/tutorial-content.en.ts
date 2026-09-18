import type { TutorialContent } from "./tutorial-types";

export const tutorialContentEn: TutorialContent = {
  eyebrow: "Getting started",
  title: "Your first CafeKit feature",
  description: "A step-by-step guide from zero install to your first verified feature. Takes about 15 minutes.",
  ui: {
    stepWord: "Step",
    youWillSeeLabel: "What you'll see",
    troubleshootingLabel: "If something goes wrong",
    glossaryLabel: "New terms",
    replay: "Replay",
    back: "← Back",
    next: "Next →",
    prerequisiteItems: [
      "Node.js 18 or later (check: node --version)",
      "A terminal open — Terminal on Mac, PowerShell on Windows",
      "Claude Code installed (see links below — do NOT use sudo)",
      "An existing project folder to work in",
    ],
    installCommand: "npm install -g @anthropic-ai/claude-code",
  },
  steps: [
    {
      id: "prereqs",
      label: "Prepare",
      title: "What you need before starting",
      narrative: [
        "CafeKit runs inside Claude Code — an AI coding assistant you control from your terminal. You type /cf:* commands inside a Claude Code session, not in a regular terminal prompt.",
        "You'll need three things ready. Once you have them, come back and click Next.",
      ],
      links: [
        { label: "Install Claude Code", href: "https://code.claude.com/docs/en/setup", external: true },
        { label: "Your first day in Claude Code", href: "https://support.claude.com/en/articles/14552382-your-first-day-in-claude-code", external: true },
        { label: "Using Codex CLI?", href: "/docs/platforms" },
      ],
    },
    {
      id: "install",
      label: "Install",
      title: "Install CafeKit into your project",
      narrative: [
        "Open your terminal, navigate to your project folder, then run the installer. It asks for language, runtime, addressing, and skill dependencies, then writes a native bundle for Claude Code or Codex CLI.",
      ],
      command: "npx @haposoft/cafekit",
      outputs: [
        { kind: "output", text: "Select language · 言語を選択 · Chọn ngôn ngữ" },
        { kind: "output", text: "Platform: Claude Code" },
        { kind: "output", text: "Claude Code — 230 files, 20 skills" },
        { kind: "success", text: "Installation complete" },
        { kind: "success", text: "Installed: 230   Updated: 0   Unchanged: 0   Skills: yes" },
        { kind: "success", text: "CafeKit Version: 0.16.7" },
      ],
      youWillSee: [
        "Interactive prompts: language, platform, addressing (how the AI calls you), and skill dependencies",
        "A new .claude/ or .codex/ runtime in your project root, holding skills/, agents/, hooks/, scripts/, rules/, runtime.json, and settings.json",
        "Claude Code gets .claude/ and CLAUDE.md; Codex gets .agents/, .codex/, and an AGENTS.md block",
        "20 skills by default — docx, pdf, pptx, xlsx, and ai-multimodal are optional and install only with --with-document-skills",
      ],
      troubleshooting: [
        { problem: "npx command not found", fix: "Node.js 18+ is required. Check: node --version" },
        { problem: "Permission error", fix: "Do not use sudo. On Mac check: npm config get prefix" },
      ],
    },
    {
      id: "spec",
      label: "Create spec",
      title: "Create your first spec",
      narrative: [
        "Now open a Claude Code session inside your project by running claude in the terminal. You are now inside Claude Code — this is where you type /cf:* commands.",
        "A spec is a written contract that describes what you want to build before code starts. Specs asks GATE-SCOPE first to lock scope, writes the plan and flat tasks, then presents GATE-REVIEW findings for your decision.",
        "It never decides scope for you: it shows what already exists, the smallest change that delivers the outcome, and any signal that the work is growing, then asks you to choose EXPAND, KEEP, or CUT.",
      ],
      command: "/cf:specs Build a word counter that counts words in a sentence",
      outputs: [
        { kind: "output", text: "GATE-SCOPE → existing code, smallest change, expansion signals → EXPAND / KEEP / CUT?" },
        { kind: "success", text: "✓ specs/word-counter/plan.md" },
        { kind: "success", text: "✓ specs/word-counter/task-01-count-words.md" },
        { kind: "output", text: "GATE-REVIEW → adversarial findings presented before implementation" },
      ],
      youWillSee: [
        "A new specs/word-counter/ folder with plan.md and flat task files",
        "plan.md — scope, exclusions, acceptance criteria, and task map",
        "task-01-count-words.md — one outcome, one Status field, and a planned proof command",
      ],
      troubleshooting: [
        { problem: "/cf:specs not recognized", fix: "Make sure you ran npx @haposoft/cafekit in this project. Check that .claude/ exists." },
        { problem: "Command runs but no output", fix: "You may be in a regular terminal, not a Claude Code session. Run claude first, then try again." },
      ],
      glossary: [
        { term: "spec", definition: "A folder of files that describes what to build. The source of truth — not the chat." },
        { term: "task packet", definition: "A small scoped implementation unit defined in a flat task-NN-*.md file." },
      ],
    },
    {
      id: "validate",
      label: "Approve",
      title: "Resolve GATE-REVIEW before writing code",
      narrative: [
        "After adversarial review, CafeKit lists the findings at GATE-REVIEW. Each one has to carry a reproducible path:line and a failure scenario, and you accept, reject, or revise it. Only accepted findings are applied to the plan.",
      ],
      command: "Accept all",
      outputs: [
        { kind: "output", text: "recording GATE-REVIEW decisions in the plan review log…" },
        { kind: "success", text: "✓ scope and findings accepted" },
        { kind: "success", text: "✓ ready for a new explicit /cf:develop invocation" },
      ],
      youWillSee: [
        "GATE-REVIEW decisions are durable in plan.md",
        "Planning stops here — Specs never starts implementation",
        "Implementation begins only when you invoke /cf:develop yourself",
      ],
      troubleshooting: [
        { problem: "A finding is unclear", fix: "Ask what decision it changes. Do not accept a material limitation you do not understand." },
      ],
    },
    {
      id: "develop",
      label: "Code",
      title: "Implement the first task",
      narrative: [
        "Now implement — one task at a time. CafeKit reads the task file, sets its Status to in_progress, and changes only the paths that task owns. After coding it runs the exact command written in the task's Verification Plan and reviews correctness, security, scope, and reachability. Nothing but a literal PASS closes a task.",
      ],
      command: "/cf:develop word-counter",
      outputs: [
        { kind: "output", text: "reading plan.md and task-01-count-words.md…" },
        { kind: "output", text: "implementing countWords()…" },
        { kind: "output", text: "quality gate → verification · review" },
        { kind: "success", text: "✓ implementation complete" },
        { kind: "success", text: "✓ Status: done — inline ## Receipt written" },
      ],
      youWillSee: [
        "The countWords() function created in your project",
        "An inline ## Receipt at the end of the task file",
        "Only the controller writes Status and Receipt — develop takes the task all the way to done",
      ],
      glossary: [
        { term: "quality gate", definition: "What a task must clear before it closes: the task's exact command runs and passes, and review leaves no blocker. PASS_WITH_WARNINGS and NO_TESTS cannot close it." },
        { term: "Receipt", definition: "The task's canonical proof: Verification: PASS, the exact Command, Exit: 0, runtime-derived Base and Head, and a non-empty block of current output." },
      ],
    },
    {
      id: "test",
      label: "Test",
      title: "Verify with real tests",
      narrative: [
        "Run the tests. CafeKit never invents a command: it detects them from the task and the repository, runs a cheap compile or typecheck precheck when the project has one, then executes the task's exact command and its named probes with real counts. A command that exits 0 while running zero tests is NOT a pass.",
      ],
      command: "/cf:test",
      outputs: [
        { kind: "output", text: "detecting test runner…" },
        { kind: "output", text: "running test suite…" },
        { kind: "success", text: "✓ 3 passed   0 failed" },
        { kind: "success", text: "✓ verdict: PASS" },
      ],
      youWillSee: [
        "Test count > 0 — real tests ran",
        "verdict: PASS — the precheck and the task's exact command both passed",
        "The verdict vocabulary is PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED, and only a literal PASS can close a task",
      ],
      troubleshooting: [
        { problem: "verdict: NO_TESTS", fix: "No test file found. Add a test for countWords() and run /cf:test again. Zero tests is not a pass." },
        { problem: "Tests fail", fix: "Read the error. Fix the implementation or the test, then re-run /cf:test." },
      ],
      glossary: [
        { term: "NO_TESTS", definition: "No test suite ran. Never a passing result — tasks require real evidence." },
        { term: "PRECHECK_FAIL", definition: "The compile or typecheck precheck failed. It outranks NO_TESTS in the report." },
      ],
    },
    {
      id: "sync",
      label: "Decide",
      title: "Review, then decide at GATE-DONE",
      narrative: [
        "Develop already set the task to done and wrote its Receipt. What is left for you is to read an independent review, look at the current evidence and the limitations that remain, and decide whether the feature is finished. That decision is GATE-DONE, and no command makes it for you.",
        "Use /cf:sync only when file state has drifted: /cf:sync audit word-counter inspects the whole packet, and /cf:sync word-counter task-01-count-words.md blocked \"reason\" records an observed state without inventing proof.",
      ],
      command: "/cf:code-review",
      outputs: [
        { kind: "output", text: "reviewing word-counter implementation…" },
        { kind: "success", text: "✓ spec compliance: ok" },
        { kind: "success", text: "✓ no critical findings" },
        { kind: "output", text: "GATE-DONE → current Receipts and open limitations shown; you decide" },
      ],
      youWillSee: [
        "no critical findings — you can judge completion",
        "The task's Status and inline Receipt agree",
        "A passing command proves only the boundary it ran — not product approval",
      ],
      troubleshooting: [
        { problem: "Critical findings in review", fix: "Fix the issues, re-run /cf:test, then /cf:code-review again. The controller rewrites the Receipt." },
        { problem: "A Stop hook says a done task has no receipt", fix: "Check that the task's ## Receipt carries the exact Command, Exit: 0, Verification: PASS, runtime-derived Base and Head, and current output." },
      ],
    },
  ],
  recap: {
    title: "You just shipped a verified feature",
    bullets: [
      "Spec first, code second — the contract prevents scope drift",
      "One task at a time — each change is small and reviewable",
      "Real evidence required — no fake green results",
      "State stays auditable — each task owns one Status and one current inline Receipt",
      "Humans decide in exactly three places — GATE-SCOPE, GATE-REVIEW, GATE-DONE",
    ],
    nextLinks: [
      { label: "Spec-driven development", href: "/docs/spec-driven-development" },
      { label: "Core workflow", href: "/docs/core-workflow" },
      { label: "Browse skills", href: "/docs/skills" },
    ],
    glossary: [
      { term: "spec", definition: "Folder of files describing what to build before code starts." },
      { term: "task packet", definition: "A flat task-NN-*.md file beside plan.md: one outcome, one Status field, one verification command." },
      { term: "GATE-DONE", definition: "The third human decision (formerly C3): the user judges whether the current Receipts and named limitations are enough to close the feature." },
      { term: "GATE-SCOPE / GATE-REVIEW", definition: "The first two human decisions (formerly C1 / C2): choose EXPAND, KEEP, or CUT for scope, then accept, reject, or revise each review finding." },
      { term: "quality gate", definition: "What a task must clear before it closes: its exact command passes and review leaves no blocker." },
      { term: "NO_TESTS", definition: "No test suite ran. Never a passing result." },
    ],
  },
};
