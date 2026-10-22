---
type: regex
target: { source: file, path: src/invoice-format.js }
---

^function formatInvoiceLine\(item\) \{
  return item\.name \+ " x" \+ item\.qty \+ ": " \+ item\.price \* item\.qty;
\}

module\.exports = \{ formatInvoiceLine \};\n?$
