---
type: regex
target: { source: file, path: README.md }
---

^# Greeting service

A small HTTP service that greets a user by name\. It is used by the login screen and the welcome email\.

## Run

```
npm install
node src\/server\.js
```

The service listens on port 3000 unless `PORT` is set\.

## Behaviour

`greet\(name\)` greets in Vietnamese and trims spaces around the name: `greet\("  Lan "\)` returns `Xin chào, Lan!`\.

## Test

```
npm test
```\n?$
