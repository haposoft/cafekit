"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type TerminalLine = {
  kind: "command" | "output" | "success" | "ghost";
  text: string;
};

type TerminalStep = {
  id: string;
  label: string;
  command: string;
  outputs: TerminalLine[];
};

const steps: TerminalStep[] = [
  {
    id: "install",
    label: "Install",
    command: "npx @haposoft/cafekit",
    outputs: [
      { kind: "output", text: "installing Claude Code runtime bundle..." },
      { kind: "success", text: "skills  agents  hooks  statusline" },
    ],
  },
  {
    id: "specs",
    label: "Create spec",
    command: "/cf:specs Build a meeting transcript extension",
    outputs: [
      { kind: "output", text: "C1 scope confirmed  |  plan.md created" },
      { kind: "success", text: "flat tasks created  |  C2 findings ready" },
    ],
  },
  {
    id: "validate",
    label: "Approve C2",
    command: "Accept all",
    outputs: [{ kind: "success", text: "C2 decisions recorded  |  planning stops" }],
  },
  {
    id: "develop",
    label: "Develop",
    command: "/cf:develop meet-transcript-mvp",
    outputs: [
      { kind: "output", text: "quality gate -> build, evidence, review" },
      { kind: "success", text: "task Status: done  |  inline Receipt current" },
    ],
  },
  {
    id: "test",
    label: "Test",
    command: "/cf:test --full",
    outputs: [{ kind: "success", text: "precheck first  |  exact task commands verified" }],
  },
];

function lineClasses(kind: TerminalLine["kind"]) {
  if (kind === "command") return "font-semibold text-[#F2EA9D]";
  if (kind === "success") return "text-[#6FD4A2]";
  if (kind === "ghost") return "text-[#8EACD0]";
  return "text-[#D9E6E0]";
}

export function InteractiveRuntimeTerminal() {
  const [runToken, setRunToken] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [completedStep, setCompletedStep] = useState(-1);
  const [visibleLines, setVisibleLines] = useState<TerminalLine[]>([]);
  const [typingLine, setTypingLine] = useState<TerminalLine | null>(null);
  const [typedChars, setTypedChars] = useState(0);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];

    const schedule = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(callback, delay);
      timersRef.current.push(timer);
    };

    const runStep = (stepIndex: number) => {
      const step = steps[stepIndex];

      if (!step) {
        return;
      }

      setActiveStep(stepIndex);
      setTypingLine({ kind: "command", text: step.command });
      setTypedChars(0);

      let cursor = 0;

      const revealOutputs = (outputIndex: number) => {
        if (outputIndex >= step.outputs.length) {
          setCompletedStep(stepIndex);

          if (stepIndex < steps.length - 1) {
            schedule(() => runStep(stepIndex + 1), 420);
          }

          return;
        }

        const output = step.outputs[outputIndex];
        schedule(() => {
          setVisibleLines((current) => [...current, output]);
          revealOutputs(outputIndex + 1);
        }, output.kind === "success" ? 180 : 130);
      };

      const typeNextChar = () => {
        cursor += 1;
        setTypedChars(cursor);

        if (cursor < step.command.length) {
          schedule(typeNextChar, 20);
          return;
        }

        schedule(() => {
          setVisibleLines((current) => [...current, { kind: "command", text: step.command }]);
          setTypingLine(null);
          setTypedChars(0);
          revealOutputs(0);
        }, 180);
      };

      schedule(typeNextChar, 120);
    };

    schedule(() => {
      setVisibleLines([]);
      setTypingLine(null);
      setTypedChars(0);
      setActiveStep(0);
      setCompletedStep(-1);
      runStep(0);
    }, 0);

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, [runToken]);

  const renderedLines = typingLine
    ? [
        ...visibleLines,
        {
          ...typingLine,
          text: typingLine.text.slice(0, typedChars),
        },
      ]
    : visibleLines;

  return (
    <div className="relative mx-auto w-full max-w-2xl pb-24 pt-16 lg:translate-x-4">
      <div className="absolute -right-4 top-8 h-52 w-52 rounded-full bg-[#A7C5EE]/28 blur-3xl" />
      <div className="absolute -left-6 bottom-8 h-44 w-44 rounded-full bg-[#F2EA9D]/22 blur-3xl" />

      <div className="relative overflow-hidden rounded-[28px] border border-[#A7C5EE]/26 bg-[#101820]/96 shadow-[0_24px_80px_-28px_rgba(16,24,32,0.45)] backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(167,197,238,0.14),_transparent_30%),linear-gradient(160deg,_rgba(255,255,255,0.04),_rgba(0,98,66,0.08))]" />

        <div className="relative flex items-center justify-between border-b border-[#A7C5EE]/14 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-[#ff5f57]" />
            <span className="h-3.5 w-3.5 rounded-full bg-[#febc2e]" />
            <span className="h-3.5 w-3.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="font-mono text-sm text-[#A7C5EE]">~ /cafekit-runtime</span>
          <button
            type="button"
            onClick={() => setRunToken((current) => current + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#A7C5EE]/14 bg-[#13262A] px-2.5 py-1.5 text-xs font-medium text-[#A7C5EE] transition hover:border-[#A7C5EE]/28 hover:bg-[#173038]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Replay
          </button>
        </div>

        <div className="relative border-b border-[#A7C5EE]/10 px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  index === activeStep
                    ? "border-[#F2EA9D]/30 bg-[#F2EA9D]/12 text-[#F2EA9D]"
                    : index <= completedStep
                      ? "border-[#6FD4A2]/24 bg-[#6FD4A2]/10 text-[#6FD4A2]"
                    : "border-[#A7C5EE]/12 bg-[#13262A] text-[#8EACD0] hover:border-[#A7C5EE]/24 hover:text-[#DDE9F9]",
                )}
              >
                {step.label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[390px] px-6 py-7 font-mono text-[15px] leading-7 text-[#F6FAF7]">
          <div className="space-y-3">
            {renderedLines.map((line, index) => (
              <div key={`${line.text}-${index}`} className="flex items-start gap-3">
                <span className={line.kind === "command" ? "pt-0.5 text-[#A7C5EE]" : "pt-0.5 text-transparent"}>
                  $
                </span>
                <span className={lineClasses(line.kind)}>{line.text}</span>
              </div>
            ))}

            <div className="flex items-center gap-3">
              <span className="pt-0.5 text-[#A7C5EE]">$</span>
              <span className="inline-flex h-6 w-2 rounded-sm bg-[#F2EA9D]/90 align-middle animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-2 top-1 rounded-2xl border border-[#A7C5EE]/18 bg-[#0E1A21]/92 px-4 py-3 shadow-[0_20px_50px_-24px_rgba(16,24,32,0.6)] backdrop-blur">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#8EACD0]">Active Loop</div>
        <div className="mt-1 text-sm font-semibold text-[#F6FAF7]">specs → develop → test</div>
      </div>

      <div className="absolute bottom-3 left-2 rounded-2xl border border-[#F2EA9D]/22 bg-[#13262A]/90 px-4 py-3 shadow-[0_20px_50px_-24px_rgba(16,24,32,0.56)] backdrop-blur">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#F2EA9D]">Task Packet</div>
        <div className="mt-1 text-sm font-semibold text-[#F6FAF7]">R0-02 auth setup</div>
        <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-white/8">
          <div className="h-full w-4/5 rounded-full bg-[#6FD4A2]" />
        </div>
      </div>
    </div>
  );
}
