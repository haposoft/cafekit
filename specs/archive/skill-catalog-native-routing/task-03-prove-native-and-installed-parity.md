# Task 03 — Prove native and installed parity

Status: done

## Outcome
Automated installation tests prove equivalent Claude/Codex instruction and projection semantics across core-only, document-enabled, divergent combined-runtime, and upgrade installations; live-model adherence remains `UNPROVEN`.

## Scope
- In: source checker; semantic mutations; Claude/Codex projection; optional inventory and packaging reachability.
- Out: live-model adherence, network installs, release, or timing benchmarks.

## Coverage
- CP-01
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/migration-manifest.json`
- Modify: `packages/spec/bin/__tests__/codex-native.test.js`
- Modify: `packages/spec/bin/__tests__/package-inventory.test.js`
- Modify: `packages/spec/bin/__tests__/optional-skill-inventory.test.js`

## Acceptance
- AC-01: negative fixtures reject over-routing of explicit, trivial, and factual prompts.
- AC-02: mutations reject missing classification, chain, agent-timing, and risk gates.
- AC-03: installed projections never invoke missing skills or agents.
- AC-04: core-only and document-enabled fixtures differ only with their live catalogs.
- AC-05: native and packed installs preserve router files, references, rules, and behavior.
- AC-03: installed fixtures remove an agent per runtime and prove controller/native fallback or an explicit gap, never synthetic delegation.
- AC-07: installed mutations reject authority escalation.

## Dependencies
- task-01-author-native-router-contract.md
- task-02-integrate-live-catalog-and-rules.md

## Verification Plan
- Command: `npm --prefix packages/spec test`
- Named probe: `Claude and Codex installed Route preserve proportional live-catalog semantics`; `combined installs bind each catalog to its native runtime inventory`; `packed core-only installs reject optional capability routing`; `packed Route rejects semantic routing weakenings`; `installed Route degrades safely when an agent is absent`
- Reachability: package tests install the manifest-declared Route payload into disposable `.claude`, `.agents`, and `.codex` roots, run each installed catalog scanner, and trace Claude/Codex instruction entrypoints to installed router/rules.
- Oracle: every named probe executes nonzero cases and exits 0; each mutation produces its exact owning issue set.
- Counterexample: Codex loses a reference or reads Claude inventory; Claude hard-codes Docs; packed upgrade auto-routes a modified retired skill; malformed/duplicate catalog entries route; one installed agent disappears; shared expected text lets source and projection drift; high-risk routing loses review or adds push/deploy authority.
- Artifacts: disposable install roots with verified cleanup; no network or live-model artifact.

## Receipt

Verification: PASS
Command: npm --prefix packages/spec test
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a

```text
✔ Claude and Codex installed Route preserve proportional live-catalog semantics
✔ combined installs bind each catalog to its native runtime inventory
✔ installed Route degrades safely when an agent is absent
✔ packed core-only installs reject optional capability routing
✔ packed Route rejects semantic routing weakenings
[skill-test] PASS: 1167 tests executed; 1166 passed, 0 failed, 1 opt-in live-host skip
```
