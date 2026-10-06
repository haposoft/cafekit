---
name: cf:research
description: "Research technical decisions with proportional depth, traceable evidence, explicit uncertainty, and project-fit recommendations."
user-invocable: true
when_to_use: "Use for external technical facts, architecture comparisons, or decisions whose uncertainty needs multi-source evidence."
category: research
keywords: [research, evidence, evaluation, architecture, comparison]
argument-hint: "<topic_or_decision>"
metadata:
  author: haposoft
  version: "3.0.0"
---
# Research — proportional evidence for a decision

Return a decision-ready answer, not a search diary or an unsorted option list.
Research evaluates choices; it does not implement them or invent certainty.

## 1. Frame the decision

Restate the decision, project constraints, affected consumers, and what evidence
would change the answer. Inspect current repository sources first whenever local
fit matters. Ask the user only when a missing choice materially changes scope or
safety; otherwise label bounded assumptions and continue.

## 2. Select depth

Choose the smallest depth that can support the decision:

| Depth | Route when | Evidence work |
|---|---|---|
| Quick | One low-risk, reversible fact or known option | Resolve the fact from one authoritative source; add a repository anchor when project fit matters. |
| Standard | Several viable options or a material integration choice | Verify material claims across at least two independent authoritative sources where available; compare fit and tradeoffs. |
| Deep | High blast radius, hard-to-reverse architecture, security/compliance, substantial cost, or conflicting evidence | Complete Standard, then run a separate contradiction-and-gap round; use at least three independent sources for disputed material claims where available. |

Escalate depth when evidence conflicts, a primary source is missing, or a finding
changes the decision boundary. Do not inflate source counts with mirrors or
articles that repeat the same upstream claim. Stop when new evidence no longer
changes the ranking, limitations, or unresolved gaps.

## 3. Gather evidence

- Repository claims: cite a resolvable `path:line` anchor from current bytes.
- External claims: prefer current official documentation, standards, research
  papers, maintainer material, and release notes. Browse when facts may have
  changed; record the source date or applicable version.
- For each material claim record: claim, URL or repository anchor, authority,
  date/version, applicability to this project, and status
  `confirmed | inferred | unresolved`.
- A source count is not confidence. Explain conflicts, missing primary evidence,
  version mismatch, and why a source does or does not apply.

Use delegated researchers only as optional acceleration when two or more
independent evidence tracks can be bounded. The controller owns the question,
source reconciliation, and final recommendation. If delegation is unavailable,
unauthorized, or not useful, research sequentially with the same evidence bar.
When a researcher's report feeds the answer, keep its `Depth:` line, its status labels and its `path:line` anchors, reconciled with your own evidence.

## 4. Synthesize

For comparisons, rank only viable options and name a winner when evidence and
project fit support one. For every ranked option include fit, decisive evidence,
tradeoffs, adoption/operational risks, and limitations. If evidence cannot choose
a winner, return `unresolved` plus the smallest fact or experiment that would.

Use the four mandatory H2 sections from
`.claude/skills/specs/templates/research.md`. Keep claim records and comparisons
inside `## Evidence Summary`; do not add or reorder mandatory H2 headings.

## 5. Output and persistence

Default to a concise answer in chat. Persist only when:

1. one explicitly resolved active Spec requires durable `research.md`; save to
   that exact `specs/<feature>/research.md`, preserving its existing lifecycle; or
2. the user explicitly requests a durable report and approves its destination.

Do not create a Spec or `_shared` archive merely to save an answer. The
controller performs any authorized write after reviewing and redacting the
output; delegated researchers never write reports or task state. Always state
depth used, decisive evidence, recommendation, limitations, and unresolved gaps.
Give every material claim in the answer its status in parentheses — `(confirmed)`, `(inferred)` or `(unresolved)` — in English whatever the answer's language.

## Handoff boundary

Research may recommend Brainstorm or Specs when a material product/design choice
remains. It never starts Develop, edits implementation code, claims user approval,
or presents source/installed evidence as live-system proof.
