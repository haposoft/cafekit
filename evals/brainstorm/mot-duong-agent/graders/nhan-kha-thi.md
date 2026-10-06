---
type: regex
target: last_message
---

(?:[Ff]easibility|[Kk]hả thi)[^\n]{0,30}?(?<![A-Za-z])(?:confirmed|plausible|unknown|infeasible)(?![A-Za-z])|(?<![A-Za-z])(?:confirmed|plausible|unknown|infeasible)(?![A-Za-z])[^\n]{0,15}?[Ff]easibility|(?:^|\n)\|[^\n]*[Ff]easibility[^\n]*\n(?:\|[^\n]*\n)*?\|[^\n]*(?<![A-Za-z])(?:confirmed|plausible|unknown|infeasible)(?![A-Za-z])|(?<![A-Za-z])(?:confirmed|plausible|unknown|infeasible)`?[ \t]*\/[ \t]*`?(?:high|medium|low)(?![A-Za-z-])
