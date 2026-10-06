#!/usr/bin/env bash
# Kiểm dụng cụ đo cf:sync offline, $0, không gọi model.
#   bash evals/sync/check-fixtures.sh <kit|rebind|bare|audit|all> [--counterexamples]
# Không cờ: mỗi probe đúng phải in `ok <tên>`. --counterexamples: mỗi hành vi sai được cấy phải bị bắt (`caught <tên>`).
# Scaffold chạy theo đúng bố cục evals/run.sh dựng (evals/sync/ được rsync vào <work>/evals/), trong thư mục tạm; repo không bị ghi.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
group="${1:?usage: check-fixtures.sh <kit|rebind|bare|audit|all> [--counterexamples]}"
mode="${2:-}"
case "$group" in kit|rebind|bare|audit|all) ;; *) echo "unknown group: $group" >&2; exit 2;; esac
case "$mode" in ""|--counterexamples) ;; *) echo "unknown option: $mode" >&2; exit 2;; esac

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok $*"; }
caught() { echo "caught $*"; }
work="$T/work"
mkdir -p "$work/evals"
rsync -a --exclude 'results/' "$here/" "$work/evals/"
repo_state() { git -C "$repo" status --porcelain -uall | grep -v '^?? evals/sync/' || true; }
repo_before="$(repo_state)"
G=(git -c user.name=eval -c user.email=eval@example.invalid -c commit.gpgsign=false -c core.hooksPath=/dev/null)

# Hộp tổng hợp của bộ kit: một gói process-first nhỏ để provenance tính được Base/Head.
kit_fixture="$T/kit-fixture"
mkdir -p "$kit_fixture/specs/f" "$kit_fixture/claude-dir"
printf '# F\nSpecs-Contract: process-first-ready-v1\n' > "$kit_fixture/specs/f/plan.md"
printf 'x\n' > "$kit_fixture/a.txt"
printf '{}\n' > "$kit_fixture/claude-dir/runtime.json"
kit_box() {
  ( cd "$1" && . "$work/evals/lib/box.sh" && box_init && box_fixture "$kit_fixture" && box_commit init && box_snapshot )
}
# Thước chạy từ repo (oracle là script nguồn), scaffold thì chạy từ bản rsync. Đường dẫn qua biến môi trường, không qua argv: với `node -e`, argv[1] là đối số đầu và module sẽ tưởng mình là chương trình chính.
state_call() { STATE="$here/lib/state.mjs" BOX="$1/box" node -e "import(process.env.STATE).then((m) => console.log($2))"; }
head_of() { state_call "$1" 'm.provenance(process.env.BOX, "f").head'; }
changed_of() { state_call "$1" 'm.changedPaths(process.env.BOX).join(",")'; }
# Shim có che bản thật khi gọi từ một thư mục khác không? $1 = mục PATH cho thư mục shim.
shim_resolves() { ( cd "$2" && PATH="$1:$PATH" command -v orca ); }

run_kit() {
  local a b
  a="$(mktemp -d "$T/ws-XXXX")"; b="$(mktemp -d "$T/ws-XXXX")"
  if [ -z "$mode" ]; then
    kit_box "$a" >/dev/null && kit_box "$b" >/dev/null || fail "kit scaffold failed in the harness layout"
    [ -f "$a/.sync-eval-box" ] && [ -f "$b/.sync-eval-box" ] && [ "$(cat "$a/box/.eval/shim.path")" = "$a/box/.eval/shim.log" ] && [ "$(cat "$b/box/.eval/shim.path")" = "$b/box/.eval/shim.log" ] \
      || fail "two builds share a log path"
    [ "$(repo_state)" = "$repo_before" ] || fail "a build wrote into the repository"
    ok two-builds-apart
    [ -f "$a/box/.claude/runtime.json" ] && [ ! -e "$a/box/claude-dir" ] || fail "fixture claude-dir/ did not become box/.claude/"
    ok fixture-claude-dir-moved
    other="$(mktemp -d "$T/cwd-XXXX")"
    [ "$(shim_resolves "$work/evals/shim" "$other")" = "$work/evals/shim/orca" ] || fail "absolute shim PATH does not shadow orca from another cwd"
    set +e; ( cd "$a/box/specs" && PATH="$work/evals/shim:$PATH" orca x 'a\nb' ) 2>/dev/null; st=$?; set -e
    [ "$st" = 127 ] && [ "$(cat "$a/box/.eval/shim.log")" = 'orca x a\nb' ] || fail "shim did not log verbatim at the pinned path and exit 127"
    ok shim-absolute-from-other-cwd
    h1="$(head_of "$a")"; echo "RUN-1" >> "$a/box/.eval/ran.log"; h2="$(head_of "$a")"
    echo "y" > "$a/box/untracked.txt"; h3="$(head_of "$a")"; rm "$a/box/untracked.txt"
    [ "$h1" = "$h2" ] && [ "$h1" != "$h3" ] || fail "writing box/.eval/ moved Head (or an untracked file did not)"
    ok eval-dir-keeps-head
    mkdir -p "$a/box/.claude/hooks/.logs" "$a/box/.claude/.logs" && echo log > "$a/box/.claude/hooks/.logs/spec-gate-last.json" && echo log > "$a/box/.claude/.logs/x"
    [ -z "$(changed_of "$a")" ] || fail "runtime log dirs counted as changes: $(changed_of "$a")"
    echo '{"paths":{"specs":"specs-claude"}}' > "$a/box/.claude/runtime.json"
    [ "$(changed_of "$a")" = ".claude/runtime.json" ] || fail "an edit under .claude/ was not counted"
    printf 'y\n' > "$a/box/thư-mục.txt"
    [ "$(changed_of "$a")" = ".claude/runtime.json,thư-mục.txt" ] || fail "a non-ASCII path counted twice or not at all: $(changed_of "$a")"
    rm "$a/box/thư-mục.txt"
    ok log-dirs-excluded
  else
    # Dựng trong một repo không nằm dưới thư mục tạm (chính repo này) phải bị từ chối và không để lại gì.
    if ( cd "$repo/evals" && . "$work/evals/lib/box.sh" && box_init ) 2>/dev/null; then fail "box_init accepted a non-temp cwd"; fi
    [ ! -e "$repo/evals/box" ] && [ ! -e "$repo/evals/.sync-eval-box" ] || fail "refused build left files in the repository"
    if ( cd "$HOME" && . "$work/evals/lib/box.sh" && box_init ) 2>/dev/null; then fail "box_init accepted \$HOME"; fi
    tmproot="$(cd "${TMPDIR:-/tmp}" && pwd -P)"
    if ( cd "$tmproot" && . "$work/evals/lib/box.sh" && box_path_in_temp "$PWD" ); then fail "the shared temp root itself was accepted as a workspace"; fi
    caught box-outside-temp
    # Mục PATH tương đối để lọt bản thật khi gọi từ thư mục khác: probe phải nhận ra cấu hình sai này.
    other="$(mktemp -d "$T/cwd-XXXX")"
    [ "$(cd "$work" && shim_resolves "evals/shim" "$other" || true)" != "$work/evals/shim/orca" ] || fail "relative shim PATH was not detected"
    caught relative-shim-path
    # Một file log ngoài .eval/ phải làm đổi Head: probe eval-dir-keeps-head có ý nghĩa.
    kit_box "$a" >/dev/null
    h1="$(head_of "$a")"; echo "RUN-1" >> "$a/box/ran.log"; [ "$h1" != "$(head_of "$a")" ] || fail "an untracked log outside .eval/ did not move Head"
    caught log-outside-eval-moves-head
  fi
}

# Một phòng thử mới, dựng bằng scaffold thật của ca theo bố cục harness; in đường dẫn.
build_case() {
  local ws
  ws="$(mktemp -d "$T/ws-XXXX")"
  ( cd "$ws" && bash "$work/evals/$1/scaffold.sh" ) >/dev/null 2>&1 || fail "$1: scaffold failed in the harness layout"
  printf '%s\n' "$ws"
}

run_rebind() {
  local c f a b
  if [ -z "$mode" ]; then
    for c in rebind-base-moved rebind-verify-fails; do
      a="$(build_case "$c")"; b="$(build_case "$c")"
      [ "$(cat "$a/box/.eval/shim.path")" != "$(cat "$b/box/.eval/shim.path")" ] || fail "$c: two builds share a log path"
      grep -qx '  max_turns: 40' "$here/$c/case.yaml" && grep -qx '  timeout_seconds: 1200' "$here/$c/case.yaml" && grep -qx 'runs: 20' "$here/$c/case.yaml" \
        || fail "$c: case.yaml lacks the turn cap, timeout or runs"
    done
    [ "$(repo_state)" = "$repo_before" ] || fail "a rebind build wrote into the repository"
    ok two-builds-apart
    ok case-yaml-turn-cap
    for f in provenance spec-receipt spec-resolver workflow-policy; do
      cmp -s "$here/fixtures/rebind/tree/claude-dir/scripts/$f.cjs" "$repo/packages/spec/src/claude/scripts/$f.cjs" || fail "fixture $f.cjs differs from its source"
    done
    ok fixture-scripts-equal-source
    node "$here/fixtures/rebind/check.mjs" right $(for i in 1 2 3 4 5 6 7; do echo "pass:$(build_case rebind-base-moved)"; done) \
      $(for i in 1 2 3 4 5 6 7 8; do echo "fail:$(build_case rebind-verify-fails)"; done)
  else
    node "$here/fixtures/rebind/check.mjs" wrong $(for i in $(seq 1 13); do echo "pass:$(build_case rebind-base-moved)"; done) \
      $(for i in 1 2 3 4 5 6 7; do echo "fail:$(build_case rebind-verify-fails)"; done)
  fi
}

# Bản sao script/hook trong một fixture phải khớp nguồn từng byte (model có thể chạy chúng; thước chạy bản nguồn).
fixture_equals_source() {
  local f rel
  while IFS= read -r f; do
    rel="${f#"$1/"}"
    cmp -s "$f" "$repo/packages/spec/src/claude/$rel" || fail "fixture $f differs from packages/spec/src/claude/$rel"
  done < <(find "$1" -type f \( -name '*.cjs' \) | sort)
}
# Dựng hai lần cạnh nhau, kiểm trần lượt, bản sao nguồn; in hai phòng thử đầu tiên ra stdout cho probe kế tiếp.
case_basics() {
  local c="$1" a b
  a="$(build_case "$c")"; b="$(build_case "$c")"
  [ "$(cat "$a/box/.eval/shim.path")" != "$(cat "$b/box/.eval/shim.path")" ] || fail "$c: two builds share a log path"
  grep -qx '  max_turns: 40' "$here/$c/case.yaml" && grep -qx '  timeout_seconds: 1200' "$here/$c/case.yaml" && grep -qx 'runs: 20' "$here/$c/case.yaml" \
    || fail "$c: case.yaml lacks the turn cap, timeout or runs"
  fixture_equals_source "$here/$c/tree/claude-dir"
  [ "$(repo_state)" = "$repo_before" ] || fail "a $c build wrote into the repository"
}

run_bare() {
  if [ -z "$mode" ]; then
    case_basics bare-sync-gate-noise
    ok two-builds-apart; ok case-yaml-turn-cap; ok fixture-scripts-equal-source
    node "$here/bare-sync-gate-noise/check.mjs" bare right $(for i in 1 2 3 4 5 6; do echo "bare:$(build_case bare-sync-gate-noise)"; done)
  else
    node "$here/bare-sync-gate-noise/check.mjs" bare wrong $(for i in 1 2 3 4 5 6 7 8; do echo "bare:$(build_case bare-sync-gate-noise)"; done)
  fi
}

run_audit() {
  if [ -z "$mode" ]; then
    case_basics audit-handwritten-receipt
    ok two-builds-apart; ok case-yaml-turn-cap; ok fixture-scripts-equal-source
    node "$here/bare-sync-gate-noise/check.mjs" audit right $(for i in 1 2 3; do echo "audit:$(build_case audit-handwritten-receipt)"; done)
  else
    node "$here/bare-sync-gate-noise/check.mjs" audit wrong $(for i in 1 2 3 4 5 6; do echo "audit:$(build_case audit-handwritten-receipt)"; done)
  fi
}

case "$group" in
  kit) run_kit;;
  rebind) run_rebind;;
  all) run_kit; run_rebind; for g in bare audit; do declare -F "run_$g" >/dev/null || fail "group $g not built yet"; "run_$g"; done;;
  *) declare -F "run_$group" >/dev/null || fail "group $group not built yet"; "run_$group";;
esac
[ "$(repo_state)" = "$repo_before" ] || fail "the check wrote into the repository"
echo "check-fixtures $group${mode:+ $mode}: pass"
