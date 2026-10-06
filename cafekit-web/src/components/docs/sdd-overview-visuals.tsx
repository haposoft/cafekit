import { ArrowRight, CheckCircle2, ClipboardCheck, Code2, FileCheck2, FileText, GitBranch, MessageSquareText, ShieldCheck, TestTube2 } from 'lucide-react';
import type { Locale } from '@/lib/locale-utils';
type SddCopy = {
  eyebrow: string; title: string; body: string;
  stages: string[][]; artifactsTitle: string; artifacts: string[][];
  loopTitle: string; loop: string[][]; compareTitle: string;
  bad: string[]; good: string[];
};
const copy = {
  en: {
    eyebrow: 'Spec-driven development',
    title: 'Turn a request into a contract, then into verified code.',
    body: 'CafeKit keeps the important truth outside chat. The assistant first writes the contract, then implements one approved task packet, then proves and syncs the result.',
    stages: [
      ['Request', 'A human asks for a change.'],
      ['Spec', 'C1/C2 scope, a plan, and flat tasks become durable files.'],
      ['Develop', 'The assistant implements one approved task packet.'],
      ['Verify', 'Real commands and runtime proof check the result.'],
      ['Review', 'A separate pass checks compliance and risk.'],
      ['Sync', 'State moves only after evidence exists.'],
    ],
    artifactsTitle: 'What lives inside specs/<feature>/',
    artifacts: [
      ['plan.md', 'Accepted C1/C2 scope, task index, ownership, dependencies, and completion boundary.'],
      ['task-NN-*.md', 'One flat implementation packet with Outcome, Scope, Acceptance, and Verification Plan.'],
      ['inline Receipt', 'Exact command, exit, current Base/Head, and non-empty current output.'],
    ],
    loopTitle: 'The loop CafeKit wants every feature to follow',
    loop: [
      ['1. Specify', 'Write down what should happen before code changes.'],
      ['2. Build narrowly', 'Implement only the approved task boundary.'],
      ['3. Prove it', 'Run commands and record exact evidence.'],
      ['4. Sync state', 'Update task Status and inline Receipt after proof.'],
    ],
    compareTitle: 'Why this is different from normal prompting',
    bad: ['Chat is the source of truth', 'Scope changes silently', 'The assistant guesses missing details', 'Review checks only the final diff'],
    good: ['Repo files are the source of truth', 'C1 scope makes changes explicit', 'Missing details route back to the plan', 'Review compares code against the contract'],
  },
  vi: {
    eyebrow: 'Spec-driven development',
    title: 'Biến request thành contract, rồi mới thành code đã verify.',
    body: 'CafeKit đưa phần quan trọng ra khỏi chat. Assistant viết contract trước, implement một task packet đã approve, sau đó prove bằng evidence và sync state.',
    stages: [
      ['Request', 'Người dùng yêu cầu một thay đổi.'],
      ['Spec', 'Scope C1/C2, plan và flat tasks thành file bền vững.'],
      ['Develop', 'Assistant implement một task packet đã approve.'],
      ['Verify', 'Command thật và runtime proof kiểm tra kết quả.'],
      ['Review', 'Một pass riêng kiểm tra compliance và risk.'],
      ['Sync', 'State chỉ được chuyển khi đã có evidence.'],
    ],
    artifactsTitle: 'Bên trong specs/<feature>/ có gì',
    artifacts: [
      ['plan.md', 'Scope C1/C2 đã duyệt, task index, ownership, dependencies và completion boundary.'],
      ['task-NN-*.md', 'Một flat task gồm Outcome, Scope, Acceptance và Verification Plan.'],
      ['inline Receipt', 'Exact command, exit, Base/Head hiện tại và current output không rỗng.'],
    ],
    loopTitle: 'Vòng lặp CafeKit muốn mọi feature đi theo',
    loop: [
      ['1. Specify', 'Viết rõ điều cần xảy ra trước khi sửa code.'],
      ['2. Build hẹp', 'Chỉ implement đúng boundary của task đã approve.'],
      ['3. Prove', 'Chạy command và ghi lại evidence chính xác.'],
      ['4. Sync state', 'Update task Status và inline Receipt sau khi có proof.'],
    ],
    compareTitle: 'Khác gì với prompt bình thường',
    bad: ['Chat là source of truth', 'Scope đổi âm thầm', 'Assistant đoán phần còn thiếu', 'Review chỉ nhìn diff cuối'],
    good: ['File trong repo là source of truth', 'Scope C1 bắt thay đổi phải explicit', 'Thiếu chi tiết thì quay lại plan', 'Review so code với contract'],
  },
  ja: {
    eyebrow: 'Spec-driven development',
    title: 'Request を contract にし、verified code に変える。',
    body: 'CafeKit は重要な truth を chat の外に置きます。Assistant は contract を先に書き、approved task packet を実装し、evidence で prove して state を sync します。',
    stages: [
      ['Request', '人が変更を依頼します。'],
      ['Spec', 'C1/C2 scope、plan、flat tasks が durable files になります。'],
      ['Develop', 'Assistant が approved task packet を 1 つ実装します。'],
      ['Verify', 'Real commands と runtime proof で結果を確認します。'],
      ['Review', '別 pass で compliance と risk を確認します。'],
      ['Sync', 'Evidence がある時だけ state を進めます。'],
    ],
    artifactsTitle: 'specs/<feature>/ の中身',
    artifacts: [
      ['plan.md', 'Approved C1/C2 scope、task index、ownership、dependencies、completion boundary。'],
      ['task-NN-*.md', 'Outcome、Scope、Acceptance、Verification Plan を持つ flat task。'],
      ['inline Receipt', 'Exact command、exit、current Base/Head、non-empty current output。'],
    ],
    loopTitle: 'CafeKit が feature に求める loop',
    loop: [
      ['1. Specify', 'Code 変更前に何を作るかを書きます。'],
      ['2. Build narrow', 'Approved task boundary だけを実装します。'],
      ['3. Prove', 'Commands を実行し exact evidence を記録します。'],
      ['4. Sync state', 'Proof 後に task Status と inline Receipt を更新します。'],
    ],
    compareTitle: '普通の prompting との違い',
    bad: ['Chat が source of truth', 'Scope が黙って変わる', 'Assistant が不足を推測する', 'Review は final diff だけを見る'],
    good: ['Repo files が source of truth', 'C1 scope で変更が explicit', '不足は plan に戻す', 'Review は code と contract を比較する'],
  },
} satisfies Record<Locale, SddCopy>;
const stageIcons = [MessageSquareText, FileText, Code2, TestTube2, ShieldCheck, GitBranch];
const loopIcons = [FileText, Code2, FileCheck2, ClipboardCheck];
function getCopy(locale: Locale = 'en') {
  return copy[locale] ?? copy.en;
}
export function SddHeroVisual({ locale = 'en' }: { locale?: Locale }) {
  const t = getCopy(locale);
  return (
    <section className="not-prose my-8 overflow-hidden rounded-[30px] border border-[#101820]/10 bg-[#101820] text-white shadow-[0_30px_90px_-55px_rgba(16,24,32,0.9)]">
      <div className="grid gap-8 border-b border-white/10 p-6 lg:grid-cols-[1fr_1.25fr] lg:p-8">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.25em] text-[#F2EA9D]">{t.eyebrow as string}</div>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{t.title as string}</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/68">{t.body as string}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(t.stages as string[][]).map(([title, detail], index) => {
            const Icon = stageIcons[index];
            return (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <Icon className="h-5 w-5 text-[#A7C5EE]" />
                  <span className="font-mono text-xs text-white/35">0{index + 1}</span>
                </div>
                <div className="font-semibold">{title}</div>
                <p className="mt-2 text-sm leading-6 text-white/62">{detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
export function SddArtifactMap({ locale = 'en' }: { locale?: Locale }) {
  const t = getCopy(locale);
  return (
    <div className="not-prose my-8 overflow-hidden rounded-[26px] border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-5 py-4 font-semibold text-foreground">{t.artifactsTitle as string}</div>
      <div className="grid gap-px bg-border md:grid-cols-5">
        {(t.artifacts as string[][]).map(([name, detail]) => (
          <div key={name} className="bg-card p-5">
            <div className="rounded-xl border border-[#006242]/15 bg-[#EEF5F1] px-3 py-2 font-mono text-sm text-[#006242] dark:bg-[#14252A] dark:text-[#A7C5EE]">{name}</div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
export function SddLoopVisual({ locale = 'en' }: { locale?: Locale }) {
  const t = getCopy(locale);
  return (
    <div className="not-prose my-8 rounded-[26px] border border-[#006242]/15 bg-[#EEF5F1]/85 p-5 dark:bg-[#14252A]/90">
      <div className="mb-5 font-semibold text-foreground">{t.loopTitle as string}</div>
      <div className="grid gap-3 lg:grid-cols-4">
        {(t.loop as string[][]).map(([title, detail], index) => {
          const Icon = loopIcons[index];
          return (
            <div key={title} className="relative rounded-2xl border border-[#006242]/15 bg-background p-5">
              <Icon className="mb-4 h-5 w-5 text-[#006242] dark:text-[#A7C5EE]" />
              <div className="font-semibold text-foreground">{title}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
              {index < 3 ? <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-[#006242]/55 lg:block" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export function SddCompareVisual({ locale = 'en' }: { locale?: Locale }) {
  const t = getCopy(locale);
  return (
    <div className="not-prose my-8 overflow-hidden rounded-[26px] border border-border bg-card">
      <div className="border-b border-border px-5 py-4 font-semibold text-foreground">{t.compareTitle as string}</div>
      <div className="grid gap-px bg-border md:grid-cols-2">
        {[['Ad-hoc prompting', t.bad as string[]], ['CafeKit SDD', t.good as string[]]].map(([title, items]) => (
          <div key={title as string} className="bg-card p-5">
            <div className="mb-4 font-semibold text-foreground">{title as string}</div>
            <div className="space-y-3">
              {(items as string[]).map((item) => (
                <div key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#006242] dark:text-[#A7C5EE]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
