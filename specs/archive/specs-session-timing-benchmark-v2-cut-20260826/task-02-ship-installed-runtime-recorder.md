# Task 02 — Ship and prove native Claude/Codex invocation without hooks

Status: blocked

## Outcome

The approved recorder is discoverable and executable from installed Claude and Codex Specs skill paths, with equivalent behavior and no automatic registration.

## Scope

- In: concise explicit invocation guidance, Codex projection inventory, packed Claude/Codex execution proof, and negative proof for hook/telemetry activation.
- Out: edits to hook registries, installer routing, B1 harness/schema, runtime kernels/parsers, global configuration, dashboards, and actual feature execution.

## Ownership

- Modify: `packages/spec/src/claude/skills/specs/SKILL.md`
- Modify: `packages/spec/bin/__tests__/codex-native.test.js`
- Modify: `packages/spec/bin/__tests__/package-inventory.test.js`
- Read: `packages/spec/bin/lib/context.js`
- Read: `packages/spec/bin/lib/codex-install.js`
- Read: `packages/spec/bin/phases/copy-payload.js`
- Read: `packages/spec/src/claude/settings/settings.json`
- Read: `packages/spec/src/codex/hooks.json`

## Acceptance

- AC-06: packed Claude and Codex installs contain the recorder at their documented native skill paths and the same approved event sequence produces equivalent output semantics in both disposable projects.
- AC-07: the installed script is inert before explicit invocation; neither installed hook registry contains its identifier; source and installed scripts satisfy the Q-07 no-network proof; B1 and kernel/parser source bytes remain unchanged.

## Blockers

- Task 01 must exist and pass its source proof.
- Q-01 must fix the canonical filename/grammar that documentation and installed probes invoke.
- Q-07 must fix the no-telemetry and proof-level contract. Live host reachability remains `UNKNOWN` unless explicitly required.

## Dependencies

- task-01-record-local-session-timing.md

## Verification Plan

- Command: `node --test packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/package-inventory.test.js`
- Named probes (to be created in the owned test files): `Codex Specs projection includes the explicit session timing recorder and native invocation`; `packed Claude and Codex installs run the explicit recorder with equivalent prompt transcript and secret free records`; `installed recorder remains inert and absent from hook registries until explicit invocation`.
- Reachability: `source` — canonical skill tree copied by `copyPlatformFiles` (`packages/spec/bin/phases/copy-payload.js:90`); `installed` — `.claude/skills/specs` and `.agents/skills/specs` from `packages/spec/bin/__tests__/package-inventory.test.js:72`; `live` — `UNKNOWN` unless Q-07 requires a real host session.
- Oracle: both installed Node commands exit with the approved output, produce schema-equivalent artifacts only after explicit invocation, and leave hook configuration and canonical package source SHA-256 values unchanged.
- Counterexample: the proof must fail if either runtime omits the script, Codex transforms executable bytes incompatibly, docs name a nonexistent path, install alone creates an artifact, a hook registry names the recorder, or installed behavior differs between Claude and Codex.
- Artifacts: `npm pack` tarballs, installed projects, recorder files, and destructive negative controls stay inside the package test's verified `mkdtemp` root; compare required source and hook bytes by SHA-256 before/after; remove the disposable root in `finally`.

## Receipt
