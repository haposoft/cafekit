'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const WEB_ROOT = path.resolve(__dirname, '../../../../cafekit-web');
const DOCS_ROOT = path.join(WEB_ROOT, 'public/content/docs');
const SOURCE_ROOT = path.join(WEB_ROOT, 'src');
const LOCALES = ['en', 'vi', 'ja'];

function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

test('website keeps process-first docs, canonical public names, and historical legacy claims', () => {
  const currentDocs = walk(DOCS_ROOT).filter((file) => {
    const relative = path.relative(DOCS_ROOT, file).split(path.sep).join('/');
    return file.endsWith('.mdx') && !relative.endsWith('/reference.mdx') && !relative.endsWith('/platforms/opencode.mdx');
  });
  const currentSources = walk(SOURCE_ROOT).filter((file) => /\.(?:ts|tsx)$/.test(file));
  const corpus = [...currentDocs, ...currentSources].map((file) => fs.readFileSync(file, 'utf8')).join('\n');

  assert.doesNotMatch(corpus, /cf:generate-graph|\/generate-graph/);
  assert.doesNotMatch(corpus, /\bspec\.json\b|\btask_registry\b|tasks\/task-R|task-R\*|cf:specs --validate|registry sync/);
  assert.doesNotMatch(corpus, /OpenCode installs|OpenCode cài|OpenCode では[^\n]*commands|Yes\.[^\n]*OpenCode|Có\.[^\n]*OpenCode|はい。[^\n]*OpenCode/i);
  assert.doesNotMatch(corpus, /cf:loop|autoresearch/i);

  const config = fs.readFileSync(path.join(SOURCE_ROOT, 'lib/docs-config.ts'), 'utf8');
  for (const slug of ['ask', 'scout', 'fix']) assert.match(config, new RegExp(`/docs/skills/${slug}`));
  assert.doesNotMatch(config, /\/docs\/skills\/(?:question|inspect|hotfix)/);

  const route = fs.readFileSync(path.join(SOURCE_ROOT, 'app/[locale]/docs/[[...slug]]/page.tsx'), 'utf8');
  assert.match(route, /ask:\s*'question'/);
  assert.match(route, /scout:\s*'inspect'/);
  assert.match(route, /hotfix:\s*'fix'/);

  for (const locale of LOCALES) {
    for (const documentSlug of ['question', 'inspect', 'fix']) {
      assert.equal(fs.existsSync(path.join(DOCS_ROOT, locale, 'skills', `${documentSlug}.mdx`)), true,
        `${locale} skills/${documentSlug}.mdx must exist`);
    }
    const lifecycle = fs.readFileSync(path.join(DOCS_ROOT, locale, 'spec-lifecycle.mdx'), 'utf8');
    assert.doesNotMatch(lifecycle, /^## Legacy compatibility$/m, `${locale} spec lifecycle must not promise a legacy adapter`);

    const opencode = fs.readFileSync(path.join(DOCS_ROOT, locale, 'platforms/opencode.mdx'), 'utf8');
    assert.match(opencode, /0\.17/);
    assert.match(opencode, /histor|lịch sử|migration/i);

    const reference = fs.readFileSync(path.join(DOCS_ROOT, locale, 'reference.mdx'), 'utf8');
    assert.match(reference, /Legacy OpenCode 0\.16 command/);
    assert.doesNotMatch(reference, /OpenCode currently|OpenCode hiện có|OpenCode は main implementation surface/);
  }
});
