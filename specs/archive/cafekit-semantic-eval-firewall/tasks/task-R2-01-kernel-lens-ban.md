# Task R2-01: Kernel lens and oracle ban
**Status:** pending

## Outcome

Add lens-registry and pattern-exact oracle ban, wire ban into validate-spec-output unconditionally for Compact/Full, prove entrypoint invocation with integration/mutation tests, and keep a single canonical owner-write anchor for validate-spec-output.

## Scope

- **In scope:** lens-registry, oracle-hardcode-ban, design-principles note, ban unit + entrypoint wire semantic-firewall tests, validate-spec-output unconditional require (sequential handoff after R1-01's C2/C13 cutover, per the dependency boundary on this exact file), validator-grounding extensions (sequential handoff after R0-01's own edits). R2-01 lands only after R1-02 and after loading C10 proves post-cutover `bootstrapBaseline` generation 0 bound to the seed PASS; task dependencies alone never authorize its protected writes, which require `authorized_evolution` bound to the latest accepted PASS.
- **Out of scope:** Optional ban wiring, IR dual-run, public-pool ownership, duplicate consumer anchors for validate-spec-output.

## Anchors and Ownership

| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-R2-01-01 | file | `packages/spec/src/claude/scripts/lens-registry.cjs` | owner | write | create |
| A-R2-01-02 | file | `packages/spec/src/claude/scripts/oracle-hardcode-ban.cjs` | owner | write | create |
| A-R2-01-03 | file | `packages/spec/src/claude/skills/specs/rules/design-principles.md` | owner | write | modify |
| A-R2-01-04 | file | `packages/spec/bin/__tests__/oracle-hardcode-ban.semantic-firewall.test.js` | owner | write | create |
| A-R2-01-05 | file | `packages/spec/bin/__tests__/oracle-ban-entrypoint-wire.semantic-firewall.test.js` | owner | write | create |
| A-R2-01-06 | file | `packages/spec/bin/__tests__/validator-grounding.test.js` | owner | write | modify |
| A-R2-01-07 | file | `packages/spec/src/claude/scripts/validate-spec-output.cjs` | owner | write | modify |
| A-R2-01-08 | file | `packages/spec/src/claude/scripts/change-firewall.cjs` | consumer | read | read |
| A-R2-01-09 | file | `packages/spec/src/claude/skills/specs/templates/spec-state.json` | consumer | read | read |
| A-R2-01-10 | file | `packages/spec/bin/__tests__/validator-grounding.test.js` | consumer | read | read |
| A-R2-01-11 | file | `packages/spec/src/claude/scripts/validate-spec-output.cjs` | consumer | read | read |
| A-R2-01-12 | file | `packages/spec/src/claude/scripts/spec-readiness.cjs` | consumer | read | read |
| A-R2-01-13 | file | `packages/spec/reports/bootstrap-activation.json` | consumer | read | read |

## Changes

- [ ] Keep kernel primitives domain-neutral without product answers as required behavior. _Requirements: 2.1_
- [ ] Reject lens packs that encode expected product oracle values. _Requirements: 2.2_
- [ ] Fail closed only on the three R2.3 machine patterns with generic seeded fixtures and prose negative control. _Requirements: 2.3_
- [ ] Import and invoke ban from validate-spec-output unconditionally for Compact/Full. _Requirements: 2.4_
- [ ] Own integration/mutation test proving real entrypoint calls ban. _Requirements: 2.5_

## Acceptance

- **R2.1:** Neutral kernel primitives without product answers as required behavior.
- **R2.2:** Question-only lenses reject product oracle packs.
- **R2.3:** Pattern-exact ban with generic fixtures and prose negative control.
- **R2.4:** Unconditional validate-spec-output ban wire for Compact/Full.
- **R2.5:** Entrypoint integration/mutation proof of ban invocation.

## Dependencies

- tasks/task-R0-01-change-firewall-choke.md
- tasks/task-R1-01-review-receipt-schema.md
- tasks/task-R1-02-finalizer-pass-gate.md
- tasks/task-R1-03-bootstrap-activation.md

## Verification Plan

- **Verification ref:** V4
- **Task role:** subject
- **Command:** `node packages/spec/scripts/run-skill-self-tests.mjs --require-semantic-test oracle-hardcode-ban.semantic-firewall.test.js --require-semantic-test oracle-ban-entrypoint-wire.semantic-firewall.test.js`
- **Expected:** Exit 0; instrumented call-count greater than zero; basenames required.
- **Negative path:** Module exists without validate require fails R2.4/R2.5.
- **Reachability:** `packages/spec/src/claude/scripts/validate-spec-output.cjs`
