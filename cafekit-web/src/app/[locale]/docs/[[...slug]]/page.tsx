import { notFound } from 'next/navigation';
import { getMDXContent, extractHeadings, type MDXContent } from '@/lib/mdx';
import { TableOfContents, TOCHeading } from '@/components/docs/toc';
import { Breadcrumbs } from '@/components/docs/breadcrumbs';
import { DocsPager } from '@/components/docs/pager';
import { type Locale, isSupportedLocale } from '@/lib/locale-utils';

interface PageProps {
  params: Promise<{
    locale: string;
    slug?: string[];
  }>;
}

const publicSkillAliases: Record<string, string> = {
  ask: 'question',
  scout: 'inspect',
  hotfix: 'fix',
};

async function getRouteInfo(locale: string, slug?: string[]) {
  const normalizedSlug = slug?.length === 2 && slug[0] === 'skills'
    ? ['skills', publicSkillAliases[slug[1]] ?? slug[1]]
    : slug;
  const mdxSlug = (!normalizedSlug || normalizedSlug.length === 0)
    ? 'index'
    : normalizedSlug.join('/');

  const fullPath = `docs/${locale}/${mdxSlug}`;

  return { locale, fullPath, mdxSlug };
}

async function resolveMDXPath(fullPath: string): Promise<string | null> {
  const mdxContent = await getMDXContent(fullPath);
  if (mdxContent) return fullPath;

  const indexPath = `${fullPath}/index`;
  const indexContent = await getMDXContent(indexPath);
  if (indexContent) return indexPath;

  return null;
}

async function resolveDocPath(
  locale: Locale,
  slug: string[] | undefined,
): Promise<{ mdxContent: MDXContent; locale: Locale } | null> {
  const { fullPath, mdxSlug } = await getRouteInfo(locale, slug);
  let resolvedPath = await resolveMDXPath(fullPath);

  if (!resolvedPath) {
    resolvedPath = await resolveMDXPath(`docs/en/${mdxSlug}`);
  }

  if (!resolvedPath) return null;

  const mdxContent = await getMDXContent(resolvedPath);
  if (!mdxContent) return null;

  return { mdxContent, locale };
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, slug } = await params;

  if (!isSupportedLocale(locale)) {
    return { title: 'Not Found', description: 'Page not found' };
  }

  const result = await resolveDocPath(locale, slug);

  if (!result) {
    return { title: 'Not Found', description: 'Page not found' };
  }

  const { mdxContent } = result;
  return {
    title: `${mdxContent.frontmatter.title} | CafeKit Documentation`,
    description: mdxContent.frontmatter.description || mdxContent.frontmatter.title,
  };
}

export default async function LocaleDocPage({ params }: PageProps) {
  const { locale, slug } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const result = await resolveDocPath(locale, slug);

  if (!result) notFound();

  const { mdxContent } = result;
  return renderDoc(mdxContent, slug, locale);
}

function renderDoc(mdxContent: MDXContent, slug: string[] | undefined, locale: Locale) {
  const headings = extractHeadings(mdxContent.rawContent);

  const tocHeadings: TOCHeading[] = headings
    .filter((h) => h.level === 2 || h.level === 3)
    .map((h) => ({
      id: h.id,
      text: h.text,
      level: h.level,
    }));

  return (
    <div className="flex gap-8">
      <article className="min-w-0 flex-1 py-6 lg:py-8">
        <Breadcrumbs slug={slug} locale={locale} />

        <div className="prose prose-zinc dark:prose-invert max-w-none text-[16px] prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-[1.35em] prose-h3:text-[1.1em] prose-a:font-medium prose-a:text-primary prose-a:underline-offset-4 prose-a:decoration-primary/20 hover:prose-a:decoration-primary prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-border">
          {mdxContent.content}
        </div>

        <DocsPager slug={slug} locale={locale} />
      </article>

      {tocHeadings.length > 0 && (
        <aside className="hidden xl:block w-64 shrink-0 mt-6 lg:mt-8 sticky top-[5.5rem] lg:top-[6rem] h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-6rem)] overflow-y-auto rounded-[24px] border border-border/70 bg-background/70 p-4 backdrop-blur">
          <TableOfContents headings={tocHeadings} />
        </aside>
      )}
    </div>
  );
}
