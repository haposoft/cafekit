"use client";

import Link from "next/link";
import { ArrowRight, ListChecks, FileText, ShieldCheck } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { localizeHref } from "@/lib/locale-utils";

const copy = {
  en: {
    heading: "See the artifacts, not just the commands",
    subheading:
      "A new user trusts CafeKit faster when they can picture the files and receipts it leaves behind.",
    cta: "Open documentation",
    items: [
      {
        title: "plan.md",
        description: "C1 scope, acceptance criteria, exclusions, decisions, and the flat task map.",
      },
      {
        title: "task-NN-*.md",
        description: "Flat task packets with one outcome, one Status, ownership, dependencies, and proof commands.",
      },
      {
        title: "review + test verdict",
        description: "Structured signals that explain whether work is actually ready to merge and ship.",
      },
    ],
  },
  vi: {
    heading: "Hãy nhìn artifact thật, không chỉ nhìn command",
    subheading:
      "Người mới tin CafeKit nhanh hơn khi họ hình dung được file và receipt mà runtime để lại.",
    cta: "Mở tài liệu",
    items: [
      {
        title: "plan.md",
        description: "C1 scope, acceptance criteria, exclusions, decisions và flat task map.",
      },
      {
        title: "task-NN-*.md",
        description: "Flat task có một outcome, một Status, ownership, dependencies và proof command.",
      },
      {
        title: "review + test verdict",
        description: "Structured signals cho biết code đã thật sự sẵn sàng để merge và ship hay chưa.",
      },
    ],
  },
  ja: {
    heading: "command だけでなく artifact も見せる",
    subheading:
      "新規ユーザーは、runtime が残す file と receipt を見たときに CafeKit をより早く信頼します。",
    cta: "ドキュメントを見る",
    items: [
      {
        title: "plan.md",
        description: "C1 scope、acceptance criteria、exclusions、decisions、flat task map。",
      },
      {
        title: "task-NN-*.md",
        description: "One outcome、one Status、ownership、dependencies、proof command を持つ flat task。",
      },
      {
        title: "review + test verdict",
        description: "merge や ship の準備ができているかを示す structured signal。",
      },
    ],
  },
} as const;

const icons = [ListChecks, FileText, ShieldCheck];

export function ArtifactPreview() {
  const locale = useLocale();
  const t = copy[locale] ?? copy.en;

  return (
    <section
      id="artifacts"
      className="bg-[linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(167,197,238,0.1))] py-20 dark:bg-[linear-gradient(180deg,_#101820,_#0E1A21)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-bold text-[#101820] dark:text-[#F6FAF7] sm:text-4xl">
              {t.heading}
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-[#496158] dark:text-[#CFE1D9]">
              {t.subheading}
            </p>

            <Link
              href={localizeHref(locale, "/docs")}
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-[#006242] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[#006242]/18 transition-all hover:bg-[#114734]"
            >
              {t.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-[#A7C5EE]/16 bg-[#101820] shadow-[0_26px_80px_-36px_rgba(16,24,32,0.5)]">
            <div className="border-b border-[#A7C5EE]/12 px-5 py-4 font-mono text-sm text-[#A7C5EE]">
              specs/meet-transcript-mvp/
            </div>

            <div className="grid gap-4 p-5">
              {t.items.map((item, index) => {
                const Icon = icons[index];

                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-[#A7C5EE]/10 bg-[#13262A]/76 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-[#A7C5EE]/10 p-2">
                        <Icon className="h-5 w-5 text-[#A7C5EE]" />
                      </div>
                      <div className="font-mono text-sm font-semibold text-[#F2EA9D]">
                        {item.title}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[#D7E7E0]">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
