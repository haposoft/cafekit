import { Bot, Boxes, Braces, Bug, FileSearch, GitPullRequest, Laptop, Layers3, PenTool, Shield, Sparkles, TestTube2, Wrench } from 'lucide-react';

const skillGroups: Array<[string, string[]]> = [
  ['Core workflow', ['specs', 'develop', 'test', 'code-review', 'sync', 'git']],
  ['Pre-spec discovery', ['ask', 'brainstorm', 'scout', 'research']],
  ['Debug and change safety', ['debug', 'fix']],
  ['Product and browser', ['ui-ux-pro-max', 'web-testing', 'agent-browser', 'chrome-devtools']],
  ['Documents and media — optional when installed', ['docs', 'ai-multimodal', 'docx', 'pdf', 'pptx', 'xlsx']],
];

const agents = [
  ['brainstormer', 'Pressure-tests product and architecture choices before specs.', Sparkles],
  ['spec-maker', 'Creates a process-first plan and flat executable task packets.', PenTool],
  ['implementer', 'Implements approved task packets as production code.', Wrench],
  ['test-runner', 'Runs exact verification and rejects green lies.', TestTube2],
  ['code-auditor', 'Findings-first review for security, logic, architecture, and drift.', Shield],
  ['debugger', 'Traces failures with evidence before fixes.', Bug],
  ['docs-keeper', 'Keeps project docs and spec docs grounded in source truth.', FileSearch],
  ['git-ops', 'Handles conventional commits, pushes, and release-safe git flow.', GitPullRequest],
  ['inspector', 'Scouts code structure and relevant files quickly.', Braces],
  ['project-manager', 'Aggregates feature progress, blockers, and release state.', Layers3],
  ['researcher', 'Builds proportional, traceable evidence for uncertain technical decisions.', FileSearch],
  ['ui-ux-designer', 'Designs accessible, polished product interfaces.', Laptop],
  ['deployer', 'Coordinates deploys, checks, and rollback handoff.', Boxes],
];

const platforms: Array<[string, string, string]> = [
  ['Claude Code', 'Primary runtime', '.claude/ skills, agents, hooks, statusline, settings'],
  ['Codex CLI', 'Supported runtime', '.agents/skills, .codex/agents, hooks, rules, runtime.json, AGENTS.md'],
  ['OpenCode', 'Legacy 0.16 only', 'Support removed in 0.17; retained only as migration history'],
  ['Cursor', 'Future target', 'Not part of the current package runtime'],
];

export function SkillConstellation() {
  return (
    <div className="not-prose my-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {skillGroups.map(([title, skills]) => (
        <section key={title} className="min-w-0 rounded-[22px] border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#006242]" />
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {(skills as string[]).map((skill) => (
              <span key={skill} className="whitespace-nowrap rounded-full border border-[#006242]/15 bg-[#EEF5F1] px-2.5 py-1 font-mono text-[11px] text-[#006242] dark:bg-[#14252A] dark:text-[#A7C5EE]">
                {skill}
              </span>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AgentGrid() {
  return (
    <div className="not-prose my-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map(([name, detail, Icon]) => {
        const AgentIcon = Icon as typeof Bot;
        return (
          <article key={name as string} className="group rounded-[22px] border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-[#006242]/30 hover:shadow-[0_18px_55px_-45px_rgba(16,24,32,0.8)]">
            <AgentIcon className="mb-4 h-5 w-5 text-[#006242] dark:text-[#A7C5EE]" />
            <h3 className="font-mono text-sm font-semibold text-foreground">{name as string}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail as string}</p>
          </article>
        );
      })}
    </div>
  );
}

export function PlatformMatrix() {
  return (
    <div className="not-prose my-8 overflow-hidden rounded-[24px] border border-border bg-card">
      <div className="grid border-b border-border bg-[#101820] px-4 py-3 font-mono text-xs text-white sm:grid-cols-[1fr_1fr_2fr]">
        <div>Platform</div>
        <div>Status</div>
        <div>Runtime shape</div>
      </div>
      {platforms.map(([platform, status, shape]) => (
        <div key={platform} className="grid gap-2 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[1fr_1fr_2fr]">
          <div className="font-semibold text-foreground">{platform}</div>
          <div className="text-sm text-[#006242] dark:text-[#A7C5EE]">{status}</div>
          <div className="text-sm leading-6 text-muted-foreground">{shape}</div>
        </div>
      ))}
    </div>
  );
}
