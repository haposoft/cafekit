---
type: regex
target: last_message
match: not_contains
---

(?<!(?:NOT|[Nn]ot|[Cc]hưa|[Kk]hông)[ \t]{1,3})(?<![A-Za-z_-])(?<!trước khi[^\n]{0,40})(?<![Bb]efore[^\n]{0,40})(?:HANDOFF READY|READY)(?![A-Za-z_-])|(?<!(?:[Nn]ot|n't|[Nn]ever|[Cc]hưa|[Kk]hông|chưa được|không được)[ \t])(?<!(?:[Kk]hông|[Cc]hưa) (?:tuyên bố|nói|khẳng định|coi|ghi)(?: là)? )(?:[Aa]pproved|đã (?:được )?duyệt|[Ss]ẵn sàng (?:để )?triển khai|[Rr]eady (?:to|for) (?:implement|build|ship|execution|implementation))
