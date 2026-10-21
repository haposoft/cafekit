---
type: regex
target: { source: file, path: gh.log }
---

gh pr (?:view|checks)[^\n]*\n(?:[\s\S]*?\n)?gh pr merge(?=[^\n]* --auto(?![\w-]))(?=[^\n]* --match-head-commit[ =]a1b2c3d4e5f60718293a4b5c6d7e8f9012345678(?![\w]))[^\n]*\n(?:[\s\S]*?\n)?gh pr view[^\n]*state[^\n]*\n(?:[\s\S]*?\n)?gh run view 4242(?![\w])
