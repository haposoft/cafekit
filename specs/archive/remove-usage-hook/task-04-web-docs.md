# Task 04 — the website's hook tables no longer list `usage.cjs`

Status: done

## Outcome
The `cafekit-web` runtime and Claude platform pages (English, Vietnamese, Japanese) list the hooks CafeKit actually ships.

## Scope
- In: delete the `usage.cjs` row from `runtime.mdx:27` and `platforms/claude.mdx:40` in `en`, `vi`, `ja`.
- Out: any other web content; site build or deploy.

## Coverage
- CP-04

## Ownership
- Modify: `../../cafekit-web/public/content/docs/en/runtime.mdx`, `../../cafekit-web/public/content/docs/vi/runtime.mdx`, `../../cafekit-web/public/content/docs/ja/runtime.mdx`, `../../cafekit-web/public/content/docs/en/platforms/claude.mdx`, `../../cafekit-web/public/content/docs/vi/platforms/claude.mdx`, `../../cafekit-web/public/content/docs/ja/platforms/claude.mdx`

## Steps
1. Run the Verification Plan Command and expect failure.
2. Delete the six rows; keep each table's other rows and alignment.
3. Run the Command.

## Acceptance
- AC-06: no page under `cafekit-web/public/content/docs` names `usage.cjs`; each edited file still has its table header row.

## Dependencies
- task-03-anchors-docs-changelog.md

## Verification Plan
- Command: `! grep -rn "usage\.cjs" ../../cafekit-web/public/content/docs && for f in ../../cafekit-web/public/content/docs/{en,vi,ja}/runtime.mdx ../../cafekit-web/public/content/docs/{en,vi,ja}/platforms/claude.mdx; do grep -q '^| .*\.cjs' "$f" || exit 1; done && echo WEB_OK`
- Named probe: the recursive `grep` over `cafekit-web/public/content/docs` and the per-file table-row check.
- Reachability: source — run from `packages/spec/` in zsh or bash (brace expansion).
- Oracle: exit 0 and `WEB_OK`.
- Counterexample: one page left with the row fails the first `grep`; a page whose table was deleted wholesale fails the per-file check.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `! grep -rn "usage\.cjs" ../../cafekit-web/public/content/docs && for f in ../../cafekit-web/public/content/docs/{en,vi,ja}/runtime.mdx ../../cafekit-web/public/content/docs/{en,vi,ja}/platforms/claude.mdx; do grep -q '^| .*\.cjs' "$f" || exit 1; done && echo WEB_OK`
Exit: 0
Base: 9f8138238923b1f01cb0be84ce9f13a1c6063522
Head: 41b0128bb69dbac3ff222b8052a4ed04e6e7136fc3dce4dc45369e44ee8578fe
```text
$ (packages/spec) <Command above>
WEB_OK
```
Pre-change run exited 1 at the recursive `grep` (six rows: `{en,vi,ja}/runtime.mdx:27`, `{en,vi,ja}/platforms/claude.mdx:40`). Each file lost exactly one row (`git diff --stat`: 6 files, 6 deletions).
