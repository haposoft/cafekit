---
type: regex
target: last_message
---

p95|(?<![0-9])200[ \t]?ms|(?<![0-9])850[ \t]?ms|(?<![0-9])5[ \t]?(?:giây|seconds?)|goals\.md|infra\.md|perf\.md|(?:[Kk]hông|[Cc]hưa|[Nn]o|[Ww]ithout)[^\n]{0,20}Redis
