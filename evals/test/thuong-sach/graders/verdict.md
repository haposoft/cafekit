---
type: regex
target: last_message
---

^(?:(?:(?!(?<![A-Za-zÀ-ỹ][ \t]*(?:\*\*)?)(?:\*\*)?(?:Status|Trạng thái)(?:\*\*)?:(?:\*\*)?[ \t]*(?:\*\*|`)?(?:(?:✅|❌|⛔|⚠️|🚫|🔴)[ \t]*)?(?:\*\*|`)?(?:PASS_WITH_WARNINGS|PASS|FAIL|BLOCKED)(?![A-Za-z_]))[\s\S])*(?<![A-Za-zÀ-ỹ][ \t]*(?:\*\*)?)(?:\*\*)?(?:Status|Trạng thái)(?:\*\*)?:(?:\*\*)?[ \t]*(?:\*\*|`)?(?:(?:✅|❌|⛔|⚠️|🚫|🔴)[ \t]*)?(?:\*\*|`)?(?:PASS|PASS_WITH_WARNINGS)(?![A-Za-z_])|(?![\s\S]*(?<![A-Za-zÀ-ỹ][ \t]*(?:\*\*)?)(?:\*\*)?(?:Status|Trạng thái)(?:\*\*)?:(?:\*\*)?[ \t]*(?:\*\*|`)?(?:(?:✅|❌|⛔|⚠️|🚫|🔴)[ \t]*)?(?:\*\*|`)?(?:PASS_WITH_WARNINGS|PASS|FAIL|BLOCKED)(?![A-Za-z_]))(?:[^\[\]]|\[[^\]]*\])*?"verdict"[ \t]*:[ \t]*"(?:PASS|PASS_WITH_WARNINGS)")
