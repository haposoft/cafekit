# Provenance Ledger

Ledger for borrowed workflow patterns. Every claim must be verifiable inside the repository
or explicitly marked as external survey / not used.

## Reuse taxonomy

| Reuse type | Meaning | Text copied? | Verification needed |
|---|---|---|---|
| `idea` | Conceptual inspiration or survey — no code/text copied, phrasing re-written from description | No | Local anchor: `plans/` survey file or `docs/` note that records the observation |
| `clean-room` | Implemented from a functional description after survey, without looking at source text at implementation time | No | Local source anchor: the `plans/` spec + destination file + contract test that proves behavior |
| `copied-text` | Verbatim or near-verbatim reuse of external source text | Yes | **Never valid** — must not be used |

`copied-text` is never valid. No `AGENT.md`/`SKILL.md` shipped text is copied from an external kit.

## Ledger rule

- Before implementation, add a ledger row: pattern → source anchor → reuse type → destination → evidence/status. Implementation must not start before the row exists.
- Source anchor must be a path inside this repo (`plans/`, `packages/spec/src/`, `docs/`) plus section/commit, or be marked `external survey — no repo artifact` with a local `plans/` mirror of the observation.
- Do not claim `AgentKit T1–T9`, `cafekit-ref used`, or any external kit as an implementation source without a committed artifact and verification. Survey notes in `plans/` are inspiration, not implementation proof.
- Adapt patterns at behavior level only; never copy source text verbatim. Update this ledger when evidence changes.

## Current ledger

| Pattern | Source anchor | Reuse type | CafeKit destination | Evidence/status |
|---|---|---|---|---|
| Parallel-wave evidence and retention protocol | `plans/20260806-fixup-and-postmerge-plan.md` §B5; local design `packages/spec/src/claude/skills/develop/references/parallel-waves.md` | `clean-room` | `packages/spec/src/claude/skills/develop/references/parallel-waves.md` | Implemented from local B5 requirements (receipt fields, immutable `base_sha`/`head_sha` diff ranges, retention, conflict graph, failure classification, integration gates). Verified by `develop-contract.test.js` → `parallel waves require immutable provenance receipts and safe recovery`. |
| External workflow survey (AgentKit / `cafekit-ref` T1–T9 techniques, e.g., delegation conditioning) | `plans/20260805-instructions-semantic-review.md` §5.1 (survey of external path `~/Desktop/cafekit-ref/.claude`, **not committed**); synthesis `plans/20260805-instructions-editorial-implementation.md` | `idea` | None in shipped runtime — survey retained in `plans/` only; no external source text used in `packages/spec/src/` | External directory `~/Desktop/cafekit-ref` is not in repo and is not a source anchor. No verbatim `cafekit-ref` text exists in shipped payload — verify: `grep -r "cafekit-ref" packages/spec/src` returns 0 hits in runtime sources (only this ledger and `plans/` survey). Reuse is inspiration-level only. |
| Direct AgentKit or `cafekit-ref` source text | No repo artifact — external source not committed or used | `idea` (none) | None | **No borrowed text recorded.** Verified by `package-inventory` + `grep` inventory that no shipped file under `.claude`/`.codex`/`.opencode` contains external kit verbatim text. Status: **unsupported claim — not used, no verification possible, explicitly marked not used.** |

## Verification note

- `grep -r "cafekit-ref" packages/spec/src` — must return no shipped runtime hits (only docs/plans).
- `grep -r "AgentKit" packages/spec/src` — must return no shipped runtime hits; mentions allowed only in this ledger and `plans/` surveys.
- Any future `idea`-only survey that is not turned into a `clean-room` implementation keeps `CafeKit destination = None` and `Evidence/status = survey only`.

## How to verify

```bash
grep -rn "cafekit-ref" packages/spec/src --include="*.md" --include="*.cjs" --include="*.ts"
grep -rn "AgentKit" packages/spec/src --include="*.md" --include="*.cjs" --include="*.ts"
pnpm --filter @haposoft/cafekit test  # includes provenance contract checks
```
