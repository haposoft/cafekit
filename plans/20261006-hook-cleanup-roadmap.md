# Hook cleanup roadmap (three packets, one at a time)

Source: the 2026-10-06 review of CafeKit's Claude Code hooks (17 hooks on 20 registrations across 9 events; installed `.claude/settings.json` equals `packages/spec/src/claude/settings/settings.json`). GATE-SCOPE was taken once for all three on 2026-10-06; each packet closes GATE-DONE before the next opens (two open process-first packets make `spec-gate` block).

| Packet | Outcome | User decision | Status |
|---|---|---|---|
| 1 `specs/remove-usage-hook` | `usage.cjs` gone from every runtime; statusline quota only from the payload `rate_limits` | KEEP; remove the hook and both cache readers; old Claude Code without `rate_limits` loses the quota segment | planned |
| 2 (not opened) | Quieter hooks: `spec-state` reports only packets this session touched (session ↔ packet record by `session_id`); `docs-sync` leaves SessionStart (drift check stays in the `docs` skill); `state` prints its SessionStart block only when it has content | KEEP | waiting for packet 1 GATE-DONE |
| 3 (not opened) | Remove the three `spec.json`-only hooks: `task-scaffold-guard`, `semantic-review-authority`, `completion-authority` (+ `-check`, `-state`) from Claude, Codex and omp, with upgrade pruning | **Remove** (not conditional registration). This reverses the CLAUDE.md "keep legacy adapters" rule: a project that still has `specs/*/spec.json` loses automatic legacy closeout gating. Packet 3 must update the CLAUDE.md/AGENTS.md legacy wording and the 28 files that reference `completion-authority`. | waiting for packet 2 GATE-DONE |

Observed but out of all three packets: `spec-gate` takes about 8.6 s per Stop in this repository (one sample); `src/claude/hooks/lib/context.cjs` is shipped but required by no hook.
