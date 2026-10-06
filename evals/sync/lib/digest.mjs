// Dấu của thước đo cf:sync (plan D-09): sha256 của danh sách sha256 từng file, sắp theo đường dẫn. Thước gồm cả bộ ca, các công cụ
// so sánh/ngân sách, evals/run.sh và các script nguồn mà thước dùng làm oracle — đổi bất kỳ file nào trong đó là đổi thước.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXED = [
  "evals/compare-sync.mjs",
  "evals/budget-sync.mjs",
  "evals/run.sh",
  "packages/spec/src/claude/scripts/spec-receipt.cjs",
  "packages/spec/src/claude/scripts/workflow-policy.cjs",
  "packages/spec/src/claude/scripts/spec-resolver.cjs",
  "packages/spec/src/claude/scripts/provenance.cjs",
];

export function instrumentFiles(root = ROOT) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "results") walk(abs); }
      else if (e.isFile()) out.push(path.relative(root, abs).split(path.sep).join("/"));
    }
  };
  walk(path.join(root, "evals", "sync"));
  for (const f of FIXED) if (fs.existsSync(path.join(root, f))) out.push(f);
  return out.sort();
}

export function instrumentDigest(root = ROOT) {
  const h = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");
  return crypto.createHash("sha256").update(instrumentFiles(root).map((f) => `${h(f)}  ${f}\n`).join("")).digest("hex");
}
