---
type: regex
target: { source: file, path: .test-runs.log }
---

^(?=[\s\S]*(?:^|\n)\S+ file=paginate\.test\.js src=(?!c3f11fd25a7e )[0-9a-f]{12} test=[0-9a-f]{12} exit=0(?=\n|$)(?![\s\S]*\n\S+ file=paginate\.test\.js src=(?!c3f11fd25a7e )[0-9a-f]{12} test=[0-9a-f]{12} exit=[1-9]))
