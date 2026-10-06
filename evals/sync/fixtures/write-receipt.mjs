#!/usr/bin/env node
// Ghi Receipt THẬT cho một task của hộp: chạy nguyên văn Command của Verification Plan (một shell, stdout+stderr của cả lệnh),
// lấy Base/Head bằng .claude/scripts/provenance.cjs của chính hộp, rồi thay phần `## Receipt` cuối file. Thoát 1 nếu lệnh fail
// (khi đó không ghi gì). Dùng bởi scaffold (dựng Receipt hợp lệ ban đầu) và bởi phép thử offline (mô phỏng lượt rebind đúng).
//   node write-receipt.mjs <box> <feature> <task-NN-*.md> [--no-provenance-run]
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

export function plannedCommand(text) {
  const plan = text.split(/^## Verification Plan\s*$/m)[1] || "";
  const m = plan.split(/^## /m)[0].match(/^- Command: `(.*)`\s*$/m);
  if (!m) throw new Error("no Verification Plan command");
  return m[1];
}

export function runCommand(box, command) {
  const r = spawnSync("bash", ["-c", `( ${command} ) 2>&1`], { cwd: box, encoding: "utf8" });
  return { exit: r.status, output: (r.stdout || "").replace(/\n+$/, "") };
}

export function provenanceOf(box, feature) {
  const r = spawnSync("node", [path.join(box, ".claude", "scripts", "provenance.cjs"), "--project-root", box, "--specs-root", path.join(box, "specs"),
    "--spec-file", path.join(box, "specs", feature, "plan.md"), "--feature-name", feature, "--session", "eval", "--json"], { encoding: "utf8" });
  const j = JSON.parse(r.stdout || "{}");
  if (!j.ok) throw new Error(`provenance failed: ${r.stdout}${r.stderr}`);
  return { base: j.Base, head: j.Head };
}

export function receiptText({ command, output, base, head }) {
  return `## Receipt\n\nVerification: PASS\nCommand: ${command}\nExit: 0\nBase: ${base}\nHead: ${head}\n\`\`\`text\n$ ${command}\n${output}\n\`\`\`\n`;
}

export function replaceReceipt(text, receipt) {
  const i = text.lastIndexOf("\n## Receipt");
  if (i < 0) throw new Error("no ## Receipt heading");
  return `${text.slice(0, i + 1)}${receipt}`;
}

// Chạy rồi ghi; trả { command, output, base, head }.
export function writeReceipt(box, feature, task, provenance = provenanceOf) {
  const file = path.join(box, "specs", feature, task);
  const text = fs.readFileSync(file, "utf8");
  const command = plannedCommand(text);
  const run = runCommand(box, command);
  if (run.exit !== 0) { const e = new Error(`command failed (exit ${run.exit})`); e.run = run; throw e; }
  const p = provenance(box, feature);
  const values = { command, output: run.output, base: p.base, head: p.head };
  fs.writeFileSync(file, replaceReceipt(text, receiptText(values)));
  return values;
}

const isMain = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (isMain()) {
  const [box, feature, task] = process.argv.slice(2);
  if (!box || !feature || !task) { console.error("usage: write-receipt.mjs <box> <feature> <task-NN-*.md>"); process.exit(2); }
  try { const v = writeReceipt(path.resolve(box), feature, task); console.log(`receipt ${task} base=${v.base} head=${v.head}`); }
  catch (e) { console.error(e.message); if (e.run) console.error(e.run.output); process.exit(1); }
}
