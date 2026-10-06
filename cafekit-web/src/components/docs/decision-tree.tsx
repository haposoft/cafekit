'use client';

import { useState } from 'react';
import Link from 'next/link';
import { localizeHref } from '@/lib/locale-utils';

interface Command {
  id: string;
  label: string;
  href: string;
  category: 'docs' | 'workflow' | 'state';
}

interface DecisionTreeProps {
  locale?: 'en' | 'vi' | 'ja';
}

const commands: Command[] = [
  { id: 'docs-init', label: '/cf:docs --init', href: '/docs/workflows', category: 'docs' },
  { id: 'docs-update', label: '/cf:docs --update', href: '/docs/workflows', category: 'docs' },
  { id: 'specs', label: '/cf:specs', href: '/docs/workflows', category: 'workflow' },
  { id: 'develop', label: '/cf:develop', href: '/docs/workflows', category: 'workflow' },
  { id: 'test', label: '/cf:test', href: '/docs/workflows', category: 'workflow' },
  { id: 'review', label: '/cf:code-review', href: '/docs/workflows', category: 'workflow' },
  { id: 'sync', label: '/cf:sync', href: '/docs/workflows', category: 'state' },
];

const categoryStyles = {
  docs: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700',
  workflow: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700',
  state: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700',
};

const translations = {
  en: {
    title: 'Interactive Command Selector',
    description: 'Use this as a quick map for the current CafeKit runtime surface.',
    groups: [
      { title: 'Need project docs baseline?', command: '/docs init' },
      { title: 'Have a new feature idea?', command: '/cf:specs' },
      { title: 'Spec approved and validated?', command: '/cf:develop' },
      { title: 'Need verification and review?', command: '/cf:test → /cf:code-review' },
      { title: 'Task state drifted?', command: '/cf:sync' },
    ],
  },
  vi: {
    title: 'Chọn Command',
    description: 'Bản đồ nhanh cho command surface hiện tại của CafeKit.',
    groups: [
      { title: 'Thiếu baseline docs dự án?', command: '/docs init' },
      { title: 'Có ý tưởng feature mới?', command: '/cf:specs' },
      { title: 'Spec đã duyệt và validate?', command: '/cf:develop' },
      { title: 'Cần verify và review?', command: '/cf:test → /cf:code-review' },
      { title: 'Task state bị lệch?', command: '/cf:sync' },
    ],
  },
  ja: {
    title: 'コマンドセレクター',
    description: '現在の CafeKit runtime surface を素早く確認するためのマップです。',
    groups: [
      { title: 'プロジェクト docs baseline が必要？', command: '/docs init' },
      { title: '新しい feature アイデアがある？', command: '/cf:specs' },
      { title: 'Spec が承認・検証済み？', command: '/cf:develop' },
      { title: '検証と review が必要？', command: '/cf:test → /cf:code-review' },
      { title: 'Task state がずれた？', command: '/cf:sync' },
    ],
  },
};

export function DecisionTree({ locale = 'vi' }: DecisionTreeProps) {
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const t = translations[locale];
  const localizedCommands = commands.map((command) => ({
    ...command,
    href: localizeHref(locale, command.href),
  }));

  return (
    <div className="my-8 rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-primary">☰</span>
        <h3 className="text-lg font-semibold">{t.title}</h3>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">{t.description}</p>

      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {localizedCommands.map((cmd) => (
          <Link
            key={cmd.id}
            href={cmd.href}
            onMouseEnter={() => setActiveCommand(cmd.id)}
            onMouseLeave={() => setActiveCommand(null)}
            className={`
              rounded-full px-3 py-1.5 text-sm font-mono transition-all
              ${categoryStyles[cmd.category]}
              ${activeCommand === cmd.id ? 'ring-2 ring-primary/50' : ''}
            `}
          >
            {cmd.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {t.groups.map((group) => (
          <div key={group.command} className="rounded-xl border bg-muted/40 p-4">
            <div className="mb-3 text-sm font-medium text-foreground">{group.title}</div>
            <div className="rounded-lg bg-zinc-900 px-3 py-2 font-mono text-sm text-emerald-400">
              {group.command}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
