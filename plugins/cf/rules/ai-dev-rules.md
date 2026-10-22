# Development Rules

Keep implementation simple, scoped, and verifiable.

## Core Principles

- YAGNI: do not build unrequested capability.
- KISS: prefer the simplest readable solution.
- DRY: extract only when duplication is real and meaningful.
- Surgical scope: every changed line should trace to the task.

## Code Quality

- Implement real production behavior; do not simulate completion.
- Follow existing architecture and local patterns.
- Prefer structured error handling at meaningful boundaries; do not wrap every call in defensive noise.
- Never log secrets, tokens, passwords, or PII.
- Comments should explain non-obvious intent, not restate code.

## File Organization

- Use descriptive `kebab-case` file names.
- Consider modularizing source files over 200 lines when there is a clear logical boundary.
- Do not modularize markdown, config, env, plain text, or bash files just to satisfy size rules.
- Check existing modules before creating new helpers.

## Tests And Verification

- For core features/modules, add or update relevant tests.
- For bug fixes, reproduce with a failing test or concrete evidence when feasible.
- Do not delete, weaken, or fake tests to pass.
- Run exact task commands first, then fallback lint/test/build.
- Build success alone is not proof that a task is complete.

## Skill And Tooling Use

- When a skill covers the task, follow its workflow and references instead of an ad hoc plan.
- Use documentation lookup when current external docs matter.
- Use `gh` for GitHub workflows and `psql` for Postgres inspection when needed.
- Use multimodal/image/document skills for visual or document-heavy tasks.

## Git Hygiene

- Lint before commit when the project has a linter.
- Run required tests before push.
- Keep commits focused.
- Use conventional commits.
- Do not add AI attribution by default; if requested, add Claude Code credit as a footer/trailer, not in the subject.
- Never commit secrets, real `.env` files, credentials, or API keys.
