---
type: regex
target: { source: file, path: .test-runs.log }
---

(^|\n)\S+ file=[^ \n]+\.test\.js src=c3f11fd25a7e test=(?!c38ca2a71238 )[0-9a-f]{12} exit=[1-9]
