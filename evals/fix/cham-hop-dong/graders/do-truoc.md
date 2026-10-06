---
type: regex
target: { source: file, path: .test-runs.log }
---

(^|\n)\S+ file=[^ \n]+\.test\.js src=85fa5c1642da test=(?!a0fb23a60253 )(?!19ba7fd20f27 )[0-9a-f]{12} exit=[1-9]
