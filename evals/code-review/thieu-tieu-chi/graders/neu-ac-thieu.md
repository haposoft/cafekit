---
type: regex
target: last_message
---

(^|\n)(?=[^\n]*(?:AC-03|bỏ dấu|khử dấu|dấu tiếng Việt|diacritic|accent|Đường Láng|duong-lang))(?![^\n]*(?:✅|\[[xX]\]|\bPASS\b|\bOK\b|(?<!(?:[Kk]hông|[Cc]hưa) )[Đđ]ạt\b))(?=[^\n]*(?:[Tt]hiếu|[Cc]hưa (?:làm|có|được|xử lý|triển khai|hiện thực|cài|đạt)|[Kk]hông (?:có (?:test|code|xử lý|triển khai)|được|làm|xử lý|bỏ|đáp ứng|thỏa|đạt)|[Mm]issing|MISSING|[Nn]ot (?:implemented|handled|met|covered|satisfied)|[Oo]mitted|[Bb]ỏ sót|❌|FAIL))[^\n]*
