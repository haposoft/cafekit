#!/usr/bin/env node
// Ghi box/.eval/state.json lúc cuối scaffold cho các ca bare và audit: với mỗi file task process-first (thư mục có plan.md, không có
// spec.json), dòng Status, thân trước Receipt, Receipt, Command đã lập kế hoạch, Base/Head ban đầu; cùng HEAD của hộp.
//   node state-meta.mjs <box>
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { plannedCommand } from "./write-receipt.mjs";

const box = path.resolve(process.argv[2] || "");
const specs = path.join(box, "specs");
const packets = {};
for (const feature of fs.readdirSync(specs).sort()) {
  const dir = path.join(specs, feature);
  if (!fs.existsSync(path.join(dir, "plan.md")) || fs.existsSync(path.join(dir, "spec.json"))) continue;
  const tasks = {};
  for (const name of fs.readdirSync(dir).filter((f) => /^task-.*\.md$/.test(f)).sort()) {
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    const at = text.lastIndexOf("\n## Receipt");
    const receipt = at < 0 ? "" : text.slice(at + 1);
    tasks[name] = {
      status: (text.match(/^Status:.*$/m) || [""])[0],
      command: plannedCommand(text),
      body: text.slice(0, text.length - receipt.length),
      receipt,
      base: (receipt.match(/^\s*(?:[-*+]\s+)?Base: `?([0-9a-f]+)/m) || [])[1] || null,
      head: (receipt.match(/^\s*(?:[-*+]\s+)?Head: `?([0-9a-f]+)/m) || [])[1] || null,
    };
  }
  packets[feature] = tasks;
}
const head = spawnSync("git", ["-C", box, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
fs.writeFileSync(path.join(box, ".eval", "state.json"), JSON.stringify({ head, packets }, null, 2) + "\n");
