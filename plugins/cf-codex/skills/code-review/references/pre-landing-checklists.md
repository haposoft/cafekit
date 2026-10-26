---
name: pre-landing-checklists
description: A static, mandatory set of rules to scan during Phase 2 (Code Quality) check before approving any code into the main branch.
---

# Pre-landing Checklists

Code Reviewers must rapidly scan against these strict checklists during **Stage 2 (Code Quality)**. Any violation of these checklists must block the merge.

## 1. Safety & Security Boundaries
- [ ] **No Hardcoded Secrets:** Check for embedded API keys, JWT secrets, passwords, or Stripe tokens. They must pull from `.env` or configuration.
- [ ] **No Exposed PII Logs:** `console.log` or logging libraries must not output user passwords, credit card numbers, or full database dumps.
- [ ] **No Magic Strings/Numbers:** Important integers or strings reused across the code must be extracted into Enums or Constants.

## 2. Typing & Structural Integrity (TypeScript/Frontend)
- [ ] **Zero `any` Tolerance:** The use of the `any` type in TypeScript is forbidden unless dealing with highly dynamic 3rd-party undocumented JSON. 
- [ ] **Strict Component Separation:** UI framework imports (e.g., `react`, `lucide-react`, `tailwindcss`) must NOT be imported into core business logic files or database services.
- [ ] **No Inline Styling Abuse:** Rely on the utility-first CSS framework (e.g. Tailwind) or external stylesheets instead of bloating components with `style={{ ... }}` objects.

## 3. Performance Trap Avoidance
- [ ] **Missing Pagination:** Any database query or API fetch that requests lists (like "get users" or "get orders") must implement or support pagination/limits.
- [ ] **N+1 Query Problems:** Loops that execute separate database queries inside each iteration are rejected immediately. 

## 4. Code Hygiene & Error Handling
- [ ] **No Swallowed Errors (Empty Catch):** A `catch(e)` block must not be empty or contain only a lazy `console.error`. It must properly handle the error, throw it upward, or report it to user/UI/Telemetry.
- [ ] **No Development Leftovers:** Forbid any leftover `console.log("here")`, `.only` in tests, or commented-out blocks like `// TODO: remove later`. The code must be pristine.
- [ ] **Testing Integrity:** If a core logic unit or a critical bug fix was introduced, there MUST be corresponding additions or modifications to the test suite verifying it.

## How To Apply
You do not need to print this checklist in your final report, but you **MUST** mentally check every box against the PR Diff. If a box fails, report it as a **Critical or Warning** issue in the Stage 2 results.
