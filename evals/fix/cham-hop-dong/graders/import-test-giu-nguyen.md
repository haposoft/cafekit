---
type: regex
target: { source: file, path: test/import.test.js }
---

^(?=[\s\S]*(?:^|\n)test\("từ chối số tiền không phải số", \(\) => \{\n[ \t]*assert\.throws\(\(\) => importRow\(\{ id: 2, amount: "abc" \}\), \/invalid amount\/\);)(?=[\s\S]*(?:^|\n)test\("từ chối số tiền rỗng", \(\) => \{\n[ \t]*assert\.throws\(\(\) => importRow\(\{ id: 3, amount: "" \}\), \/invalid amount\/\);)
