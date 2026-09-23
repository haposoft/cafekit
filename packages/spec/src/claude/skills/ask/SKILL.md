---
name: cf:ask
description: "Answer questions with evidence. Use when the user asks about project behavior, source code, specs, docs, configuration, dependencies, or external technical information; inspect the repo first, use internet/current docs when repo evidence is insufficient, and ask back only when the question cannot be answered safely."
user-invocable: true
when_to_use: "Invoke to answer project or technical questions with repo-first evidence."
category: utilities
keywords: [ask, question, evidence, answer, research]
argument-hint: "<question> [--repo|--web|--both|--brief|--deep]"
metadata:
  author: haposoft
  version: "1.0.0"
---
# Ask Skill

`cf:ask` is an evidence-backed question-answering skill. It answers user questions by checking the local project first, then external/current sources when the repository cannot answer the question.

## Core Stance

- Answer the question; do not turn every question into a spec or planning session.
- Source-first: prefer README, docs, specs, code, config, tests, logs, and package metadata before assumptions.
- Use external/current sources when the local repo is missing the answer, the topic is version-sensitive, or the user asks about outside tools, libraries, APIs, laws, pricing, or best practices.
- Ask back only when the question is too broad, has no target, needs credentials/private context, or any answer would be misleading.
- Do not edit files, implement code, create specs, or change project state.

<ANSWER-ONLY-GATE>
Do NOT implement, scaffold, refactor, modify files, generate full specs, or make final architecture decisions.
The output is an answer, evidence, confidence, and a follow-up only when needed.
</ANSWER-ONLY-GATE>

## When To Use

Use `cf:ask` when the user asks:
- "What does X do in this system?"
- "Where is this flow handled?"
- "What is the current config/version/package?"
- "Does it use a particular library/technology/approach?"
- "Does this requirement/spec match the code?"
- "How should I use this tool/library/framework?"
- "What does best practice or the current docs say?"
- "How should I understand this part?"

Do not use it when:
- The user asks to implement, fix, debug, test, commit, or publish.
- The user wants ideation/tradeoff exploration; use `cf:brainstorm`.
- The user wants a formal spec; use `cf:specs`.
- The user wants full legacy documentation reconstruction: use
  `cf:docs --reconstruct` when the optional document bundle is installed;
  otherwise use `cf:scout` plus source evidence, or explain how to install the
  bundle with `npx @haposoft/cafekit --with-document-skills`.
- The user wants root-cause diagnosis for a failure; use `cf:debug`.

## Modes

- Default: repo-first answer. Use external sources only if local evidence is insufficient.
- `--repo`: answer from local source only. If not enough evidence, say so and do not use web.
- `--web`: answer from external/current sources. Still read local context if the question mentions this project.
- `--both`: explicitly combine local source evidence and external/current evidence.
- `--brief`: short answer, minimal evidence.
- `--deep`: broader evidence scan, include trace and tradeoffs.

If modes conflict, prefer the most explicit source mode in this order: `--both`, `--repo`, `--web`, then default. Apply `--brief` or `--deep` as output depth modifiers.

## Workflow

### 1. Classify The Question

Pick one primary answer type:

```text
source-code behavior | config/version | spec/docs consistency | dependency/library | workflow/process | external/current knowledge | unclear
```

If `unclear`, ask one focused follow-up with the minimum choices needed.

### 2. Gather Evidence

Repo evidence priority:
1. `README.md`, `AGENTS.md`, `CLAUDE.md`
2. relevant `docs/`, `specs/`, `.claude/`
3. source files, tests, scripts, package manifests, config files
4. git history only when the question asks about changes or provenance

Use focused search (`rg`, targeted file reads) instead of broad scans. Use `cf:scout` when the user asks where something lives or the source surface is unclear.

External evidence:
- Use external/current docs when repo evidence is absent, stale, or not authoritative.
- Prefer official docs, standards, source repositories, or primary vendor docs.
- State clearly when an answer is inferred from external docs rather than confirmed in the repo.

### 3. Decide Whether To Answer Or Ask Back

Answer directly when at least one of these is true:
- repo evidence answers the question,
- external/current evidence answers the non-project part,
- a cautious answer can separate known facts from inference.

Ask back when:
- the target system/module is not named and multiple targets are plausible,
- the needed file/source is blocked or private,
- the question requires business/domain judgment not present in source,
- the answer would require guessing customer intent,
- the question bundles multiple unrelated topics.

Ask only one follow-up question. Include 2-3 concrete options if helpful.

### 4. Output Contract

Default output:

```markdown
**Answer**
...

**Evidence**
- `path/to/file`: what it proves
- External: source name/link, what it proves

**Confidence**
high | medium | low

**Gaps**
- ...

**Next**
...
```

Use `templates/question.md` when the user asks to save or document the answer.

## Answer Style

- Lead with the answer, not the research process.
- Use file paths and line references when local evidence is used.
- Separate "confirmed by source" from "inferred".
- Keep the answer proportional: concise for simple questions, structured for complex ones.
- If external sources were used, include source links or names.
- If no evidence exists, say "no evidence found in the current source" and explain what was checked.

## Examples

### Source Question

```text
/cf:ask "In this system, which file does cafekit use to toggle skill routing?"
```

Expected behavior:
- read runtime/config/install files,
- answer with exact config file and relevant keys,
- say whether it is runtime-driven or hard-coded.

### Mixed Source + Web Question

```text
/cf:ask "Which React version does this project use, and does that version still match current best practice?" --both
```

Expected behavior:
- read `package.json` or lockfile,
- check current React docs/release info if needed,
- separate local version from external recommendation.

### Ask Back

```text
/cf:ask "Is this system stable?"
```

Expected behavior:
- ask one narrowing question because "stable" could mean architecture, security, performance, UX, tests, or deploy readiness.
