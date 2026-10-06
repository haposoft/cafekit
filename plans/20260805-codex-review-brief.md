# Task: Independent review — instruction refactor on PR #76

> Self-contained brief for a fresh-context agent. Date: 2026-08-05.
> FOUNDATION: branch `refactor/instructions-2026`, clean working tree, 11 commits ahead of `dev` (base `232520d`). Nothing here is merged. Two prior independent reviews already ran; your job is a third, adversarial pass. Do NOT edit files, commit, or push — read-only plus disposable temp-dir experiments.

## Context

CafeKit (`packages/spec/`) is an npm installer that copies instruction files (AGENTS.md/CLAUDE.md templates, skills, hooks) into end-user projects for three runtimes: Claude Code, Codex CLI, OpenCode. This branch refactors the instruction layer:

- `AGENTS.md` becomes the canonical shared instruction core (`src/common/AGENTS.md`), installed once as a marked block; `CLAUDE.md` becomes a thin wrapper importing it via `@AGENTS.md`.
- The dynamic rules hook (`src/*/hooks/rules.cjs`, `src/opencode/plugins/rules.ts`) now injects once per session instead of nearly every prompt, and injects nothing when `runtime.json` is missing/malformed (fail-open, exit 0).
- The language section is patched by the installer inside the shared core block of root `AGENTS.md`; the Addressing section no longer ships in templates (installer adds it on user opt-in and preserves it across reinstalls).
- Commit `925e094` additionally edits ~30 skill files: a single "Delegation policy" table in `develop` replacing contradictory always-delegate wording, `git` skill rewritten, numeric review thresholds (9.5/10, 9.0/10) replaced by a word rule ("PASS = no Critical, no High, at most one Medium"), agent `god-developer` renamed to `implementer`, unsourced statistics removed from domain skills, Vietnamese strings translated to English.

Design decisions were locked in advance in these repo files (treat them as the spec to review against):

1. `plans/20260805-instructions-editorial-implementation.md` — the implementation plan with verbatim target text
2. `plans/20260805-instructions-semantic-review.md` — the defect inventory that motivated the plan
3. `plans/20260804-cafekit-opus5-fix-map.md` — the architecture-level rationale

## Scope

Commits to review: `git log --oneline 232520d..HEAD` (11 commits). Focus hardest on the two newest:

- `6f17b48` refactor(instructions): centralize shared runtime instruction core
- `925e094` refactor(instructions): editorialize wave 4 skills

## Phase 1 — Blind word-level review (do this BEFORE reading Appendix A)

Read the full diffs (`git show 6f17b48`, `git show 925e094`) and the resulting files. Review the actual wording, sentence by sentence, for:

1. **Plan-artifact leakage**: annotations, rationale notes, or reviewer-directed commentary from the plan documents copied verbatim into shipped product text (headings, parentheticals, comments addressed to nobody).
2. **Audience confusion**: sentences in model-facing instruction files that only a human maintainer can act on, or vice versa.
3. **Incomplete renames/replacements**: any leftover `god-developer`, any leftover mandatory-delegation wording contradicting the new Delegation policy, any surviving numeric score threshold, any surviving `~/.claude/skills` reference in Codex/OpenCode content.
4. **Dedupe that lost meaning**: deleted lines in `develop/SKILL.md` Step 4/5 whose semantic content is NOT actually preserved by Step 3 rules or by `src/common/AGENTS.md`. Check each deleted line individually.
5. **Tautologies, doubled clauses, grammar damage** introduced by mechanical edits.
6. **Table semantics**: rows whose cell placement or empty cells make the table misleading (check the new Mode Matrix in `develop`).
7. **Cross-file contradiction**: the same rule stated differently in core AGENTS.md vs a skill vs an agent file vs a reference file. Pay attention to `develop/references/quality-gate.md`, `hotfix/references/review-cycle.md`, `agents/code-auditor.md` versus the new word rule.
8. **Changelog honesty**: does `packages/spec/CHANGELOG.md` [0.16.0] accurately and completely describe user-visible behavior changes in these commits? List anything user-visible that is missing or overclaimed.
9. **Template quality**: `src/common/AGENTS.md`, `src/claude/CLAUDE.md`, `src/codex/AGENTS.md`, `src/opencode/AGENTS.md` — judge every sentence: is it project-specific fact a model could not infer from the repo, is it verifiable, is it unambiguous?

Record findings with file:line and a concrete fix suggestion each.

## Phase 2 — Behavioral verification (execute, do not assume)

Safety rules first:
- NEVER run `node packages/spec/bin/install.js` with the repo as CWD — a known pre-existing bug makes it write into the repo. Always `cd` into a `mktemp -d` directory first.
- If you find a stray `packages/spec/.claude/` or `packages/spec/.cafekit-backup/` directory afterwards, delete it (untracked, gitignored artifacts).
- Do not modify tracked files.

Run and report exact output for each:

```bash
REPO=$(git rev-parse --show-toplevel); INST=$REPO/packages/spec/bin/install.js

# 1. Full suite
cd $REPO/packages/spec && npm test           # expect: 229 passing

# 2. Fresh installs per platform — check shipped text, not source
d=$(mktemp -d); (cd $d && node $INST --yes --platform claude)
#    expect: AGENTS.md + CLAUDE.md exist; CLAUDE.md has @AGENTS.md; no Addressing section;
#    venv paths + skill-location rule present; grep finds zero 'packages/spec/src/' anywhere under $d

# 3. Language into the CORE block
d=$(mktemp -d); (cd $d && node $INST --yes --platform claude --lang vi)
#    expect: 'Always respond in **Vietnamese**' inside the CAFEKIT CORE block of AGENTS.md;
#    CLAUDE.md has NO language section of its own. Repeat for codex and opencode.

# 4. Combined install + rerun idempotence
d=$(mktemp -d); (cd $d && node $INST --yes --platform claude,codex,opencode --lang vi)
(cd $d && node $INST --yes --platform claude,codex,opencode)
#    expect: exactly one 'CAFEKIT CORE START', exactly one 'cafekit:lang', Vietnamese survives rerun

# 5. Hook silence on missing runtime config
t=$(mktemp -d); printf '{"session_id":"x","cwd":"%s"}' $t | node $REPO/packages/spec/src/claude/hooks/rules.cjs
#    expect: zero bytes, exit 0. Repeat for src/codex/hooks/rules.cjs.

# 6. Addressing preservation across reinstall
#    Install claude into a temp dir, manually append a '## Addressing (Context Overflow Indicator)'
#    section with a custom name inside the CAFEKIT CLAUDE block of CLAUDE.md, re-run the installer,
#    verify the custom name survives.
```

Also verify one thing the previous reviews did NOT: pick 3 deleted lines from `git show 925e094 -- packages/spec/src/claude/skills/develop/SKILL.md` and trace where (or whether) each deleted rule still exists in the shipped payload a user receives.

## Phase 3 — Compare against known findings

Only now read Appendix A. For each of your Phase 1 findings, mark it as overlapping a known defect or new. For each known defect you did NOT independently find, verify it is real by reading the cited location. Report both lists.

## Report format

1. Verdict per Phase 2 check: CONFIRMED / BROKEN, with command output.
2. Phase 1 findings ranked by severity, each with file:line + quoted text + suggested fix.
3. Overlap table: your findings vs Appendix A (found independently / confirmed on inspection / disputed — with reason).
4. The 3-deleted-lines trace result.
5. Final recommendation: mergeable as-is, mergeable after fixup commit (list exact items), or not mergeable.

Do not pad. If something is fine, one line saying so.

---

## Appendix A — Known defects from prior reviews (do NOT read before finishing Phase 1)

1. `develop/SKILL.md` (~L282, CWD Protocol): doubled clause — "will search for the root docs/ folder in the wrong place and will fail to locate the root docs/ folder". Should be a single clause.
2. `develop/SKILL.md` (~L193): leftover "If the **inspector** cannot identify..." — two sibling references were changed to "the scout", this one was missed; Light/Standard tiers scout in the main session.
3. `git/SKILL.md`: heading "## References (unchanged)" — "(unchanged)" is a plan annotation leaked into the shipped heading.
4. `git/SKILL.md`: parenthetical "(Word-boundary + assignment context: 'tokenizer' no longer false-positives.)" — rationale note addressed to a plan reviewer, shipped in model-facing text.
5. `develop/SKILL.md` Mode Matrix: the `--flash --parallel` row places its prose in the Scout column with the remaining columns empty — table shape is misleading.
6. `packages/spec/CHANGELOG.md` [0.16.0]: missing user-visible entries for (a) Addressing now opt-in + preserved across reinstalls, (b) `god-developer` → `implementer` rename (affects users who reference the agent by name); also says "prohibition on editing global `~/.claude/skills`" while Codex/OpenCode texts now say "a global skills directory".
