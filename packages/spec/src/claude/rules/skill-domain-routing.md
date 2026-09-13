# Skill Domain Routing

This rule is advisory model guidance, not an automatic prompt hook. Generate the
current runtime catalog first when capability presence is uncertain, then read
the selected skill's `SKILL.md` before acting.

Resolve a capability slot from catalog `description`, `when_to_use`, `category`,
and `keywords`; examples below are intent hints, not a copied installed inventory.

| Capability slot | Matching intent |
|---|---|
| evidence answer | factual question requiring source/docs/spec/config/current evidence |
| repository discovery | files, entrypoints, call path, structure, blast radius |
| product or architecture decision | unresolved outcome, scope, or material trade-off |
| technical research | external comparison, conflicting evidence, current best practice |
| specification | concrete substantial work needing durable plan/tasks |
| implementation or repair | authorized code/content change or cause-aligned fix |
| diagnosis | bug, failure, CI, incident, regression, or unexpected behavior |
| verification or review | test execution, independent correctness/security review |
| browser evidence | page interaction, snapshots, network, performance, or accessibility |
| terminal/pane control in the surrounding agent host | reading, waiting on, or sending to another agent pane, or spawning an agent into a host-managed worktree |
| repository delivery | explicitly authorized commit, push, or branch operation |
| document/artifact work | use only a matching installed optional capability |

Choose one primary capability per intent. Add a secondary only when its output is
an entry condition for the primary. If zero valid capabilities match, continue
inline when safe or name the gap. If multiple catalog entries expose the same
public identity, do not auto-route; require explicit user disambiguation.

Never infer an optional document capability from this rule. Never select the
explicit-only numeric optimization capability unless the user invokes it with
its required bounded metric/guard contract.
