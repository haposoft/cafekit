# Task 04 — `--platform grok` installs the Claude runtime and asks for trust

Status: done

## Outcome
`npx @haposoft/cafekit --platform grok` resolves to the Claude platform: the install lands under `.claude/` exactly as `--platform claude` would, no `.grok/` directory is created, and one localized line tells the user that grok reads this install through its Claude compatibility and that project hooks run only after `grok --trust` or `/hooks-trust`. Nothing about automatic detection changes.

## Scope
- In: a platform alias table in `bin/lib/context.js` (`grok` → `claude`); its application in `bin/phases/select-platform.js` on `ctx.options.platforms` **before** the language step reads them, followed by a second deduplication so `--platform grok,claude` installs once; one notice string in the three locales of `bin/lib/i18n.js`, printed by `select-platform.js` only when the alias was used.
- Out: a `PLATFORMS.grok` entry, a `.grok/cafekit.json`, any file under `.grok/`, writing `~/.grok/config.toml`, interactive prompt changes beyond accepting the alias, and — by C2 finding 11 — **any detection hint**: adding `.grok` to Claude's `detectFiles` would make a repository that only uses grok install a full `.claude/` tree unattended, since `PLATFORMS.claude` currently has no `detectFiles` and falls back to `['.claude']`.

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/bin/lib/context.js`, `packages/spec/bin/phases/select-platform.js`, `packages/spec/bin/lib/i18n.js`
- Create: `packages/spec/bin/__tests__/grok-platform.test.js`
- Read: `packages/spec/bin/install.js`, `packages/spec/bin/phases/summary.js`, `packages/spec/bin/phases/write-metadata.js`

## Acceptance
- AC-05 as stated in `plan.md`, with one correction found while executing it: the installer already defaults to Claude when it detects no platform at all (`No platform detected; defaulting to Claude Code`), so "a grok-only project is not auto-detected" cannot be observed through a bare install. The acceptance is therefore that `.grok` is not a detection marker: with `.grok/` and `.codex/` both present, `detectPlatforms()` returns `['codex']` alone. That is the behaviour the finding was protecting, since detected platforms are unioned with saved ones on a reinstall.
- **The alias resolves before language selection.** `select-platform.js` filters `ctx.options.platforms` through `PLATFORMS[key]` when choosing which installed runtime to read a saved locale from; an unresolved `grok` makes that list empty and the fallback scans every platform folder, so `--platform grok` in a project that also has `.codex/` would silently take Codex's language. The alias is applied to `ctx.options.platforms` upstream of that filter, and the unknown-platform rejection stays reachable for genuinely unknown values.
- **`select-platform.js` prints the notice**, not `summary.js`; it already prints platform-selection lines and owns the moment the alias is known. Exactly one notice per install, in the language selected by `--lang`, naming both `grok --trust` and `/hooks-trust`.
- An install with `--platform claude` prints no grok notice, so the alias leaves the Claude path unchanged.

## Dependencies
- task-02-route-hooks-through-reader.md

## Verification Plan
- Command: `node --test bin/__tests__/grok-platform.test.js`
- Named probe: `grok is an alias, not a platform of its own`, `--platform grok installs the Claude runtime and no .grok directory`, `the trust reminder is printed once in the selected language`, `grok and claude together install once`, `a plain claude install prints no grok notice`, `.grok is not a detection marker`, `an unknown platform is still rejected`, `the notice exists in every shipped locale`.
- Reachability: known — the real installer runs into a temp git repository, the technique `omp-runtime.test.js` uses.
- Oracle: `.claude/cafekit.json` records `platform: claude`; `fs.existsSync('.grok')` is false; stdout carries the localized notice exactly once; a single Claude summary line for `grok,claude`; `detectPlatforms()` returns `['codex']` beside a `.grok/` directory.
- Counterexample: registering `grok` as its own `PLATFORMS` entry must fail the alias case; adding `.grok` to `detectFiles` must fail the detection case; printing the notice unconditionally must fail the plain-claude case; dropping a locale's string must fail the locale case.
- Artifacts: ephemeral, removed in `finally`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/grok-platform.test.js
Exit: 0
Base: bd02208496605fab1d8c0c85ee5c04595f41eb7d
Head: 3241648cf2a84a1da32bb12b4cc254825e202eb216d3b2964369434f702ce5cd
```text
$ node --test bin/__tests__/grok-platform.test.js
✔ grok is an alias, not a platform of its own (1.524875ms)
✔ --platform grok installs the Claude runtime and no .grok directory (311.411833ms)
✔ the trust reminder is printed once in the selected language (454.38825ms)
✔ grok and claude together install once (224.011583ms)
✔ a plain claude install prints no grok notice (223.623792ms)
✔ .grok is not a detection marker (0.840667ms)
✔ an unknown platform is still rejected (109.731083ms)
✔ the notice exists in every shipped locale (0.110208ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Counterexamples ran on a disposable copy under a temp root with the package's node_modules linked in, never the tracked bytes. Adding `.grok` to Claude's `detectFiles` turned 8 pass into 7 pass 1 fail; printing the notice unconditionally, the same; deleting the Vietnamese string turned it into 6 pass 2 fail; registering `grok` as its own `PLATFORMS` entry turned it into 3 pass 5 fail.

One acceptance clause was corrected during execution rather than satisfied as written. `a grok-only project is not auto-detected as a Claude install` is not observable through a bare install: the installer already reports `No platform detected; defaulting to Claude Code` for any project with no platform at all, which predates this alias. The case now asserts the property the finding was protecting, that `.grok` is not a detection marker: with `.grok/` and `.codex/` both present, `detectPlatforms()` returns `['codex']` alone.
