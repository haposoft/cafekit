# Rebind, bare call, and the changed-files report

Read this before a rebind, a call without arguments, or any report of files
changed. Every rule here exists because a past sync run broke it.

## Snapshot first

Before the first edit, record `git status --porcelain -uall` and the sha256 of
every path it lists. A file that was already modified is not yours to claim.

## Rebind

`/cf:sync rebind <feature> [<task-NN-slug.md>]` refreshes the Receipt of tasks
that are already `done`. Any other Status is reported and not written.

1. Take each task's Command exactly as the validator does: the last top-level
   `- Command:` of its Verification Plan before the first `###` sub-heading,
   or, when there is none at top level, the last `- Command:` under the
   sub-headings. That one Command is the one you run and write.
2. Run every selected Command verbatim, each once as one shell, so stdout,
   stderr and the exit code cover the whole command. Never pipe it through
   `| tail`, never redirect only its last `&&` link to a log, never edit it.
3. A Command that exits non-zero, prints a failure marker, or runs zero
   required tests never yields PASS. Set `Status: blocked` and, right under
   the `Status:` line, add one line
   `Blocker: rebind <date>: <Command> exited <code> (<failing test line>)`;
   keep the old Receipt, and put this line directly under its `## Receipt`
   heading:
   `Not current proof: the rebind run of this Command exited <code>; the record below is historical.`
4. After all Commands have run, run the provenance command once, exactly as
   Develop names it:
   `node .claude/scripts/provenance.cjs --project-root . --specs-root specs --spec-file <task file> --feature-name <feature> --session <any label> --json`
   Copy its `Base` and `Head` fields into each passing Receipt. Never type,
   compute, shorten, or `sed`-edit Base or Head, and never write a Receipt
   from output that a run in this call did not print.
5. Run the provenance command again. If Head moved, say so and do not claim
   the receipts current.
6. Re-read each edited task: exactly one `Status:` and one `## Receipt`.

## Never silence the gate

A Stop-gate block is answered with fresh evidence or with a reported blocker.
Never archive, move, rename, or delete a packet, change the specs root, or edit
`.claude/` (including `runtime.json`) or any hook so the gate goes quiet.

## Bare call

`/cf:sync` without arguments audits every process-first packet under the specs
root and writes nothing. Report archived packets, and packet directories without
`plan.md` that CafeKit no longer reads, without touching them. End by asking with `AskUserQuestion` when the host has
it, otherwise ask in text and stop. Only a reply that arrives after the report
and names the changes counts as confirmation; an instruction given before the
report, such as "close everything", does not.

## Report files from git

After the last edit, take the snapshot again and report every path whose
status line or sha256 changed. List changes that were already there before the
first edit apart from your own. Never write "no files changed" from memory.
