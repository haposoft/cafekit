#!/usr/bin/env bash
# Run `claude plugin eval` for one CafeKit skill.
#
#   evals/run.sh <skill> [claude plugin eval options...]
#   evals/run.sh specs                       # full suite, ablation with-without
#   evals/run.sh specs --case dung-o-c1 --runs 1 --ablation none --model opus
#   evals/run.sh specs --validate         # load every case and print the plan, $0
#   evals/run.sh specs --with-skill brainstorm --out du-cua-sonnet --model sonnet \
#     --judge-model sonnet --runs 10 --threshold 0 --ablation none --tag du-cua
#   evals/run.sh specs --out sonnet-single --model sonnet --judge-model sonnet --runs 3 \
#     --threshold 0 --tag single-turn
#   evals/run.sh specs --out sonnet-history --model sonnet --judge-model sonnet --runs 3 \
#     --threshold 0 --ablation none --allow-tools Write Edit --tag history
#   evals/run.sh code-review --with-agent code-auditor --out pilot-x --model sonnet \
#     --judge-model sonnet --runs 1 --threshold 0 --ablation none --allow-tools Bash Agent
#     # a case that measures an agent needs it loaded the way the product ships it
#   evals/run.sh test --plugin-name cf --out pilot-x --model sonnet --runs 1 --case sach
#     # the plugin is named cf, so the eval host lists the skill as cf:test (default cafekit-<skill>)
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

# `--with-skill <name>`, repeatable: load a second skill beside the one under test. A case that
# asks an under-specified question can only choose between doors that exist, and with one skill
# loaded the only alternatives are that skill or no skill at all — which is not the world the
# product ships. Refuse an unknown name rather than building a plugin that silently lacks it.
# `--with-agent <name>`, repeatable and in any order with `--with-skill`: copy an agent into the
# plugin's agents/ folder, which the harness loads by default, so a case can measure the agent
# the way the product ships it. `--plugin-name <name>`, at most once: name the temporary plugin, so
# the host lists the skill as <name>:<skill> instead of cafekit-<skill>:<skill>. All three flags come
# right after <skill>, before --validate or --out.
extra=()
agents=()
plugin_name="cafekit-$skill"
named_plugin=0
while [ "${1:-}" = "--with-skill" ] || [ "${1:-}" = "--with-agent" ] || [ "${1:-}" = "--plugin-name" ]; do
  if [ "$1" = "--plugin-name" ]; then
    [ "$named_plugin" = 0 ] || { echo "--plugin-name is given once" >&2; exit 2; }
    name="${2:-}"
    # A regex, not a case range: bash 3.2 under a UTF-8 locale lets [a-z] match capitals.
    [[ "$name" =~ ^[a-z0-9][a-z0-9-]*$ ]] && [[ ! "$name" =~ [A-Z] ]] \
      || { echo "--plugin-name takes a name of a-z, 0-9 and -, not starting with -" >&2; exit 2; }
    plugin_name="$name"
    named_plugin=1
  elif [ "$1" = "--with-skill" ]; then
    name="${2:?usage: --with-skill <name>}"
    [ -f "$root/packages/spec/src/claude/skills/$name/SKILL.md" ] \
      || { echo "no skill at packages/spec/src/claude/skills/$name" >&2; exit 2; }
    extra+=("$name")
  else
    name="${2:?usage: --with-agent <name>}"
    case "$name" in *[!A-Za-z0-9._-]*|.|..) echo "--with-agent takes one agent name" >&2; exit 2;; esac
    [ -f "$root/packages/spec/src/claude/agents/$name.md" ] \
      || { echo "no agent at packages/spec/src/claude/agents/$name.md" >&2; exit 2; }
    agents+=("$name")
  fi
  shift 2
done

work="$(mktemp -d "${TMPDIR:-/tmp}/cafekit-eval-$skill-XXXXXX")"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/skills/$skill" "$work/evals"
rsync -a --exclude 'results/' "$src/" "$work/skills/$skill/"
rsync -a --exclude 'results/' "$cases/" "$work/evals/"
skill_list="\"./skills/$skill\""
for name in ${extra[@]+"${extra[@]}"}; do
  mkdir -p "$work/skills/$name"
  rsync -a --exclude 'results/' "$root/packages/spec/src/claude/skills/$name/" "$work/skills/$name/"
  skill_list="$skill_list, \"./skills/$name\""
done
for name in ${agents[@]+"${agents[@]}"}; do
  mkdir -p "$work/agents"
  cp "$root/packages/spec/src/claude/agents/$name.md" "$work/agents/$name.md"
done
version="$(node -p "require('$root/packages/spec/package.json').version")"
mkdir -p "$work/.claude-plugin"
cat > "$work/.claude-plugin/plugin.json" <<JSON
{ "name": "$plugin_name", "version": "$version",
  "description": "temporary eval root for the CafeKit $skill skill",
  "skills": [$skill_list], "experimental": { "evals": "evals" } }
JSON
# Validate only: load every case, print the plan, spend nothing. The harness checks the cost
# ceiling before each run launches, so a ceiling of 0 stops it right after loading and exits 2.
# Exit 2 there means "stopped at the ceiling", not "a case is broken", and the old `exit 0` said
# the opposite: it reported success even when a case failed to load. Translate instead — a clean
# load prints no `✗` line and exits 0 here; any load error prints its output and exits 1.
if [ "${1:-}" = "--validate" ]; then
  set +e
  validate_out="$( cd "$work" && claude plugin eval . --no-publish --trust-plugin --max-cost-usd 0 "${@:2}" 2>&1 )"
  validate_status=$?
  set -e
  # `grep -v` exits 1 when it filters every line, which `set -e` would turn into a silent death.
  printf '%s\n' "$validate_out" | grep -vE '^Note:|^Ablation: defaulting' || true
  if printf '%s\n' "$validate_out" | grep -q '✗'; then exit 1; fi
  if [ "$validate_status" = 0 ] || [ "$validate_status" = 2 ]; then exit 0; fi
  exit 1
fi
# `--out <name>` fixes the result directory so a task Receipt can name it before the run and
# quote it afterwards. Without it the directory stays timestamped.
name="$(date -u +%Y%m%dT%H%M%SZ)"
named=0
if [ "${1:-}" = "--out" ]; then
  name="${2:?usage: evals/run.sh <skill> --out <name> [options]}"
  case "$name" in *[!A-Za-z0-9._-]*|.|..) echo "--out takes one directory name" >&2; exit 2;; esac
  named=1
  shift 2
fi
out="$root/evals/results/$skill/$name"
if [ "$named" = 1 ] && [ -e "$out" ]; then
  echo "refusing to overwrite existing results at $out; remove it first" >&2
  exit 2
fi
mkdir -p "$out"
set +e
( cd "$work" && claude plugin eval . --scaffold --no-publish --trust-plugin \
    --json "$out/result.json" --report "$out/report.html" "$@" )
status=$?
set -e
echo "results: $out (exit $status)"
exit $status
