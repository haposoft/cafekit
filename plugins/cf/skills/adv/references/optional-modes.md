# Optional advisory modes

## Emit outputs per flags

Write the canonical advice report first, at `plans/reports/YYYYMMDD-advise-<slug>.md`. Each flag agent below reads it. Independent flag agents run in parallel. Every agent prompt carries the task, the report path to read, the files it may write, acceptance criteria, and "DO NOT COMMIT OR PUSH".

### `--html`

Spawn `ui-ux-designer` with the report as input and a self-contained HTML file beside it as output: inline CSS and JS, no network assets (no web fonts, CDN scripts, or remote images), responsive, with reduced-motion handling. Forbid it from running scripts that belong to other skills. The page must show: needs from you (when present), verdict, requirements and goals, do versus don't, alternatives comparison, benefits and trade-offs, unverified claims (when present), and the handoff brief as a verbatim copyable block.

When `ui-ux-designer` is not available (the plugin build omits it), the controller writes a self-contained HTML file itself under the same constraints, or reports "skipped --html: ui-ux-designer is missing" and continues.

### `--md`

Spawn `cf:docs-keeper` to produce a polished standalone markdown report for a reader who did not see the conversation. If the canonical report already meets that bar, `--md` only reports its path.

### `--github`

The controller does this itself; no agent posts to GitHub.

1. Write the body to a file under `plans/reports/`. For a GitHub issue or PR input, lead with Needs from you (when present), then the reframed problem and verdict. Otherwise include the reframing, requirements, goals, done means, advice summary, and the handoff brief verbatim.
2. Show the body to the user and ask one confirmation question before posting anything.
3. After a yes, run `gh issue comment <number> --body-file <body.md>` for an existing issue, or `gh issue create --title "<reframed title>" --body-file <body.md>` in the current repo.
4. If `gh` fails (auth, permissions), report the exact error verbatim; never fake success. On a no, post nothing.

### `--agent`

The controller relays; the agent `cf:advisor` runs the interview and the advice. Spawn agent `cf:advisor` with the original input, the flags, the state file path `plans/reports/YYYYMMDD-advise-<slug>-state.md`, and the report path. It must never be asked to spawn flag agents. Handle each reply by its first line:

1. `NEEDS_USER_INPUT` with a `json` block: pass the question verbatim to the native user-question tool.

   ```json
   { "question": "...", "header": "...", "multiSelect": false, "options": [{ "label": "...", "description": "..." }, { "label": "...", "description": "..." }] }
   ```

2. `NEEDS_PREVIEW` with `reframing`, `brief`, `preview_path`, `question`: render the preview yourself (inline Mermaid plus a text mockup, labelled a hypothetical end state), save it to `preview_path`, show it, then ask `question`.
3. `ADVICE_READY: <path>`: read the report and run the flag outputs itself (the sections above).
4. Re-spawn the agent after every answer with `ANSWER to Q<n>: <text>`, where each question, including the preview confirmation, takes the next `Q<n>`; the state file records every question and answer. If the user ends the interview, tell the agent so it moves to the reframing and carries the gaps as assumptions.
5. If the agent repeats a question the state file already answers, re-spawn once with the earlier answer; on a second repeat, stop and report the state file path. `NEEDS_PREVIEW` rounds never count as repeats.

On `ADV_SKILL_NOT_FOUND` or any other error, stop and surface it. There is no fixed round cap. If the user aborts, report the state file path.
