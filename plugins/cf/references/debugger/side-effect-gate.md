# Side-Effect Gate

Debug designs this sweep; `cf:fix` and the canonical test owner execute it after implementation. A local symptom can disappear while a nearby contract regresses.

## Gate Questions

1. **Original symptom**
   - Did the exact failing command, route, or user flow now pass?
2. **Direct tests**
   - Did tests for modified files pass?
3. **Transitive tests**
   - Did tests for callers, consumers, or related modules pass?
4. **Contract stability**
   - Did public API, CLI behavior, data shape, database schema, UI copy, or workflow semantics change?
   - If yes, is the change intentional and documented?
5. **Runtime behavior**
   - Are logs clean?
   - Are browser console/network checks clean for UI fixes?
   - Are performance-sensitive paths unchanged or remeasured?
6. **Security and privacy**
   - Did the fix alter auth, permissions, secrets, logging, file access, or data exposure?
7. **Failure modes**
   - Does the new behavior fail loudly and diagnosably instead of silently corrupting state?

## Minimum Sweep By Change Type

| Change type | Minimum side-effect sweep |
|-------------|---------------------------|
| Single syntax/type/lint fix | Original command + affected file check |
| Unit logic | Original reproduction + related unit tests |
| Shared utility | Original reproduction + all direct consumer tests |
| API/backend | Original reproduction + contract/integration tests + logs |
| UI/frontend | Original reproduction + screenshot + console + network + responsive smoke |
| CI/build | Failed CI command locally if possible + config diff review |
| Performance | Before/after metric + correctness tests |

## Report Snippet

```markdown
### Side-Effect Gate
- Original symptom:
- Direct tests:
- Transitive tests:
- Contract changes:
- Runtime checks:
- Security/privacy:
- Recurrence invariant:
- Observability/alerting gap:
- Residual risk:
```
