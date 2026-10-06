import { CheckCircle2, ClipboardCheck, Code2, FileText, GitBranch, ShieldCheck, TestTube2 } from 'lucide-react';

const stages = [
  {
    icon: FileText,
    command: '/cf:specs',
    title: 'Specify',
    detail: 'Create requirements, research, design, task packets, and validation gates before code starts.',
  },
  {
    icon: ClipboardCheck,
    command: 'Approve task packet',
    title: 'Lock scope',
    detail: 'Use the accepted C1/C2 decisions, plan, and flat task as the implementation contract.',
  },
  {
    icon: Code2,
    command: '/cf:develop',
    title: 'Build',
    detail: 'Implement one approved task at a time after task-aware inspection of real entrypoints.',
  },
  {
    icon: TestTube2,
    command: '/cf:test',
    title: 'Verify',
    detail: 'Run exact commands, prove reachability, and reject fake green results such as zero-test passes.',
  },
  {
    icon: ShieldCheck,
    command: '/cf:code-review',
    title: 'Review',
    detail: 'Check spec compliance, code quality, edge cases, security, and regression risk before closeout.',
  },
  {
    icon: GitBranch,
    command: '/cf:sync',
    title: 'Sync',
    detail: 'Update task Status and its inline Receipt only after proof, or audit drift before continuing.',
  },
];

const proofItems = [
  ['Contract', 'Plan, accepted decisions, and active task agree on scope.'],
  ['Code', 'Runtime-facing work is wired into a real entrypoint or caller.'],
  ['Evidence', 'The task records commands, outcomes, and runtime or artifact proof.'],
  ['State', 'Task Status and inline Receipt are synchronized after verification.'],
];

export function CoreWorkflowMap() {
  return (
    <section className="not-prose my-8 overflow-hidden rounded-[28px] border border-[#101820]/10 bg-[#101820] shadow-[0_30px_90px_-58px_rgba(16,24,32,0.9)]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#F2EA9D]">Main CafeKit workflow</div>
      </div>
      <div className="grid gap-px bg-white/10 lg:grid-cols-6">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div key={stage.command} className="bg-[#101820] p-5 text-white">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                  <Icon className="h-5 w-5 text-[#F2EA9D]" />
                </div>
                <span className="font-mono text-xs text-white/45">0{index + 1}</span>
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

export function WorkflowProofStack() {
  return (
    <div className="not-prose my-8 grid gap-4 md:grid-cols-4">
      {proofItems.map(([title, detail]) => (
        <div key={title} className="rounded-2xl border border-[#006242]/15 bg-[#EEF5F1] p-5 dark:bg-[#14252A]">
          <CheckCircle2 className="mb-4 h-5 w-5 text-[#006242] dark:text-[#A7C5EE]" />
          <div className="font-semibold text-foreground">{title}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
      ))}
    </div>
  );
}

export function WorkflowStateRail() {
  return (
    <div className="not-prose my-8 overflow-hidden rounded-[24px] border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3 font-mono text-xs text-muted-foreground">
        <GitBranch className="h-4 w-4 text-[#006242] dark:text-[#A7C5EE]" />
        State moves only when proof exists
      </div>
      <div className="grid gap-px bg-border md:grid-cols-4">
        {['pending', 'in_progress', 'blocked', 'done'].map((state) => (
          <div key={state} className="bg-card p-4">
            <div className="font-mono text-sm font-semibold text-foreground">{state}</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {state === 'pending' && 'Task is known but not active yet.'}
              {state === 'in_progress' && 'Task has been claimed and is being implemented or verified.'}
              {state === 'blocked' && 'A concrete blocker is recorded and must be cleared before continuing.'}
              {state === 'done' && 'Completion criteria and evidence are satisfied with real proof.'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
