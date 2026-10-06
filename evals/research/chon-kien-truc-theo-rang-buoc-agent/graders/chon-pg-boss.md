---
type: regex
target: last_message
---

(?<!(?:[Kk]hông|[Kk]hông nên|[Cc]hưa|[Nn]ot|[Dd]on't|[Dd]o not) )(?<!(?:[Mm]ặc dù|[Dd]ù(?!ng)|[Aa]lthough|[Ee]ven though|[Dd]espite)[^\n,]{0,60})(?:[Cc]họn|[Kk]huyến nghị|[Đđ]ề xuất|[Nn]ên dùng|[Dd]ùng|[Rr]ecommend(?:ation|ed|s)?|[Cc]hoose|[Pp]ick|[Uu]se|[Gg]o with|(?:[Kk]ết luận|[Ll]ựa chọn|[Đđ]áp án|[Vv]erdict|[Cc]onclusion)(?:\*\*)?[ \t]*:)(?:(?!BullMQ|thay vì|instead of|rather than)[^\n]){0,60}pg-boss(?![^\n]*(?:nhưng|tuy nhiên|but|however)[^\n]{0,40}(?:nên|đề xuất|khuyến nghị|recommend|should)[^\n]{0,30}BullMQ)|(?<!(?:[Mm]ặc dù|[Dd]ù(?!ng)|[Aa]lthough|[Ee]ven though|[Dd]espite)[^\n,]{0,60})pg-boss(?:(?!BullMQ|không|chưa|not |n't)[^\n]){0,20}[ \t](?:là|is|remains)[ \t](?:(?!BullMQ|không|chưa|not |n't)[^\n]){0,20}(?:lựa chọn|choice|option|phù hợp)(?![^\n]*(?:nhưng|tuy nhiên|but|however)[^\n]{0,40}(?:nên|đề xuất|khuyến nghị|recommend|should)[^\n]{0,30}BullMQ)
