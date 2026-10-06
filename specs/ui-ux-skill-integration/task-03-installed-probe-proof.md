# Task 03 — the installed skill's probe runs with the Playwright and browser the installer provisions

Status: done

## Outcome
In a fresh project, `bin/install.js --with-skills-deps` reports Node packages and the Playwright browser ready for `ui-ux`, the browser lands under `PLAYWRIGHT_BROWSERS_PATH`, and `probe.mjs` loaded from the installed `scripts/` measures a local page at 375 and 1440 px, writing `report.json` with two widths.

## Scope
- In: one end-to-end run of the real installer and the real probe in a temp project; reading its output.
- Out: any source edit (if the run fails, the cause is repaired in task-01 or task-02 under their Failure Protocol and this Command is rerun); running the probe against a dev server; judging the probe's findings.

## Coverage
- CP-04

## Ownership
- Modify: none
- Create: none (temp project only)
- Read: `bin/phases/skills-setup.js`, `bin/lib/skill-deps.js`, `bin/lib/i18n.js:73,76`, `src/claude/skills/ui-ux/scripts/probe.mjs` (usage header, `loadPlaywright`, `launchBrowser`)

## Steps
1. Confirm `src/claude/skills/ui-ux/scripts/node_modules` does not exist (the Command's first guard) → nothing stray would be copied into the temp install.
2. Run the Verification Plan Command from `packages/spec/` → the installer log is printed and contains `ui-ux — Node packages ready` and `ui-ux — Playwright browser ready`, `ls` shows a `chromium-*` directory under `$T/pw`, the probe prints its per-width output, `report.json` holds two widths, and the Command ends with `PROBE_OK`. Expect several minutes: `--with-skills-deps` also installs `chrome-devtools`' puppeteer (skipping its Chromium when a system Chrome exists) and downloads Playwright's Chromium into `$T/pw` (~150 MB).
3. If the Bash tool's timeout moves the Command to the background, wait for its exit and read its full output file; the Receipt must quote the real output of the finished run, with the Command line verbatim from this plan (no extra wrapper).

## Acceptance
- AC-05: Command exits 0; both readiness lines are in the installer log; `node_modules/playwright` exists under the installed skill's `scripts/`; a `chromium-*` directory exists under `$T/pw`; `report.json` has exactly two `widths` entries; the probe output directory listing shows screenshot files.

## Dependencies
- task-01-vendor-skill.md
- task-02-register-and-route.md

## Verification Plan
- Command: `S=$PWD && test ! -e "$S/src/claude/skills/ui-ux/scripts/node_modules" && T=$(mktemp -d) && trap 'rm -rf "$T"' EXIT && export PLAYWRIGHT_BROWSERS_PATH="$T/pw" && git -C "$T" init -q && (cd "$T" && node "$S/bin/install.js" --platform claude --yes --with-skills-deps --without-document-skills > "$T/install.log" 2>&1); cat "$T/install.log" && grep -q "ui-ux — Node packages ready" "$T/install.log" && grep -q "ui-ux — Playwright browser ready" "$T/install.log" && test -d "$T/.claude/skills/ui-ux/scripts/node_modules/playwright" && ls -d "$T"/pw/chromium-*/ && node "$T/.claude/skills/ui-ux/scripts/probe.mjs" "file://$T/.claude/skills/ui-ux/references/layouts/app-kanban.html" --widths 375,1440 --out "$T/probe" --pw "$T/.claude/skills/ui-ux/scripts" && node -e 'const r=require(process.argv[1]);if(!Array.isArray(r.widths)||r.widths.length!==2)throw new Error("expected 2 widths, got "+JSON.stringify(r.widths&&r.widths.length))' "$T/probe/report.json" && ls "$T/probe" && echo PROBE_OK`
- Named probe: `skills-setup.js` `npmInstall` + `installPlaywrightBrowser` for skill `ui-ux` (`bin/phases/skills-setup.js:75-100`, messages `npmInstalled` / `playwrightReady` from `bin/lib/i18n.js:73,76`); `probe.mjs` `loadPlaywright` with `--pw` (`scripts/probe.mjs:62-74`), `launchBrowser` (`:76-83`), and `writeFileSync(join(options.out, "report.json"), …)` (`:4438`).
- Reachability: installed + live — needs `npm`/`npx` on PATH, network to the npm registry and Playwright's CDN, headless Chromium (no display), and network to the three CDNs `app-kanban.html` loads (Google Fonts, `cdn.jsdelivr.net` Tailwind browser, `unpkg.com` lucide, `references/layouts/app-kanban.html:8-16,298`); verified earlier in this session that `node probe.mjs` loads on Node 22. `[UNVERIFIED]` until run: a full probe pass over the static `file://` page.
- Oracle: exit 0 and `PROBE_OK` as the last line, preceded by a listing containing `report.json` and at least one `.png`. A probe message asking whether the dev server is running means a network timeout on the page's CDN assets, not a defect in the change; an installer log line `ui-ux — Playwright browser download skipped` means the browser download failed and the Command must fail at the second `grep`.
- Counterexample: removing `playwright` from `scripts/package.json` (task-01) must fail the first `grep` or `test -d`; deleting the `chromium-*` directory under `$T/pw` before the probe (or a failed browser download) must fail `ls -d`; a stray `src/…/ui-ux/scripts/node_modules` must fail the first `test`; a probe that falls back to the system Chrome cannot make `ls -d "$T"/pw/chromium-*/` pass on its own; a `report.json` with one width must fail the `node -e` check.
- Artifacts: ephemeral — `$T` (install, `install.log`, `pw/` browsers, `probe/` screenshots and `report.json`) is removed by the `trap` on every exit, success or failure; to inspect a failure, rerun the steps by hand without the `trap`. The Receipt's fenced output is the durable record.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `S=$PWD && test ! -e "$S/src/claude/skills/ui-ux/scripts/node_modules" && T=$(mktemp -d) && trap 'rm -rf "$T"' EXIT && export PLAYWRIGHT_BROWSERS_PATH="$T/pw" && git -C "$T" init -q && (cd "$T" && node "$S/bin/install.js" --platform claude --yes --with-skills-deps --without-document-skills > "$T/install.log" 2>&1); cat "$T/install.log" && grep -q "ui-ux — Node packages ready" "$T/install.log" && grep -q "ui-ux — Playwright browser ready" "$T/install.log" && test -d "$T/.claude/skills/ui-ux/scripts/node_modules/playwright" && ls -d "$T"/pw/chromium-*/ && node "$T/.claude/skills/ui-ux/scripts/probe.mjs" "file://$T/.claude/skills/ui-ux/references/layouts/app-kanban.html" --widths 375,1440 --out "$T/probe" --pw "$T/.claude/skills/ui-ux/scripts" && node -e 'const r=require(process.argv[1]);if(!Array.isArray(r.widths)||r.widths.length!==2)throw new Error("expected 2 widths, got "+JSON.stringify(r.widths&&r.widths.length))' "$T/probe/report.json" && ls "$T/probe" && echo PROBE_OK`
Exit: 0
Base: 659b7053ca581085ca5c84977e6c1741c96f9b28
Head: d32e06651c1d0a1012ce09671d2f57c892e86a6d0270f151d28f5dbc1ce852c8
```text
$ (packages/spec) <Command above>   # excerpt of 147 lines; EXIT=0
  ✓ Skill: ui-ux
  ✓ Skill: ui-ux-pro-max
Installing Node packages: chrome-devtools
chrome-devtools — Node packages ready
Installing Node packages: ui-ux
ui-ux — Node packages ready
Downloading Playwright browser for ui-ux
ui-ux — Playwright browser ready
System Chrome detected (/Applications/Google Chrome.app/Contents/MacOS/Google Chrome), skipping download
Installation complete
/var/folders/0n/c1ky29v16kjfm08y24plng7w0000gn/T/tmp.3Ygvob5eVX/pw/chromium-1243/
# Probe: 2 nhóm lỗi đo được
## 375px  (ảnh: …/probe/375.png)
## 1440px  (ảnh: …/probe/1440.png)
# Việc phải đối chiếu: 0 mục probe xếp Hỏng
1440.png
375.png
report.json
PROBE_OK
EXIT=0
```
No pre-change run: the Command downloads Playwright and Chromium (~150 MB) and writes artifacts. Temp directory removed by the trap after exit (verified `ls` → No such file or directory). The probe's findings (orphan last words on four kanban card titles) are about upstream's sample page, out of scope.
