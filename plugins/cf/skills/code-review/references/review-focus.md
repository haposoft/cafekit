# Review Focus

## Review order

1. correctness
2. security
3. regressions
4. maintainability

## Focus areas

- Does the change satisfy the approved spec task?
- Did the change introduce behavior outside the approved scope?
- Are edge cases or failure paths obviously missing?
- Are tests missing for non-trivial risk?

## Good findings

- concrete
- reproducible
- tied to changed code
- includes a fix direction

## Avoid

- vague style-only comments
- speculative refactors outside scope
- comments on unchanged code unless it creates risk
