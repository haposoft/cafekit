#!/usr/bin/env node
// Trần chi phí một ô số gốc brainstorm (plan D-03): max(4, ⌈k × costUsd cao nhất⌉) trên các pilot của một model và một
// đường, k là 12 ở đường skill (ba ca) và 15 ở đường agent (một ca). Mỗi pilot đọc dưới tên của nó (là lượt chạy lại khi
// có -lan1) và đọc cả -lan1 của nó. costUsd đã gồm phần judge. Không có trần trên.
//   node evals/brainstorm/ceiling.mjs <sonnet|opus> <skill|agent> [results dir] [--prefix <p>]   (default pilot-; the
//   repair packet's after-pilots use sau-pilot-)
//   node evals/brainstorm/ceiling.mjs --self-test
// Thoát 1, nêu lý do trên stderr, khi thiếu pilot, hay pilot partial hoặc không đúng một lượt.
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROUTES = { skill: ["duyet-khong-trien-khai", "can-plan-sang-specs", "ne-cau-hoi"], agent: ["mot-duong-agent"] };
export const K = { skill: 12, agent: 15 };
const MODELS = ["sonnet", "opus"];

// Returns { ceiling } or { error }; never exits.
export function ceilingOf(model, route, dir = path.join(here, "..", "results", "brainstorm"), prefix = "pilot-") {
  if (!MODELS.includes(model) || !(route in ROUTES)) return { error: "usage: <sonnet|opus> <skill|agent> [results dir]" };
  let highest = 0;
  for (const c of ROUTES[route]) {
    const name = `${prefix}${c}-${model}`;
    let r;
    try { r = JSON.parse(fs.readFileSync(path.join(dir, name, "result.json"), "utf8")); } catch { return { error: `missing pilot ${name}` }; }
    const runs = (r.cases && r.cases[0] && r.cases[0].arms && r.cases[0].arms.with) || [];
    if (r.partial || runs.length !== 1) return { error: `pilot ${name} is partial or does not hold exactly one run` };
    highest = Math.max(highest, runs[0].costUsd || 0);
    const lan1 = path.join(dir, `${name}-lan1`, "result.json");
    if (fs.existsSync(lan1)) for (const x of JSON.parse(fs.readFileSync(lan1, "utf8")).cases[0].arms.with) highest = Math.max(highest, x.costUsd || 0);
  }
  return { ceiling: Math.max(4, Math.ceil(K[route] * highest)) };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brainstorm-ceiling-"));
  let failed = 0;
  const check = (label, ok) => { console.log(`${ok ? "ok" : "FAIL"}: ceiling self-test: ${label}`); if (!ok) failed++; };
  const pilot = (name, costs, partial = false) => { const d = path.join(root, name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ partial, costUsd: costs.reduce((a, b) => a + b, 0), cases: [{ arms: { with: costs.map((c) => ({ costUsd: c })) } }] })); };
  try {
    pilot("pilot-duyet-khong-trien-khai-sonnet", [0.3]); pilot("pilot-can-plan-sang-specs-sonnet", [0.1]); pilot("pilot-ne-cau-hoi-sonnet", [0.2]);
    check("skill sonnet at $0.30 → max(4, ⌈3.6⌉) = 4", ceilingOf("sonnet", "skill", root).ceiling === 4);
    pilot("pilot-ne-cau-hoi-sonnet", [0.55]);
    check("skill sonnet at $0.55 → ⌈6.6⌉ = 7", ceilingOf("sonnet", "skill", root).ceiling === 7);
    pilot("pilot-mot-duong-agent-opus", [0.76]);
    check("agent opus at $0.76 → ⌈15 × 0.76⌉ = 12", ceilingOf("opus", "agent", root).ceiling === 12);
    pilot("pilot-mot-duong-agent-opus-lan1", [0.9]);
    check("a -lan1 at $0.90 raises agent opus to ⌈13.5⌉ = 14", ceilingOf("opus", "agent", root).ceiling === 14);
    check("a missing pilot is an error", !!ceilingOf("opus", "skill", root).error);
    pilot("pilot-mot-duong-agent-sonnet", [0.2, 0.2]);
    check("a pilot with two runs is an error", !!ceilingOf("sonnet", "agent", root).error);
    pilot("pilot-mot-duong-agent-sonnet", [0.2], true);
    check("a partial pilot is an error", !!ceilingOf("sonnet", "agent", root).error);
    check("a wrong route is a usage error", !!ceilingOf("sonnet", "both", root).error);
    pilot("sau-pilot-mot-duong-agent-opus", [0.4]);
    check("--prefix sau-pilot- reads the after-pilots: agent opus at $0.40 → ⌈6⌉ = 6", ceilingOf("opus", "agent", root, "sau-pilot-").ceiling === 6);
    check("--prefix sau-pilot- with a missing after-pilot is an error", !!ceilingOf("sonnet", "agent", root, "sau-pilot-").error);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") process.exit(selfTest());
  let prefix = "pilot-";
  const k = args.indexOf("--prefix");
  if (k >= 0) { prefix = args[k + 1]; args.splice(k, 2); }
  const [model, route, dir] = args;
  const r = prefix ? ceilingOf(model, route, dir, prefix) : { error: "usage: --prefix <p>" };
  if (r.error) { console.error(`ceiling: ${r.error}`); process.exit(1); }
  console.log(r.ceiling);
}
