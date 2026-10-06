---
type: regex
target: last_message
---

(?<!(?:[Kk]hông|[Kk]hông nên|[Cc]hưa|[Đđ]ừng|[Nn]ot|[Dd]on't|[Nn]ever) )(?:[Cc]họn|[Kk]huyến nghị|[Đđ]ề xuất|[Nn]ên dùng|[Dd]ùng|[Cc]hốt|[Rr]ecommend(?:ation|ed|s)?|[Cc]hoose|[Pp]ick|[Gg]o with|[Uu]se|(?:[Kk]ết luận|[Ll]ựa chọn|[Qq]uyết định|[Vv]erdict|[Dd]ecision)(?:\*\*)?[ \t]*:)(?:\*\*)?(?:(?!thay vì|instead of|rather than|không|not |hay |or )[^\n]){0,40}?(?:(?<![A-Za-z0-9À-ỹ])A(?![A-Za-z0-9À-ỹ])|LRU)(?![^\n]{0,30}(?:không phù hợp|bị loại|loại bỏ|not suitable|rejected))
