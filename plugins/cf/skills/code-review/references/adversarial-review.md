---
name: adversarial-review
description: Stage 3 Red-Team Protocol for Hapo Code Review. Focuses on brutally breaking the code with hostle mindset and strict scope gates.
---

# Adversarial Review (Stage 3)

This protocol is only activated after Stage 1 (Spec Compliance) and Stage 2 (Code Quality) have successfully scanned the surface of the codebase. It must portray absolute ruthlessness and zero tolerance.

## 1. The Scope Gate

Do not waste AI resources firing cannons at mosquitoes.
**SKIP the Adversarial Stage** if ALL the following conditions match:
- Total changed files <= 2
- Total changed lines <= 30 (logic code only)
- Does not touch core files (Configs, Authentication, Security, SQL, Package dependencies).
*Note: Write `.Adversarial: Skipped (Modifications too small)` in the report.*

**MANDATORY ACTIVATION IF YOU SEE:**
- Modifications to Login / Authorization / New API Routes.
- Declaration / Addition of New npm Libraries (Lockfile changes) -> Sniff out Supply Chain risks.

## 2. The Mindset

> "Hapo's job is not to stroke the Programmer's ego. Code always contains fatal flaws. Your job is to **Pierce the Bulletproof Vest**, proving that the Code can be wrong, can be Hacked, and can be Overloaded." 

## 3. The Attack Vectors

Do not review if a function has a pretty name. Look for:

### 3.1. Security Holes
- Have input forms been Sanitized against XSS?
- Does SQL string concatenation expose Injection vulnerabilities?
- Silly authorization errors (Auth Bypass) due to carelessly branching logic.
- Are sensitive data (Stripe Keys, API Keys, JWT Tokens) likely to be dumped into Error Logs during application crashes?

### 3.2. False Assumptions
- Developers betting their life on the code: `const id = event.data.userId` without checking if `event.data` might be Null.
- Trusting a 3rd party library call unconditionally, failing to consider the case where the Network drops during the server request.

### 3.3. Resource Exhaustion & Infinite Loops
- Querying a 1-million-row DB table without limits/pagination? Catch it immediately!
- Rendering a Component with 1000 standard DOM nodes in ReactJS causing browser freezes or RAM leaks?

### 3.4. Supply Chain Risks
- Warn the Developer when installing an obscure package like `left-pad`. Could this library hide a dirty Logger running a stealth script to plant malware? 

## 4. Adjudication
When an error is found, it must be judged:
- **[CRITICAL]** The system will definitely crash, or Hackers will 100% penetrate. Require an IMMEDIATE MERGE BLOCK and return the bash command for the User to fix it.
- **[MEDIUM]** There is a flaw but the risk is minor (it still must be flagged for fixing).
- **[REJECTED]** Self-awareness that the analysis is too harsh (False positive because the DB already has a defensive rule wrap). Be smart enough to Reject it yourself.
