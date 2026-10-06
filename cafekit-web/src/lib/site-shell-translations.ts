import type { Locale } from "@/lib/locale-utils";

type SiteShellTranslations = {
  header: {
    workflow: string;
    whyItWorks: string;
    artifacts: string;
    quickstart: string;
    github: string;
    tryQuickstart: string;
  };
  footer: {
    description: string;
    readDocs: string;
    github: string;
    product: string;
    workflows: string;
    resources: string;
    documentation: string;
    installation: string;
    quickstart: string;
    commandReference: string;
    specs: string;
    coreWorkflow: string;
    develop: string;
    testReview: string;
    claudeCode: string;
    releases: string;
    issues: string;
    faq: string;
    copyright: string;
  };
};

const translations: Record<Locale, SiteShellTranslations> = {
  en: {
    header: {
      workflow: "Workflow",
      whyItWorks: "What's different",
      artifacts: "Artifacts",
      quickstart: "Quickstart",
      github: "GitHub",
      tryQuickstart: "Quickstart",
    },
    footer: {
      description:
        "Claude Code-first runtime for spec-driven delivery. Install the runtime bundle, validate specs, implement verified task packets, and release with confidence.",
      readDocs: "Read docs",
      github: "GitHub",
      product: "Product",
      workflows: "Workflows",
      resources: "Resources",
      documentation: "Documentation",
      installation: "Installation",
      quickstart: "Quickstart",
      commandReference: "Command Reference",
      coreWorkflow: "Core workflow",
      specs: "/cf:specs",
      develop: "/cf:develop",
      testReview: "/cf:test + /cf:code-review",
      claudeCode: "Claude Code",
      releases: "Releases",
      issues: "Issues",
      faq: "FAQ",
      copyright: "Built for real repos, not demo prompts.",
    },
  },
  vi: {
    header: {
      workflow: "Quy trình",
      whyItWorks: "Điểm khác biệt",
      artifacts: "Kết quả",
      quickstart: "Bắt đầu nhanh",
      github: "GitHub",
      tryQuickstart: "Bắt đầu nhanh",
    },
    footer: {
      description:
        "Runtime Claude Code-first cho quy trình spec-driven. Cài runtime bundle, validate spec, triển khai task packet đã verify, rồi release với sự tự tin.",
      readDocs: "Đọc docs",
      github: "GitHub",
      product: "Sản phẩm",
      workflows: "Workflow",
      resources: "Tài nguyên",
      documentation: "Tài liệu",
      installation: "Cài đặt",
      quickstart: "Bắt đầu nhanh",
      commandReference: "Tham chiếu lệnh",
      coreWorkflow: "Workflow chính",
      specs: "/cf:specs",
      develop: "/cf:develop",
      testReview: "/cf:test + /cf:code-review",
      claudeCode: "Claude Code",
      releases: "Releases",
      issues: "Issues",
      faq: "FAQ",
      copyright: "Dành cho repo thật, không phải prompt demo.",
    },
  },
  ja: {
    header: {
      workflow: "ワークフロー",
      whyItWorks: "違い",
      artifacts: "Artifacts",
      quickstart: "クイックスタート",
      github: "GitHub",
      tryQuickstart: "クイックスタート",
    },
    footer: {
      description:
        "Claude Code-first の spec-driven runtime。runtime bundle を入れ、spec を validate し、verified task packet を実装して、自信を持って release できます。",
      readDocs: "Docs を読む",
      github: "GitHub",
      product: "Product",
      workflows: "Workflows",
      resources: "Resources",
      documentation: "Documentation",
      installation: "Installation",
      quickstart: "Quickstart",
      commandReference: "Command Reference",
      coreWorkflow: "Core workflow",
      specs: "/cf:specs",
      develop: "/cf:develop",
      testReview: "/cf:test + /cf:code-review",
      claudeCode: "Claude Code",
      releases: "Releases",
      issues: "Issues",
      faq: "FAQ",
      copyright: "demo prompt ではなく実際の repo 向けに作られています。",
    },
  },
};

export function getSiteShellTranslations(locale: Locale): SiteShellTranslations {
  return translations[locale] ?? translations.en;
}
