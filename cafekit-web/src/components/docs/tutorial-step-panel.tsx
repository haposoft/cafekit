"use client";

import Link from "next/link";
import { CheckCircle2, AlertTriangle, BookOpen, ExternalLink } from "lucide-react";
import { localizeHref } from "@/lib/locale-utils";
import type { Locale } from "@/lib/locale-utils";
import type { TutorialStep, TutorialUI, GlossaryTerm } from "./tutorial-types";
import { TutorialStepTerminal } from "./tutorial-step-terminal";

type Props = {
  step: TutorialStep;
  ui: TutorialUI;
  locale: Locale;
  runKey: number;
};

function GlossaryList({ terms }: { terms: GlossaryTerm[] }) {
  return (
    <dl className="mt-1 space-y-2">
      {terms.map(({ term, definition }) => (
        <div key={term} className="rounded-xl border border-[#006242]/12 bg-[#EEF5F1] px-4 py-3 dark:bg-[#14252A]">
          <dt className="font-mono text-sm font-semibold text-[#006242] dark:text-[#A7C5EE]">{term}</dt>
          <dd className="mt-1 text-sm leading-6 text-muted-foreground">{definition}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Step 0 — prerequisites panel (prose + install command + links, no terminal) */
function PrereqsPanel({ step, ui, locale }: { step: TutorialStep; ui: TutorialUI; locale: Locale }) {
  return (
    <div className="space-y-6">
      {step.narrative.map((p, i) => (
        <p key={i} className="text-[15px] leading-8 text-muted-foreground">{p}</p>
      ))}

      {/* Checklist */}
      <ul className="space-y-2">
        {ui.prerequisiteItems.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#006242] dark:text-[#A7C5EE]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {/* Claude Code install command */}
      <div className="overflow-hidden rounded-[20px] border border-[#A7C5EE]/20 bg-[#101820]">
        <div className="border-b border-[#A7C5EE]/12 px-4 py-2.5 font-mono text-xs text-[#8EACD0]">
          terminal
        </div>
        <div className="px-5 py-4 font-mono text-sm text-[#F2EA9D]">
          <span className="mr-3 text-[#A7C5EE]">$</span>
          {ui.installCommand}
        </div>
      </div>

      {/* Links */}
      {step.links && step.links.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {step.links.map((link) => (
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-[#006242]/30 hover:text-[#006242] dark:hover:text-[#A7C5EE]"
              >
                {link.label}
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
            ) : (
              <Link
                key={link.href}
                href={localizeHref(locale, link.href)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-[#006242]/30 hover:text-[#006242] dark:hover:text-[#A7C5EE]"
              >
                {link.label}
              </Link>
            )
          ))}
        </div>
      )}
    </div>
  );
}

/** Steps 1–6 panel: narrative + terminal + sections */
export function TutorialStepPanel({ step, ui, locale, runKey }: Props) {
  const isPrereqs = !step.command;

  if (isPrereqs) {
    return <PrereqsPanel step={step} ui={ui} locale={locale} />;
  }

  return (
    <div className="space-y-6">
      {/* Narrative */}
      {step.narrative.map((p, i) => (
        <p key={i} className="text-[15px] leading-8 text-muted-foreground">{p}</p>
      ))}

      {/* Animated terminal */}
      <TutorialStepTerminal
        command={step.command!}
        outputs={step.outputs ?? []}
        runKey={runKey}
        replayLabel={ui.replay}
      />

      {/* What you'll see */}
      {step.youWillSee && step.youWillSee.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <CheckCircle2 className="h-4 w-4 text-[#006242] dark:text-[#6FD4A2]" />
            {ui.youWillSeeLabel}
          </div>
          <ul className="space-y-2">
            {step.youWillSee.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#006242]/50 dark:bg-[#A7C5EE]/50" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Troubleshooting */}
      {step.troubleshooting && step.troubleshooting.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {ui.troubleshootingLabel}
          </div>
          <div className="space-y-2">
            {step.troubleshooting.map(({ problem, fix }) => (
              <div key={problem} className="rounded-xl border border-amber-200/50 bg-amber-50/40 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/15">
                <p className="text-sm font-medium text-foreground">{problem}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{fix}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Glossary */}
      {step.glossary && step.glossary.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <BookOpen className="h-4 w-4 text-[#006242] dark:text-[#A7C5EE]" />
            {ui.glossaryLabel}
          </div>
          <GlossaryList terms={step.glossary} />
        </div>
      )}
    </div>
  );
}
