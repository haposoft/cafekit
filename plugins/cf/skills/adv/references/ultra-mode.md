# Ultra mode (`--ultra`)

Best-of-5 for the advice. The interview and reframing run once; only the advice generation is fanned out, so the user is never interviewed five times. This is prompt orchestration with rubric selection, not a benchmarked algorithm; claim no numeric result from it. It pays off when the decision is load-bearing enough to justify five candidates plus a verifier; for routine questions the default path is better.

## Conflict with `--agent`

`--ultra` and `--agent` both own how the advice is produced. If both are passed, hard stop and name both flags (`--ultra`, `--agent`); never resolve it silently. `--ultra` composes with `--html`, `--md`, `--github`, and `--yagni`.

## Protocol

1. **One interview.** Run steps 1-4 of the skill (analyze, scout, one-question interview, preview and confirm the reframing) exactly once.
2. **Immutable evidence packet.** Assemble the original input, the scout findings and references, and the confirmed reframing (problem, requirements, goals, done means, non-goals, constraints, preview feedback folded in), plus the confirmed preview path when one exists and `--yagni` when set. Pass this identical packet to all five candidates.
3. **Five candidates, one wave.** Dispatch exactly five independent read-only `cf:brainstormer` candidates in a single parallel wave. Each generates the complete step-5 advice from the packet. They ask the user no questions and do not re-interview, because the answers are in the packet; they read no other candidate's output and write no files.
4. **Runtime gate.** If the runtime cannot run five read-only subagents in parallel, hard stop, tell the user `--ultra` is unsupported here, and name the missing capability. Never fall back to sequential runs, role-played candidates, or a single run.
5. **Five-usable gate.** A candidate is usable when it returned without a terminal error and its output is non-empty and shaped like the advice. All five must be usable. If any slot failed, re-dispatch only the failed slots exactly once. If fewer than five are usable after that, hard stop naming the failed slots and why; never proceed on a partial pool.
6. **Anonymize.** Strip author and order identity. Give the verifier an unordered set labelled Candidate A to E, with a random mapping only the controller keeps. Never pass a candidate's self-rating.
7. **Verify.** Dispatch a single `cf:strategist` as the verifier, told not to write any file. It scores each candidate 1-20 per criterion, ranks them, and either selects the winner or rejects all, with concise evidence-backed reasons. Run it on the strongest model tier the runtime offers; if per-agent tiers are unavailable, run candidates and verifier on the same tier and tell the user in one sentence that this run is same-tier best-of-5.
8. **Select or reject-all.** The controller emits the winning advice unchanged (never a blend) through step 6, with a short ranking appendix. If the verifier rejects all candidates, hard stop and report the ranking and why nothing was emitted; never fall back to the first candidate.

## Candidate task

The complete step-5 advice: needs from you (when any), verdict, do and don't, better alternatives, recommended path, benefits, trade-offs, unverified claims, and the work checklist, success metrics, and handoff brief, grounded in the confirmed reframing.

## Rubric (score each 1-20)

- **Reframing fidelity**: stays faithful to the confirmed requirements, goals, and non-goals.
- **Evidence**: grounded in scout and URL evidence rather than assertion.
- **Real trade-offs**: names real costs, no praise-padding.
- **Actionability**: the checklist, success metrics, and handoff brief are doable, with observable Done means and narrow stop conditions.
