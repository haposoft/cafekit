#!/usr/bin/env bash
# Run `claude plugin eval` for one CafeKit skill.
#
#   evals/run.sh <skill> [claude plugin eval options...]
#   evals/run.sh specs                       # full suite, ablation with-without
#   evals/run.sh specs --case dung-o-c1 --runs 1 --ablation none --model opus
#   evals/run.sh specs --validate         # load every case and print the plan, $0
#
# Why a script: the harness treats the plugin root as the tree it enumerates, and it
# passes one Read/Glob/Grep grant per path to the child as a single --allowed-tools
# argument. Rooting the plugin at this repository (41k files) exceeds ARG_MAX (E2BIG),
# and a manifest inside evals/ may not point at a skill outside its own root. So the
# skill source is copied from packages/spec/src/claude/skills/<skill> into a small
# temporary plugin next to the cases in evals/<skill>/, and results come back to
# evals/results/<skill>/. The skill source stays single; nothing here is a published
# plugin. Cases needing a workspace use context.scaffold_script, which only runs with
# --scaffold (author-supplied bash, run as you) — passed by default below since every
# case here is authored in this repository.
set -euo pipefail
skill="${1:?usage: evals/run.sh <skill> [options]}"; shift
root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/packages/spec/src/claude/skills/$skill"
cases="$root/evals/$skill"
[ -f "$src/SKILL.md" ] || { echo "no skill at $src" >&2; exit 2; }
[ -d "$cases" ] || { echo "no cases at $cases" >&2; exit 2; }
work="$(mktemp -d "${TMPDIR:-/tmp}/cafekit-eval-$skill-XXXXXX")"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/skills/$skill" "$work/evals"
rsync -a --exclude 'results/' "$src/" "$work/skills/$skill/"
rsync -a --exclude 'results/' "$cases/" "$work/evals/"
version="$(node -p "require('$root/packages/spec/package.json').version")"
mkdir -p "$work/.claude-plugin"
cat > "$work/.claude-plugin/plugin.json" <<JSON
{ "name": "cafekit-$skill", "version": "$version",
  "description": "temporary eval root for the CafeKit $skill skill",
  "skills": ["./skills/$skill"], "experimental": { "evals": "evals" } }
JSON
# Validate only: load every case, print the plan, spend nothing. The harness checks the
# cost ceiling before each run launches, so a ceiling of 0 stops it right after loading.
if [ "${1:-}" = "--validate" ]; then
  ( cd "$work" && claude plugin eval . --no-publish --trust-plugin --max-cost-usd 0 "${@:2}" ) \
    | grep -vE '^Note:|^Ablation: defaulting'
  exit 0
fi
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$root/evals/results/$skill/$stamp"; mkdir -p "$out"
set +e
( cd "$work" && claude plugin eval . --scaffold --no-publish --trust-plugin \
    --json "$out/result.json" --report "$out/report.html" "$@" )
status=$?
set -e
echo "results: $out (exit $status)"
exit $status
