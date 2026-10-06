---
type: regex
target: last_message
---

(?<!(?:[Cc]hưa|[Kk]hông|[Kk]hông nên|[Cc]hưa nên|[Kk]hông cần|[Cc]hưa cần|[Đđ]ừng|[Hh]ề|[Kk]hông tạo hay|[Đđ]ã|[Cc]hỉnh|[Nn]ot|n't|[Nn]ever) )(?:[Cc]ập nhật(?![ \t]+(?:ngày[ \t]+\d|\d{4}[-/]))|[Ss]ửa|[Cc]hỉnh(?: sửa)?|[Tt]hêm vào|[Uu]pdate|[Rr]evise|[Aa]mend|[Ee]dit)[^\n]{0,80}plan(?:\.md)?(?![A-Za-z])|plan(?:\.md)?(?![A-Za-z])[^\n]{0,80}(?<!(?:[Kk]hông|[Cc]hưa|[Nn]ot|n't) )(?:cần|nên|should|needs? to|must)[^\n]{0,40}(?:cập nhật|sửa|chỉnh|update|revis|amend)|(?<!(?:[Kk]hông|[Cc]hưa|n't|[Nn]ot) )(?:[Mm]uốn|[Ww]ould you like|[Ww]ant)[^\n]{0,40}?(?:tôi|mình|me)[^\n]{0,20}?(?:cập nhật|sửa|chỉnh|update|edit|revise|fix)|(?<![A-Za-zÀ-ỹ])(?<!(?:[Kk]hông|[Cc]hưa|[Đđ]ừng) )[Gg]hi(?![A-Za-zÀ-ỹ])[^\n]{0,60}(?:vào|into the) plan(?![A-Za-z])
