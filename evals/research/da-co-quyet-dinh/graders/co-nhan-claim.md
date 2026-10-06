---
type: regex
target: last_message
---

(?:[(\[|:\x60*]|—|–|(?:^|\n)[ \t]*[-*][ \t])[ \t]*(?:[Cc]onfirmed|[Ii]nferred|[Uu]nresolved(?!(?:\*\*)?[ \t]*:[ \t]*(?:\*\*)?[ \t]*(?:[Nn]one|[Kk]hông|N\/A|n\/a|—|–|\n|$)|\*\*[ \t]*(?:\n|$)))\b(?![ \t]+(?:gaps?|questions?|issues?|items?|points?))
