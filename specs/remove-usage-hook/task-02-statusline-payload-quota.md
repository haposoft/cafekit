# Task 02 — quota comes only from the payload; no usage cache reader remains

Status: done

## Outcome
The statusline's quota (default line and `statuslineLayout` `quota` section) comes from `rate_limits` alone, a usage cache file no longer affects it, `context.cjs` has no usage reader, and the `usage` config key is marked deprecated.

## Scope
- In: `status.cjs` — delete `USAGE_CACHE_TTL_MS`, the cache `else` branch, the `'N/A'` handling in `buildUsageString`, and the comments that mention the cache or the usage hook; keep `applyWindows`/`fromPayload`. `context.cjs` — delete `USAGE_CACHE_FILE`, `readUsageCache`, `buildUsageSection` and its two call sites (`:498`, `:576`) and export (`:599`), plus helpers left unused. Schema — `usage` gets `"deprecated": true` and a "Not honoured" description. Tests — convert every cache-seeded statusline test, add the ignored-cache and layout-quota tests, add `usage` to the deprecated-key test.
- Out: deleting `context.cjs`; `runtime.json` defaults; the golden fixture bytes.

## Coverage
- CP-02

## Ownership
- Modify: `src/claude/status.cjs`, `src/claude/hooks/__tests__/statusline.test.js`, `src/claude/hooks/lib/context.cjs`, `src/claude/runtime.schema.json`, `bin/__tests__/runtime-schema.test.js`
- Read: `src/claude/hooks/__tests__/fixtures/statusline-default.golden`, `src/claude/runtime.schema.json:192-202`

## Steps
1. Tests first. In `statusline.test.js` replace `freshUsageCache()` with `rateLimits({ fiveHour, weekly })` returning `{ five_hour: { used_percentage, resets_at }, seven_day: { used_percentage, resets_at } }` (epoch seconds, reset 2h29m and 2d ahead) and pass it as `payload.rate_limits` in every test that seeded `ck-usage-limits-cache.json` (`:145`, `:202`, `:218`, `:227-232`, `:253`). Replace the stale-cache test (`:152-159`) with `statusline shows no quota when the payload has no rate_limits, even with a fresh usage cache` (seed a fresh cache file, no `rate_limits`, assert no `⧗`/`◷`). Rename `statusline reads quota from the payload rate_limits before the usage cache` to `statusline reads quota from the payload rate_limits`. Add `statusline layout quota section renders from the payload` (layout `[['quota']]`, `rate_limits` 36/43, colours off; strip ANSI and NBSP but do not use `visible()`, whose mask matches only `\d+h\d+m`, then `assert.match(line, /⌛ \d+h \d+m left \(36% used\)  wk 43% \(\d+d \d+h\)/)` — the layout prints `2h 29m` with a space and a weekly countdown that may roll over between seconds). In `runtime-schema.test.js:89` make the list `['hooks', 'develop', 'usage']`.
2. Run the Verification Plan Command and expect failure.
3. Edit `status.cjs`, `context.cjs`, `runtime.schema.json` as scoped.
4. Run the Command.

## Acceptance
- AC-04: all statusline tests and the schema test pass; the ignored-cache and layout-quota tests are present and pass.

## Dependencies
- task-01-retire-usage-hook.md

## Verification Plan
- Command: `! grep -n "ck-usage-limits-cache\|USAGE_CACHE_TTL_MS\|'N/A'" src/claude/status.cjs && ! grep -n "ck-usage-limits-cache\|readUsageCache\|buildUsageSection" src/claude/hooks/lib/context.cjs && node --test src/claude/hooks/__tests__/statusline.test.js bin/__tests__/runtime-schema.test.js 2>&1 | tee /dev/stderr | grep -E '^ok .* - statusline (shows no quota when the payload has no rate_limits, even with a fresh usage cache|layout quota section renders from the payload)$' | wc -l | grep -q '^ *2$' && node --test src/claude/hooks/__tests__/statusline.test.js bin/__tests__/runtime-schema.test.js 2>&1 | grep -q '^# fail 0$'`
- Named probe: `statusline shows no quota when the payload has no rate_limits, even with a fresh usage cache`; `statusline layout quota section renders from the payload`; `keys the runtime does not honour are marked deprecated, not documented as working` (`runtime-schema.test.js:86`); `statusline default output is byte-identical to the golden fixture when no layout is configured`.
- Reachability: source — spawns `status.cjs` with pinned `TMPDIR`, `COLUMNS`, runtime config.
- Oracle: exit 0; both named new tests reported `ok`; `# fail 0`.
- Counterexample: restoring the cache fallback fails the ignored-cache test; a skipped or misnamed new test makes the count differ from 2; leaving `usage` undeprecated fails the schema test.
- Artifacts: ephemeral temp dirs.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `! grep -n "ck-usage-limits-cache\|USAGE_CACHE_TTL_MS\|'N/A'" src/claude/status.cjs && ! grep -n "ck-usage-limits-cache\|readUsageCache\|buildUsageSection" src/claude/hooks/lib/context.cjs && node --test src/claude/hooks/__tests__/statusline.test.js bin/__tests__/runtime-schema.test.js 2>&1 | tee /dev/stderr | grep -E '^ok .* - statusline (shows no quota when the payload has no rate_limits, even with a fresh usage cache|layout quota section renders from the payload)$' | wc -l | grep -q '^ *2$' && node --test src/claude/hooks/__tests__/statusline.test.js bin/__tests__/runtime-schema.test.js 2>&1 | grep -q '^# fail 0$'`
Exit: 0
Base: 9f8138238923b1f01cb0be84ce9f13a1c6063522
Head: df358d03baca6066e70670d5c72e6d9e628117aac0b4a3398f9a7d46694c4a90
```text
$ (packages/spec) <Command above>   # summary lines; EXIT=0
ok 5 - keys the runtime does not honour are marked deprecated, not documented as working
ok 8 - statusline default output is byte-identical to the golden fixture when no layout is configured
ok 13 - statusline shows five-hour and weekly windows with countdowns from the payload
ok 14 - statusline shows no quota when the payload has no rate_limits, even with a fresh usage cache
ok 22 - statusline reads quota from the payload rate_limits
ok 23 - statusline layout quota section renders from the payload
# tests 26
# pass 26
# fail 0
```
Pre-change run of the same Command exited 1 at the first `! grep` (status.cjs:31 `USAGE_CACHE_TTL_MS`, :107 `'N/A'`, :572 the cache path) with `not ok` for the deprecated-key test and the ignored-cache test. The layout quota test passed before the change (the payload path already existed); it guards that path.
