---
type: regex
target: last_message
---

(?<!(?:[Kk]hông|[Kk]hông nên|[Cc]hưa|[Nn]ot|[Dd]on't|[Dd]o not) )(?<!(?:[Mm]ặc dù|[Dd]ù(?!ng)|[Aa]lthough|[Ee]ven though|[Dd]espite)[^\n,]{0,60})(?:[Cc]họn|[Kk]huyến nghị|[Đđ]ề xuất|[Nn]ên dùng|[Gg]iữ(?: nguyên)?|[Tt]iếp tục(?: dùng)?|[Dd]ùng|[Rr]ecommend(?:ation|ed|s)?|[Cc]hoose|[Pp]ick|[Kk]eep|[Ss]tay with|[Ss]tick with|[Uu]se|(?:[Kk]ết luận|[Ll]ựa chọn|[Đđ]áp án|[Vv]erdict|[Cc]onclusion)(?:\*\*)?[ \t]*:)(?:(?!Prisma|thay vì|instead of|rather than)[^\n]){0,60}Drizzle(?![^\n]*(?:nhưng|tuy nhiên|but|however)[^\n]{0,40}(?:nên|đề xuất|khuyến nghị|recommend|should)[^\n]{0,30}Prisma)|(?<!(?:[Mm]ặc dù|[Dd]ù(?!ng)|[Aa]lthough|[Ee]ven though|[Dd]espite)[^\n,]{0,60})Drizzle(?:(?!Prisma|không|chưa|not |n't)[^\n]){0,20}[ \t](?:là|is|remains)[ \t](?:(?!Prisma|không|chưa|not |n't)[^\n]){0,20}(?:lựa chọn|choice|option|phù hợp)(?![^\n]*(?:nhưng|tuy nhiên|but|however)[^\n]{0,40}(?:nên|đề xuất|khuyến nghị|recommend|should)[^\n]{0,30}Prisma)
