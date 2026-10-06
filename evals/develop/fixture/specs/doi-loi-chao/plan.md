# Đổi lời chào sang tiếng Việt
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE)
- Chosen: KEEP. Đổi lời chào của `greet` sang tiếng Việt và bỏ khoảng trắng thừa quanh tên.
- Out: mọi thứ khác trong dự án.

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | Khi gọi `greet` với một tên, nó trả về lời chào tiếng Việt, và khoảng trắng thừa quanh tên bị cắt. | `node --test test/greet.test.js` |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Đổi lời chào sang tiếng Việt và cắt khoảng trắng | P1 | AC-01 | `src/greet.js` | - | pending |
