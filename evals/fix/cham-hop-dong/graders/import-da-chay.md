---
type: regex
target: { source: file, path: .test-runs.log }
---

(^|\n)\S+ file=import\.test\.js src=(?!85fa5c1642da )[0-9a-f]{12} 
