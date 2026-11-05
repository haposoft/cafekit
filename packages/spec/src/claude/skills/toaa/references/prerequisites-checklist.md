# Prerequisites checklist

Load at gate 2. Walk each confirmed Done-means item and ask: what would stop an unattended run here? Keep only items the run cannot obtain or decide alone.

## Categories

| Category | Typical items | Ready check (non-destructive) |
|---|---|---|
| Access and auth | Repo push rights, `gh auth`, cloud/CLI logins, SSH hosts, admin panels | `gh auth status`, `<cli> whoami`, read-only list call |
| Secrets and config | API keys, tokens, webhook secrets, env vars per environment | Variable present (never print its value) |
| Accounts and quotas | Third-party accounts, billing enabled, rate limits, domains, DNS | Read-only API call or dashboard state the user confirms |
| Data and assets | Sample data, copy, brand assets, designs, fixtures, test accounts | File exists at the agreed path |
| Issue tracking | Repo where the work's issue lives, permission to create issues and labels (`in progress`, `in review`, `done`, `shipped`, `ai-handle`) | `gh issue list --limit 1`, `gh label list` |
| Authority | Commit, push, PR, merge or deploy rights, spend limits, permission to email or post | Stated in the brief |
| Decisions only the user owns | Pricing, legal text, public naming, business trade-offs | Answer recorded in the brief |
| Environment | Toolchain versions, running services, free ports, disk | Version or health command |

Skip a category entirely when nothing in the brief touches it.

## Message format

```markdown
## Before I go autonomous, I need

1. **<item>**: <why the run needs it>. Put it in <where>. I will check with <how>.
2. ...

## Defaults I will use unless you say otherwise
- <reversible choice>: <one-line reason>

## I will only stop if
- <the stop conditions from gate 3 that apply to this brief>

Reply "ready" when these are in place.
```

Order items so the slowest to obtain (account approvals, DNS, billing) come first. Never ask the user to paste a secret into the conversation; point to the env file, secret manager or CLI login that the run will read.
