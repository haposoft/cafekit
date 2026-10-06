---
type: regex
target: last_message
---

^(?=(?:(?:(?!(?<![A-Za-zÀ-ỹ][ \t]*(?:\*\*)?)(?:\*\*)?(?:Status|Trạng thái)(?:\*\*)?:(?:\*\*)?[ \t]*(?:\*\*|`)?(?:(?:✅|❌|⛔|⚠️|🚫|🔴)[ \t]*)?(?:\*\*|`)?(?:PASS_WITH_WARNINGS|PASS|FAIL|BLOCKED)(?![A-Za-z_]))[\s\S])*(?<![A-Za-zÀ-ỹ][ \t]*(?:\*\*)?)(?:\*\*)?(?:Status|Trạng thái)(?:\*\*)?:(?:\*\*)?[ \t]*(?:\*\*|`)?(?:(?:✅|❌|⛔|⚠️|🚫|🔴)[ \t]*)?(?:\*\*|`)?(?:FAIL|BLOCKED)(?![A-Za-z_])|(?![\s\S]*(?<![A-Za-zÀ-ỹ][ \t]*(?:\*\*)?)(?:\*\*)?(?:Status|Trạng thái)(?:\*\*)?:(?:\*\*)?[ \t]*(?:\*\*|`)?(?:(?:✅|❌|⛔|⚠️|🚫|🔴)[ \t]*)?(?:\*\*|`)?(?:PASS_WITH_WARNINGS|PASS|FAIL|BLOCKED)(?![A-Za-z_]))(?:[^\[\]]|\[[^\]]*\])*?"verdict"[ \t]*:[ \t]*"(?:FAIL|BLOCKED)"))(?=[\s\S]*(?:Executed:?(?:\*\*)?[ \t]*0\b|"executed"[ \t]*:[ \t]*0\b|\|[ \t]*Executed[ \t]*\|[ \t]*0[ \t]*\||#[ \t]*tests[ \t]+0\b|ℹ[ \t]*tests[ \t]+0\b|\btests[ \t]+0\b|(?<!(?:Failed|Skipped|Passed|failed|skipped|passed)[:*\s]{0,5})\b0[ \t]+tests?\b|\b[Zz]ero[ \t]+tests?\b|\b[Nn]o[ \t]+tests?\b(?![ \t]+(?:failed|were skipped))|[Kk]hông có test nào|\b0 test\b))
