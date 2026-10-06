---
type: regex
target: files
match: not_contains
---

(?:^|\n)(?!(?:\./)?(?:\.git/[^\n]*|\.git|README\.md|package\.json|src/?|src/config\.js|src/greet\.js|src/server\.js|test/?|test/greet\.test\.js)(?=\n|$))[^\n]
