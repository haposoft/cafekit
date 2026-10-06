# Task 05 — Update Skills discovery surfaces

Status: done

## Outcome
All localized Skills pages and catalog visuals expose Route as the proportional escalation owner while preserving the installed-only and optional-bundle boundaries.

## Scope
- In: three localized Skills pages and two catalog components.
- Out: reference-guide prose owned by Task 04, release notes, or live-model claims.

## Coverage
- CP-03

## Ownership
- Modify: `cafekit-web/public/content/docs/en/skills.mdx`
- Modify: `cafekit-web/public/content/docs/vi/skills.mdx`
- Modify: `cafekit-web/public/content/docs/ja/skills.mdx`
- Modify: `cafekit-web/src/components/docs/catalog-visuals.tsx`
- Modify: `cafekit-web/src/components/docs/skill-overview.tsx`

## Acceptance
- AC-06: all Skills surfaces distinguish direct native selection from Route escalation and never show an absent optional capability as installed.
- AC-06: catalog visuals include Route once, use current public names, and make no deterministic-adherence claim.

## Dependencies
- task-04-document-routing-behavior.md

## Verification Plan
- Command: `node -e "const fs=require('fs');const en=/(always|guaranteed|guarantees).{0,60}(select|selection|route|routing|dispatch)|(select|selection|route|routing|dispatch).{0,60}(always|guaranteed|guarantees)/i;const vi=/(luôn|luôn luôn|đảm bảo).{0,60}(chọn|lựa chọn|định tuyến)|(chọn|lựa chọn|định tuyến).{0,60}(luôn|luôn luôn|đảm bảo)/i;const ja=/(常に|保証).{0,60}(選択|ルート|ルーティング)|(選択|ルート|ルーティング).{0,60}(常に|保証)/i;const cases=[['cafekit-web/public/content/docs/en/skills.mdx',/document.{0,80}(optional|only when installed)/i,/semantic.{0,80}(not deterministic|does not guarantee)/i,en],['cafekit-web/public/content/docs/vi/skills.mdx',/tài liệu.{0,80}(tùy chọn|chỉ khi.{0,20}cài)/i,/ngữ nghĩa.{0,80}không.{0,20}(tất định|đảm bảo|tự động)/i,vi],['cafekit-web/public/content/docs/ja/skills.mdx',/ドキュメント.{0,80}(オプション|インストール時のみ)/i,/セマンティック.{0,80}(非決定|保証しない|自動ではない)/i,ja],['cafekit-web/src/components/docs/catalog-visuals.tsx',/document.{0,80}(optional|installed)/i,/semantic.{0,80}(not deterministic|does not guarantee)/i,en],['cafekit-web/src/components/docs/skill-overview.tsx',/document.{0,80}(optional|installed)/i,/semantic.{0,80}(not deterministic|does not guarantee)/i,en]];for(const [f,optional,nondeterministic,forbidden] of cases){const s=fs.readFileSync(f,'utf8');if((s.match(/hapo[: -]route/gi)||[]).length!==1||!optional.test(s)||!nondeterministic.test(s)||forbidden.test(s))throw new Error(f+' routing contract')}" && node -e "const s=require('fs').readFileSync('cafekit-web/src/components/docs/skill-overview.tsx','utf8');if(!s.includes(\"getSkillDetails(normalized).filter(([slug]) => slug !== 'docs')\"))throw new Error('main grid exposes optional docs')" && pnpm --dir cafekit-web lint && pnpm --dir cafekit-web build`
- Named probe: `inline Skills-surface Route presence contract`; `Next localized Skills compilation`
- Reachability: the inline check reads the three MDX pages and two components before Next lint and compilation validate the application.
- Oracle: all five surfaces render through lint and compilation with Route present exactly once and optional skills marked conditional.
- Counterexample: one locale omits Route; visual duplicates Route; Docs is shown as core; a page claims hooks or deterministic dispatch select skills.
- Artifacts: normal web compilation output only; no retained report.
- Runtime counterexample evidence (planning closure): `node` disposable-string probe exited 0 with `PASS: 6 deterministic counterexamples rejected; 3 nondeterministic statements accepted` on 2026-09-01; this proves only the planned regex oracle, not implementation.

## Receipt

Verification: PASS
Command: node -e "const fs=require('fs');const en=/(always|guaranteed|guarantees).{0,60}(select|selection|route|routing|dispatch)|(select|selection|route|routing|dispatch).{0,60}(always|guaranteed|guarantees)/i;const vi=/(luôn|luôn luôn|đảm bảo).{0,60}(chọn|lựa chọn|định tuyến)|(chọn|lựa chọn|định tuyến).{0,60}(luôn|luôn luôn|đảm bảo)/i;const ja=/(常に|保証).{0,60}(選択|ルート|ルーティング)|(選択|ルート|ルーティング).{0,60}(常に|保証)/i;const cases=[['cafekit-web/public/content/docs/en/skills.mdx',/document.{0,80}(optional|only when installed)/i,/semantic.{0,80}(not deterministic|does not guarantee)/i,en],['cafekit-web/public/content/docs/vi/skills.mdx',/tài liệu.{0,80}(tùy chọn|chỉ khi.{0,20}cài)/i,/ngữ nghĩa.{0,80}không.{0,20}(tất định|đảm bảo|tự động)/i,vi],['cafekit-web/public/content/docs/ja/skills.mdx',/ドキュメント.{0,80}(オプション|インストール時のみ)/i,/セマンティック.{0,80}(非決定|保証しない|自動ではない)/i,ja],['cafekit-web/src/components/docs/catalog-visuals.tsx',/document.{0,80}(optional|installed)/i,/semantic.{0,80}(not deterministic|does not guarantee)/i,en],['cafekit-web/src/components/docs/skill-overview.tsx',/document.{0,80}(optional|installed)/i,/semantic.{0,80}(not deterministic|does not guarantee)/i,en]];for(const [f,optional,nondeterministic,forbidden] of cases){const s=fs.readFileSync(f,'utf8');if((s.match(/hapo[: -]route/gi)||[]).length!==1||!optional.test(s)||!nondeterministic.test(s)||forbidden.test(s))throw new Error(f+' routing contract')}" && node -e "const s=require('fs').readFileSync('cafekit-web/src/components/docs/skill-overview.tsx','utf8');if(!s.includes(\"getSkillDetails(normalized).filter(([slug]) => slug !== 'docs')\"))throw new Error('main grid exposes optional docs')" && pnpm --dir cafekit-web lint && pnpm --dir cafekit-web build
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a

```text
inline Skills-surface Route presence contract: PASS (5/5 surfaces)
main-grid installed-only contract: PASS
eslint: PASS
Next build: PASS; generated /en, /vi, /ja
```
