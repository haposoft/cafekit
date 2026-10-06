#!/usr/bin/env bash
# The scout, fix and ask skills moved out of the inspect, hotfix and question directories, because a
# host names a project skill by its directory and callers ask for cf:scout, cf:fix and cf:ask.
# This check proves two things the unit tests cannot:
#   1. no source file still points at an old directory, except the lines listed below, each with
#      the reason it must keep the old name (JavaScript and JSON only; Markdown is not scanned);
#   2. a real upgrade from an install made before the move retires the old directories — nothing
#      under --dry-run, then removal — and every runtime's catalog lists the three public names.
set -euo pipefail
pkg="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$pkg/../.." && pwd)"
old_ref="${OLD_REF:-e083bd9}"
ok() { echo "ok: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

# file|line regex — why the old name must stay
allow=(
  'src/claude/migration-manifest.json|^ *"(inspect|hotfix|question)",?$'
  'src/claude/scripts/generate-skill-catalog.cjs|^ *'"'"'(inspect|hotfix|question)'"'"',$'
  'src/claude/runtime.json|"inspect": \{'
  'src/codex/runtime.json|"inspect": \{'
  'src/omp/runtime.json|"inspect": \{'
  'src/claude/runtime.schema.json|"inspect": \{'
  'src/claude/hooks/inspect-block.cjs|"inspect": \{ "enabled": false \}'
  'bin/__tests__/package-inventory.test.js|existsSync\(path\.join\(skillRoot, '"'"'(inspect|question)'"'"'\)\), false'
  'bin/__tests__/package-inventory.test.js|existsSync\(path\.join\(skillsRoot, '"'"'hotfix'"'"'\)\), false'
  'bin/__tests__/package-inventory.test.js|(ask|scout|question|inspect):\s*.*'"'"'(question|inspect)'"'"''
  'bin/__tests__/codex-native.test.js|existsSync\(path\.join\(root, .*(inspect|question|hotfix).*false'
  'bin/__tests__/codex-native.test.js|fs\.existsSync\(path\.join\(root, '"'"'\.agents'"'"', '"'"'skills'"'"', '"'"'(inspect|question)'"'"'\)\),$'
  'bin/__tests__/codex-native.test.js|\[.ask., .question., .contact.\]'
  'scripts/run-skill-self-tests.mjs|\[.ask., .question., .contact.\]'
  'scripts/run-skill-self-tests.mjs|(required|obsolete\.skills)\.includes\("(question|hotfix)"\)'
  'scripts/run-skill-self-tests.mjs|content\.includes\('"'"'"inspect"'"'"'\)'
  'bin/__tests__/optional-skill-inventory.test.js|(\[.inspect., .hotfix., .question.\]|.inspect., .hotfix., .question.$|, .hotfix., .SKILL\.md.|directory === .hotfix.)'
  'bin/__tests__/skill-routing-source.test.js|(writeSkill\(skills, .question.|item\.directory === .question.|renamed of \[)'
)
# reasons, in the same order: retired lists (2); the runtime broad-search guard key (5); inverted
# assertions that the old directories are absent (4); cafekit-web docs slugs, another repository (1);
# an unrelated "question" action word (2); retirement probes and the guard key probe (2); the
# migration test itself (1); the retired-copy routing fixture (1)

matches="$(cd "$pkg" && grep -rnE "skills/(inspect|hotfix|question)\b|['\"](inspect|hotfix|question)['\"]" src bin scripts \
  --include='*.js' --include='*.cjs' --include='*.mjs' --include='*.json' || true)"
unlisted=0
while IFS= read -r hit; do
  [ -n "$hit" ] || continue
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest#*:}"
  [ "$file" = "scripts/check-skill-rename.sh" ] && continue
  listed=0
  for entry in "${allow[@]}"; do
    [ "${entry%%|*}" = "$file" ] || continue
    if printf '%s\n' "$line" | grep -qE "${entry#*|}"; then listed=1; break; fi
  done
  if [ "$listed" = 0 ]; then echo "unlisted: $hit" >&2; unlisted=$((unlisted + 1)); fi
done <<< "$matches"
[ "$unlisted" = 0 ] || fail "$unlisted reference(s) to an old skill directory are not allowlisted"
ok "no unlisted reference to skills/inspect, skills/hotfix or skills/question"

work="$(mktemp -d)"
cleanup() {
  git -C "$repo" worktree remove --force "$work/old" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
git -C "$repo" worktree add -q --detach "$work/old" "$old_ref"
# A worktree holds sources only; the installer's dependencies are unchanged since the old ref, so the
# old installer borrows this checkout's node_modules rather than reinstalling them.
ln -s "$pkg/node_modules" "$work/old/packages/spec/node_modules"
project="$work/project"; mkdir -p "$project"
( cd "$project" && node "$work/old/packages/spec/bin/install.js" --platform claude,codex -y ) >/dev/null
for dir in .claude/skills .agents/skills; do
  for old in inspect hotfix question; do
    [ -f "$project/$dir/$old/SKILL.md" ] || fail "the $old_ref install did not create $dir/$old"
  done
done
ok "the $old_ref install created inspect, hotfix and question for claude and codex"

tree_hash() { ( cd "$project" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 ); }
before="$(tree_hash)"
( cd "$project" && node "$pkg/bin/install.js" --platform claude,codex --dry-run -y ) >/dev/null
[ "$(tree_hash)" = "$before" ] || fail "--dry-run changed a file in the project"
for dir in .claude/skills .agents/skills; do
  for old in inspect hotfix question; do
    [ -f "$project/$dir/$old/SKILL.md" ] || fail "--dry-run removed $dir/$old"
  done
  for new in scout fix ask; do
    [ ! -e "$project/$dir/$new" ] || fail "--dry-run created $dir/$new"
  done
done
ok "--dry-run changes nothing"

( cd "$project" && node "$pkg/bin/install.js" --platform claude,codex -y ) >/dev/null
for dir in .claude/skills .agents/skills; do
  for old in inspect hotfix question; do
    [ ! -e "$project/$dir/$old" ] || fail "upgrade left $dir/$old"
  done
  for new in scout fix ask; do
    [ -f "$project/$dir/$new/SKILL.md" ] || fail "upgrade did not install $dir/$new"
  done
done
ok "upgrade removed the three old directories and installed scout, fix and ask for claude and codex"

for runtime in .claude .codex; do
  catalog="$(cd "$project" && node "$runtime/scripts/generate-skill-catalog.cjs" --json)"
  for id in cf:scout cf:fix cf:ask; do
    printf '%s' "$catalog" | node -e '
      const c = JSON.parse(require("fs").readFileSync(0, "utf8"));
      process.exit(c.skills.some((s) => s.public_id === process.argv[1]) ? 0 : 1);' "$id" \
      || fail "$runtime catalog is missing $id"
  done
done
ok "both catalogs list cf:scout, cf:fix and cf:ask"
