---
name: spec-compliance-review
description: Hapo native protocol for verifying core implementation requirements, using multimodal visual validation when available.
---

# Spec Compliance Review (Stage 1)

Code that runs smoothly, follows Clean Code principles, and has high performance is still USELESS if it does not meet the requirements. This stage acts as a gatekeeper to ensure the Developer has followed the design specifications before assessing code quality.

## 1. Goal
- Prevent "feature creep": Developers arbitrarily adding unrequested features.
- Prevent "dropped requirements": Developers forgetting core business logic requirements.
- Ensure the User Interface perfectly matches the Design mockups.
- Prevent "fake done": Developers claiming completion while required runtime outputs, entrypoints, or artifacts are still missing.

## 2. Multimodal Invocation Process

Do not attempt a standard text-based review if the project includes Visual Specs (Images, Layouts, PDFs).

**Spec Detection Algorithm:**
1. Check if the `.specs/` directory, user instructions, or Jira tickets contain attached Image files (`.png`, `.jpg`, `.svg`) or Documents (`.pdf`).
2. If YES: use **`cf:ai-multimodal` when installed**, or the runtime's available multimodal capability. If neither is available, mark visual comparison `UNPROVEN` and continue the non-visual review.
3. If NO (Markdown Spec only): Read the spec directly and extract:
   - requirement bullets
   - task `Outcome`, `Scope`, `Anchors and Ownership`, `Changes`, `Acceptance`,
     `Dependencies`, and `Verification Plan`
   - typed `coordination.boundaries` as the only ownership/DAG/proof/parallel authority
   - task `Verification Plan`
   - canonical contracts/invariants from `design.md`
   Then verify the changed files against those concrete obligations.

Execution proof is separate from the task plan. Consume
`receipts/<task-basename>.md` first and legacy `## Evidence` only as fallback;
conflicting proof identities fail closed. Review never creates a receipt and
never treats a receipt as approval, readiness, audit status, or semantic judgment.

## 3. Verdict Scale

Each Requirement in the Spec must return 1 of 3 states:
- `[PASS]` Fully implemented. Proceed to Code Quality Review.
- `[MISSING]` Forgotten feature. Force the Developer to add it immediately (BLOCK MERGE).
- `[EXTRA]` The code has bloated with spontaneous features not in the spec card. If unjustified -> FAIL.
- `[VISUAL_MISMATCH]` (For UI Design): Available multimodal evidence indicates this screen will break layout or violate the Design System.
- `[UNPROVEN]` Required artifact/runtime behavior or verification evidence is missing, so completion cannot be trusted.

## 4. Red Flags
- Praising "Clean Code" without measuring against Requirements.
- Assuming Design Images are just for display and hold no validation value.
