#!/usr/bin/env node
// Ghi box/.eval/meta.json lúc cuối scaffold: thứ thước cần biết về trạng thái ban đầu mà không suy ra lại được từ hộp sau lượt chạy —
// Command đã lập kế hoạch của từng task, Receipt ban đầu (Base/Head và thân), dòng Outcome đã sửa chính tả, HEAD, và các nonce mà
// chính scaffold đã sinh (một nonce "mới" là nonce không có trong danh sách này).
//   node meta.mjs <box>
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { plannedCommand } from "../write-receipt.mjs";

const box = path.resolve(process.argv[2] || "");
const feature = "doi-ten";
const dir = path.join(box, "specs", feature);
const tasks = {};
for (const name of fs.readdirSync(dir).filter((f) => /^task-.*\.md$/.test(f)).sort()) {
  const text = fs.readFileSync(path.join(dir, name), "utf8");
  const receipt = text.slice(text.lastIndexOf("\n## Receipt") + 1);
  tasks[name] = {
    command: plannedCommand(text),
    outcome: (text.match(/^## Outcome\n(.*)$/m) || [])[1],
    receipt,
    body: text.slice(0, text.length - receipt.length),
    base: (receipt.match(/^Base: (\S+)$/m) || [])[1],
    head: (receipt.match(/^Head: (\S+)$/m) || [])[1],
  };
}
const head = spawnSync("git", ["-C", box, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const ranLog = path.join(box, ".eval", "ran.log");
const nonces = fs.existsSync(ranLog) ? [...new Set([...fs.readFileSync(ranLog, "utf8").matchAll(/-([0-9a-f-]{36})$/gm)].map((m) => m[1]))] : [];
fs.writeFileSync(path.join(box, ".eval", "meta.json"), JSON.stringify({ feature, head, tasks, scaffoldNonces: nonces }, null, 2) + "\n");
