---
type: regex
target: last_message
---

^(?![\s\S]*(?:\*\*(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?:?(?:\*\*)?:?|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]*:|#{1,6}[ \t]*(?:\*\*)?(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?(?:\*\*)?[ \t]*[:—–-]?(?:[ \t]*\n){0,2}|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:[ \t]*\([^)\n]{0,40}\)|[ \t]+(?:của|cuối cùng|chung|tổng thể|of|from|cho)[^*\n:]{0,40})?[ \t]+(?:là[ \t]+)?(?=\*\*|`)|(?:[Vv]erdict|VERDICT|[Kk]ết luận|[Pp]hán quyết|[Kk]ết quả(?: review)?(?! chạy test))(?:(?![Tt]est)[^\n:*]){1,40}?[ \t]là[ \t]+(?=\*\*|`))[ \t]*(?:\*\*)?[ \t]*`?[ \t]*(?:(?:\uD83D[\uDD34\uDD35\uDFE0\uDFE1]|❌|⚠️?|✅)[ \t]*)?(?:\*\*)?`?PASS)
