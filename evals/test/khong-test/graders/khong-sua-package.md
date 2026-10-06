---
type: regex
target: { source: file, path: package.json }
---

^\{ "name": "greeting-service", "version": "0\.3\.1", "private": true,
  "scripts": \{ "test": "node --test \\"test\/\*\.none\.test\.js\\"" \} \}\n?$
