# Task 06 — website docs match the current runtime

Status: done

## Outcome
The `en`, `vi` and `ja` website docs drop the legacy-adapter section and sentence and the Claude SessionStart `docs-sync` row, and the website test forbids the section and scans `spec-lifecycle.mdx` like every other current doc.

## Scope
- In: `cafekit-web/public/content/docs/en/spec-lifecycle.mdx`: delete lines 75-78 (blank + `## Legacy compatibility` + blank + paragraph, to EOF). `vi/` and `ja/spec-lifecycle.mdx`: delete lines 69-72 each.
- In: `en/runtime.mdx:48`: drop the sentence " Existing legacy packets retain their separate adapter without redefining the process-first default."; `vi/runtime.mdx:44`: "Chat không phải source of truth; legacy packets giữ adapter riêng." → "Chat không phải source of truth."; `ja/runtime.mdx:44`: "Chat は source of truth ではなく、legacy packet は separate adapter を維持します。" → "Chat は source of truth ではありません。"
- In: `{en,vi,ja}/platforms/claude.mdx:38`: delete the row "| `docs-sync.cjs` | `SessionStart` | …" (Claude no longer registers it).
- In: `bin/__tests__/package-inventory.test.js`, test "website keeps process-first docs, canonical public names, and historical legacy claims": remove the `spec-lifecycle.mdx` exclusion `:2568` (so its `spec.json`/`task_registry`/`tasks/task-R` ban `:2575-2578` applies to it) and replace `:2616-2619` with one assertion that `lifecycle` does not match `/^## Legacy compatibility$/m` (message: "<locale> spec lifecycle must not promise a legacy adapter")
- Out: `runtime.mdx:24` `docs-sync.cjs` row (still ships); `platforms/opencode.mdx` and `reference.mdx` (historical OpenCode); `installation.mdx` "legacy install" (installer `schemaVersion: 1`, unrelated).

## Coverage
- CP-03

## Ownership
- Modify: `../../cafekit-web/public/content/docs/{en,vi,ja}/spec-lifecycle.mdx` (3)
- Modify: `../../cafekit-web/public/content/docs/{en,vi,ja}/runtime.mdx` (3)
- Modify: `../../cafekit-web/public/content/docs/{en,vi,ja}/platforms/claude.mdx` (3)
- Modify: `bin/__tests__/package-inventory.test.js` (lines 2568, 2614-2619 only)

## Steps
1. Delete the three sections, three sentences and three rows.
2. Edit the website test.
3. Run the Command.

## Acceptance
- AC-06: zero matches in the nine files for the legacy-section, adapter-sentence and Claude SessionStart `docs-sync` patterns; all three `runtime.mdx` still name `docs-sync.cjs`; the website test passes.

## Dependencies
- none

## Verification Plan
- Command: `F=/tmp/ck-3c-06.txt; W=../../cafekit-web/public/content/docs; rm -f $F; grep -nE 'Legacy compatibility|legacy adapter|separate adapter|adapter riêng|installed legacy|.docs-sync\.cjs. [|] .SessionStart.' $W/*/spec-lifecycle.mdx $W/*/runtime.mdx $W/*/platforms/claude.mdx > $F; cat $F; [ ! -s $F ] && [ "$(grep -l 'docs-sync.cjs' $W/*/runtime.mdx | wc -l | tr -d ' ')" = 3 ] && ! grep -q "endsWith('/spec-lifecycle.mdx')" bin/__tests__/package-inventory.test.js && node --test --test-name-pattern='website keeps process-first docs' bin/__tests__/package-inventory.test.js > $F 2>&1; grep -E '^# (pass|fail)' $F; grep -qx '# pass 1' $F && grep -qx '# fail 0' $F && rm -f $F`
- Named probe: `package-inventory.test.js` "website keeps process-first docs, canonical public names, and historical legacy claims" (selected by `--test-name-pattern`), plus the greps.
- Reachability: source — run from `packages/spec/`; web docs read at `../../cafekit-web/public/content/docs`.
- Oracle: exit 0; no listed line; `# pass 1`, `# fail 0`. On acfdf6e9 the Command exits 1 with 12 hits.
- Counterexample: leaving one locale's section lists its lines; keeping the `spec-lifecycle.mdx` exclusion fails the `! grep` (A-05); keeping the old `legacyIndex >= 0` assert fails the test once the sections are gone; deleting a `runtime.mdx` `docs-sync` row by mistake fails the count of 3.
- Artifacts: `/tmp/ck-3c-06.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3c-06.txt; W=../../cafekit-web/public/content/docs; rm -f $F; grep -nE 'Legacy compatibility|legacy adapter|separate adapter|adapter riêng|installed legacy|.docs-sync\.cjs. [|] .SessionStart.' $W/*/spec-lifecycle.mdx $W/*/runtime.mdx $W/*/platforms/claude.mdx > $F; cat $F; [ ! -s $F ] && [ "$(grep -l 'docs-sync.cjs' $W/*/runtime.mdx | wc -l | tr -d ' ')" = 3 ] && ! grep -q "endsWith('/spec-lifecycle.mdx')" bin/__tests__/package-inventory.test.js && node --test --test-name-pattern='website keeps process-first docs' bin/__tests__/package-inventory.test.js > $F 2>&1; grep -E '^# (pass|fail)' $F; grep -qx '# pass 1' $F && grep -qx '# fail 0' $F && rm -f $F`
Exit: 0
Base: d5a1012464b45afd7cab9928786228864592b1cc
Head: bc31f59588c3a3dd871136d503bf47ef3413f637963a1da860c94e2ac30cbd9c
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
# pass 1
# fail 0
EXIT=0
```
Controller rerun from packages/spec after the edits; Base/Head from provenance.cjs.
