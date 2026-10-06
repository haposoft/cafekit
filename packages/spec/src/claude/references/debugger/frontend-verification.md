# Frontend Verification

Use this when the issue affects rendering, layout, interaction, hydration, browser state, accessibility, or network behavior.

## When To Apply

- UI does not render or renders incorrectly
- A user flow fails in browser but not in unit tests
- A visual layout, responsive breakpoint, overlay, or z-index behavior is suspect
- Console/network errors may explain an application failure
- A reported failure or proposed fix direction affects visible UI or interaction behavior

## Evidence Checklist

1. **Route and state**
   - Record URL, viewport, user role, feature flags, and required test data.
   - Record browser, OS, and device profile when relevant.
2. **Screenshot**
   - Debug captures the failing baseline screenshot. Fix/Test owns the post-change comparison.
   - Check text overflow, occlusion, clipping, broken images, blank states, and responsive layout.
3. **Console**
   - Capture console errors and warnings.
   - Treat hydration errors and uncaught exceptions as root-cause candidates, not noise.
4. **Network**
   - Capture failed requests, status codes, response shapes, CORS issues, and timing.
   - Compare expected API contract with actual payload.
5. **Accessibility tree**
   - Use an accessibility or ARIA snapshot to find hidden overlays, missing labels, disabled controls, and focus traps.
6. **Interaction**
   - Reproduce the exact click/type/navigation flow.
   - Verify focus, loading states, disabled states, empty states, and error states.

## Preferred Tools

- `agent-browser` for visual reproduction, screenshots, and exploratory browser checks
- `chrome-devtools` for console, network, CDP, screenshots, ARIA snapshots, and WebSocket debugging
- Project-native E2E tooling when it already exists

## Report Snippet

```markdown
### Frontend Evidence
- URL/viewport:
- Screenshot:
- Console:
- Network:
- Accessibility:
- Interaction result:
```

## Common Root Causes

- Hydration mismatch between server and client render
- Missing data/loading/error state
- Broken asset or route path
- CSS containment, overflow, stacking context, or responsive breakpoint issue
- JavaScript crash before component mount
- API contract drift or missing auth/session state
- Race condition hidden by arbitrary waits
