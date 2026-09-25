---
type: regex
target: last_message
match: not_contains
---

(^|\n)[ \t]*(?:[-*][ \t]+)?(?:#{2,4}[ \t]*|\*\*)(?:Evidence Timeline|Timeline|Dòng thời gian|Elimination Path|Đường loại trừ|Recurrence[- ]Prevention|Phòng ngừa tái diễn)|(^|\n)[ \t]*#{2,4}[ \t]*(?:Phòng tái phát|Loại trừ)|\[(?:[Rr]efuted|REFUTED|[Ii]nconclusive|INCONCLUSIVE|[Bb]ác bỏ|[Cc]hưa kết luận)\]|\*\*(?:[Rr]efuted|REFUTED|[Ii]nconclusive|INCONCLUSIVE)\*\*|\*\*(?:Loại|Loại trừ|Loại bỏ|Bị loại|Đã loại|Đã loại trừ|Sai|Bác bỏ|Đã bác bỏ|[Rr]efuted|REFUTED|[Ii]nconclusive|INCONCLUSIVE):\*\*|[Gg]iả thuyết đã loại|[Bb]ị bác bỏ
