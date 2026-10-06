---
type: regex
target: { source: file, path: .test-runs.log }
---

^(?=[\s\S]*(?:^|\n)\S+ file=total\.test\.js src=(?!166d8c27acc5 )[0-9a-f]{12} test=[0-9a-f]{12} exit=0(?=\n|$)(?![\s\S]*\n\S+ file=total\.test\.js src=(?!166d8c27acc5 )[0-9a-f]{12} test=[0-9a-f]{12} exit=[1-9]))
