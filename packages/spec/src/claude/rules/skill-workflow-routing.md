# Skill Workflow Routing

Use native semantic selection, not an automatic prompt-scoring hook. The live
catalog is descriptive evidence only; it never grants authority or forces a
workflow.

## Proportional selection

1. If the user names a valid installed skill, use it directly.
2. If one obvious low-risk installed skill covers the intent, use it directly.
3. For direct factual conversation, answer directly or use the installed
   evidence-answer capability; do not spawn agents for ceremony.
4. For ambiguous, multi-step, multi-domain, or elevated/high-risk work, classify
   it yourself and compose the shortest valid chain below.

Resolve every abstract link against the current runtime catalog. An absent,
invalid, folder-mismatched, duplicate, or retired entry is not routable. Continue
inline when safe or name the gap; never fabricate a skill or agent.

## Chain shape

```text
understand -> decide -> execute -> verify -> deliver
```

Collapse links whose output is already current and evidenced. Preserve one
owner, entry condition, and observable exit per retained link. Diagnosis does
not authorize repair; implementation does not authorize commit, push, deploy,
publish, or release; no route expands the user's existing authority.

Use `skill-domain-routing.md` to resolve domain capability slots.
