---
type: regex
target: last_message
---

^(?:(?!(?:^|\n)[ \t]*(?:#+[ \t]*|>[ \t]*|-[ \t]*)?(?:\*\*)?(?:[Aa]nswer|[Tt]rả lời|[Cc]âu trả lời|[Kk]ết luận|[Ee]vidence|[Bb]ằng chứng|[Cc]onfidence|[Đđ]ộ tin cậy|[Mm]ức độ tin cậy))[\s\S])*?(?:^|\n)(?![ \t]*[#>])(?![ \t]*(?:#+[ \t]*|>[ \t]*|-[ \t]*)?(?:\*\*)?(?:[Aa]nswer|[Tt]rả lời|[Cc]âu trả lời|[Kk]ết luận|[Ee]vidence|[Bb]ằng chứng|[Cc]onfidence|[Đđ]ộ tin cậy|[Mm]ức độ tin cậy))[^\n]*\?[*_ \t]*(?:\([^\n]*\)[*_ \t]*)?(?=\n|$)
