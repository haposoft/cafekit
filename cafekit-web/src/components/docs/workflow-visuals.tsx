import { ArrowRight, CheckCircle2, CircleDashed, FileCheck2, GitBranch, ShieldCheck, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const flowSteps = [
  ['/cf:specs', 'Turn intent into scope, evidence, requirements, design, and task packets.'],
  ['/cf:develop', 'Implement one approved task packet, not the whole chat memory.'],
  ['/cf:test', 'Run exact evidence commands and runtime checks.'],
  ['/cf:code-review', 'Review for spec compliance, regressions, security, and drift.'],
  ['/cf:sync', 'Update process-first Status and inline Receipt only after proof, or audit drift.'],
];

const runtimeFiles = [
  ['skills/', '30 packaged workflows and domain capabilities'],
  ['agents/', '13 specialist agents for planning, code, QA, docs, git, and deploy'],
  ['hooks/', 'Privacy, scope, state, usage, docs sync, and spec-state gates'],
  ['runtime.json', 'Runtime configuration, paths, locale, usage, and model hints'],
  ['settings.json', 'Claude Code hook wiring and statusline command'],
  ['status.cjs', 'Git, context, usage, task, and agent statusline'],
];

const gates = [
  ['Scope', 'Accepted C1 scope plus task Ownership define what may change.'],
  ['Evidence', 'Exact commands and runtime proof must be fresh.'],
  ['Review', 'Critical findings block task completion.'],
  ['Sync', 'Task Status and inline Receipt move together.'],
];

export function DocsHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="not-prose relative overflow-hidden rounded-[28px] border border-[#101820]/10 bg-[#101820] p-6 text-white shadow-[0_30px_90px_-50px_rgba(16,24,32,0.85)] sm:p-8">
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative max-w-3xl">
        <div className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#F2EA9D]">
          {eyebrow}
        </div>
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-base leading-8 text-white/74 sm:text-lg">
          {description}
        </p>
      </div>
    </section>
  );
}

export function CommandFlow() {
  return (
    <div className="not-prose my-8 rounded-[24px] border border-border bg-card p-4 shadow-[0_24px_70px_-55px_rgba(16,24,32,0.7)] sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#006242] dark:text-[#A7C5EE]">Spec-driven delivery path</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">The docs should always point back to this contract loop.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {flowSteps.map(([command, detail], index) => (
          <div key={command} className="relative rounded-2xl border border-[#006242]/15 bg-[#EEF5F1] p-4 dark:bg-[#14252A]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="font-mono text-xs font-semibold text-[#006242] dark:text-[#A7C5EE]">{command}</span>
              {index < flowSteps.length - 1 ? <ArrowRight className="hidden h-4 w-4 text-[#006242]/50 xl:block" /> : <CheckCircle2 className="h-4 w-4 text-[#006242]" />}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RuntimeBundle() {
  return (
    <div className="not-prose my-8 overflow-hidden rounded-[24px] border border-[#101820]/10 bg-[#FCFCF5] shadow-[0_28px_80px_-60px_rgba(16,24,32,0.8)] dark:bg-[#122227]">
      <div className="flex items-center gap-2 border-b border-border bg-[#101820] px-4 py-3 font-mono text-xs text-white">
        <CircleDashed className="h-4 w-4 text-[#F2EA9D]" />
        .claude/ runtime bundle
      </div>
      <div className="grid gap-px bg-border md:grid-cols-2">
        {runtimeFiles.map(([name, detail]) => (
          <div key={name} className="bg-card p-4">
            <div className="font-mono text-sm font-semibold text-foreground">{name}</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QualityGate() {
  return (
    <div className="not-prose my-8 grid gap-4 md:grid-cols-4">
      {gates.map(([title, detail], index) => {
        const icons = [GitBranch, FileCheck2, ShieldCheck, Wrench];
        const Icon = icons[index];
        return (
          <div key={title} className={cn("rounded-2xl border bg-card p-4", index === 1 && "border-[#F2EA9D] bg-[#FFFBE2] dark:bg-[#2A2A18]")}>
            <Icon className="mb-4 h-5 w-5 text-[#006242] dark:text-[#A7C5EE]" />
            <div className="font-semibold text-foreground">{title}</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
          </div>
        );
      })}
    </div>
  );
}
