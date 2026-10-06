"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TerminalLine } from "./tutorial-types";

type Props = {
  command: string;
  outputs: TerminalLine[];
  /** Increment from parent to trigger replay */
  runKey: number;
  replayLabel: string;
};

function lineClasses(kind: TerminalLine["kind"]) {
  if (kind === "command") return "font-semibold text-[#F2EA9D]";
  if (kind === "success") return "text-[#6FD4A2]";
  if (kind === "ghost") return "text-[#8EACD0]";
  if (kind === "error") return "text-[#ff8c8c]";
  return "text-[#D9E6E0]";
}

type AnimationProps = Pick<Props, "command" | "outputs">;

function TerminalAnimation({ command, outputs }: AnimationProps) {
  const [visibleLines, setVisibleLines] = useState<TerminalLine[]>([]);
  const [typingText, setTypingText] = useState("");
  const [done, setDone] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const schedule = (fn: () => void, delay: number) => {
      const timer = window.setTimeout(fn, delay);
      timersRef.current.push(timer);
    };

    const revealOutput = (index: number) => {
      if (index >= outputs.length) {
        setDone(true);
        return;
      }
      const line = outputs[index];
      schedule(() => {
        setVisibleLines((previous) => [...previous, line]);
        revealOutput(index + 1);
      }, line.kind === "success" ? 200 : 140);
    };

    let cursor = 0;
    const typeChar = () => {
      cursor += 1;
      setTypingText(command.slice(0, cursor));
      if (cursor < command.length) {
        schedule(typeChar, 22);
      } else {
        schedule(() => {
          setVisibleLines([{ kind: "command", text: command }]);
          setTypingText("");
          revealOutput(0);
        }, 200);
      }
    };

    schedule(typeChar, 80);

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, [command, outputs]);

  const renderedLines = typingText
    ? [...visibleLines, { kind: "command" as const, text: typingText }]
    : visibleLines;

  return (
    <div className="min-h-[160px] px-5 py-5 font-mono text-[13px] leading-7">
      <div className="space-y-1.5">
        {renderedLines.map((line, index) => (
          <div key={index} className="flex items-start gap-3">
            <span className={cn("shrink-0 pt-0.5", line.kind === "command" ? "text-[#A7C5EE]" : "text-transparent select-none")}>
              $
            </span>
            <span className={lineClasses(line.kind)}>{line.text}</span>
          </div>
        ))}
        {!done && (
          <div className="flex items-center gap-3">
            <span className="pt-0.5 text-[#A7C5EE]">$</span>
            <span className="inline-flex h-5 w-2 animate-pulse rounded-sm bg-[#F2EA9D]/80" />
          </div>
        )}
      </div>
    </div>
  );
}

export function TutorialStepTerminal({ command, outputs, runKey, replayLabel }: Props) {
  const [localKey, setLocalKey] = useState(0);

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#A7C5EE]/20 bg-[#101820] shadow-[0_20px_60px_-30px_rgba(16,24,32,0.55)]">
      {/* Chrome */}
      <div className="flex items-center justify-between border-b border-[#A7C5EE]/12 px-5 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="font-mono text-xs text-[#8EACD0]">claude</span>
        <button
          type="button"
          onClick={() => setLocalKey((key) => key + 1)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#A7C5EE]/14 bg-[#13262A] px-2.5 py-1.5 text-xs font-medium text-[#A7C5EE] transition hover:border-[#A7C5EE]/28 hover:bg-[#173038]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {replayLabel}
        </button>
      </div>

      <TerminalAnimation key={`${runKey}-${localKey}`} command={command} outputs={outputs} />
    </div>
  );
}
