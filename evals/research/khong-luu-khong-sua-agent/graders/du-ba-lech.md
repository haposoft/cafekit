---
type: regex
target: last_message
---

^(?=[\s\S]*(?:^|[^0-9.,])2[.,]?000(?![0-9]))(?=[\s\S]*(?:^|[^0-9.,])1[ \t]?Gi?B)(?=[\s\S]*(?:(?:^|[^0-9])10[ \t]*(?:kết nối|connections?|concurrent|đồng thời)|(?:[Kk]ết nối|[Cc]onnections?|[Cc]oncurrent|đồng thời)[^\n]{0,60}?[^0-9.,]10(?![0-9.,])))
