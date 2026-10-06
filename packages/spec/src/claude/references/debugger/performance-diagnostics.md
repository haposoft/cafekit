# Performance Diagnostics

Use this when the issue is slow response, high CPU, memory growth, expensive rendering, DB latency, CI slowness, or timeout behavior.

## First Rule

Measure before optimizing. A performance fix without a baseline is guessing.

## Investigation Flow

1. **Define the symptom**
   - Slow operation, endpoint, page, test, job, query, render, or background task.
   - Record expected threshold and actual observed time.
2. **Capture a baseline**
   - Command, URL, load profile, dataset size, cache state, runtime versions.
   - Run more than once if variance is high.
3. **Locate the bottleneck layer**
   - Client render
   - Network
   - Server/application logic
   - Database/query
   - External dependency
   - Build/CI infrastructure
4. **Profile the narrowest meaningful scope**
   - Use project-native profilers and logs first.
   - Add temporary timing only when existing telemetry is insufficient.
5. **Identify root cause**
   - Algorithmic complexity
   - N+1 query
   - Missing index
   - Excessive serialization
   - Large bundle or render thrash
   - Cold starts, cache misses, or dependency latency
6. **Set verification target**
   - Before metric
   - Required after metric for Fix/Test
   - Acceptable threshold
   - Regression guard if feasible

## Database Checks

When PostgreSQL is involved:

```sql
EXPLAIN (ANALYZE, BUFFERS) <query>;
```

Check:
- Missing indexes
- Sequential scans on large tables
- N+1 query patterns
- Lock waits
- Connection pool saturation
- Query plan changes after data growth

## Frontend Checks

Check:
- Bundle size and route-level chunking
- Render count and unnecessary state updates
- Long tasks on the main thread
- Image dimensions and loading strategy
- Network waterfall and cache headers
- Interaction latency after hydration

## Report Snippet

```markdown
### Performance Evidence
- Baseline:
- Bottleneck layer:
- Root cause:
- Cause-aligned fix direction:
- Verification target:
- Regression guard:
```
