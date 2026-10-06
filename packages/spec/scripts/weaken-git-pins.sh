#!/usr/bin/env bash
# Prove the cf:git pins can fail. Builds a light copy (packages/spec without node_modules, plus README.md, docs/, plans/, and a git root, which the
# static section reads), requires `run-skill-self-tests.mjs --static-only` to pass there unweakened, then for each pin in the block between
# `git-skill-pins:start` and `git-skill-pins:end` of the self-test removes every `includes` sentence (or appends every `excludes` string) from the
# copy's skill text, one at a time, and requires the same command to fail. Never touches tracked bytes.
#   bash packages/spec/scripts/weaken-git-pins.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/packages"
rsync -a --exclude node_modules "$repo/packages/spec" "$tmp/packages/"
cp "$repo/README.md" "$tmp/" && rsync -a "$repo/docs" "$repo/plans" "$tmp/"
( cd "$tmp" && env -u GIT_DIR git init -q . )
run() { ( cd "$tmp" && node packages/spec/scripts/run-skill-self-tests.mjs --static-only >/dev/null 2>&1 ); }

run || { echo "FAIL: the unweakened copy does not pass --static-only" >&2; exit 1; }

pins="$tmp/pins.json"
node - "$repo/packages/spec/scripts/run-skill-self-tests.mjs" "$pins" <<'JS'
const fs = require("fs");
const [file, out] = process.argv.slice(2);
const m = fs.readFileSync(file, "utf8").match(/\/\/ git-skill-pins:start\nconst GIT_SKILL_PINS = (\[[\s\S]*?\n\]);\n\/\/ git-skill-pins:end/);
if (!m) { console.error("FAIL: no git-skill-pins block"); process.exit(1); }
fs.writeFileSync(out, JSON.stringify(JSON.parse(m[1])));
JS

total=0; caught=0
n="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).length)' "$pins")"
i=0
while [ "$i" -lt "$n" ]; do
  # one mutation per line: <weaken|plant|forbid>\t<file>\t<index in the list>
  mutations="$(node -e '
    const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))[Number(process.argv[2])];
    p.includes.forEach((_, k) => console.log(["weaken", p.file, k].join("\t")));
    (p.excludes || []).forEach((_, k) => console.log(["plant", p.file, k].join("\t")));
    (p.forbid || []).forEach((_, k) => console.log(["forbid", p.file, k].join("\t")));
  ' "$pins" "$i")"
  while IFS=$'\t' read -r kind file idx; do
    [ -n "$kind" ] || continue
    target="$tmp/packages/spec/$file"; cp "$target" "$target.orig"
    node - "$pins" "$i" "$kind" "$idx" "$target" <<'JS'
const fs = require("fs");
const [pinsFile, i, kind, idx, target] = process.argv.slice(2);
const pin = JSON.parse(fs.readFileSync(pinsFile, "utf8"))[Number(i)];
let text = fs.readFileSync(target, "utf8");
if (kind === "weaken") {
  const needle = pin.includes[Number(idx)];
  if (!text.includes(needle)) { console.error(`FAIL: sentence not in the copy: ${needle}`); process.exit(2); }
  text = text.replace(needle, "");
} else if (kind === "forbid") {
  text += "\n" + pin.forbid[Number(idx)].plant + "\n";
} else {
  text += "\n" + pin.excludes[Number(idx)] + "\n";
}
fs.writeFileSync(target, text);
JS
    total=$((total + 1))
    if run; then echo "SURVIVED: pin $i ($kind #$idx of $file)" >&2; else caught=$((caught + 1)); fi
    mv "$target.orig" "$target"
  done <<EOF_M
$mutations
EOF_M
  i=$((i + 1))
done
[ "$total" -gt 0 ] && [ "$total" = "$caught" ] || { echo "FAIL: $caught of $total weakened copies were caught" >&2; exit 1; }
echo "weaken-git-pins: unweakened pass, $caught/$total weakened copies fail"
