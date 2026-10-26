# Conditional skill integration: research, debug, test, docs

These four join the pipeline only when their predicate holds. Evaluate the predicate deterministically, never by asking the user; when it is 50/50, skip and record why. Never run a step for ceremony.

## Research (`cf-research`): technology present

- Trigger: the request or issue names a library, framework, plugin, SDK, API, protocol, service, or pinned version whose current behaviour the work depends on.
- Skip: a change internal to this repo with no external dependency surface, or technology already settled in this codebase.
- Action: before planning, run `cf-research` on the topics. Feed the summary into `cf-specs` and the issue body. Do not forward `--ultra` or `--advice`.

## Debug (`cf-debug`): bugfix route

- Trigger: the request is a bug, regression, broken behaviour, failing test or CI, incident, error log, or says fix or repair.
- Skip: a net-new feature or enhancement with no defect to diagnose.
- Action: run `cf-debug` with the error and evidence to prove the root cause (repro command, logs, call path), with no guessing and no symptom patching. Carry the cause into `cf-specs` and `cf-fix`. Diagnosis does not authorize the repair; the code change stays with `cf-fix`.

## Test (`cf-test`): coverage that earns its place

- Trigger: the change adds or alters observable behaviour, boundaries, invariants, transitions, precedence, or real error paths that a plausible bug could break and existing coverage would miss.
- Skip: a trivial change, no observable contract, or `cf-develop` / `cf-fix` already left honest coverage. Do not add tests just so the change has tests.
- Anti-cheat: no pass-only, tautological, or implementation-echoing tests. Each test must fail on a plausible bug and assert behaviour a consumer sees.

## Docs (`docs_keeper` agent): documentation impact

- Trigger: the change alters a public contract, user-facing behaviour, usage, configuration, or an operating workflow that documentation reflects.
- Skip: a change invisible to docs readers, such as an internal refactor.
- Action: delegate to the `docs_keeper` agent for the existing docs only, with the diff and plan as input. When the docs live in another repository, do not edit them and never open or link an issue there; record the follow-up only under Human Next Steps in the completion report.
- Record the docs impact (reason and disposition) in the PR and the completion report.

## Resolving the target branch

- Beta: the integration branch is the GitHub default branch, `gh repo view --json defaultBranchRef`.
- Stable: the release branch is the one `origin/HEAD` points to, `git symbolic-ref refs/remotes/origin/HEAD`. When it equals the default branch, beta and stable coincide: say so in the report and run one stage.
- Run `git fetch origin <target>` before creating the worktree so `origin/<target>` is current.
