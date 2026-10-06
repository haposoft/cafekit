#!/usr/bin/env node
// Trần chi phí một ô của research baseline (plan D-09): max(6, ⌈12 × costUsd cao nhất⌉) trên bốn pilot của một
// model và một đường (bốn thư mục skill, hoặc bốn thư mục -agent). costUsd đã gồm phần judge.
//   node evals/research/ceiling.mjs <sonnet|opus> <skill|agent> [results dir]
// Thoát 1, nêu lý do trên stderr, khi thiếu pilot, pilot partial hay không đúng một lượt, hoặc trần vượt 15
// (sonnet) hay 20 (opus).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CASES = ["da-co-quyet-dinh", "nguon-cu-mau-thuan", "khong-luu-khong-sua", "chon-kien-truc-theo-rang-buoc"];
export const LIMIT = { sonnet: 15, opus: 20 };

// Returns { ceiling } or { error }; never exits.
export function ceilingOf(model, route, dir = path.join(here, "..", "results", "research")) {
  if (!(model in LIMIT) || !["skill", "agent"].includes(route)) return { error: `usage: <sonnet|opus> <skill|agent> [results dir]` };
  let highest = 0;
  for (const c of CASES) {
    const name = `pilot-${c}${route === "agent" ? "-agent" : ""}-${model}`;
    let r;
    try { r = JSON.parse(fs.readFileSync(path.join(dir, name, "result.json"), "utf8")); } catch { return { error: `missing pilot ${name}` }; }
    const runs = (r.cases && r.cases[0] && r.cases[0].arms && r.cases[0].arms.with) || [];
    if (r.partial || runs.length !== 1) return { error: `pilot ${name} is partial or does not hold exactly one run` };
    highest = Math.max(highest, runs[0].costUsd || 0);
  }
  const ceiling = Math.max(6, Math.ceil(12 * highest));
  if (ceiling > LIMIT[model]) return { error: `ceiling ${ceiling} for ${model} ${route} is above ${LIMIT[model]} (highest pilot $${highest})` };
  return { ceiling };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [model, route, dir] = process.argv.slice(2);
  const r = ceilingOf(model, route, dir);
  if (r.error) { console.error(`ceiling: ${r.error}`); process.exit(1); }
  console.log(r.ceiling);
}
