import { CheckCircle2, ClipboardList, Code2, FileCheck2, FileText, GitBranch, SearchCheck, ShieldCheck } from 'lucide-react';

const lifecycleStages = [
  {
    icon: SearchCheck,
    label: '01',
    title: 'C1 scope',
    command: '/cf:specs',
    detail: 'Scout proportionally, resolve ambiguity, and record the user-approved scope and exclusions.',
  },
  {
    icon: FileText,
    label: '02',
    title: 'Plan',
    command: 'plan.md',
    detail: 'Record accepted scope, constraints, decisions, ownership, dependencies, acceptance mapping, and C3 boundary.',
  },
  {
    icon: ClipboardList,
    label: '03',
    title: 'Task packets',
    command: 'task-NN-*.md',
    detail: 'Split work into flat packets with Outcome, Scope, Ownership, Acceptance, Dependencies, and Verification Plan.',
  },
  {
    icon: FileCheck2,
    label: '04',
    title: 'C2 review',
    command: 'adversarial findings',
    detail: 'The user accepts, rejects, or revises bounded findings before implementation handoff.',
  },
  {
    icon: Code2,
    label: '05',
    title: 'Develop',
    command: '/cf:develop',
    detail: 'Implement one unblocked task after task-aware inspection of real entrypoints and blast radius.',
  },
  {
    icon: ShieldCheck,
    label: '06',
    title: 'Proof',
    command: '/cf:test + /cf:code-review',
    detail: 'Run exact evidence commands, prove reachability, and reject scope drift or hidden placeholders.',
  },
  {
    icon: GitBranch,
    label: '07',
    title: 'Sync',
    command: '/cf:sync',
    detail: 'Write Status and inline Receipt only after proof, then present evidence and limitations for C3.',
  },
];

const artifacts = [
  ['plan.md', 'Feature contract', 'C1/C2 decisions, scope, exclusions, task index, ownership, dependencies, acceptance mapping, C3 boundary'],
  ['task-NN-*.md', 'Execution packet', 'Outcome, Scope, Ownership, Acceptance, Dependencies, Verification Plan, Status, inline Receipt'],
  ['inline Receipt', 'Canonical proof', 'exact command, Exit: 0, Verification: PASS, current Base and Head, fenced current output'],
];

const readiness = [
  ['C1 is recorded', 'Scope, exclusions, assumptions, and user decisions are explicit.'],
  ['C2 is resolved', 'Every bounded finding has an accepted, rejected, or revised disposition.'],
  ['Tasks are flat', 'Every plan row maps to one direct-child task-NN file.'],
  ['Ownership is disjoint', 'Task write boundaries and dependencies are explicit before execution.'],
  ['Verification is executable', 'Each task names an exact command, probes, oracle, negative path, and reachability proof.'],
  ['C3 stays human-owned', 'Current Receipts and limitations are shown before the user decides completion.'],
];

export function SpecLifecycleMap() {
  return (
    <section className="not-prose my-8 overflow-hidden rounded-[28px] border border-[#101820]/10 bg-[#101820] shadow-[0_30px_90px_-58px_rgba(16,24,32,0.9)]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#F2EA9D]">Spec-driven development loop</div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/64">
          CafeKit keeps the assistant moving through persistent contracts instead of relying on chat memory.
        </p>
      </div>
      <div className="grid gap-px bg-white/10 md:grid-cols-2 xl:grid-cols-4">
        {lifecycleStages.map((stage) => {
          const Icon = stage.icon;
          return (
            <div key={stage.label} className="bg-[#101820] p-5 text-white">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                  <Icon className="h-5 w-5 text-[#F2EA9D]" />
                </div>
                <span className="font-mono text-xs text-white/42">{stage.label}</span>
              </div>
              <div className="font-mono text-[12px] text-[#A7C5EE]">{stage.command}</div>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{stage.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/68">{stage.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SpecArtifactGrid() {
  return (
    <div className="not-prose my-8 overflow-hidden rounded-[24px] border border-border bg-card">
      <div className="grid border-b border-border bg-[#101820] px-4 py-3 font-mono text-xs text-white sm:grid-cols-[1fr_1fr_2fr]">
        <div>Artifact</div>
        <div>Owns</div>
        <div>Must contain</div>
      </div>
      {artifacts.map(([artifact, owns, contains]) => (
        <div key={artifact} className="grid gap-2 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[1fr_1fr_2fr]">
          <div className="font-mono text-sm font-semibold text-[#006242] dark:text-[#A7C5EE]">{artifact}</div>
          <div className="text-sm font-medium text-foreground">{owns}</div>
          <div className="text-sm leading-6 text-muted-foreground">{contains}</div>
        </div>
      ))}
    </div>
  );
}

export function SpecReadinessGrid() {
  return (
    <div className="not-prose my-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {readiness.map(([title, detail]) => (
        <div key={title} className="rounded-2xl border border-[#006242]/15 bg-[#EEF5F1] p-5 dark:bg-[#14252A]">
          <CheckCircle2 className="mb-4 h-5 w-5 text-[#006242] dark:text-[#A7C5EE]" />
          <div className="font-semibold text-foreground">{title}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
      ))}
    </div>
  );
}
