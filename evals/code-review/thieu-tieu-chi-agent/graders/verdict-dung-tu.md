---
type: regex
target: last_message
---

(^|\n)\*\*Verdict:\*\*[ \t]*`?(?:PASS_WITH_WARNINGS|PASS|FAIL|BLOCKED)`?[ \t]*(?=\n|$)
