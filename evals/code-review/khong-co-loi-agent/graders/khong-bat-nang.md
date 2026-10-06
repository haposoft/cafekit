---
type: regex
target: last_message
---

^(?![\s\S]*(?:(?:^|\n)[ \t]*(?:[-*]|\d+\.)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High|Medium)\]?\**(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*[\w./-]+\.js(?::L?|#L)\d+|(?:^|\n)(?=[ \t]*\|)(?=[^\n]*\|[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\**\[?(?:Critical|High|Medium)\]?\**[ \t]*\|(?![ \t]*0[ \t]*(?:\||$)))[^\n]*[\w./-]+\.js(?::L?|#L)\d+|(?:^|\n)#{2,4}[^\n]*(?:Critical|High|Medium)[^\n]*(?:\n(?!#)[^\n]*)*?\n[ \t]*(?:[-*]|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*[\w./-]+\.js(?::L?|#L)\d+|(?:^|\n)[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\*\*(?:(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?\[?(?:Critical|High|Medium)\]?|[^\n*()]{0,40}\((?:(?:mức(?: độ)?|level|severity)[: \t]*)?(?:Critical|High|Medium)\))(?![ \t]*(?:[Ii]ssues)?\**:?\**[ \t]*0(?!\d))[^\n]*(?:\n(?![ \t]*(?:#|\*\*))[^\n]*)*?\n[ \t]*(?:-|\*(?!\*)|\d+\.)(?![ \t]*\**(?:[Kk]hông có|[Nn]one|N/A)(?![A-Za-z]))[^\n]*[\w./-]+\.js(?::L?|#L)\d+))
