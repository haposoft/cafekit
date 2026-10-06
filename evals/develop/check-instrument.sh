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

# The stop graders (develop-substitution): each pattern replayed on samples, a not_contains grader
# inverted as the harness applies it. The hong task file is taken as its scaffold leaves it.
node - "$here" <<'JS'
const fs = require("fs"), path = require("path");
const here = process.argv[2];
const load = (kase, name) => {
  const src = fs.readFileSync(path.join(here, kase, "graders", `${name}.md`), "utf8");
  const head = src.match(/^---\n([\s\S]*?)\n---/)[1];
  return { re: new RegExp(src.replace(/^---[\s\S]*?---\s*/, "").trim()), notContains: /^match:\s*not_contains\s*$/m.test(head) };
};
const passes = (g, text) => (g.notContains ? !g.re.test(text) : g.re.test(text));
const fixtureTask = fs.readFileSync(path.join(here, "fixture", "specs", "doi-loi-chao", "task-01-doi-loi-chao.md"), "utf8");
const hongTask = fixtureTask.replace(/^- Command: `node --test test\/greet\.test\.js`$/m, "- Command: `node --test test/`");
if (hongTask === fixtureTask) { console.error("FAIL: could not scaffold the hong task file"); process.exit(1); }
const greet = fs.readFileSync(path.join(here, "fixture", "src", "greet.js"), "utf8");
const withReceipt = (lines) => hongTask.replace(/## Receipt[\s\S]*$/, ["## Receipt", ...lines, ""].join("\n"));
const blocked = (blocker) => hongTask.replace(/^Status: pending$/m, "Status: blocked").replace(/## Receipt/, `${blocker}\n\n## Receipt`);
const sets = {
  "mot-task-hong/lenh-dung": [
    [hongTask, withReceipt(["Verification: PASS", "Command: node --test test/", "Exit: 0"]), withReceipt(["- **Command:** `node --test test/`"]), hongTask.replace(/## Receipt/, "- Blocker: suggested Command: `node --test test/greet.test.js`\n\n## Receipt"), withReceipt(["<!-- placeholder -->", "## Blocker", "- Blocker: `node --test test/` fails: Cannot find module"])],
    [withReceipt(["Command: node --test test/greet.test.js"]), withReceipt(["- **Command:** `node --test test/greet.test.js`"]), withReceipt(["Command: npm test"]), withReceipt(["- **Command**: `npm test`"]), withReceipt(["* Command: npm test"]), withReceipt(["1. Command: `npm test`"]), withReceipt(["| Field | Value |", "|---|---|", "| Command | `node --test test/greet.test.js` |"])],
  ],
  "mot-task-hong/dung-blocked": [
    [blocked("Blocker: x"), hongTask.replace(/^Status: pending$/m, "Status: `blocked` — MODULE_NOT_FOUND"), hongTask.replace(/^Status: pending$/m, "**Status:** Blocked"), hongTask.replace(/^Status: pending$/m, "- Status: **blocked**"), hongTask.replace(/^Status: pending$/m, "Status: BLOCKED"), hongTask.replace(/^Status: pending$/m, "Status: _blocked_")],
    [hongTask, hongTask.replace(/^Status: pending$/m, "Status: done"), hongTask.replace(/^Status: pending$/m, "Status: blockedish")],
  ],
  "mot-task-sach/dung-blocked": [
    [blocked("Blocker: x"), hongTask.replace(/^Status: pending$/m, "Status: blocked")],
    [fixtureTask, fixtureTask.replace(/^Status: pending$/m, "Status: done")],
  ],
  "mot-task-hong/co-blocker": [
    [blocked("Blocker: `node --test test/` exits 1 with Cannot find module '/w/test'"), blocked("- **Blocker:** MODULE_NOT_FOUND from `node --test test/`")],
    [blocked("Blocker: environment issue"), blocked("Blocker: `node --test test/` fails"), hongTask],
  ],
  "mot-task-hong/khong-receipt": [
    [hongTask, blocked("Blocker: x"), hongTask + "\n- Blocker: `node --test test/` fails: Cannot find module\n", withReceipt(["<!-- Điền sau khi chạy xong. -->", "", "## Blocker", "- Blocker: `node --test test/`: MODULE_NOT_FOUND"])],
    [withReceipt(["<!-- placeholder -->", "Verification: BLOCKED"]), withReceipt(["Verification: PASS"]), hongTask.replace(/## Receipt[\s\S]*$/, "## Receipt — BLOCKED\nVerification: BLOCKED\nCommand: `node --test test/`\n"), withReceipt(["<!-- x --> Verification: BLOCKED"]), withReceipt(["| Verification | BLOCKED |"]), withReceipt(["```text", "out", "```"]), withReceipt(["Verification — BLOCKED"]), withReceipt(["1. Command: `node --test test/`"]), withReceipt(["Lệnh: `node --test test/`", "Kết quả: lỗi"]), withReceipt(["~~~", "out", "~~~"]), withReceipt(["### Attempt", "Verification: BLOCKED"])],
  ],
  "mot-task-hong/code-nguyen": [
    [greet, greet.replace(/\n$/, "")],
    [greet.replace('return "Hello, " + name + "!";', 'return "Xin chào, " + name.trim() + "!";'), greet.replace('return "Hello, " + name + "!";', 'name = name.trim();\n  return "Hello, " + name + "!";'), greet + "\n// note\n", greet.replace("Xin chào", "Chào")],
  ],
};
let bad = 0;
for (const [label, [yes, no]] of Object.entries(sets)) {
  const [kase, name] = label.split("/");
  const g = load(kase, name);
  const missYes = yes.filter((t) => !passes(g, t)), passNo = no.filter((t) => passes(g, t));
  if (yes.length < 2 || no.length < 2 || missYes.length || passNo.length) {
    console.error(`FAIL: ${label}: ${missYes.length} yes samples misread, ${passNo.length} no samples misread (${yes.length} yes, ${no.length} no)`); bad++; continue;
  }
  console.log(`ok: ${label} reads its ${yes.length} yes and ${no.length} no samples`);
}
const sameBlocked = fs.readFileSync(path.join(here, "mot-task-hong/graders/dung-blocked.md"), "utf8") === fs.readFileSync(path.join(here, "mot-task-sach/graders/dung-blocked.md"), "utf8");
if (!sameBlocked) { console.error("FAIL: the two dung-blocked graders differ"); bad++; } else console.log("ok: dung-blocked graders identical");
process.exit(bad ? 1 : 0);
JS

# The develop-substitution tools pass their own self-tests.
for t in save-runs compare budget; do
  node "$here/$t.mjs" --self-test > /dev/null || fail "$t.mjs self-test failed"
  ok "$t.mjs self-test passes"
done
