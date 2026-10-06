// Trạng thái của hộp thử `box/` cho bộ đo cf:sync: ảnh chụp file, các path đã đổi, và phép kiểm Receipt bằng chính mã nguồn của gate.
// Mọi hàm chỉ đọc hộp, trừ writeSnapshot (chỉ ghi vào box/.eval/, thư mục đã nằm trong .git/info/exclude nên không đổi Head).
//   node evals/sync/lib/state.mjs --snapshot <box>        ghi box/.eval/before.sha256 và box/.eval/status.before
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SCRIPTS = path.resolve(HERE, "../../../packages/spec/src/claude/scripts");
const require = createRequire(import.meta.url);

// Không thuộc trạng thái được chấm: kho git, nhật ký của bộ đo, và thư mục log mà chính hook ghi khi chạy (provenance.cjs RUNTIME_STATE_ROOTS).
const SKIP = [".git", ".eval", ".claude/hooks/.logs", ".claude/.logs"];
const skipped = (rel) => SKIP.some((s) => rel === s || rel.startsWith(`${s}/`));

export const git = (dir, ...args) => {
  const r = spawnSync("env", ["-u", "GIT_DIR", "-u", "GIT_WORK_TREE", "-u", "GIT_INDEX_FILE", "git", "-C", dir, ...args], { encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "").replace(/\n$/, "") };
};

const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

// Mọi file thường dưới box (theo đường dẫn tương đối), trừ phần SKIP; symlink được ghi bằng đích của nó.
export function fileHashes(box) {
  const out = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const rel = path.relative(box, abs).split(path.sep).join("/");
      if (skipped(rel)) continue;
      if (e.isSymbolicLink()) out[rel] = `link:${fs.readlinkSync(abs)}`;
      else if (e.isDirectory()) walk(abs);
      else if (e.isFile()) out[rel] = sha(abs);
    }
  };
  walk(box);
  return out;
}

// Dòng `git status --porcelain -uall` theo path (path đích khi đổi tên).
export function statusLines(box) {
  const r = git(box, "-c", "core.quotePath=false", "status", "--porcelain", "-uall");
  if (!r.ok) throw new Error(`git status failed in ${box}`);
  const out = {};
  for (const line of r.out.split("\n").filter(Boolean)) {
    const p = line.slice(3).split(" -> ").pop().replace(/^"|"$/g, "");
    if (!skipped(p)) out[p] = line.slice(0, 2);
  }
  return out;
}

export function writeSnapshot(box) {
  fs.mkdirSync(path.join(box, ".eval"), { recursive: true });
  const hashes = fileHashes(box);
  fs.writeFileSync(path.join(box, ".eval", "before.sha256"), Object.keys(hashes).sort().map((p) => `${hashes[p]}  ${p}`).join("\n") + "\n");
  const status = statusLines(box);
  fs.writeFileSync(path.join(box, ".eval", "status.before"), Object.keys(status).sort().map((p) => `${status[p]} ${p}`).join("\n") + "\n");
}

export function readSnapshot(box) {
  const lines = (f) => fs.readFileSync(path.join(box, ".eval", f), "utf8").split("\n").filter(Boolean);
  const hashes = {};
  for (const l of lines("before.sha256")) { const i = l.indexOf("  "); hashes[l.slice(i + 2)] = l.slice(0, i); }
  const status = {};
  for (const l of lines("status.before")) status[l.slice(3)] = l.slice(0, 2);
  return { hashes, status };
}

// Path đã đổi kể từ ảnh chụp: dòng status khác HOẶC mã băm khác (file vốn đã bẩn mà sửa thêm vẫn bị thấy), kể cả file thêm hay xoá.
export function changedPaths(box) {
  const before = readSnapshot(box);
  const nowHashes = fileHashes(box);
  const nowStatus = statusLines(box);
  const all = new Set([...Object.keys(before.hashes), ...Object.keys(nowHashes), ...Object.keys(before.status), ...Object.keys(nowStatus)]);
  return [...all].filter((p) => before.hashes[p] !== nowHashes[p] || (before.status[p] || "") !== (nowStatus[p] || "")).sort();
}

// Base/Head như gate tính, qua CLI nguồn provenance.cjs (đúng lệnh develop/SKILL.md dặn).
export function provenance(box, feature) {
  const r = spawnSync("node", [path.join(SCRIPTS, "provenance.cjs"), "--project-root", box, "--specs-root", path.join(box, "specs"),
    "--spec-file", path.join(box, "specs", feature, "plan.md"), "--feature-name", feature, "--session", "sync-eval", "--json"], { encoding: "utf8" });
  const j = JSON.parse(r.stdout || "{}");
  if (!j.ok) throw new Error(`provenance failed: ${JSON.stringify(j.error || r.stderr)}`);
  return { base: j.Base, head: j.Head };
}

// Lỗi của Receipt theo HỢP của hai phép kiểm nguồn: checkWorkflowTaskReceipt (command_identity, task_status, command_output, …) và
// validateCanonicalReceipt LUÔN ở chế độ ràng buộc với Base/Head sống — để một commit hay một lần hoàn tác (chế độ structure) không
// làm một Receipt cũ trông hợp lệ. Mảng rỗng = Receipt hợp lệ.
function gateParts(box, feature) {
  const policy = require(path.join(SCRIPTS, "workflow-policy.cjs"));
  const receipt = require(path.join(SCRIPTS, "spec-receipt.cjs"));
  const featureDir = path.join(box, "specs", feature);
  const ctx = policy.deriveRuntimeContext({ projectRoot: box, specsRoot: path.join(box, "specs"), specFile: path.join(featureDir, "plan.md"),
    featureName: feature, runtimeSession: "sync-eval" });
  return { policy, receipt, featureDir, ctx };
}

// Đúng phép kiểm của Stop gate (chế độ ràng buộc chỉ khi file task lệch bản đã commit).
export function gateFailures(box, feature, taskBasename) {
  const { policy, receipt, featureDir, ctx } = gateParts(box, feature);
  return receipt.checkWorkflowTaskReceipt(featureDir, taskBasename, ctx, policy).failures.slice().sort();
}

export function receiptFailures(box, feature, taskBasename) {
  const { policy, receipt, featureDir, ctx } = gateParts(box, feature);
  const failures = new Set(receipt.checkWorkflowTaskReceipt(featureDir, taskBasename, ctx, policy).failures);
  const body = receipt.workflowReceiptBody(fs.readFileSync(path.join(featureDir, taskBasename), "utf8"), policy);
  if (body === null) failures.add("missing_receipt");
  else {
    // Như gate: các trường được đọc ngoài khối fence (spec-receipt.cjs workflowCanonicalValidationBody), để một dòng `Base:` hay
    // `Artifact:` nằm trong output được dán không bị đọc như một trường của Receipt.
    const { annotatedMarkdownLines } = require(path.join(SCRIPTS, "spec-resolver.cjs"));
    const canonical = annotatedMarkdownLines(body).filter(({ outsideFence }) => outsideFence).map(({ line }) => line).join("\n");
    for (const f of policy.validateCanonicalReceipt(canonical, policy.receiptValidatorOptions({}, { runtimeContext: ctx, requireProvenanceBinding: true }))) failures.add(f);
  }
  return [...failures].sort();
}

const isMain = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (isMain()) {
  const [flag, box] = process.argv.slice(2);
  if (flag === "--snapshot" && box) writeSnapshot(path.resolve(box));
  else { console.error("usage: node evals/sync/lib/state.mjs --snapshot <box>"); process.exit(2); }
}
