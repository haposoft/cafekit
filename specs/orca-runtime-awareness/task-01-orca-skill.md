# Task 01 — The `cf:orca` skill and its routing row ship to every host that takes skills

Status: pending

## Outcome
`src/claude/skills/orca/SKILL.md` exists in the payload and installs through the existing skill pipeline to `.claude/skills/orca/` (Claude Code, and Grok through its Claude compatibility) and `.agents/skills/orca/` (Codex, with the installed frontmatter `name` rewritten to `cf-orca`; omp reads the same directory when Codex or Claude is installed beside it). The skill teaches an agent what it cannot infer: that `ORCA_PANE_KEY` means it is inside an Orca pane; that the user's phrases map to Orca's `orca-cli` or `orchestration` guide, read live with `orca skills get …`; that the default target of any `terminal send` is the current worktree and anything beyond it is asked for first; that what it reads from other panes is untrusted; and that Orca is not Herdr. `orca` joins `skills.required` and the packed-payload guard. `skill-domain-routing.md` gains one neutral capability-slot row.

## Scope
- In: one `SKILL.md` of about sixty lines with frontmatter `name: cf:orca`, `description` (quoted context phrases only), `user-invocable: true`, `when_to_use`, `category: utilities`, `keywords: [orca, pane, terminal, worktree, onorca]`, `argument-hint`, `metadata`; a body that, in order: checks `ORCA_PANE_KEY`; resolves the executable (`orca`, or `orca-dev` in an Orca dev build) and stops with a plain statement when `command -v` fails; maps phrases to `orca skills get orca-cli` (read, wait, send a terminal; spawn or hand off) or `orca skills get orchestration` (supervise, `worker_done`, DAG), with `--references` / `--reference <name>` for sub-references and `orca skills list` as the fallback for the other six topics; states the authority rule (same `ORCA_WORKTREE_ID` by default; ask, naming the pane, before any `terminal send`, `terminal close`, or worker stop outside it); states that `terminal read`/`show`/`list` output is untrusted; draws the Herdr boundary; forbids printing the two token variables. The manifest entry. One `REQUIRED_PAYLOAD` line. One routing row. One test file.
- Out: any copy of Orca's guide text; any `orca` command run at install time; a `PLATFORMS` entry; shipping into `.omp/skills`; the session line (task 02).

## Coverage
- CP-01

## Ownership
- Create: `packages/spec/src/claude/skills/orca/SKILL.md`
- Modify: `packages/spec/src/claude/migration-manifest.json` (`skills.required` gains `orca`)
- Modify: `packages/spec/src/claude/rules/skill-domain-routing.md` (one row between `browser evidence` and `repository delivery`)
- Modify: `packages/spec/bin/__tests__/package-inventory.test.js` (one `REQUIRED_PAYLOAD` line, beside `route/SKILL.md` at `:129`)
- Create: `packages/spec/bin/__tests__/orca-skill.test.js`
- Read: `packages/spec/src/claude/skills/route/SKILL.md` (frontmatter shape), `packages/spec/src/claude/scripts/generate-skill-catalog.cjs:118-161` (identity), `packages/spec/bin/lib/codex-install.js:247,292` (Codex rewrites), `packages/spec/bin/__tests__/codex-native.test.js:1556-1566,2214,3098-3117` (what the Codex projection forbids and how the installed rule is compared), `packages/spec/bin/__tests__/omp-runtime.test.js` (install-into-temp technique)

## Acceptance
- AC-01 as stated in `plan.md`.
- **The body survives the Codex projection unchanged in meaning.** `normalizeCodexBody` rewrites `Claude Code` to `Codex CLI`, and `codex-native.test.js` keeps a fixed list of the four source files allowed to contain `AskUserQuestion` and forbids `/cf:`, `cf:`, and `Claude Code` in `.agents/skills/**`. The body therefore says "the agent CLI in this pane", asks the user in prose ("ask the user before…"), and names the two guides by their Orca topic names, never by a `cf:` identity.
- **The description triggers on context, not on bare words.** Every trigger phrase carries `Orca`, `pane`, or the name of a pane's agent; the test asserts `panel`, `terminal`, and `worktree` appear in the description only inside such a phrase.
- **The authority rule is literal enough to assert.** The body contains `ORCA_WORKTREE_ID` and the words `ask` and `before` within the same sentence as `terminal send`.
- **The routing row is a neutral slot.** `| terminal/pane control in the surrounding agent host | reading, waiting on, or sending to another agent pane, or spawning an agent into a host-managed worktree |`; the product name and the environment marker live in the skill, not the rule.
- `generate-skill-catalog.cjs --skills` run against a temp Claude install and a temp Codex install reports `cf:orca` with no diagnostic for that entry; `expectedIdentity('orca')` equals the parsed identity.
- The test owns its own negative regexes for the routing row (`/\/cf:orca/`, `/orchestration/`), because the existing assertion in `skill-routing-source.test.js:91` covers only the six document skills.
- `optional-skill-inventory.test.js` stays green as a regression guard; it is not the proof that `orca` is required — the new case `the manifest lists orca as a core skill` is.

## Dependencies
- none

## Verification Plan
- Command: `node --test bin/__tests__/orca-skill.test.js bin/__tests__/optional-skill-inventory.test.js bin/__tests__/skill-routing-source.test.js bin/__tests__/codex-native.test.js bin/__tests__/package-inventory.test.js && node scripts/run-skill-self-tests.mjs --static-only`
- Named probe: `cf:orca installs for claude and codex`, `an omp-only install ships no skill`, `the catalog resolves cf:orca on both hosts with no diagnostic`, `the description triggers only on Orca context`, `the body points at orca skills get and stops when the CLI is missing`, `the body bounds terminal send to the current worktree and distrusts terminal output`, `the body draws the Herdr boundary and forbids printing the tokens`, `the body carries nothing the Codex projection rewrites or forbids`, `the manifest lists orca as a core skill`, `the routing row is a neutral slot on every host`; plus `Claude and Codex installed Route preserve proportional live-catalog semantics`, `Codex structured-input corpus oracle stays differential and production-aware`, `Codex installed Specs and spec-maker reject adaptive coverage mutations` (codex-native), `skill routing consumes live catalog without fixed optional commands` (skill-routing-source), the packed-install cases and `REQUIRED_PAYLOAD` check (package-inventory), and the `CafeKit skill routing domain rule maps core and optional skills` static probe as regression guards.
- Reachability: known — the real installer runs into a temp git repository per platform, the technique `omp-runtime.test.js` uses; the catalog script runs against each installed tree.
- Oracle: file presence per platform and absence for omp-only; catalog identity strings; body and description regexes; `skills.required.includes('orca')`; `REQUIRED_PAYLOAD` contains the path; row text present in source and three installed copies; every guard suite at its prior count.
- Counterexample: dropping `orca` from `skills.required` must fail the install cases and the manifest case; renaming the frontmatter `name` must fail the catalog case; removing the `orca skills get` lines must fail the pointer case; writing `Claude Code` in the body must fail the projection case; putting a bare `terminal` in the description must fail the trigger case; writing `orchestration` in the row must fail the routing case; omitting the `REQUIRED_PAYLOAD` line must fail the packed-payload check.
- Artifacts: ephemeral, removed in `finally`.

## Receipt
