# Task 01 — `cf:ui-ux` vendored byte-identical (one patched line) and visible in the catalog

Status: done

## Outcome
`packages/spec/src/claude/skills/ui-ux/` holds upstream `skills/ui-ux` at commit 6465d4c unchanged except its `SKILL.md` frontmatter and the D-01 line, plus `LICENSE` and `scripts/package.json` (53 regular files); the catalog generator lists `cf:ui-ux` with no diagnostic.

## Scope
- In: copy every upstream file; replace only the frontmatter block of `SKILL.md`; patch the one `count_files` line (D-01); add `LICENSE` (upstream root file, unchanged) and `scripts/package.json`.
- Out: any other edit to `SKILL.md`, `references/**` (including `rules-type.md:343`, whose `$<digit>` is a currency example in a file the host reads without substitution), `scripts/probe.mjs`, `scripts/lint-skill.mjs`, `tokens.css`; manifest registration (task-02); installing dependencies (task-03); running `npm install` inside `src/claude/skills/ui-ux/scripts/` (its `node_modules` would be copied by the installer and break task-03's guard).

## Coverage
- CP-01, CP-02

## Ownership
- Create: `src/claude/skills/ui-ux/**` (upstream copy), `src/claude/skills/ui-ux/LICENSE`, `src/claude/skills/ui-ux/scripts/package.json`
- Modify: `src/claude/skills/ui-ux/SKILL.md` (frontmatter block and the D-01 line only)
- Read: `src/claude/skills/pptx/scripts/package.json`, `src/claude/scripts/generate-skill-catalog.cjs`

## Steps
1. `UP=$(mktemp -d) && gh repo clone evondev/evondevKit "$UP" -- -q && git -C "$UP" checkout -q 6465d4c37506b0b21823c24d557d61fbc60ca51a` → a clean upstream tree pinned to the commit the plan names (`find "$UP/skills/ui-ux" -type f | wc -l` prints 51).
2. `rm -rf src/claude/skills/ui-ux && mkdir -p src/claude/skills/ui-ux && cp -R "$UP/skills/ui-ux/." src/claude/skills/ui-ux/ && cp "$UP/LICENSE" src/claude/skills/ui-ux/LICENSE` → 51 upstream files plus `LICENSE` (52) under `src/claude/skills/ui-ux/`; rerunning this step after a failed round yields the same tree, never a nested `ui-ux/ui-ux/`.
3. Replace lines 1–4 of `src/claude/skills/ui-ux/SKILL.md` (the upstream frontmatter: `---`, `name: ui-ux`, the 857-character Vietnamese `description`, `---`) with exactly these 14 lines:
   ```yaml
   ---
   name: cf:ui-ux
   description: "Build, review, or redesign an in-app screen (dashboard, list, table, form, settings, modal) the way a designer works: brief, 2–3 wireframes, the user picks, then build with the project's own components and measure the page with a browser probe. Other routes on request: review an existing UI ('xem giúp', 'review', 'nhìn rối', 'what's wrong'), rebuild keeping the brand ('giữ brand', 'keep the brand'), rebuild in the skill's own style ('bỏ style cũ'), refactor keeping the look ('chuyển sang Tailwind'), build right away ('dựng luôn', 'just build it'), design system first ('UI kit', 'component library'), a simple logo ('làm logo', 'design a logo'), or fix one component. Triggers: 'dựng màn', 'thiết kế', 'làm UI cho đẹp', 'làm lại UX', 'build a page', 'design this screen', 'redesign', 'make it look good', 'ecommerce', 'ui-ux', 'evon'. Landing pages, storefronts and blogs are not covered (it still builds them, with a warning)."
   license: MIT
   user-invocable: true
   when_to_use: "Invoke to build, review, or redesign an app screen with wireframes and a measured probe; for palette, font, or UX-guideline lookups use cf:ui-ux-pro-max."
   category: frontend
   keywords: [ui, ux, wireframe, dashboard, review, probe]
   metadata:
     author: "Tuấn Trần (evondev) — adapted by Haposoft"
     version: "0.3.13"
     upstream: https://github.com/evondev/evondevKit
     upstream_commit: 6465d4c37506b0b21823c24d557d61fbc60ca51a
   ---
   ```
   → every byte after the closing `---` is still upstream's (upstream line 6 `# UI/UX cho hệ thống dashboard` is now line 16).
4. In `src/claude/skills/ui-ux/SKILL.md`, change the single line `  grep -rlE "$1" --include='*.tsx' --include='*.jsx' --include='*.vue' --include='*.svelte' \` (upstream line 119, now line 129) to `  grep -rlE "$*" --include='*.tsx' --include='*.jsx' --include='*.vue' --include='*.svelte' \` → `grep -c '\$[0-9]' src/claude/skills/ui-ux/SKILL.md` prints `0`; nothing else in the body changes.
5. Write `src/claude/skills/ui-ux/scripts/package.json` following `src/claude/skills/pptx/scripts/package.json`: `name` `cafekit-skill-ui-ux`, `version` `0.3.13`, `private` true, `description` "Node dependencies for the CafeKit ui-ux skill (probe.mjs)", `dependencies` `{"playwright": "^1.40.0"}` → `skills-setup.js` will `npm install` it and run `playwright install chromium`; the tree now holds 53 regular files.
6. Run the Verification Plan Command → it prints `cf:ui-ux OK: ui-ux frontend description N chars` (N ≤ 1024) and exits 0.

## Acceptance
- AC-01: catalog `--json` contains a skill with `public_id` `cf:ui-ux`, `directory` `ui-ux`, `category` `frontend`, `description.length` ≤ 1024; no diagnostic has `directory` `ui-ux`.
- AC-02: `find` counts 53 regular files; `diff -rq` excluding `SKILL.md`, `package.json`, `LICENSE` is empty; the `SKILL.md` body equals the upstream body with the D-01 line patched; the body has more than 400 lines; `SKILL.md` has no `$<digit>`; `LICENSE` equals upstream's.

## Dependencies
- none

## Verification Plan
- Command: `UP=$(mktemp -d) && trap 'rm -rf "$UP"' EXIT && gh repo clone evondev/evondevKit "$UP" -- -q && git -C "$UP" checkout -q 6465d4c37506b0b21823c24d557d61fbc60ca51a && test "$(cd src/claude/skills/ui-ux && find . -type f | wc -l | tr -d ' ')" -eq 53 && diff -rq "$UP/skills/ui-ux" src/claude/skills/ui-ux -x SKILL.md -x package.json -x LICENSE && cmp "$UP/LICENSE" src/claude/skills/ui-ux/LICENSE && diff <(sed '119s/"\$1"/"$*"/' "$UP/skills/ui-ux/SKILL.md" | awk 'f>=2{print} /^---$/{f++}') <(awk 'f>=2{print} /^---$/{f++}' src/claude/skills/ui-ux/SKILL.md) && test "$(awk 'f>=2{print} /^---$/{f++}' src/claude/skills/ui-ux/SKILL.md | wc -l | tr -d ' ')" -gt 400 && ! grep -q '\$[0-9]' src/claude/skills/ui-ux/SKILL.md && node src/claude/scripts/generate-skill-catalog.cjs --root src/claude/skills --json | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8"));const s=c.skills.find(x=>x.public_id==="cf:ui-ux");if(!s||s.directory!=="ui-ux"||s.category!=="frontend")throw new Error("cf:ui-ux missing or wrong");if(c.diagnostics.some(d=>d.directory==="ui-ux"))throw new Error("diagnostic for ui-ux");if(s.description.length>1024)throw new Error("description too long");console.log("cf:ui-ux OK:",s.directory,s.category,"description",s.description.length,"chars")'`
- Named probe: `scanSkills` in `src/claude/scripts/generate-skill-catalog.cjs` (diagnostics `missing_routing_metadata`, `duplicate_public_name`, `retired_skill`); `find -type f` count; `diff -rq` / `cmp` against the pinned upstream checkout; the body `diff` against upstream with `sed '119s/"\$1"/"$*"/'` applied; the body line-count guard; `grep '\$[0-9]'`.
- Reachability: source — run from `packages/spec/` in this worktree with zsh or bash (process substitution); needs `gh` authenticated and network to clone upstream (verified available in this session); the pinned commit must still be reachable on the remote (`[UNVERIFIED]` until the Command runs).
- Oracle: exit 0 and the final line `cf:ui-ux OK: ui-ux frontend description N chars`; any `diff` line, `cmp` difference, failed `test`, a `$<digit>` hit, or thrown error is a failure.
- Counterexample: a body edit beyond the D-01 line, a nested `ui-ux/ui-ux/` copy, a leftover `scripts/node_modules` (count ≠ 53), a renamed temp dir (`evon-design`), a missing `LICENSE`, `"$1"` left at the `count_files` line, a CRLF `SKILL.md` (body line count 0), or `name: ui-ux` left in place must make the Command exit non-zero.
- Artifacts: ephemeral upstream checkout in `$UP`, removed by the `trap` on every exit; the vendored tree itself is the durable artifact.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `UP=$(mktemp -d) && trap 'rm -rf "$UP"' EXIT && gh repo clone evondev/evondevKit "$UP" -- -q && git -C "$UP" checkout -q 6465d4c37506b0b21823c24d557d61fbc60ca51a && test "$(cd src/claude/skills/ui-ux && find . -type f | wc -l | tr -d ' ')" -eq 53 && diff -rq "$UP/skills/ui-ux" src/claude/skills/ui-ux -x SKILL.md -x package.json -x LICENSE && cmp "$UP/LICENSE" src/claude/skills/ui-ux/LICENSE && diff <(sed '119s/"\$1"/"$*"/' "$UP/skills/ui-ux/SKILL.md" | awk 'f>=2{print} /^---$/{f++}') <(awk 'f>=2{print} /^---$/{f++}' src/claude/skills/ui-ux/SKILL.md) && test "$(awk 'f>=2{print} /^---$/{f++}' src/claude/skills/ui-ux/SKILL.md | wc -l | tr -d ' ')" -gt 400 && ! grep -q '\$[0-9]' src/claude/skills/ui-ux/SKILL.md && node src/claude/scripts/generate-skill-catalog.cjs --root src/claude/skills --json | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8"));const s=c.skills.find(x=>x.public_id==="cf:ui-ux");if(!s||s.directory!=="ui-ux"||s.category!=="frontend")throw new Error("cf:ui-ux missing or wrong");if(c.diagnostics.some(d=>d.directory==="ui-ux"))throw new Error("diagnostic for ui-ux");if(s.description.length>1024)throw new Error("description too long");console.log("cf:ui-ux OK:",s.directory,s.category,"description",s.description.length,"chars")'`
Exit: 0
Base: 659b7053ca581085ca5c84977e6c1741c96f9b28
Head: d62b769e984084d20854ceb6a7e781e5ba0f9490342962ee333cc3ef0c510292
```text
$ (packages/spec) <Command above>
cf:ui-ux OK: ui-ux frontend description 933 chars
EXIT=0
```
Pre-change run of the same Command failed at the unmet Acceptance (`cd: no such file or directory: src/claude/skills/ui-ux`, exit 1) after the pinned upstream commit cloned and checked out. Copy step observed: upstream 51 files, vendored 52 after `LICENSE`, 53 after `scripts/package.json`.
