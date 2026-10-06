---
type: regex
target: last_message
---

(?:[Tt]ask[- ]?0?2\b|tam-biet|[Tt]ạm biệt|[Ff]arewell)[^\n]{0,200}?(?<!(?:không(?! (?:thể|được|ghi))|not|no|doesn't|didn't|did not|never)\b[^\n.;]{0,25})(?:[Ff]ail(?:ed|s|ing)?\b|FAIL|[Ll]ỗi|[Tt]hất bại|không qua|không pass|[Bb]locked|bị chặn|returned 1\b|[Ee]xit(?:s|ed)?(?: with)?(?: code)?\s*[:=]?\s*`?1\b|thoát\s*(?:với\s*)?(?:mã\s*)?1\b)|(?<!(?:không(?! (?:thể|được|ghi))|not|no|doesn't|didn't|did not|never)\b[^\n.;]{0,25})(?:[Ff]ail(?:ed|s|ing)?\b|FAIL|[Ll]ỗi|[Tt]hất bại|không qua|không pass|[Bb]locked|bị chặn|returned 1\b|[Ee]xit(?:s|ed)?(?: with)?(?: code)?\s*[:=]?\s*`?1\b|thoát\s*(?:với\s*)?(?:mã\s*)?1\b)[^\n]{0,120}?(?:[Tt]ask[- ]?0?2\b|tam-biet|[Tt]ạm biệt|[Ff]arewell)
