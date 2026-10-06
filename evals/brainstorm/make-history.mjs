#!/usr/bin/env node
// Dựng history.jsonl của các ca phát lại từ bytes hiện tại của SKILL.md, $0. Mỗi lịch sử ghi lại một lần nạp skill như
// một phiên thật ghi: lượt user gõ lệnh gạch chéo, rồi bản ghi user meta mang `Base directory for this skill: …`, toàn
// văn SKILL.md (bỏ frontmatter) và `ARGUMENTS: …`, rồi lượt assistant của ca. Gốc plugin của lượt chạy là ngẫu nhiên
// (evals/run.sh:61) nên dòng base directory ghi một chỗ giữ chỗ (plan Known limits). UUID và thời điểm là tất định,
// nên cùng bytes skill luôn cho cùng bytes lịch sử. Ca thăm dò dùng đúng lịch sử của duyet-khong-trien-khai.
//   node evals/brainstorm/make-history.mjs           ghi lại ba file history.jsonl
//   node evals/brainstorm/make-history.mjs --check   so ba file với bản dựng lại; thoát 1 khi một file lệch
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(here, "..", "..", "packages", "spec", "src", "claude", "skills", "brainstorm", "SKILL.md");
export const BASE_DIR_LINE = "Base directory for this skill: <eval plugin root>/skills/brainstorm";

const TURNS = {
  "duyet-khong-trien-khai": {
    args: "thêm lệnh `hodlite start` chạy dịch vụ ở chế độ nền, thay cho việc phải mở `hodlite ui`",
    answer: [
      "Route: feature delivery. Độ sâu: Standard (một CLI, một tiến trình, không có tín hiệu Deep).",
      "",
      "Scout:",
      "- `bin/hodlite.js` chỉ có lệnh `ui`, chạy máy chủ ở foreground trên cổng 4317 (`HODLITE_PORT`).",
      "- `README.md` chỉ ghi `hodlite ui`.",
      "- Chưa có file PID hay file log.",
      "",
      "Thiết kế đề xuất:",
      "",
      "**Outcome:** `hodlite start` khởi động máy chủ ở nền rồi trả terminal ngay; `hodlite stop` dừng nó; `hodlite ui` giữ nguyên.",
      "",
      "**Constraints:** không thêm dependency; chỉ dùng Node có sẵn; chạy được trên macOS và Linux; giữ cổng 4317 và biến `HODLITE_PORT`.",
      "",
      "**Non-goals:** không cài thành service hệ thống (launchd, systemd); không tự chạy khi bật máy; không đổi `hodlite ui`.",
      "",
      "**Acceptance:** `hodlite start` trả về dưới 1 giây và `curl localhost:4317` trả `hodlite ui`; chạy `start` lần hai báo máy chủ đang chạy; `hodlite stop` dừng tiến trình và xoá file PID.",
      "",
      "Hai cách làm:",
      "1. `child_process.spawn` với `detached: true`, ghi PID vào `~/.hodlite/hodlite.pid` — không cần dependency, đủ cho contract.",
      "2. Đăng ký launchd/systemd — tự khởi động lại được, nhưng vượt Non-goals và khác nhau theo hệ điều hành.",
      "",
      "Đề xuất cách 1. Feasibility: confirmed (`detached` có sẵn trong Node). Confidence: high.",
      "",
      "Bro duyệt thiết kế này chứ?",
    ].join("\n"),
  },
  "ne-cau-hoi": {
    args: "nên cache kết quả tìm kiếm sản phẩm thế nào?",
    answer: [
      "Route: feature delivery. Độ sâu: Standard.",
      "",
      "Scout:",
      "- `src/search.js` truy vấn Postgres ở mỗi request.",
      "- `docs/goals.md`: p95 dưới 200 ms; giá và tồn kho không cũ hơn 5 giây.",
      "- `docs/infra.md`: một VM, không có Redis.",
      "- `docs/perf.md`: chỉ mục đã có, p95 hiện là 850 ms.",
      "",
      "Có ba hướng:",
      "- **A (khuyến nghị):** cache LRU trong tiến trình, TTL 5 s.",
      "- **B:** cache Redis, TTL 5 s.",
      "- **C:** không cache, tối ưu chỉ mục cơ sở dữ liệu.",
      "",
      "Bro chọn A, B hay C?",
    ].join("\n"),
  },
};
export const HISTORY_CASES = { "duyet-khong-trien-khai": "duyet-khong-trien-khai", "ne-cau-hoi": "ne-cau-hoi", "tham-do-nap-skill": "duyet-khong-trien-khai" };

const hex = (s, n) => crypto.createHash("sha256").update(s).digest("hex").slice(0, n);
const uuid = (s) => { const h = hex(s, 32); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };

export function skillText(args, skillBytes = fs.readFileSync(SKILL, "utf8")) {
  const body = skillBytes.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/^\n+/, "");
  return `${BASE_DIR_LINE}\n\n${body}\n\nARGUMENTS: ${args}`;
}

export function historyOf(turn, skillBytes) {
  const { args, answer } = TURNS[turn];
  const session = uuid(`${turn}:session`), prompt = uuid(`${turn}:prompt`);
  const ids = [0, 1, 2].map((k) => uuid(`${turn}:record:${k}`));
  const common = (k) => ({ isSidechain: false, uuid: ids[k], timestamp: `2026-10-01T02:00:0${k}.000Z`, sessionId: session, cwd: "/workspace", userType: "external", entrypoint: "cli", version: "2.1.286", gitBranch: "main" });
  const records = [
    { parentUuid: null, type: "user", message: { role: "user", content: `<command-message>cf:brainstorm</command-message>\n<command-name>/cf:brainstorm</command-name>\n<command-args>${args}</command-args>` }, promptId: prompt, ...common(0) },
    { parentUuid: ids[0], type: "user", message: { role: "user", content: [{ type: "text", text: skillText(args, skillBytes) }] }, isMeta: true, promptId: prompt, turnCompanion: true, ...common(1) },
    { parentUuid: ids[1], type: "assistant", message: { model: "claude-sonnet-5", id: `msg_${hex(`${turn}:msg`, 24)}`, type: "message", role: "assistant", content: [{ type: "text", text: answer }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 9100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 420, service_tier: "standard" } }, requestId: `req_${hex(`${turn}:req`, 24)}`, ...common(2) },
  ];
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv[2] === "--check";
  let bad = 0;
  for (const [dir, turn] of Object.entries(HISTORY_CASES)) {
    const file = path.join(here, dir, "history.jsonl");
    const want = historyOf(turn);
    if (!check) { fs.writeFileSync(file, want); console.log(`wrote ${dir}/history.jsonl`); continue; }
    const got = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (got === want) console.log(`ok: ${dir}/history.jsonl equals its regeneration from the current SKILL.md`);
    else { console.log(`FAIL: ${dir}/history.jsonl differs from its regeneration from the current SKILL.md`); bad++; }
  }
  process.exit(bad ? 1 : 0);
}
