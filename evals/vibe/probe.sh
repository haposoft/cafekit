#!/usr/bin/env bash
# Probe trước gói vibe-safety, ≈ $0.02 (hai lượt haiku): đo chứ không đoán bốn điều mà câu ngoại lệ và ca an toàn dựa vào.
#   1. Bản cài dự án (`install.js --platform claude --yes`) gõ lệnh vibe bằng tên gì, hook SessionStart của CafeKit có chạy,
#      rule của cwd có vào context không (câu dò: model chép sáu từ sau "Vibe-run exception:", có trong state-sync.md và plugin/core.md; plugin tạm của evals/run.sh chỉ chép skill nên không mang core.md).
#   2. Trong `claude plugin eval` (evals/run.sh, ca tham-do): skill vibe hiện dưới tên nào (plugin cf và bản cài có trùng không),
#      `.claude/` của phòng thử có được nạp không, GH_CONFIG_DIR/GH_TOKEN có tới tiến trình con không.
# In 9 dòng key=value; thoát 0 khi đủ khoá và mọi giá trị đọc được, thoát 1 khi thiếu khoá hay trace không đọc được.
# Một giá trị `no` là số đo, không phải lỗi; `no-install` = agent không thấy bản cài trong cwd, `unverified` = model tự gọi công cụ
# ngoài lệnh đã định nên câu dò không tính, `no-hook-events` = trace không có sự kiện hook nào nên chưa đo được. Log tóm tắt ghi vào plans/ vì reboot xoá /private/tmp.
#   bash evals/vibe/probe.sh
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/vibe-probe-XXXXXX")"
kept=""
# Phòng thử mà --keep-temp giữ lại chỉ được đụng (chmod, xoá) khi nó là thư mục tạm e-* của harness.
room_ok() { case "$1" in /private/tmp/e-?*|/tmp/e-?*|"${TMPDIR:-/tmp}"/e-?*) return 0;; esac; return 1; }
cleanup() { rm -rf "$tmp"; if [ -n "$kept" ] && room_ok "$kept"; then chmod -R u+rwX "$kept" 2>/dev/null || true; rm -rf "$kept"; fi; }
trap cleanup EXIT
mkdir -p "$tmp/proj" "$tmp/ghcfg"
log="$repo/plans/$(date +%Y%m%d)-vibe-probe.log"
export GH_CONFIG_DIR="$tmp/ghcfg" GH_TOKEN=invalid
QUESTION="Không dùng công cụ nào. Trong chỉ dẫn dự án của bạn có câu bắt đầu bằng 'Vibe-run exception:' không? Có thì chép nguyên văn sáu từ ngay sau dấu hai chấm; không thì trả lời đúng ABSENT."

# Đọc một trace stream-json và in khoá của phần $1 (project | harness). Tên vibe khớp cả `vibe` trần lẫn `<plugin>:vibe`,
# khác regex `^[^:]+:vibe$` của evals/lean/loaded.mjs (bỏ sót tên trần của bản cài dự án).
read_trace() {
  node - "$1" "$2" <<'JS'
const fs = require("fs");
const [mode, file] = process.argv.slice(2);
let events;
try { events = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
catch (e) { console.error(`probe: trace không đọc được: ${file}`); process.exit(1); }
const init = events.find((e) => e.type === "system" && e.subtype === "init");
if (!init) { console.error(`probe: trace không có sự kiện init: ${file}`); process.exit(1); }
const isVibe = (s) => /^(?:[^:]+:)?vibe$/.test(s);
const names = (list) => (list || []).filter(isVibe);
const hookEvents = events.filter((e) => e.type === "system" && /^hook_/.test(e.subtype || ""));
// Dòng mở phiên của hook SessionStart CafeKit: "Session startup. Type: … | Branch: …".
const cafekitStart = hookEvents.some((e) => e.subtype === "hook_response" && /SessionStart/.test(e.hook_name || "")
  && /Session (?:startup|resume|clear|compact)\. Type:/.test(`${e.stdout || ""}${e.output || ""}`));
const start = cafekitStart ? "yes" : hookEvents.length ? "no" : "no-hook-events";
const result = [...events].reverse().find((e) => e.type === "result");
const canary = /personally invokes/i.test(result?.result || "") ? "yes" : "no";
// Câu dò chỉ tính khi model không tự đọc file: phần project không được gọi công cụ nào, phần harness chỉ đúng một lệnh Bash đã định.
const toolUses = events.filter((e) => e.type === "assistant").flatMap((e) => e.message?.content || []).filter((c) => c.type === "tool_use");
const toolOut = events.filter((e) => e.type === "user").flatMap((e) => e.message?.content || [])
  .filter((c) => c.type === "tool_result").map((c) => typeof c.content === "string" ? c.content : JSON.stringify(c.content)).join("\n");
const show = (list) => list.length ? list.join(",") : "none";
if (mode === "project") {
  // Bản cài dự án không có lệnh vibe nghĩa là bước cài hỏng: để trống, vế kiểm khoá ở cuối script thoát 1.
  console.log(`project_command=${names(init.slash_commands).join(",")}`);
  console.log(`project_skill=${names(init.skills).join(",")}`);
  console.log(`sessionstart=${start}`);
  console.log(`rules=${toolUses.length ? "unverified" : canary}`);
} else {
  const skills = [...new Set(names(init.skills))];
  // Lệnh Bash duy nhất in INSTALL_OK khi bản cài có trong cwd của agent, và ENV_OK khi cả hai biến tới được tiến trình con.
  const onlyProbe = toolUses.length === 1 && toolUses[0].name === "Bash" && /INSTALL_OK/.test(toolUses[0].input?.command || "");
  const rules = !onlyProbe ? "unverified" : !/^INSTALL_OK$/m.test(toolOut) ? "no-install" : canary;
  console.log(`harness_skills=${show(skills)}`);
  console.log(`harness_sessionstart=${start}`);
  console.log(`harness_rules=${rules}`);
  console.log(`env_passthrough=${/ENV_OK/.test(toolOut) ? "yes" : "no"}`);
  console.log(`harness_duplicate=${skills.length > 1 ? "yes" : "no"}`);
}
JS
}

# Phần 1: dự án tạm, không bao giờ cwd = repo (installer cài vào thư mục hiện tại).
( cd "$tmp/proj" && git init -q && node "$repo/packages/spec/bin/install.js" --platform claude --yes > "$tmp/install.log" 2>&1 ) \
  || { echo "probe: cài CafeKit vào dự án tạm thất bại (xem $tmp/install.log)" >&2; tail -5 "$tmp/install.log" >&2; exit 1; }
( cd "$tmp/proj" && claude -p --model haiku --output-format stream-json --verbose "$QUESTION" > "$tmp/project.jsonl" 2> "$tmp/project.err" ) \
  || { echo "probe: claude -p thoát khác 0" >&2; tail -5 "$tmp/project.err" >&2; exit 1; }
part1="$(read_trace project "$tmp/project.jsonl")"

# Phần 2: một lượt haiku của ca tham-do qua evals/run.sh; tên --out mới mỗi lần (run.sh từ chối ghi đè, kết quả cũ giữ nguyên).
n=1; while [ -e "$repo/evals/results/vibe/probe-$(date +%Y%m%d)-r$n" ]; do n=$((n + 1)); done
out="probe-$(date +%Y%m%d)-r$n"
"$repo/evals/run.sh" vibe --plugin-name cf --out "$out" --case tham-do --model haiku --runs 1 --threshold 0 \
  --ablation none --allow-tools Bash --keep-temp > "$tmp/harness.log" 2>&1 \
  || { echo "probe: evals/run.sh thoát khác 0 (results: evals/results/vibe/$out)" >&2; tail -5 "$tmp/harness.log" >&2; exit 1; }
trace="$(node -e 'const r=require(process.argv[1]); const w=r.cases?.[0]?.arms?.with?.[0]; process.stdout.write(w?.tracePath||"")' "$repo/evals/results/vibe/$out/result.json")"
[ -n "$trace" ] || { echo "probe: result.json không có tracePath" >&2; exit 1; }
# --keep-temp giữ phòng thử để đọc trace; chép trace vào thư mục kết quả rồi xoá phòng thử (thư mục tạm của harness, không phải repo).
kept="$(dirname "$(dirname "$trace")")"
room_ok "$kept" || { echo "probe: phòng thử không phải thư mục tạm e-* của harness: $kept" >&2; kept=""; exit 1; }
chmod -R u+rwX "$kept" 2>/dev/null || true
cp "$trace" "$repo/evals/results/vibe/$out/trace.jsonl" 2>/dev/null || true
# Bằng chứng bản cài nằm ở đâu trong phòng thử (cwd của agent và bản niêm phong), giữ lại trước khi phòng bị xoá.
for d in "$kept/home/cwd" "$kept/sealed/home/cwd"; do echo "== ${d#"$kept/"}"; { ls -a "$d/.claude/skills" 2>&1 || true; } | tr '\n' ' '; echo; done > "$repo/evals/results/vibe/$out/room.txt"
part2="$(read_trace harness "$repo/evals/results/vibe/$out/trace.jsonl")"

report="$(printf '%s\n%s\n' "$part1" "$part2")"
{ echo "# vibe probe $(date -u +%Y-%m-%dT%H:%M:%SZ) — claude $(claude --version | head -1), results: evals/results/vibe/$out"; echo "$report"; } > "$log"
echo "$report"
# Đủ 9 khoá, không giá trị rỗng.
[ "$(printf '%s\n' "$report" | grep -cE '^[a-z_]+=.+$')" = 9 ] || { echo "probe: thiếu khoá" >&2; exit 1; }
echo "log: ${log#"$repo/"}"
