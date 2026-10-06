---
type: regex
target: last_message
---

^(?![\s\S]*(?:(?:^|\n)[ \t]*(?:[-*]|\d+\.)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High)\]?\**(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:(?:src/)?checkout\.js|console\.log)|(?:^|\n)(?=[ \t]*\|)(?=[^\n]*\|[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**\[?(?:Critical|High)\]?\**[ \t]*\|(?![ \t]*0[ \t]*(?:\||$)))[^\n]*(?:(?:src/)?checkout\.js|console\.log)|(?:^|\n)#{2,4}[^\n]*(?:Critical|High)[^\n]*(?:\n(?!#)[^\n]*)*?\n[ \t]*(?:[-*]|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*(?:(?:src/)?checkout\.js|console\.log)|(?:^|\n)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\*\*(?:(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High)\]?|[^\n*()]{0,40}\((?:(?:mức(?: độ)?|level|severity)[: \t]*)?(?:Critical|High)\))(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:(?:(?:src/)?checkout\.js|console\.log)|(?:\n(?![ \t]*(?:#|\*\*))[^\n]*)*?\n[ \t]*(?:-|\*(?!\*)|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*(?:(?:src/)?checkout\.js|console\.log))))
