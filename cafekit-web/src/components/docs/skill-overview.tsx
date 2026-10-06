import Link from 'next/link';
import { ArrowRight, Bot, Braces, Bug, FileText, GitBranch, HelpCircle, PenTool, Shield, Sparkles, TestTube2, Wrench } from 'lucide-react';
import { type Locale, localizeHref } from '@/lib/locale-utils';
import { getSkillDetails, type MainSkillSlug } from './skill-detail-content';

const icons = {
  ask: HelpCircle,
  brainstorm: Sparkles,
  specs: PenTool,
  develop: Wrench,
  test: TestTube2,
  'code-review': Shield,
  sync: GitBranch,
  debug: Bug,
  fix: Wrench,
  docs: FileText,
  scout: Braces,
  git: GitBranch,
} satisfies Record<MainSkillSlug, typeof Bot>;

const labels = {
  en: {
    title: 'Main skill pages',
    description: 'Start with the workflow skills. Each page explains when to use the skill, its operating flow, output, traps, and handoff.',
    supportTitle: 'Support skill catalog',
  },
  vi: {
    title: 'Trang chi tiết skill chính',
    description: 'Bắt đầu từ nhóm workflow skills. Mỗi trang giải thích khi nào dùng, flow vận hành, output, bẫy cần tránh, và handoff.',
    supportTitle: 'Catalog support skills',
  },
  ja: {
    title: 'Main skill pages',
    description: 'まず workflow skills から読むのがおすすめです。各ページで use case、flow、output、traps、handoff を説明します。',
    supportTitle: 'Support skill catalog',
  },
};

const supportSkills = [
  ['cf:research', 'Adaptive evidence for uncertain decisions, with traceable claims and explicit gaps; it does not implement or guarantee the recommendation.'],
  ['cf:ui-ux-pro-max', 'UI/UX rules, accessibility, layout, motion, and design intelligence.'],
  ['cf:web-testing', 'Playwright, Vitest, k6, visual, a11y, and performance testing.'],
  ['cf:agent-browser', 'Context-efficient browser automation snapshots.'],
  ['cf:chrome-devtools', 'Puppeteer automation, screenshots, console, and ARIA checks.'],
  ['cf:docs', 'Document capability, optional and available only when installed; supports project documentation and source-backed reconstruction.'],
  ['cf:ai-multimodal (optional)', 'Image, audio, video, OCR, transcript, and document analysis.'],
  ['cf:docx (optional)', 'Word document creation, extraction, editing, comments, and redlines.'],
  ['cf:pdf (optional)', 'PDF extraction, creation, forms, merge, split, and batch work.'],
  ['cf:pptx (optional)', 'PowerPoint creation, editing, templates, and slide generation.'],
  ['cf:xlsx (optional)', 'Spreadsheet creation, formulas, charts, analysis, and recalculation.'],
];

function normalizeLocale(locale: string): Locale {
  return locale === 'vi' || locale === 'ja' ? locale : 'en';
}

export function MainSkillIndex({ locale }: { locale: string }) {
  const normalized = normalizeLocale(locale);
  const t = labels[normalized];
  const details = getSkillDetails(normalized).filter(([slug]) => slug !== 'docs');

  return (
    <section className="not-prose my-10 space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{t.description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {details.map(([slug, detail]) => {
          const Icon = icons[slug];
          return (
            <Link
              key={slug}
              href={localizeHref(normalized, `/docs/skills/${slug}`)}
              className="group rounded-[24px] border border-border bg-card p-5 no-underline transition hover:-translate-y-0.5 hover:border-[#006242]/30 hover:shadow-[0_18px_55px_-45px_rgba(16,24,32,0.8)]"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF5F1] text-[#006242] dark:bg-[#14252A] dark:text-[#A7C5EE]">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-[#006242]" />
              </div>
              <div className="font-mono text-xs text-[#006242] dark:text-[#A7C5EE]">{detail.command}</div>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{detail.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail.summary}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function SupportSkillCatalog({ locale }: { locale: string }) {
  const normalized = normalizeLocale(locale);
  const t = labels[normalized];

  return (
    <section className="not-prose my-10">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t.supportTitle}</h2>
      <div className="mt-5 overflow-hidden rounded-[24px] border border-border bg-card">
        {supportSkills.map(([skill, detail]) => (
          <div key={skill} className="grid gap-2 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[220px_1fr]">
            <div className="font-mono text-sm font-semibold text-[#006242] dark:text-[#A7C5EE]">{skill}</div>
            <div className="text-sm leading-6 text-muted-foreground">{detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
