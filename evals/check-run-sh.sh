#!/usr/bin/env bash
# Proves, for $0, what `evals/run.sh --plugin-name` changes: a stub `claude` first on PATH copies the
# temporary plugin's .claude-plugin/plugin.json before run.sh's trap removes it. Without the flag the
# name is cafekit-<skill>; with it only the name changes; a bad or repeated name stops with exit 2
# before `claude` runs (no capture is written).
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
ok() { echo "ok: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat > "$tmp/bin/claude" <<'SH'
#!/usr/bin/env bash
# Stub: keep the plugin manifest the call would have used.
set -eu
cp "$PWD/.claude-plugin/plugin.json" "${CAPTURE:?}"
exit 0
SH
chmod +x "$tmp/bin/claude"

run() { # run <capture> <run.sh args...>; returns run.sh's status
  local cap="$1"; shift
  local st=0
  (cd "$repo" && PATH="$tmp/bin:$PATH" CAPTURE="$cap" bash evals/run.sh "$@") > "$cap.out" 2>&1 || st=$?
  return $st
}
name_of() { node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).name)' "$1"; }

run "$tmp/a.json" develop --validate || fail "develop --validate exited non-zero"
[ "$(name_of "$tmp/a.json")" = cafekit-develop ] || fail "default name is $(name_of "$tmp/a.json")"
ok "default name cafekit-develop"

run "$tmp/b.json" develop --plugin-name cf --validate || fail "develop --plugin-name cf --validate exited non-zero"
sed 's/"name": "cafekit-develop"/"name": "cf"/' "$tmp/a.json" | cmp -s - "$tmp/b.json" \
  || { diff "$tmp/a.json" "$tmp/b.json" >&2 || true; fail "--plugin-name cf changed more than the name"; }
ok "--plugin-name cf changes only the name"

run "$tmp/c.json" develop --with-skill specs --plugin-name cf --validate || fail "--with-skill specs --plugin-name cf exited non-zero"
[ "$(name_of "$tmp/c.json")" = cf ] && grep -q '"./skills/specs"' "$tmp/c.json" || fail "--plugin-name after --with-skill lost the name or the skill"
ok "--plugin-name after --with-skill"

for bad in Bad_Name CF Cf -cf "" "c f"; do
  st=0; run "$tmp/d.json" develop --plugin-name "$bad" --validate || st=$?
  [ "$st" = 2 ] && [ ! -e "$tmp/d.json" ] || fail "--plugin-name '$bad' gave exit $st or reached claude"
done
ok "invalid name exits 2 before claude"

st=0; run "$tmp/e.json" develop --plugin-name cf --plugin-name cg --validate || st=$?
[ "$st" = 2 ] && [ ! -e "$tmp/e.json" ] || fail "a repeated --plugin-name gave exit $st or reached claude"
ok "repeated flag exits 2 before claude"
