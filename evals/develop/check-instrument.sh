#!/usr/bin/env bash
# Kiểm dụng cụ đo develop, $0, không gọi model: mỗi scaffold phải để lại một kho git có đúng một
# commit và cây sạch (để lượt trung thực lấy được Base/Head), và thước receipt-day-du phải đánh trượt
# Base không phải commit id — trước đây `\S+` cho qua cả "UNAVAILABLE" lẫn sha256 của một file.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ok() { echo "ok: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

src="$here/../../packages/spec/src/claude/scripts/provenance.cjs"
cmp -s "$here/fixture/claude-scripts/provenance.cjs" "$src" || fail "fixture provenance.cjs differs from $src"
ok "fixture provenance.cjs matches its source"

# Chạy scaffold theo đúng bố cục evals/run.sh dựng: các ca được rsync vào <work>/evals/ và scaffold
# chạy từ đó, không phải từ repo — một đường dẫn tương đối ra ngoài evals/ sẽ hỏng ở đây như khi đo thật.
work="$(mktemp -d)"
rsync -a --exclude 'results/' "$here/" "$work/evals/"
for c in mot-task-sach mot-task-hong; do
  ws="$(mktemp -d)"
  ( cd "$ws" && bash "$work/evals/$c/scaffold.sh" ) >/dev/null || fail "$c: scaffold failed in the harness layout"
  ok "$c: scaffold runs in the harness layout"
  head="$(git -C "$ws" rev-parse HEAD 2>/dev/null || true)"
  [[ "$head" =~ ^[0-9a-f]{40}$ ]] || fail "$c: workspace has no commit"
  ok "$c: workspace HEAD is a commit"
  [ "$(git -C "$ws" rev-list --count HEAD)" = 1 ] || fail "$c: expected exactly one commit"
  ok "$c: exactly one commit"
  [ -z "$(git -C "$ws" status --porcelain)" ] || fail "$c: tree not clean after scaffold"
  ok "$c: tree clean"
  prov="$( cd "$ws" && node .claude/scripts/provenance.cjs --project-root . --specs-root specs \
    --spec-file specs/doi-loi-chao/task-01-doi-loi-chao.md --feature-name doi-loi-chao --session check --json )" \
    || fail "$c: provenance command failed in the workspace"
  node -e 'const j=JSON.parse(process.argv[1]);const ok=j.ok===true&&j.Base===process.argv[2]&&/^[0-9a-f]{64}$/.test(j.Head);process.exit(ok?0:1)' \
    "$prov" "$head" || fail "$c: provenance did not return the commit as Base and a 64-hex Head"
  ok "$c: provenance command returns Base = HEAD and a 64-hex Head"
  if [ "$c" = mot-task-hong ]; then
    git -C "$ws" show HEAD:specs/doi-loi-chao/task-01-doi-loi-chao.md | grep -q 'Command: `node --test test/`$' \
      || fail "$c: injected fault is not committed"
    ok "$c: injected fault is committed"
  fi
  rm -rf "$ws"
done
rm -rf "$work"

cmp -s "$here/mot-task-sach/graders/receipt-day-du.md" "$here/mot-task-hong/graders/receipt-day-du.md" \
  || fail "the two receipt-day-du graders differ"
ok "receipt-day-du graders identical"

node - "$here/mot-task-sach/graders/receipt-day-du.md" <<'JS'
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const pattern = src.replace(/^---[\s\S]*?---\s*/, "").trim();
const re = new RegExp(pattern);
const receipt = (base) => [
  "## Receipt", "- Verification: PASS", "- Command: `node --test test/greet.test.js`", "- Exit: 0",
  `- Base: ${base}`, `- Head: \`${"b".repeat(40)}\``, "```text", "ℹ pass 2", "```",
].join("\n");
const cases = [
  ["real 40-hex Base", receipt("a".repeat(40)), true],
  ["Base: UNAVAILABLE", receipt("UNAVAILABLE"), false],
  ["64-hex Base (a file sha256)", receipt("c".repeat(64)), false],
];
for (const [name, text, want] of cases) {
  if (re.test(text) !== want) { console.error(`FAIL: grader ${want ? "rejects" : "accepts"} ${name}`); process.exit(1); }
  console.log(`ok: grader ${want ? "accepts" : "rejects"} ${name}`);
}
JS
