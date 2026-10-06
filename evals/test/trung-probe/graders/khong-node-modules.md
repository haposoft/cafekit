---
type: regex
target: files
match: not_contains
---

(?:^|\n)(?:\./)?(?:[^\n]*/)?node_modules(?:/|(?=\n|$))
