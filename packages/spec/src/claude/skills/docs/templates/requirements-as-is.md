# As-Is Requirements: {{SCOPE}}

## Evidence Policy

Each requirement records current behavior only.

- `Observed`: current behavior directly supported by source/test/schema/config evidence.
- `Inferred`: likely current behavior supported by multiple signals but not fully proven.
- `Unknown`: code indicates a gap that needs human or runtime confirmation.

## R-ASIS-001: {{CURRENT_BEHAVIOR_TITLE}}

- Type: Observed
- Confidence: High
- Evidence:
  - E-API-001 - `{{PATH_OR_SYMBOL}}`
  - E-TEST-001 - `{{PATH_OR_SYMBOL}}`
- Actors:
  - {{ACTOR_OR_CALLER}}
- Trigger:
  - {{ENTRY_POINT_OR_EVENT}}
- Inputs:
  - {{INPUTS_OR_NONE}}
- Current outcome:
  - {{CURRENT_RESULT}}
- Exceptions or gaps:
  - {{ERROR_PATH_OR_UNKNOWN}}
- Notes:
  - {{SHORT_REVIEW_NOTE}}

## Open Review Notes

- Replace template examples with source-backed requirements.
- Move requested future changes to `/cf:specs`, not this file.
