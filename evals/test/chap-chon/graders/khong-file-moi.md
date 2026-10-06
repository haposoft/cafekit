---
type: regex
target: files
match: not_contains
---

(?:^|\n)(?!(?:\./)?(?:\.git/[^\n]*|\.git|package\.json|src/?|src/greet\.js|test/?|test/greet\.test\.js)(?=\n|$))[^\n]
