---
type: regex
target: { source: file, path: .test-runs.log }
---

^(?=[\s\S]*(?:^|\n)\S+ file=greet\.test\.js src=(?!f2392aa60c68 )[0-9a-f]{12} test=[0-9a-f]{12} exit=0(?=\n|$)(?![\s\S]*\n\S+ file=greet\.test\.js src=(?!f2392aa60c68 )[0-9a-f]{12} test=[0-9a-f]{12} exit=[1-9]))
