# Task 01 — Plan manifest files safely

Status: done

## Outcome
`planManifestFiles(projectRoot)` lists every file recorded in the Claude and Codex install manifests as `remove` or `keep` with a reason, so the dry-run shows exactly which installed files go and why the rest stay; nothing is written.

## Scope
- In:
  - Detect a platform by its `cafekit-manifest.json`; read it raw — a parse error makes that platform `refused` (nothing planned for it); `cafekit.json` without a manifest is reported as an unmanaged install and nothing is planned.
  - Resolve each key against `PLATFORMS[p].ownership?.recordRoot || folder` (Claude has no `ownership`) (`packages/spec/bin/lib/context.js:110-113`): Claude keys under `.claude/`, Codex keys under the repository root. A key that is absolute, contains `..`, or resolves outside the platform's folders (`.claude/` for Claude; `.codex/`, `.agents/` for Codex) → `keep: outside-root`.
  - Any path component from the repository root that is a symlink (checked with `lstat` per component) → `keep: symlinked`; when `.claude`, `.codex` or `.agents` itself is a symlink, the platform is `refused`.
  - Disk hash ≠ recorded hash → `keep: modified`; absent → `missing`; `runtime.json` → `keep: runtime`; `runtime.schema.json` → `keep: runtime` while `runtime.json` is kept.
  - Group by skill folder (`skills/<name>/`, `.agents/skills/<name>/`) and agent file: a skill or agent the plugins do not ship (`EXCLUDED_SKILLS`, `EXCLUDED_AGENTS`, skills outside `skills.required`) → whole group `keep: npx-only`; any kept file in a group → the whole group `keep: group-kept`. A nested `.gitignore` stays while any file below its folder is kept.
  - `keep: required-by-kept` for every shared manifest file (`scripts/`, `references/`, `hooks/`, `output-styles/`) that a kept group names by path (scan the kept group's text files for `.claude/<path>`, `.codex/<path>`, `.agents/<path>` and their installer-transformed forms), and for the `output-styles/*.md` file whose style name equals `outputStyle` in `.claude/settings.json` (D-03).
  - Move `EXCLUDED_SKILLS`/`EXCLUDED_AGENTS` into a shipped module `packages/spec/bin/lib/plugin-inventory.js` (the npm package ships `bin` and `src`, not `scripts`); `build-claude-plugin.mjs` imports and re-exports them (its test reads `lib.EXCLUDED_SKILLS`).
  - Files inside the platform folders that are in no manifest → `keep: untracked` (listed).
  - Render the plan grouped by action and reason.
- Out: merged files (task-02); writing anything.

## Coverage
- CP-01

## Ownership
- Create: `packages/spec/bin/lib/migrate-plan.js`
- Create: `packages/spec/bin/lib/plugin-inventory.js`
- Modify: `packages/spec/scripts/build-claude-plugin.mjs` (import the lists)
- Create: `packages/spec/bin/__tests__/migrate-plan.test.js`
- Read: `packages/spec/bin/lib/manifest.js`, `packages/spec/bin/lib/context.js`, `packages/spec/bin/lib/path-safety.js`

## Steps
1. Move the lists, write the planner and renderer.
2. Fixture: a temp git repo; run `bin/install.js --platform claude,codex --with-document-skills -y` with `cwd` set to it and a temp `HOME` (the installer writes into its cwd); then edit one file of the `specs` skill, add a user skill folder, symlink one `.agents/skills/<x>` folder to a copy outside the repo, and add `.claude/.env`.

## Acceptance
- AC-01: on the untouched fixture every Codex key and every plugin-equivalent Claude key is `remove` except `runtime*.json` (Codex `remove` count = recorded keys − runtime − npx-only groups); the edited `specs` skill folder is wholly kept (`group-kept`); `chrome-devtools`, `ui-ux`, `ui-ux-pro-max`, `ui-ux-designer` are `npx-only`; the symlinked folder is `symlinked` and its target is never in `remove`; a planted manifest key `../../outside.txt` with the file's true hash is `outside-root`; a corrupt manifest makes its platform `refused`; with document skills installed, `scripts/validate-docs.cjs`, `scripts/validate-docs-reconstruct.cjs` and `hooks/docs-sync.cjs` are `required-by-kept`, and the edited `specs` skill keeps every shared file it names; the output-style file selected in settings.json is `required-by-kept`; the repository tree hash is equal before and after planning.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/migrate-plan.test.js`
- Named probe: `migrate-plan.test.js` (pristine-removed-count, runtime-kept, modified-group-kept, npx-only-kept, symlinked-kept, outside-root-kept, corrupt-manifest-refused, kept-skill-deps-kept, selected-style-kept, unmanaged-reported, untracked-listed, writes-nothing).
- Reachability: source — `planManifestFiles` on a real npx install made by `bin/install.js` in a temp repo.
- Oracle: per-path action and reason; counts; tree hash before = after.
- Counterexample: a planner that follows the symlink or resolves Codex keys under `.codex/` → `symlinked-kept` or `pristine-removed-count` red.
- Artifacts: ephemeral temp repo, `HOME` and symlink target, removed in `after`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/migrate-plan.test.js
Exit: 0
Base: 32ef63d6daf052d6bb6e938e73714e8930f70f88
Head: de24c4764f214476925303804e5bc286001c18c47250a2840c6aff615c44be4c
```text
$ node --test packages/spec/bin/__tests__/migrate-plan.test.js
✔ pristine-removed-count: every Codex key is removed except runtime, npx-only, required and ignore files (84.792792ms)
✔ runtime-kept: runtime.json and its schema stay for both platforms (70.38325ms)
✔ npx-only-kept: skills and agents no plugin ships stay whole (70.568375ms)
✔ kept-skill-deps-kept: shared files a kept skill names stay, transitively (291.538833ms)
✔ selected-style-kept: the output style chosen in settings.json stays (309.810083ms)
✔ modified-group-kept: an edited skill stays whole with every shared file it names (439.529208ms)
✔ symlinked-kept: a symlinked skill folder is kept and its target is never planned (697.688083ms)
✔ outside-root-kept: a manifest key that leaves the platform folders is never removed (240.923333ms)
✔ corrupt-manifest-refused: a manifest that does not parse plans nothing for its platform (241.241334ms)
✔ unmanaged-reported: cafekit.json without a manifest is reported and nothing is planned (240.003416ms)
✔ untracked-listed: user files in the platform folders are listed and kept (259.652542ms)
✔ writes-nothing: planning leaves the repository bytes unchanged (335.231625ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5002.370917
EXIT=0
```

Reachability: source — `planManifestFiles` on a real npx 0.18.2 install (`bin/install.js --platform claude,codex --with-document-skills -y`, cwd = temp repo, temp HOME).
Negative proof: in-place mutations (file restored, sha256 checked) — skipping the symlink probe reds `symlinked-kept`; resolving Codex keys under `.codex/` reds 5 probes; dropping the untracked seed, `settings.local.json`, the slash collapse, `follow`, or symlinked-folder traversal each reds its probe.
Review: code-auditor round 1 FAIL (2 High: untracked user files not scanned; `settings.local.json` style), round 2 FAIL (1 High: symlinked user skill; 1 Medium: JSON `\\` separators), round 3 PASS.
Clarification of D-02/D-03 applied in review: "a kept group names it" also covers user files (untracked, followed through symlinks), the style named in `settings.local.json` is kept, and a plugin skill folder holding a user file stays whole (`group-kept`).
Limitations: an unreadable folder reached through a user symlink throws (fail-closed, no removal; the CLI must report it); following a user symlink has no size cap; case-variant manifest keys are not grouped (the installer never writes them); a user-named symlink back into the repo does not keep its target; reference scanning sees `.claude|.codex|.agents/<path>` and relative `require`, not `path.join` or ESM imports.
