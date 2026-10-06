# Task 04 — Document routing behavior

Status: done

## Outcome
Repository, package, and localized web guides explain discovery, selection, loading, chaining, and fallback without overstating determinism.

## Scope
- In: implicit versus explicit selection; three-level disclosure; `hapo:route`; optional skills; hooks-not-router boundary; limitations.
- Out: general runtime manuals, AgentKit branding, timing claims, or release notes.

## Coverage
- CP-03

## Ownership
- Modify: `README.md`
- Modify: `packages/spec/README.md`
- Modify: `cafekit-web/public/content/docs/en/reference.mdx`
- Modify: `cafekit-web/public/content/docs/vi/reference.mdx`
- Modify: `cafekit-web/public/content/docs/ja/reference.mdx`

## Acceptance
- AC-06: all guides distinguish instruction/projection parity from `UNPROVEN` live-model adherence and state that hooks do not select skills.
- AC-06: all guides explain metadata to `SKILL.md` to selected references, direct invocation, Route escalation, and absent-capability fallback.

## Dependencies
- task-03-prove-native-and-installed-parity.md

## Verification Plan
- Command: `node -e "const fs=require('fs');const files=['README.md','packages/spec/README.md','cafekit-web/public/content/docs/en/reference.mdx','cafekit-web/public/content/docs/vi/reference.mdx','cafekit-web/public/content/docs/ja/reference.mdx'];for(const f of files){const s=fs.readFileSync(f,'utf8');for(const p of [/hapo[: -]route/i,/progressive disclosure|metadata/i,/UNPROVEN|not deterministic|không.*đảm bảo|非決定/i,/hooks?.*(not|không|ではない).*rout/i])if(!p.test(s))throw new Error(f+' missing '+p)}" && pnpm --dir cafekit-web lint && pnpm --dir cafekit-web build`
- Named probe: `inline reference-guide routing contract`; `Next localized reference compilation`
- Reachability: the inline check reads all five owned guides before Next lint and compilation validate the published MDX routes.
- Oracle: required claims exist across all guides, prohibited deterministic claims are absent, and every command exits 0.
- Counterexample: one locale says hooks auto-select; a guide recommends an absent optional skill; docs claim live-model adherence; MDX compilation fails.
- Artifacts: normal web compilation output only; no retained report.

## Receipt

Verification: PASS
Command: node -e "const fs=require('fs');const files=['README.md','packages/spec/README.md','cafekit-web/public/content/docs/en/reference.mdx','cafekit-web/public/content/docs/vi/reference.mdx','cafekit-web/public/content/docs/ja/reference.mdx'];for(const f of files){const s=fs.readFileSync(f,'utf8');for(const p of [/hapo[: -]route/i,/progressive disclosure|metadata/i,/UNPROVEN|not deterministic|không.*đảm bảo|非決定/i,/hooks?.*(not|không|ではない).*rout/i])if(!p.test(s))throw new Error(f+' missing '+p)}" && pnpm --dir cafekit-web lint && pnpm --dir cafekit-web build
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a

```text
inline reference-guide routing contract: PASS (5/5 guides)
eslint: PASS
Next build: PASS; generated /en, /vi, /ja
```
