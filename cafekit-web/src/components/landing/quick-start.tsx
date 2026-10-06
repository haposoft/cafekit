"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/hooks/use-locale";
import { localizeHref } from "@/lib/locale-utils";
import { getLandingTranslations } from "@/lib/landing-translations";

export function QuickStart() {
  const locale = useLocale();
  const t = getLandingTranslations(locale).quickStart;
  const [copied, setCopied] = useState(false);

  const commands = [
    'npx @haposoft/cafekit',
    '/cf:specs Build a user authentication system',
    'Accept all  # C2',
    '/cf:develop user-authentication',
    '/cf:test --full',
    '/cf:code-review --pending',
    '/cf:git commit',
    '/cf:git push',
    'vercel --prod',
  ];

  const codeLines = [
    t.comments[0],
    commands[0],
    '',
    t.comments[1],
    commands[1],
    commands[2],
    '',
    t.comments[2],
    commands[3],
    '',
    t.comments[3],
    commands[4],
    commands[5],
    '',
    t.comments[4],
    commands[6],
    commands[7],
    commands[8],
  ];

  const codeExample = codeLines.join('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="quickstart" className="bg-[linear-gradient(180deg,_rgba(242,234,157,0.14),_rgba(167,197,238,0.12),_rgba(255,255,255,0.96))] py-20 dark:bg-[linear-gradient(180deg,_#114734,_#101820_42%,_#101820)]">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="mb-4 text-center text-3xl font-bold text-[#101820] dark:text-[#F6FAF7] sm:text-4xl">
          {t.heading}
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-lg text-[#3A5249] dark:text-[#CFE1D9]">
          {t.subheading}
        </p>

        <div className="relative">
          <div className="overflow-hidden rounded-xl border border-[#A7C5EE]/24 bg-[#101820] shadow-[0_24px_80px_-32px_rgba(16,24,32,0.48)]">
            <div className="flex items-center justify-between border-b border-[#A7C5EE]/12 bg-[#0D161C] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
              </div>
              <button
                onClick={handleCopy}
                className="rounded-md bg-[#114734] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#006242]"
              >
                {copied ? t.copied : t.copy}
              </button>
            </div>

            <div className="p-6">
              <pre className="font-mono text-sm leading-relaxed">
                {codeLines.map((line, i) => (
                  <code key={i} className={line.startsWith('#') ? 'text-[#8EACD0] block' : 'text-[#F2EA9D] block'}>
                    {line.startsWith('#') ? line : line === '' ? '\u00A0' : <><span className="text-[#6FD4A2]">$ </span>{line}</>}
                  </code>
                ))}
              </pre>
            </div>
          </div>

          <div className="absolute -bottom-4 -right-4 -z-10 h-24 w-24 rounded-full bg-[#A7C5EE]/28 blur-3xl"></div>
          <div className="absolute -left-4 -top-4 -z-10 h-24 w-24 rounded-full bg-[#F2EA9D]/28 blur-3xl"></div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-5">
          <Link
            href={localizeHref(locale, "/docs/quickstart")}
            className="group inline-flex items-center gap-2 text-[#006242] transition-colors hover:text-[#114734] dark:text-[#A7C5EE] dark:hover:text-[#F2EA9D]"
          >
            <span className="font-medium">{t.viewGuide}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>

          {/* Tutorial callout for newcomers */}
          <div className="flex items-center gap-4 rounded-2xl border border-[#006242]/15 bg-white/72 px-5 py-4 shadow-sm backdrop-blur-sm dark:border-[#A7C5EE]/14 dark:bg-[#101820]/55">
            <div className="text-left">
              <p className="text-sm font-semibold text-[#101820] dark:text-[#F6FAF7]">{t.tutorialHeading}</p>
              <p className="mt-0.5 text-sm text-[#456055] dark:text-[#CFE1D9]">{t.tutorialBody}</p>
            </div>
            <Link
              href={localizeHref(locale, "/docs/tutorial")}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#006242] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#114734]"
            >
              {t.tutorialCta}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
