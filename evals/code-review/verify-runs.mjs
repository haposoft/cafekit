#!/usr/bin/env node
// Đọc lại mỗi lượt chạy đã giữ (--keep-temp) của evals/code-review mà không chạy git hay bất cứ lệnh
// nào bên trong thư mục giữ lại. Với mỗi result.json: lấy case từ cases[0].name, fixture là tên case bỏ
// hậu tố -agent, và các thước regex có target: last_message của case đó (evals/code-review/<case>/graders).
// Một lượt có error in error=… (reported, not verified) và không tính vào bất cứ đếm nào. Với mỗi lượt
// khác: mở thư mục giữ lại dirname(dirname(tracePath)) (chmod -R u+rwX trước; thiếu thư mục là một bất
// đồng), đọc từng dòng JSON của trace, rồi in agent=, init-host-code-review=, skill-ids=, calls-auditor=,
// sub-events=, denied=, report-src=, report=, r.<thước>=, final=, unread-verdict=, git-broken=, test-runs=,
// head-moves=, stash=, tree=, con-nguyen (khi case có), và disagreements=. Mỗi thư mục in runs=, errored=
// và tổng hợp trên các lượt đã đọc được. Thoát 1 khi có bất đồng, khi một result.json không đọc được, và
// với --require-report khi không lượt nào của một case -agent có report-src=sync hay notification. Một
// notification là <task-notification> trong tin nhắn user, hoặc summary của sự kiện system task_notification.
// Mỗi lượt còn in main-test-cmds= và sub-test-cmds= (lệnh Bash khớp input_match của thước khong-chay-test-bash
// của case, do phiên chính hay do auditor chạy), caller-line= (yes|no|none: report có **For the caller:**) và
// run-claim= (khong-khai-test-xanh đã lưu là fail và main-test-cmds>0); mỗi thư mục in main-test-runs=,
// sub-test-runs=, caller-line=, run-claim= và main-only-claim= (khong-khai-test-xanh đã lưu fail trong khi
// r.khong-khai-test-xanh=yes) ngay trước report-runs=. Không token nào thêm bất đồng.
//   node evals/code-review/verify-runs.mjs [--require-report] <result dir>...
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rawArgs = process.argv.slice(2);
const requireReport = rawArgs[0] === "--require-report";
const dirs = requireReport ? rawArgs.slice(1) : rawArgs;
if (!dirs.length) { console.error("usage: node evals/code-review/verify-runs.mjs [--require-report] <result dir>..."); process.exit(2); }

const VERDICT_WORD = /\b(?:PASS_WITH_WARNINGS|PASS|FAIL|BLOCKED)\b/;
const GIT_BROKEN = /Failed to locate 'git'|xcrun: error/;

const textOfContent = (content) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((c) => c && c.type === "text").map((c) => c.text).join("\n");
  return "";
};

// -- case graders (regex, target: last_message) --
const graderCache = new Map();
function lastMessageGraders(caseName) {
  if (graderCache.has(caseName)) return graderCache.get(caseName);
  const dir = path.join(here, caseName, "graders");
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!m) continue;
    const fm = m[1];
    if (!/^type: regex$/m.test(fm) || !/^target: last_message$/m.test(fm)) continue;
    const body = text.slice(m[0].length).trim();
    out.push({ name: f.slice(0, -3), pattern: new RegExp(body) });
  }
  graderCache.set(caseName, out);
  return out;
}

// -- fixture bytes: base overlaid by head (or pending for sua-ho) --
function fixtureFiles(fixtureName) {
  const overlayName = fixtureName === "sua-ho" ? "pending" : "head";
  const base = path.join(here, "fixtures", fixtureName, "base");
  const overlay = path.join(here, "fixtures", fixtureName, overlayName);
  const files = new Map();
  const walk = (root, dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).split(path.sep).join("/");
      if (e.isDirectory()) walk(root, full);
      else files.set(rel, fs.readFileSync(full));
    }
  };
  walk(base, base);
  walk(overlay, overlay);
  return files;
}
const commitCounts = { "giam-gia": 2, "khong-co-loi": 2, "chi-loi-nho": 2, "sua-ho": 1, "thieu-tieu-chi": 2 };

function findWorkspace(kept) {
  const stack = [kept];
  while (stack.length) {
    const dir = stack.pop();
    if (/(^|\/)evals(\/|$)/.test(path.relative(kept, dir))) continue;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    if (fs.existsSync(path.join(dir, "test", "_runs.js")) && fs.existsSync(path.join(dir, ".git"))) return dir;
    for (const e of entries) if (e.isDirectory()) stack.push(path.join(dir, e.name));
  }
  return null;
}

// A completed system task_notification for the launch carries the auditor's last text, unframed.
function notificationSummary(events, launchId) {
  for (const ev of events) {
    if (ev.type !== "system" || ev.subtype !== "task_notification") continue;
    if (ev.tool_use_id !== launchId || ev.status !== "completed") continue;
    if (typeof ev.summary === "string" && ev.summary) return ev.summary;
  }
  return null;
}

// A synchronous hand-back opens with a "[Subagent hand-back]" line and indents every report line by two spaces;
// the lines after the report (agentId:, <usage>) are not indented.
function unframe(text) {
  if (!text.startsWith("[Subagent hand-back]")) return text;
  const body = [];
  for (const line of text.split("\n").slice(1)) {
    if (line.startsWith("  ")) body.push(line.slice(2));
    else if (line === "") body.push("");
    else break;
  }
  return body.join("\n").replace(/\n+$/, "");
}

// input_match of the case's khong-chay-test-bash grader: the Bash commands that run the fixture's tests.
function testCommandPattern(caseName) {
  const f = path.join(here, caseName, "graders", "khong-chay-test-bash.md");
  if (!fs.existsSync(f)) return null;
  const m = fs.readFileSync(f, "utf8").match(/^input_match: '(.*)'$/m);
  return m ? new RegExp(m[1].replace(/''/g, "'")) : null;
}

function classifyReport(events) {
  let launch = null;
  for (const ev of events) {
    if (ev.type !== "assistant" || !ev.message || !Array.isArray(ev.message.content)) continue;
    for (const block of ev.message.content) {
      if (block.type === "tool_use" && block.name === "Agent" && typeof block.input?.subagent_type === "string" && /code-auditor$/.test(block.input.subagent_type)) {
        launch = block;
        break;
      }
    }
    if (launch) break;
  }
  if (!launch) return { src: "none" };
  let resultBlock = null;
  for (const ev of events) {
    if (ev.type !== "user" || !ev.message || !Array.isArray(ev.message.content)) continue;
    for (const block of ev.message.content) {
      if (block.type === "tool_result" && block.tool_use_id === launch.id) { resultBlock = block; break; }
    }
    if (resultBlock) break;
  }
  if (!resultBlock) return { src: "none" };
  if (resultBlock.is_error) return { src: "error" };
  const text = textOfContent(resultBlock.content);
  if (!text.startsWith("Async agent launched")) return { src: "sync", report: notificationSummary(events, launch.id) ?? unframe(text) };
  const idMatch = text.match(/agentId:\s*(\S+)/);
  const agentId = idMatch ? idMatch[1] : null;
  for (const ev of agentId ? events : []) {
    if (ev.type !== "user") continue;
    const t = typeof ev.message?.content === "string" ? ev.message.content : textOfContent(ev.message?.content);
    if (!t || !t.includes("<task-notification>")) continue;
    const idm = t.match(/<task-id>([^<]*)<\/task-id>/);
    if (!idm || idm[1] !== agentId) continue;
    const resm = t.match(/<result>([\s\S]*?)<\/result>/);
    if (!resm) continue;
    return { src: "notification", report: resm[1] };
  }
  // The stream form seen in the sonnet pilots: the finished background agent's last text is the `summary`
  // of a system task_notification event that names the launch's tool_use id.
  const summary = notificationSummary(events, launch.id);
  return summary ? { src: "notification", report: summary } : { src: "launch-only" };
}

let totalDisagreements = 0;
let readErrors = 0;
let agentPathReportSeen = false;

for (const dir of dirs) {
  let result;
  try {
    result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  } catch (e) {
    console.log(`${dir} unreadable result.json: ${e.message}`);
    readErrors++;
    continue;
  }
  const kase = result.cases[0];
  const caseName = kase.name;
  const fixtureName = caseName.replace(/-agent$/, "");
  const isAgentPath = caseName !== fixtureName;
  const graders = lastMessageGraders(caseName);
  const expectedFiles = fixtureFiles(fixtureName);
  const expectedCommits = commitCounts[fixtureName] ?? 2;

  let errored = 0, dirDisagreements = 0;
  let withLog = 0, srcCounts = { sync: 0, notification: 0, "launch-only": 0, error: 0, none: 0 };
  let auditorCalls = 0, hostSkillCalls = 0, pluginSkillCalls = 0, initHostYesCount = 0, subEventTotal = 0, deniedTotal = 0;
  let unreadVerdictYes = 0, headMoveRuns = 0, stashRuns = 0, treeChangedRuns = 0, gitBrokenRuns = 0;
  const rGraderCounts = Object.fromEntries(graders.map((g) => [g.name, 0]));
  let reportRuns = 0, mainTestRuns = 0, subTestRuns = 0, callerLineRuns = 0, runClaimRuns = 0, mainOnlyClaim = 0;
  const testCmd = testCommandPattern(caseName);

  kase.arms.with.forEach((run, i) => {
    const label = `${dir} run=${i + 1}`;
    if (run.error) { console.log(`${label} error=${JSON.stringify(run.error)} (reported, not verified)`); errored++; return; }
    if (!run.tracePath) { console.log(`${label} error=null tracePath=missing (reported, not verified)`); errored++; return; }
    const kept = path.dirname(path.dirname(run.tracePath));
    if (!fs.existsSync(kept)) { console.log(`${label} kept-directory-missing=${kept} disagreements=1`); dirDisagreements++; return; }
    spawnSync("chmod", ["-R", "u+rwX", kept]);

    const events = fs.readFileSync(run.tracePath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const initEvent = events.find((e) => e.type === "system" && e.subtype === "init");
    const agentTypes = ((initEvent && initEvent.agents) || []).filter((a) => /code-auditor$/.test(a));
    const skills = ((initEvent && initEvent.skills) || []);
    const slashCommands = ((initEvent && initEvent.slash_commands) || []);
    const initHostCodeReview = skills.includes("code-review") || slashCommands.includes("code-review");
    if (initHostCodeReview) initHostYesCount++;

    const skillIds = [];
    const auditorIds = new Set();
    let callsAuditor = 0;
    for (const ev of events) {
      if (ev.type !== "assistant" || !ev.message || !Array.isArray(ev.message.content)) continue;
      for (const block of ev.message.content) {
        if (block.type !== "tool_use") continue;
        if (block.name === "Skill" && typeof block.input?.skill === "string") {
          skillIds.push(block.input.skill);
        }
        if (block.name === "Agent" && typeof block.input?.subagent_type === "string" && /code-auditor$/.test(block.input.subagent_type)) { callsAuditor++; auditorIds.add(block.id); }
      }
    }
    // Per-directory counts are runs, not calls.
    if (callsAuditor > 0) auditorCalls++;
    if (skillIds.includes("cafekit-code-review:code-review")) pluginSkillCalls++;
    if (skillIds.some((s) => s === "code-review" || s === "review")) hostSkillCalls++;

    const subEvents = events.filter((e) => e.parent_tool_use_id != null).length;
    if (subEvents > 0) subEventTotal++;

    const resultEvent = events.find((e) => e.type === "result");
    const denials = (resultEvent && resultEvent.permission_denials) || [];
    const auditorDenied = denials.some((d) => d.tool_name === "Agent" && (auditorIds.has(d.tool_use_id) || /code-auditor$/.test(d.tool_input?.subagent_type || "")));
    if (denials.length > 0) deniedTotal++;

    const { src, report } = classifyReport(events);
    srcCounts[src] = (srcCounts[src] || 0) + 1;
    if (src === "sync" || src === "notification") { agentPathReportSeen = agentPathReportSeen || isAgentPath; reportRuns++; }

    let mainTestCmds = 0, subTestCmds = 0;
    for (const ev of events) {
      if (ev.type !== "assistant" || !ev.message || !Array.isArray(ev.message.content) || !testCmd) continue;
      for (const block of ev.message.content) {
        if (block.type !== "tool_use" || block.name !== "Bash" || !testCmd.test(JSON.stringify(block.input))) continue;
        if (ev.parent_tool_use_id != null && auditorIds.has(ev.parent_tool_use_id)) subTestCmds++;
        else mainTestCmds++;
      }
    }
    if (mainTestCmds > 0) mainTestRuns++;
    if (subTestCmds > 0) subTestRuns++;
    const callerLine = report === undefined ? "none" : report.includes("**For the caller:**") ? "yes" : "no";
    if (callerLine === "yes") callerLineRuns++;
    const storedClaim = run.graders.find((g) => g.name === "khong-khai-test-xanh");
    const claimFailed = !!storedClaim && storedClaim.passed === false;
    const runClaim = claimFailed && mainTestCmds > 0;
    if (runClaim) runClaimRuns++;
    if (claimFailed && report !== undefined && graders.some((g) => g.name === "khong-khai-test-xanh" && g.pattern.test(report))) mainOnlyClaim++;

    const rTokens = [];
    if (report !== undefined) {
      for (const g of graders) {
        const yes = g.pattern.test(report);
        if (yes) rGraderCounts[g.name]++;
        rTokens.push(`r.${g.name}=${yes ? "yes" : "no"}`);
      }
    }

    const mainTexts = events.filter((e) => e.type === "assistant" && e.parent_tool_use_id == null && e.message && Array.isArray(e.message.content))
      .flatMap((e) => e.message.content.filter((c) => c.type === "text").map((c) => c.text));
    const finalText = mainTexts.length ? mainTexts[mainTexts.length - 1] : "";
    const coVerdict = graders.find((g) => g.name === "co-verdict");
    const hasVerdictWord = VERDICT_WORD.test(finalText);
    const coVerdictMatches = coVerdict ? coVerdict.pattern.test(finalText) : false;
    const unreadVerdict = hasVerdictWord && !coVerdictMatches;
    if (unreadVerdict) unreadVerdictYes++;

    const gitBroken = events.some((e) => {
      if (e.type !== "user" || !e.message) return false;
      const content = e.message.content;
      if (typeof content === "string") return GIT_BROKEN.test(content);
      if (Array.isArray(content)) return content.some((b) => b.type === "tool_result" && GIT_BROKEN.test(textOfContent(b.content)));
      return false;
    });
    if (gitBroken) gitBrokenRuns++;

    let runDisagreements = 0;
    if (agentTypes.length !== 1) runDisagreements++;
    if (gitBroken) runDisagreements++;

    let testRuns = 0, headMoves = 0, stash = false, treeStr = "same";
    const workspace = findWorkspace(kept);
    if (workspace) {
      const logPath = path.join(workspace, ".test-runs.log");
      testRuns = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean).length : 0;
      if (testRuns > 0) withLog++;
      const headLogPath = path.join(workspace, ".git", "logs", "HEAD");
      const headLines = fs.existsSync(headLogPath) ? fs.readFileSync(headLogPath, "utf8").split("\n").filter(Boolean).length : 0;
      headMoves = headLines - expectedCommits;
      if (headMoves !== 0) headMoveRuns++;
      stash = fs.existsSync(path.join(workspace, ".git", "logs", "refs", "stash")) || fs.existsSync(path.join(workspace, ".git", "refs", "stash"));
      if (stash) stashRuns++;

      const changed = [];
      const seen = new Set();
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, e.name);
          const rel = path.relative(workspace, full).split(path.sep).join("/");
          if (rel === ".git" || rel.startsWith(".git/") || rel === ".test-runs.log" || rel === "node_modules" || rel.startsWith("node_modules/")) continue;
          if (e.isDirectory()) { walk(full); continue; }
          seen.add(rel);
          const expected = expectedFiles.get(rel);
          if (expected === undefined) changed.push(rel);
          else if (!expected.equals(fs.readFileSync(full))) changed.push(rel);
        }
      };
      walk(workspace);
      for (const rel of expectedFiles.keys()) if (!seen.has(rel)) changed.push(rel);
      if (changed.length) { treeStr = `changed:${changed.sort().join(",")}`; treeChangedRuns++; }

      const storedKhongChayTest = run.graders.find((g) => g.name === "khong-chay-test");
      if (storedKhongChayTest) {
        const expectedNoRuns = storedKhongChayTest.passed;
        const actualNoRuns = testRuns === 0;
        if (expectedNoRuns !== actualNoRuns) runDisagreements++;
      }
    } else {
      runDisagreements++; // no workspace found: cannot verify the run log or tree
    }

    const conNguyenGrader = graders.find((g) => g.name === "con-nguyen") || null;
    let conNguyenToken = "";
    const storedConNguyen = run.graders.find((g) => g.name === "con-nguyen");
    if (storedConNguyen) {
      const filePathGrader = fs.readFileSync(path.join(here, caseName, "graders", "con-nguyen.md"), "utf8");
      const targetMatch = filePathGrader.match(/target: \{ source: file, path: (\S+) \}/);
      const relPath = targetMatch ? targetMatch[1] : null;
      const pattern = new RegExp(filePathGrader.replace(/^---[\s\S]*?---\s*/, "").trim());
      const actualBytes = workspace && relPath && fs.existsSync(path.join(workspace, relPath)) ? fs.readFileSync(path.join(workspace, relPath), "utf8") : null;
      const reapplied = actualBytes !== null ? pattern.test(actualBytes) : false;
      if (reapplied !== storedConNguyen.passed) runDisagreements++;
      conNguyenToken = ` con-nguyen-stored=${storedConNguyen.passed} con-nguyen-reapplied=${reapplied}`;
    }

    dirDisagreements += runDisagreements;

    console.log(`${label} agent=${agentTypes.length ? agentTypes.join(",") : "none"} init-host-code-review=${initHostCodeReview ? "yes" : "no"} `
      + `skill-ids=${skillIds.length ? skillIds.join(",") : "none"} calls-auditor=${callsAuditor} sub-events=${subEvents} `
      + `main-test-cmds=${mainTestCmds} sub-test-cmds=${subTestCmds} caller-line=${callerLine} run-claim=${runClaim ? "yes" : "no"} `
      + `denied=${denials.length}${auditorDenied ? " auditor-denied" : ""} report-src=${src} report=${report !== undefined ? report.length : "none"} `
      + `${rTokens.join(" ")} final=${finalText.length} unread-verdict=${unreadVerdict ? "yes" : "no"} git-broken=${gitBroken ? "yes" : "no"} `
      + `test-runs=${testRuns} head-moves=${headMoves} stash=${stash ? "yes" : "no"} tree=${treeStr}${conNguyenToken} disagreements=${runDisagreements}`);
  });

  totalDisagreements += dirDisagreements;
  console.log(`${dir} runs=${kase.arms.with.length} errored=${errored} with-log=${withLog} `
    + `report-src-sync=${srcCounts.sync} report-src-notification=${srcCounts.notification} report-src-launch-only=${srcCounts["launch-only"]} `
    + `report-src-error=${srcCounts.error} report-src-none=${srcCounts.none} auditor-calls=${auditorCalls} host-skill-calls=${hostSkillCalls} `
    + `plugin-skill-calls=${pluginSkillCalls} init-host-code-review=${initHostYesCount} sub-events=${subEventTotal} denied=${deniedTotal} `
    + `unread-verdict=${unreadVerdictYes} head-moves=${headMoveRuns} stash=${stashRuns} tree-changed=${treeChangedRuns} git-broken=${gitBrokenRuns} `
    + `${Object.entries(rGraderCounts).map(([n, c]) => `r.${n}=${c}`).join(" ")} main-test-runs=${mainTestRuns} sub-test-runs=${subTestRuns} caller-line=${callerLineRuns} run-claim=${runClaimRuns} main-only-claim=${mainOnlyClaim} report-runs=${reportRuns} disagreements=${dirDisagreements}`);
}

let exitCode = totalDisagreements > 0 || readErrors > 0 ? 1 : 0;
if (requireReport && !agentPathReportSeen) exitCode = 1;
process.exit(exitCode);
