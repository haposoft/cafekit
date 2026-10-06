#!/usr/bin/env node
// Kiểm gói bằng chứng test-proof-v1 mà cf:test in trong câu trả lời cuối (gói test-eval-hard, plan D-03), ngoại tuyến,
// từ file đã lưu của save-runs. Trên các lượt so được (không lỗi, đã nạp skill, không chạm trần — cùng nền với compare):
//   delivered — một khối code có rào của câu trả lời parse ra JSON có schema_version "test-proof-v1" (lấy khối cuối);
//   valid     — gói giao đúng schema: đúng 16 khoá; target {feature, task_path}; counts {executed, passed, failed,
//               skipped} cộng khớp; branches có đúng khoá, id duy nhất, xếp theo `<` của JavaScript, và đúng bằng danh
//               sách Named probes của task; counts các nhánh cộng bằng counts tổng; verdict bằng verdict ở nhãn Status
//               đầu tiên của báo cáo (không dùng JSON; báo cáo không có nhãn đếm riêng ở report-verdict missing);
//               payload_sha256 bằng SHA-256 của JSON gọn, khoá xếp theo thứ tự, bỏ chính khoá đó ([UNVERIFIED]: đó là
//               "stable JSON" của skill; 38/39 gói ở test-eval-baseline khớp).
// Task có Named probes trùng tên (ca trung-probe) không có gói nào hợp lệ được: in valid=n/a (quyết định của user).
//   node evals/test/check-payload.mjs <ô>...        in delivered=/valid= và số lỗi theo từng phép kiểm cho mỗi ô
//   node evals/test/check-payload.mjs --self-test
// Một ô có <ô>-lan1 thì dùng <ô>-lan1. Thoát 1 khi thiếu ô, ô partial, thiếu file đã lưu, file đã lưu cũ hay lệch số lượt.
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { resolveCell, parseSaved } from "./save-runs.mjs";
import { fisher } from "./compare.mjs";

const SELF = fileURLToPath(import.meta.url);
const TOP = ["schema_version", "target", "verdict", "command", "exit", "counts", "provenance", "proof_level", "expected", "observed", "reachability", "artifacts", "branches", "raw_output", "redactions", "payload_sha256"];
const BRANCH = ["id", "required", "verdict", "command", "exit", "counts", "proof_level"];
const COUNTS = ["executed", "passed", "failed", "skipped"];
const CHECKS = ["keys", "target", "counts", "branch-keys", "branch-ids", "branch-order", "branch-counts", "verdict", "digest"];
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}` : JSON.stringify(v));
const sameKeys = (o, keys) => !!o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).sort().join() === [...keys].sort().join();
// The report's verdict: the first Status/Trạng thái label whose value is a verdict, as the verdict graders read it.
const LABEL = /(?<![A-Za-zÀ-ỹ][ \t]*(?:\*\*)?)(?:\*\*)?(?:Status|Trạng thái)(?:\*\*)?:(?:\*\*)?[ \t]*(?:\*\*|`)?(?:(?:✅|❌|⛔|⚠️|🚫|🔴)[ \t]*)?(?:\*\*|`)?(PASS_WITH_WARNINGS|PASS|FAIL|BLOCKED)(?![A-Za-z_])/;
export const reportVerdict = (answer) => (answer.match(LABEL) || [])[1] || null;
export const namedProbes = (task) => { const m = task.match(/^- Named probes: (.*)$/m); return m ? [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]) : []; };

// The last fenced block of the answer that parses as a test-proof-v1 object, or null.
export function payloadOf(answer) {
  let found = null;
  for (const m of answer.matchAll(/```[^\n]*\n([\s\S]*?)\n```/g)) {
    try { const j = JSON.parse(m[1]); if (j && j.schema_version === "test-proof-v1") found = { text: m[1], json: j }; } catch { /* not JSON */ }
  }
  return found;
}

// The failed checks of one delivered payload (empty = valid).
export function validate(p, probes, report) {
  const bad = [];
  if (!sameKeys(p, TOP)) bad.push("keys");
  if (!sameKeys(p.target, ["feature", "task_path"])) bad.push("target");
  const c = p.counts;
  if (!sameKeys(c, COUNTS) || !COUNTS.every((k) => Number.isInteger(c[k]) && c[k] >= 0) || c.passed + c.failed + c.skipped !== c.executed) bad.push("counts");
  const b = Array.isArray(p.branches) ? p.branches : [];
  if (!b.length || !b.every((r) => sameKeys(r, BRANCH) && (r.counts === null || sameKeys(r.counts, COUNTS)))) bad.push("branch-keys");
  const ids = b.map((r) => r?.id);
  const want = [...probes].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  // Equal to the sorted unique Named probes: this also rules out a duplicate id.
  if ([...ids].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)).join("\u0000") !== want.join("\u0000")) bad.push("branch-ids");
  if (ids.some((id, i) => i > 0 && !(ids[i - 1] < id))) bad.push("branch-order");
  if (sameKeys(c, COUNTS) && !COUNTS.every((k) => b.reduce((n, r) => n + ((r?.counts || {})[k] || 0), 0) === c[k])) bad.push("branch-counts");
  if (report !== null && p.verdict !== report) bad.push("verdict");
  const { payload_sha256, ...rest } = p;
  if (sha(Buffer.from(stable(rest))) !== payload_sha256) bad.push("digest");
  return bad;
}

// specs/test-proof-repair D-01: the report, then `### Machine handoff (test-proof-v1)`, exactly one fenced json block
// after it, no fenced block after that, and no JSON block inside the report.
const HANDOFF = "### Machine handoff (test-proof-v1)";
export function placed(answer) {
  const at = answer.indexOf(HANDOFF);
  if (at < 0 || answer.indexOf(HANDOFF, at + 1) >= 0) return false;
  const fences = (t) => [...t.matchAll(/```([^\n]*)\n([\s\S]*?)\n```/g)];
  const isJson = (m) => { if (/^json\b/i.test(m[1].trim())) return true; try { JSON.parse(m[2]); return true; } catch { return false; } };
  if (fences(answer.slice(0, at)).some(isJson)) return false;
  const after = fences(answer.slice(at + HANDOFF.length));
  if (after.length !== 1 || !/^json\b/i.test(after[0][1].trim())) return false;
  try { return JSON.parse(after[0][2]).schema_version === "test-proof-v1"; } catch { return false; }
}

// The facts of one cell over its comparable runs, or { error }.
function cellFacts(raw) {
  const dir = resolveCell(raw), cell = path.basename(dir), file = path.join(dir, "result.json"), saved = path.join(path.dirname(dir), "_saved", `${cell}.txt`);
  if (!fs.existsSync(file) || !fs.existsSync(saved)) return { error: `${dir}: missing ${fs.existsSync(file) ? saved : file}` };
  const bytes = fs.readFileSync(file), r = JSON.parse(bytes.toString("utf8")), text = fs.readFileSync(saved, "utf8");
  if (r.partial) return { error: `${dir}: partial` };
  if (!text.startsWith(`# result.json sha256=${sha(bytes)}\n`)) return { error: `${dir}: saved file is stale for its result.json` };
  const runs = r.cases?.[0]?.arms?.with || [], facts = parseSaved(text);
  if (facts.length !== runs.length) return { error: `${dir}: saved file has ${facts.length} runs, result.json ${runs.length}` };
  const tally = Object.fromEntries(CHECKS.map((k) => [k, 0]));
  let errored = 0, unloaded = 0, capped = 0, comparable = 0, delivered = 0, valid = 0, placedN = 0, missing = 0, dupProbes = false;
  runs.forEach((x, i) => {
    const f = facts[i];
    if (x.error || f.error) { errored++; return; }
    if (!f.loaded) { unloaded++; return; }
    if (f.cap) { capped++; return; }
    comparable++;
    const probes = namedProbes(f.task);
    if (new Set(probes).size !== probes.length) dupProbes = true;
    if (placed(f.answer)) placedN++;
    const p = payloadOf(f.answer);
    if (!p) return;
    delivered++;
    const report = reportVerdict(f.answer);
    if (report === null) missing++;
    const failed = validate(p.json, probes, report);
    for (const k of failed) tally[k]++;
    if (!failed.length) valid++;
  });
  // A trung-probe cell has no valid payload by construction, whatever its runs hold (user decision).
  const na = dupProbes || /(^|-)trung-probe-/.test(cell);
  return { cell, tally, errored, unloaded, capped, comparable, delivered, valid, placed: placedN, missing, na };
}

const caseModel = (cell) => cell.replace(/-lan1$/, "").match(/((?:sach|do|khong-test|thieu-cong-cu|tron-legacy|trung-probe|khong-cham-code)-(?:sonnet|opus))$/)?.[1] || null;

// Before and after, both over their comparable runs, with a two-sided Fisher p (specs/test-proof-repair D-03).
export function pairCells(pairs) {
  const lines = []; let bad = 0; const say = (l) => lines.push(l);
  for (const [b, a] of pairs) {
    const B = cellFacts(b), A = cellFacts(a);
    if (B.error || A.error) { say(B.error || A.error); bad++; continue; }
    const cm = caseModel(A.cell);
    if (!cm || caseModel(B.cell) !== cm) { say(`pair ${B.cell},${A.cell}: case and model differ`); bad++; continue; }
    const row = (k, x, y) => say(`pair=${cm} ${k} before=${x}/${B.comparable} after=${y}/${A.comparable} p=${fisher(x, B.comparable, y, A.comparable).toPrecision(4)}`);
    row("delivered", B.delivered, A.delivered);
    if (B.na || A.na) say(`pair=${cm} valid before=n/a after=n/a`); else row("valid", B.valid, A.valid);
    row("placed", B.placed, A.placed);
    if (!B.na && !A.na) for (const k of CHECKS) say(`pair=${cm} check=${k} before=${B.tally[k]} after=${A.tally[k]}`);
  }
  return { lines, bad };
}

export function checkCells(cells) {
  const lines = []; let bad = 0; const say = (l) => lines.push(l);
  for (const raw of cells) {
    const f = cellFacts(raw);
    if (f.error) { say(f.error); bad++; continue; }
    say(`cell=${f.cell} delivered=${f.delivered}/${f.comparable} valid=${f.na ? "n/a" : `${f.valid}/${f.delivered}`}`);
    if (!f.na) for (const k of CHECKS) say(`cell=${f.cell} check=${k} failed=${f.tally[k]}`);
    say(`cell=${f.cell} report-verdict missing=${f.missing}`);
    say(`cell=${f.cell} errored=${f.errored} unloaded=${f.unloaded} capped=${f.capped}`);
  }
  return { lines, bad };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "test-payload-st-"));
  let failed = 0;
  const check = (label, ok, d = "") => { console.log(`${ok ? "ok" : "FAIL"}: check-payload self-test: ${label}${ok ? "" : ` — ${d}`}`); if (!ok) failed++; };
  const A = "greet chào bằng tiếng Việt và giữ nguyên tên", B = "greet cắt khoảng trắng thừa quanh tên";
  const task = (probes) => `Status: in_progress\n- Command: \`node --test test/greet.test.js\`\n- Named probes: ${probes.map((p) => `\`${p}\``).join(", ")}\n`;
  const branch = (id, verdict = "PASS") => ({ id, required: true, verdict, command: "node --test test/greet.test.js", exit: 0, counts: { executed: 1, passed: 1, failed: 0, skipped: 0 }, proof_level: "source" });
  const make = (over = {}, branches = [branch(A), branch(B)]) => {
    const p = { schema_version: "test-proof-v1", target: { feature: "doi-loi-chao", task_path: "specs/doi-loi-chao/task-01-doi-loi-chao.md" }, verdict: "PASS", command: "node --test test/greet.test.js", exit: 0,
      counts: { executed: 2, passed: 2, failed: 0, skipped: 0 }, provenance: { base: "a".repeat(40), head: "b".repeat(40) }, proof_level: "source", expected: "2 pass", observed: "2 pass",
      reachability: { status: "PASS", evidence: ["x"] }, artifacts: [], branches, raw_output: "ok", redactions: [], ...over };
    const { payload_sha256, ...rest } = p; return { ...p, payload_sha256: sha(Buffer.from(stable(rest))) };
  };
  const block = (p, fence = "```json", pretty = false) => `${fence}\n${pretty ? JSON.stringify(p, null, 2) : JSON.stringify(p)}\n\`\`\``;
  const report = (v, p, fence) => `## Test Verdict\n\n**Status:** ${v}\n\n${p ? block(p, fence) : "The payload is ready for the controller."}`;
  const cell = (name, runs, { stale = false, extra = 0 } = {}) => {
    const res = path.join(root, "test"), d = path.join(res, name); fs.mkdirSync(d, { recursive: true }); fs.mkdirSync(path.join(res, "_saved"), { recursive: true });
    const json = JSON.stringify({ partial: false, cases: [{ arms: { with: runs.map((x) => (x.error ? { error: "boom" } : {})) } }] });
    fs.writeFileSync(path.join(d, "result.json"), json);
    const body = [...runs, ...Array(extra).fill({ answer: "" })].map((x, i) => `### run ${i + 1}\nskill=${x.unloaded ? "none" : "loaded"} cap=${x.cap ? "yes" : "no"} error=no\n--- task\n${x.task || task([A, B])}\n--- answer\n${x.answer}`).join("\n");
    fs.writeFileSync(path.join(res, "_saved", `${name}.txt`), `# result.json sha256=${stale ? "0".repeat(64) : sha(Buffer.from(json))}\n${body}\n`);
    return d;
  };
  try {
    const good = make();
    let r = checkCells([cell("k-sach-sonnet", [{ answer: report("PASS", good) }, { answer: report("PASS") }, { answer: report("PASS", good), unloaded: true }, { answer: "", error: true }, { answer: report("PASS", good), cap: true }])]);
    let L = r.lines.join("\n");
    check("a valid payload counts; an undelivered run counts apart; unloaded, errored and capped runs are out", r.bad === 0 && L.includes("delivered=1/2 valid=1/1") && L.includes("errored=1 unloaded=1 capped=1"), L);
    // The digest pinned through JSON.stringify of an object built in sorted key order, independent of stable().
    const sortedRest = Object.fromEntries(Object.keys(good).filter((k) => k !== "payload_sha256").sort().map((k) => [k, good[k]]));
    const deep = (v) => (Array.isArray(v) ? v.map(deep) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, deep(v[k])])) : v);
    check("payload_sha256 is SHA-256 of compact JSON with sorted keys, without that key", good.payload_sha256 === sha(Buffer.from(JSON.stringify(deep(sortedRest)))), good.payload_sha256);
    const runs = [
      ["duplicate branch ids", make({}, [branch(A), branch(A)]), "branch-ids"],
      ["a missing branch", make({ counts: { executed: 1, passed: 1, failed: 0, skipped: 0 } }, [branch(A)]), "branch-ids"],
      ["`cắt` before `chào` (localeCompare order)", make({}, [branch(B), branch(A)]), "branch-order"],
      ["an extra top-level key", (() => { const p = make(); const { payload_sha256, ...rest } = { ...p, note: "x" }; return { ...rest, payload_sha256: sha(Buffer.from(stable(rest))) }; })(), "keys"],
      ["a wrong digest", { ...make(), payload_sha256: "0".repeat(64) }, "digest"],
      ["branch counts that do not sum", make({ counts: { executed: 3, passed: 3, failed: 0, skipped: 0 } }), "branch-counts"],
      ["a payload verdict unlike the report", make({ verdict: "FAIL" }), "verdict"],
      ["a target given as a string", make({ target: "specs/doi-loi-chao/task-01-doi-loi-chao.md" }), "target"],
      ["top-level counts that do not add up", make({ counts: { executed: 2, passed: 1, failed: 0, skipped: 0 } }), "counts"],
      ["branches holding only {id, status}", make({}, [{ id: A, status: "PASS" }, { id: B, status: "PASS" }]), "branch-keys"],
    ];
    for (const [label, p, k] of runs) {
      r = checkCells([cell(`k-${k}-x-sonnet`, [{ answer: report("PASS", p) }])]);
      L = r.lines.join("\n");
      check(`${label} is invalid under check=${k}`, L.includes("valid=0/1") && L.includes(`check=${k} failed=1`), L);
    }
    r = checkCells([cell("k-pretty-sonnet", [{ answer: report("PASS", good, "```") .replace(JSON.stringify(good), JSON.stringify(good, null, 2)) }])]);
    check("a pretty-printed payload in a plain fence is delivered and valid", r.lines.join("\n").includes("delivered=1/1 valid=1/1"), r.lines.join("\n"));
    r = checkCells([cell("k-json-only-sonnet", [{ answer: block(good) }])]);
    check("a JSON-only answer counts under report-verdict missing and is still checked", r.lines.join("\n").includes("valid=1/1") && r.lines.join("\n").includes("report-verdict missing=1"), r.lines.join("\n"));
    r = checkCells([cell("k-trung-probe-opus", [{ answer: report("BLOCKED", make({ verdict: "BLOCKED" }, [branch(A)])), task: task([A, A]) }])]);
    check("a trung-probe cell (duplicate Named probes) prints valid=n/a", r.lines.join("\n").includes("delivered=1/1 valid=n/a") && !r.lines.join("\n").includes("check="), r.lines.join("\n"));
    r = checkCells([cell("k-trung-probe-sonnet", [{ answer: report("BLOCKED"), unloaded: true }])]);
    check("a trung-probe cell with no comparable run still prints valid=n/a", r.lines.join("\n").includes("delivered=0/0 valid=n/a"), r.lines.join("\n"));
    cell("k-lan-sonnet", [{ answer: report("PASS") }]); cell("k-lan-sonnet-lan1", [{ answer: report("PASS", good) }]);
    r = checkCells([path.join(root, "test", "k-lan-sonnet")]);
    check("a cell's -lan1 is read", r.lines.join("\n").includes("cell=k-lan-sonnet-lan1 delivered=1/1 valid=1/1"), r.lines.join("\n"));
    r = checkCells([cell("k-stale-sonnet", [{ answer: report("PASS", good) }], { stale: true })]);
    check("a saved file stale for its result.json is refused", r.bad === 1 && r.lines.join("\n").includes("stale"), r.lines.join("\n"));
    r = checkCells([cell("k-count-sonnet", [{ answer: report("PASS", good) }], { extra: 1 })]);
    check("a saved file with another run count is refused", r.bad === 1 && r.lines.join("\n").includes("has 2 runs"), r.lines.join("\n"));
    const handoff = (p, extra = "") => `## Test Verdict\n\n**Status:** PASS\n\n### Machine handoff (test-proof-v1)\n\n\`\`\`json\n${JSON.stringify(p)}\n\`\`\`${extra}`;
    check("placed: the handoff heading then one json block, nothing fenced after it", placed(handoff(good)) && placed(handoff(good, "\nThe controller writes the Receipt.")), handoff(good));
    check("placed fails for a JSON block in the report, two blocks, a later fence, or no heading",
      !placed(`**Status:** PASS\n${block(good)}\n${handoff(good)}`) && !placed(handoff(good, `\n${block(good)}`)) && !placed(handoff(good, "\n\`\`\`\nmore\n\`\`\`")) && !placed(report("PASS", good)));
    const pk = (name, runs) => cell(name, runs);
    pk("b-sach-sonnet", [{ answer: report("PASS", good) }, { answer: report("PASS", good) }, ...Array(8).fill({ answer: report("PASS") })]);
    pk("a-sach-sonnet", [...Array(7).fill({ answer: handoff(good) }), ...Array(3).fill({ answer: handoff({ ...good, payload_sha256: "0".repeat(64) }) })]);
    r = pairCells([[path.join(root, "test", "b-sach-sonnet"), path.join(root, "test", "a-sach-sonnet")]]);
    L = r.lines.join("\n");
    check("--pair reads valid over comparable runs: 2 of 2 delivered against 7 of 10 is 2/10 against 7/10", r.bad === 0 && L.includes("pair=sach-sonnet valid before=2/10 after=7/10 p=") && L.includes("pair=sach-sonnet delivered before=2/10 after=10/10") && L.includes("pair=sach-sonnet placed before=0/10 after=10/10"), L);
    check("--pair prints both sides' check counts", L.includes("pair=sach-sonnet check=digest before=0 after=3"), L);
    check("--pair p for 0/10 against 10/10 is 1.083e-5", L.includes("pair=sach-sonnet placed before=0/10 after=10/10 p=0.00001083"), L);
    pk("a-sach-opus", [{ answer: handoff(good) }]);
    r = pairCells([[path.join(root, "test", "b-sach-sonnet"), path.join(root, "test", "a-sach-opus")]]);
    check("--pair refuses a pair whose case and model differ", r.bad === 1 && r.lines.join("\n").includes("case and model differ"), r.lines.join("\n"));
    check("namedProbes reads the backticked names; reportVerdict reads the first label only", namedProbes(task([A, B])).join("|") === `${A}|${B}` && reportVerdict("Task Status: in_progress\n**Status:** FAIL\nStatus: PASS") === "FAIL" && reportVerdict('{"verdict":"PASS"}') === null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(SELF)) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") process.exit(selfTest());
  if (args[0] === "--pair") {
    const pairs = args.slice(1).map((x) => x.split(","));
    if (!pairs.length || pairs.some((x) => x.length !== 2 || !x[0] || !x[1])) { console.error("usage: check-payload.mjs --pair <before>,<after>..."); process.exit(2); }
    const r = pairCells(pairs);
    for (const l of r.lines) console.log(l);
    process.exit(r.bad ? 1 : 0);
  }
  if (!args.length || args.some((a) => a.startsWith("--"))) { console.error("usage: check-payload.mjs <cell>... | --pair <before>,<after>... | --self-test"); process.exit(2); }
  const r = checkCells(args);
  for (const l of r.lines) console.log(l);
  process.exit(r.bad ? 1 : 0);
}
