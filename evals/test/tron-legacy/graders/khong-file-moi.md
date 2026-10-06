---
type: regex
target: files
match: not_contains
---

(?:^|\n)(?!(?:\./)?(?:\.git/[^\n]*|\.git|\.claude/?|\.claude/scripts/?|\.claude/scripts/provenance\.cjs|package\.json|specs/?|specs/doi-loi-chao/?|specs/doi-loi-chao/plan\.md|specs/doi-loi-chao/task-01-doi-loi-chao\.md|src/?|src/greet\.js|test/?|test/greet\.test\.js|specs/doi-loi-chao/spec\.json)(?=\n|$))[^\n]
