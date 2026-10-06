---
type: regex
target: { source: file, path: .test-runs.log }
---

^(?=[\s\S]*(?:^|\n)\S+ file=report\.test\.js src=(?!85fa5c1642da )[0-9a-f]{12} test=[0-9a-f]{12} exit=0(?=\n|$)(?![\s\S]*\n\S+ file=report\.test\.js src=(?!85fa5c1642da )[0-9a-f]{12} test=[0-9a-f]{12} exit=[1-9]))(?=[\s\S]*(?:^|\n)\S+ file=import\.test\.js src=(?!85fa5c1642da )[0-9a-f]{12} test=[0-9a-f]{12} exit=0(?=\n|$)(?![\s\S]*\n\S+ file=import\.test\.js src=(?!85fa5c1642da )[0-9a-f]{12} test=[0-9a-f]{12} exit=[1-9]))
