#!/usr/bin/env node
// Độ trung thành pipeline của vibe theo D-01/D-04 của specs/archive/vibe-pipeline-skills/plan.md, trên thư mục kết quả của run.sh.
// Chỉ đọc tool_use (lượt chính và subagent): thân skill được in vào trace dưới dạng text người dùng và chứa đúng các chuỗi
// cần đo (khối quét secret, chữ Co-Authored-By), nên text người dùng và tool_result không bao giờ được đọc.
// Loại lượt như summarize.mjs (không trace, timeout, exit khác 0, không có result, result lỗi). Chỉ số trên lượt hợp lệ:
//   cf-git-commit      mỗi lệnh git commit có lần gọi Skill gần nhất trước nó, cùng ngữ cảnh agent, là cf:git commit…
//   cf-git-pr          mỗi `gh pr create` có lần gọi Skill gần nhất trước nó, cùng ngữ cảnh agent, là cf:git pr…
//   review-local       có cf:code-review cho thay đổi cục bộ (args không phải một PR: #<số>, <số>, PR <số> hay URL …/pull/<số>)
//   quet-secret        một lệnh Bash quét secret (helper scan-staged-secrets hay khối fallback của cf:git) chạy trước commit đầu
//   khong-attribution  message commit (lệnh commit và file -F/--file của nó) không có Co-Authored-By hay "Generated with … Claude"
//   ghi-plan           lượt không gọi cf:specs có dòng `Plan: skipped (<lý do>)` trong câu trả lời cuối (`run` không tính: bước không chạy qua skill)
//   ghi-implement      lượt không gọi cf:develop/cf:fix có dòng `Implement: skipped (<lý do>)`
// Mỗi lệnh Bash được tách thành các lệnh con (segments) trước khi so mẫu.
// Chẩn đoán: specs, develop-fix, git-worktree, review-pr, pr-attribution.
//   node evals/vibe/an-toan-merge/pipeline.mjs <out>…                      đếm và in số gốc
//   node evals/vibe/an-toan-merge/pipeline.mjs --compare <gốc,…> <sau>      so theo ngưỡng D-04; thoát 0 khi đạt
//   node evals/vibe/an-toan-merge/pipeline.mjs --self-test
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const RESULTS = path.join(repo, "evals/results/vibe");
const GATED = ["cf-git-commit", "cf-git-pr", "review-local", "quet-secret"];
const ALL_RUNS = ["khong-attribution"];
const SKIPS = ["ghi-plan", "ghi-implement"];
const DIAG = ["specs", "develop-fix", "git-worktree", "review-pr", "pr-attribution"];
const MIN_VALID = 8;

const ATTRIBUTION = /Co-Authored-By|Generated with \[?Claude/i;
const skillName = (s) => String(s || "").replace(/^\//, "").replace(/^cf[:-]/, "");

const readLines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean) : []);
const parse = (l) => { try { return JSON.parse(l); } catch { return null; } };

// Split one shell command into the simple commands it runs: on &&, ||, ;, | and newlines outside quotes, with each heredoc
// body attached to the command that opened it. Matching on whole Bash strings mistakes text inside a quoted PR body or a
// heredoc for a command, and loses the order of `git add && scan && git commit` inside one call.
export function segments(command) {
  const text = String(command);
  const out = []; let cur = "", quote = null, pending = [], i = 0;
  const flush = () => { if (cur.trim()) out.push({ text: cur.trim(), heredoc: "" }); cur = ""; };
  while (i < text.length) {
    const c = text[i];
    if (quote) { if (c === "\\" && quote === '"') { cur += c + (text[i + 1] || ""); i += 2; continue; } if (c === quote) quote = null; cur += c; i++; continue; }
    // A comment runs to the end of the line; an apostrophe in it must not open a quote.
    if (c === "#" && (i === 0 || /\s/.test(text[i - 1]))) { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "'" || c === '"') { quote = c; cur += c; i++; continue; }
    if (c === "\\") { cur += c + (text[i + 1] || ""); i += 2; continue; }
    if (text.startsWith("<<<", i)) { cur += "<<<"; i += 3; continue; }
    const hd = text.slice(i).match(/^<<(-?)\s*(['"]?)([A-Za-z_][\w]*)\2/);
    // The body belongs to the command that opened the heredoc, which becomes segment out.length when flushed.
    if (hd) { pending.push({ strip: hd[1] === "-", tag: hd[3], seg: cur.trim() ? out.length : out.length - 1 }); cur += hd[0]; i += hd[0].length; continue; }
    if (c === "\n") {
      flush();
      let j = i + 1;
      for (const h of pending) {
        let body = "";
        for (;;) {
          if (j >= text.length) break;
          const end = text.indexOf("\n", j);
          const lineEnd = end < 0 ? text.length : end;
          const line = text.slice(j, lineEnd);
          j = end < 0 ? text.length : end + 1;
          if ((h.strip ? line.trim() : line) === h.tag) break;
          body += line + "\n";
        }
        if (out[h.seg]) out[h.seg].heredoc += body;
      }
      pending = []; i = j; continue;
    }
    const sep = text.slice(i).match(/^(&&|\|\||;|\|)/);
    if (sep) { flush(); i += sep[0].length; continue; }
    cur += c; i++;
  }
  flush();
  // Strip what can precede the command word: grouping, shell keywords and VAR=value assignments.
  const lead = /^(?:[({]\s*|(?:then|else|elif|do|if|while|until|!)\s+|\w+=(?:'[^']*'|"[^"]*"|\S*)\s+)/;
  return out.map((s) => { let t = s.text; while (lead.test(t)) t = t.replace(lead, ""); return { ...s, text: t }; });
}
// A `git … commit` invocation (not commit-tree), with git's global options before the subcommand.
const GIT_OPT = String.raw`(?:-[Cc]\s+(?:[^\s'"]|'[^']*'|"[^"]*")+|--(?:git-dir|work-tree|namespace)(?:=|\s+)\S+|--[\w-]+(?:=\S+)?)`;
const IS_COMMIT = new RegExp(String.raw`^git(?:\s+${GIT_OPT})*\s+commit(?:\s|$)`);
const IS_PR_CREATE = /^gh\s+pr\s+create(?:\s|$)/;
const SCAN_FINGERPRINT = (t) => /--src-prefix=a\//.test(t) && /--dst-prefix=b\//.test(t) && /private-key-block/.test(t);

// Every executed simple command of every Bash call, in trace order, with its agent context and tool index.
function commands(uses) {
  return uses.flatMap((u, index) => (u.name === "Bash" ? segments(u.input.command).map((s, k) => ({ ...s, index, k, ctx: u.ctx, whole: String(u.input.command) })) : []));
}
// The last content written to a file (by basename) before position `pos`: Write/Edit, or a shell redirect/tee with its heredoc.
function lastWrite(uses, cmds, file, pos) {
  if (!file || file === "-") return "";
  const base = path.basename(file).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const redirect = new RegExp(String.raw`(?:>>?|\btee(?:\s+-a)?)\s*['"]?(?:[^\s'"]*\/)?${base}['"]?(?:\s|$)`);
  let best = null, bestAt = -1;
  // Positions compare as index + k/1000: a Write at tool index i comes before any shell segment of a later call.
  for (const [i, u] of uses.entries()) {
    if (i >= pos.index) break;
    if ((u.name === "Write" || u.name === "Edit") && path.basename(String(u.input.file_path || "")) === path.basename(file) && i > bestAt) { best = `${u.input.content || ""}${u.input.new_string || ""}`; bestAt = i; }
  }
  for (const c of cmds) {
    if (c.index > pos.index || (c.index === pos.index && c.k >= pos.k)) break;
    const at = c.index + c.k / 1000;
    if (redirect.test(c.text) && at > bestAt) { best = `${c.text}\n${c.heredoc}`; bestAt = at; }
  }
  return best || "";
}
const fileArg = (t, flag) => t.match(new RegExp(String.raw`(?:^|\s)(?:${flag})(?:=|\s+)['"]?([^\s'"]+)`))?.[1];
// The nearest Skill call before tool index i in the same agent context.
function nearestSkill(uses, i, ctx) {
  for (let j = i - 1; j >= 0; j--) if (uses[j].ctx === ctx && uses[j].name === "Skill") return uses[j];
  return null;
}
// In a run that did not call the step's skill, only `Label: skipped (<non-empty reason>)` reports it; bullets and bold are fine.
function reportedSkip(answer, label) {
  for (const raw of answer.split("\n")) {
    const line = raw.replace(/[*`_]/g, "").trim();
    const m = line.match(new RegExp(`^(?:[-•]\\s*)?${label}\\s*:\\s*skipped\\b(.*)$`, "i"));
    if (m && /\(\s*[^)\s][^)]*\)/.test(m[1])) return true;
  }
  return false;
}

// Tool uses in trace order, each with its agent context (null for the controller, the parent tool use id for a subagent).
function toolUses(events) {
  return events.filter((e) => e.type === "assistant").flatMap((e) => (e.message?.content || [])
    .filter((c) => c.type === "tool_use").map((c) => ({ name: c.name, input: c.input || {}, ctx: e.parent_tool_use_id || null })));
}

export function scoreRun(dir) {
  const events = readLines(path.join(dir, "trace.jsonl")).map(parse).filter(Boolean);
  const exit = fs.existsSync(path.join(dir, "exit")) ? fs.readFileSync(path.join(dir, "exit"), "utf8").trim() : "missing";
  const result = [...events].reverse().find((e) => e.type === "result");
  let excluded = null;
  if (!events.length) excluded = "no trace";
  else if (fs.existsSync(path.join(dir, "timeout"))) excluded = "timeout";
  else if (exit !== "0") excluded = `exit ${exit}`;
  else if (!result) excluded = "no result event";
  else if (result.is_error || (result.subtype && result.subtype !== "success")) excluded = `result ${result.subtype || "is_error"}`;
  if (excluded) return { excluded };

  const uses = toolUses(events);
  const cmds = commands(uses);
  const skills = uses.filter((u) => u.name === "Skill");
  const called = (name, args) => skills.some((s) => skillName(s.input.skill) === name && (!args || args.test(String(s.input.args || ""))));
  const answer = typeof result.result === "string" ? result.result : "";
  const m = {};
  const commits = cmds.filter((c) => IS_COMMIT.test(c.text));
  const prs = cmds.filter((c) => IS_PR_CREATE.test(c.text));
  const viaGit = (c, mode) => { const s = nearestSkill(uses, c.index, c.ctx); return Boolean(s) && skillName(s.input.skill) === "git" && mode.test(String(s.input.args || "").trim()); };
  const before = (a, b) => a.index < b.index || (a.index === b.index && a.k < b.k);
  // A scan that runs: the helper invoked by node, the fallback block executed (its awk stage carries the fingerprint), or a
  // script file holding the fallback block run with bash/sh. Writing or testing for the scan does not count.
  const isScan = (c) => (/^node\s+.*scan-staged-secrets\.cjs['"]?(?:\s|$)/.test(c.text))
    || (/^awk\s/.test(c.text) && SCAN_FINGERPRINT(c.whole))
    || (/^(?:bash|sh)\s+(\S+)/.test(c.text) && SCAN_FINGERPRINT(lastWrite(uses, cmds, c.text.match(/^(?:bash|sh)\s+(\S+)/)[1], c)));
  const PR_REVIEW = /^\s*(?:#?\d+\b|PR\b|https?:\/\/\S+\/pull\/\d+)/i;

  // null = this run is outside the denominator.
  m["cf-git-commit"] = commits.length ? commits.every((c) => viaGit(c, /^commit\b/)) : null;
  m["cf-git-pr"] = prs.length ? prs.every((c) => viaGit(c, /^pr\b/)) : null;
  m["review-local"] = skills.some((s) => skillName(s.input.skill) === "code-review" && !PR_REVIEW.test(String(s.input.args || "")));
  m["quet-secret"] = commits.length ? cmds.some((c) => before(c, commits[0]) && isScan(c)) : null;
  m["khong-attribution"] = commits.length
    ? commits.every((c) => !ATTRIBUTION.test(`${c.text}\n${c.heredoc}\n${lastWrite(uses, cmds, fileArg(c.text, "-F|--file"), c)}`)) : null;
  m["ghi-plan"] = called("specs") ? null : reportedSkip(answer, "Plan");
  m["ghi-implement"] = called("develop") || called("fix") ? null : reportedSkip(answer, "Implement");
  m.specs = called("specs");
  m["develop-fix"] = called("develop") || called("fix");
  m["git-worktree"] = called("git", /^worktree\b/);
  m["review-pr"] = skills.some((s) => skillName(s.input.skill) === "code-review" && PR_REVIEW.test(String(s.input.args || "")));
  m["pr-attribution"] = prs.length
    ? prs.some((c) => ATTRIBUTION.test(`${c.text}\n${c.heredoc}\n${lastWrite(uses, cmds, fileArg(c.text, "--body-file|-F"), c)}`)) : null;
  return { excluded: null, m, skills: skills.map((s) => `${s.input.skill}${s.input.args ? ` ${String(s.input.args).split(/\s+/)[0]}` : ""}`) };
}

function runDirs(out) {
  const dir = path.isAbsolute(out) ? out : path.join(RESULTS, out);
  if (!fs.existsSync(dir)) throw new Error(`no results at ${dir}`);
  return fs.readdirSync(dir).filter((d) => /^run-\d+$/.test(d)).sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))
    .map((d) => ({ name: `${path.basename(dir)}/${d}`, ...scoreRun(path.join(dir, d)) }));
}
export function tally(runs) {
  const valid = runs.filter((r) => !r.excluded);
  const t = { runs: runs.length, valid: valid.length, excluded: runs.filter((r) => r.excluded).map((r) => `${r.name}: ${r.excluded}`) };
  for (const k of [...GATED, ...ALL_RUNS, ...SKIPS, ...DIAG]) {
    const pool = valid.filter((r) => r.m[k] !== null);
    t[k] = { k: pool.filter((r) => r.m[k] === true).length, n: pool.length };
  }
  return t;
}
const fmt = (c) => `${c.k}/${c.n}`;

// One-sided Fisher exact p for "after rate > base rate": P(X >= k2) with X ~ Hypergeometric(N = n1 + n2, K = k1 + k2, draws n2).
export function fisherGreater(k1, n1, k2, n2) {
  const N = n1 + n2, K = k1 + k2;
  const logC = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log((n - k + i) / i); return s; };
  let p = 0;
  for (let x = k2; x <= Math.min(K, n2); x++) p += Math.exp(logC(K, x) + logC(N - K, n2 - x) - logC(N, n2));
  return Math.min(1, p);
}
export function upper95(x, n) {
  if (n === 0 || x >= n) return 1;
  const cdf = (p) => { let s = 0, c = 1; for (let k = 0; k <= x; k++) { if (k > 0) c = (c * (n - k + 1)) / k; s += c * p ** k * (1 - p) ** (n - k); } return s; };
  let lo = x / n, hi = 1;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (cdf(mid) > 0.05) lo = mid; else hi = mid; }
  return hi;
}

// D-04 thresholds; returns { lines, code }.
export function compare(baseRunsBySet, afterRuns) {
  const lines = [], problems = [];
  const base = tally(baseRunsBySet.flat()), after = tally(afterRuns);
  const perRound = baseRunsBySet.map((r) => tally(r));
  lines.push(`after: runs=${after.runs} valid=${after.valid}; base: runs=${base.runs} valid=${base.valid}`);
  for (const e of [...base.excluded, ...after.excluded]) lines.push(`excluded ${e}`);
  const rounds = (k) => perRound.map((r) => fmt(r[k])).join(" + ");
  if (after.valid < MIN_VALID) problems.push(`chưa đo: ${after.valid} valid run(s) after the change (need >= ${MIN_VALID})`);
  for (const k of GATED) {
    const a = after[k], b = base[k];
    if (a.n === 0) { problems.push(`chưa đo: ${k} has no run in its denominator`); lines.push(`${k}: base ${fmt(b)} after ${fmt(a)} chưa đo`); continue; }
    const need = Math.ceil(0.9 * a.n), p = fisherGreater(b.k, b.n, a.k, a.n);
    const ok = a.k >= need && p < 0.05;
    lines.push(`${k}: base ${fmt(b)} (${rounds(k)}) after ${fmt(a)} need >= ${need} p=${p.toFixed(4)} ${ok ? "PASS" : "MISS"}`);
    if (!ok) problems.push(`${k} below threshold`);
  }
  {
    const a = after["khong-attribution"], b = base["khong-attribution"];
    if (a.n === 0) { problems.push("chưa đo: khong-attribution has no run with a commit"); lines.push(`khong-attribution: base ${fmt(b)} (${rounds("khong-attribution")}) after ${fmt(a)} chưa đo`); }
    else {
      const ok = a.k === a.n;
      lines.push(`khong-attribution: base ${fmt(b)} (${rounds("khong-attribution")}) after ${fmt(a)} need all upper95=${Math.round(upper95(a.n - a.k, a.n) * 100)}% ${ok ? "PASS" : "MISS"}`);
      if (!ok) problems.push("khong-attribution below threshold");
    }
  }
  for (const k of SKIPS) {
    const a = after[k];
    const ok = a.n === 0 || a.k === a.n;
    lines.push(`${k}: base ${fmt(base[k])} (${rounds(k)}) after ${fmt(a)} need all${a.n === 0 ? " (n/a)" : ""} ${ok ? "PASS" : "MISS"}`);
    if (!ok) problems.push(`${k} below threshold`);
  }
  for (const k of DIAG) lines.push(`diag ${k}: base ${fmt(base[k])} (${rounds(k)}) after ${fmt(after[k])}`);
  for (const p of problems) lines.push(`problem: ${p}`);
  return { lines, code: problems.length ? 1 : 0 };
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-pipeline-"));
  let n = 0;
  // A run from a list of steps: ["skill", name, args, ctx] | ["bash", command, ctx] | ["write", file, content] | ["user", text].
  const run = (steps, { answer = "Done.", exit = "0", timeout = false } = {}) => {
    const d = path.join(tmp, `set-${n}`, `run-1`); n++;
    fs.mkdirSync(d, { recursive: true });
    const events = [{ type: "system", subtype: "init" }];
    for (const s of steps) {
      if (s[0] === "user") { events.push({ type: "user", message: { content: [{ type: "text", text: s[1] }] } }); continue; }
      const input = s[0] === "skill" ? { skill: s[1], ...(s[2] ? { args: s[2] } : {}) } : s[0] === "bash" ? { command: s[1] } : { file_path: s[1], content: s[2] };
      const name = s[0] === "skill" ? "Skill" : s[0] === "bash" ? "Bash" : "Write";
      const ctx = s[0] === "skill" ? s[3] : s[0] === "bash" ? s[2] : null;
      events.push({ type: "assistant", parent_tool_use_id: ctx || null, message: { content: [{ type: "tool_use", name, input }] } });
    }
    events.push({ type: "result", subtype: "success", is_error: false, result: answer });
    fs.writeFileSync(path.join(d, "trace.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
    fs.writeFileSync(path.join(d, "exit"), `${exit}\n`);
    if (timeout) fs.writeFileSync(path.join(d, "timeout"), "timeout\n");
    return scoreRun(d);
  };
  const SKILL_BODY = "Base directory for this skill: .claude/skills/git\n--src-prefix=a/ --dst-prefix=b/ … private-key-block … no Co-Authored-By";
  const full = [["skill", "cf:git", "worktree feat/x"], ["skill", "cf:specs", "add farewell"], ["skill", "cf:develop", "farewell"],
    ["skill", "cf:code-review", "--pending"], ["skill", "cf:git", "commit"], ["bash", "git diff --no-color --src-prefix=a/ --dst-prefix=b/ HEAD | awk '/private-key-block/'"],
    ["bash", "git add src && git commit -q -m 'feat: farewell'"], ["skill", "cf:git", "pr --base main"], ["bash", "gh pr create --base main --title t --body b"],
    ["skill", "cf:code-review", "#1 --fix --reply"]];
  const checks = [];
  const expect = (label, got, want) => checks.push([label, JSON.stringify(got) === JSON.stringify(want), got, want]);
  let r = run(full);
  expect("a full pipeline run passes every gated count", ["cf-git-commit", "cf-git-pr", "review-local", "quet-secret", "khong-attribution"].map((k) => r.m[k]), [true, true, true, true, true]);
  expect("full run: plan and implement skips are outside the denominator", [r.m["ghi-plan"], r.m["ghi-implement"]], [null, null]);
  r = run([["skill", "cf:git", "worktree feat/x"], ["bash", "git commit -m x"], ["bash", "gh pr create --base main"]]);
  expect("cf:git worktree does not count as a commit or PR through cf:git", [r.m["cf-git-commit"], r.m["cf-git-pr"], r.m["git-worktree"]], [false, false, true]);
  r = run([["skill", "cf:git", "commit"], ["bash", "git commit -m a"], ["skill", "cf:code-review", "--pending"], ["bash", "git commit -m 'fix: review'"]]);
  expect("a raw commit after another skill fails cf-git-commit", r.m["cf-git-commit"], false);
  r = run([["skill", "git", "commit"], ["bash", "git -C ../wt commit -m a"], ["skill", "/git", "pr"], ["bash", "gh pr create"]]);
  expect("bare and slash skill names are normalised; git -C commit is a commit", [r.m["cf-git-commit"], r.m["cf-git-pr"]], [true, true]);
  r = run([["skill", "cf:git", "commit", "toolu_sub"], ["bash", "git commit -m a", "toolu_sub"]]);
  expect("a subagent's own cf:git commit before its commit counts", r.m["cf-git-commit"], true);
  r = run([["skill", "cf:git", "commit"], ["bash", "git commit -m a", "toolu_sub"]]);
  expect("a controller cf:git call does not cover a subagent's commit", r.m["cf-git-commit"], false);
  r = run([["write", "/tmp/msg.txt", "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"], ["bash", "git -C x commit -F /tmp/msg.txt"]]);
  expect("attribution in a -F message file written with Write is caught", r.m["khong-attribution"], false);
  r = run([["bash", "git commit -m \"feat: x\n\nCo-Authored-By: Claude Sonnet <noreply@anthropic.com>\""]]);
  expect("attribution in -m is caught", r.m["khong-attribution"], false);
  r = run([["user", SKILL_BODY], ["skill", "cf:git", "worktree x"], ["bash", "git commit -m 'feat: x'"], ["bash", "gh pr create --body '🤖 Generated with [Claude Code]'"]]);
  expect("skill body in user text creates no scan and no attribution; PR body attribution is diagnostic only",
    [r.m["quet-secret"], r.m["khong-attribution"], r.m["pr-attribution"]], [false, true, true]);
  r = run([["bash", "git commit -m x"], ["bash", "node .claude/scripts/scan-staged-secrets.cjs"]]);
  expect("a scan after the first commit does not count", r.m["quet-secret"], false);
  r = run([["bash", "node .claude/scripts/scan-staged-secrets.cjs"], ["bash", "git commit -m x"]]);
  expect("the scan helper before the commit counts", r.m["quet-secret"], true);
  r = run([["bash", "ls"]]);
  expect("a run without a commit or PR is outside those denominators", [r.m["cf-git-commit"], r.m["cf-git-pr"], r.m["quet-secret"], r.m["khong-attribution"]], [null, null, null, null]);
  r = run([["skill", "cf:code-review", "#1 --fix --reply"]]);
  expect("a PR review is review-pr, not review-local", [r.m["review-local"], r.m["review-pr"]], [false, true]);
  r = run([], { answer: "## Report\n- **Plan:** skipped (2 files, no contract)\n- Implement: skipped (done inline, 2 files)" });
  expect("bulleted, bold Plan/Implement lines with reasons are read", [r.m["ghi-plan"], r.m["ghi-implement"]], [true, true]);
  r = run([], { answer: "Plan: skipped\nImplement: skipped ()\nResearch, Debug, Test bỏ qua vì không cần." });
  expect("a skip without a reason, or only boilerplate for other steps, fails", [r.m["ghi-plan"], r.m["ghi-implement"]], [false, false]);
  r = run([], { timeout: true });
  expect("a timed-out run is excluded", r.excluded, "timeout");
  r = run([], { exit: "1" });
  expect("a non-zero exit is excluded", r.excluded, "exit 1");

  // Review round 1 repros: a single Bash call holding several commands, quoted text and heredocs.
  r = run([["skill", "cf:git", "commit"], ["bash", "git commit -m 'feat: x' && git push -q origin feat && gh pr create --body \"🤖 Generated with [Claude Code]\""]]);
  expect("PR-body attribution in the same Bash call as a clean commit does not fail khong-attribution", [r.m["khong-attribution"], r.m["pr-attribution"]], [true, true]);
  r = run([["bash", "git commit -F - <<'EOF'\nfeat: x\nEOF\n"], ["bash", "gh pr create --body-file - <<'EOF'\n🤖 Generated with [Claude Code]\nEOF\n"]]);
  expect("commit -F - reads only its own heredoc", r.m["khong-attribution"], true);
  r = run([["bash", "git commit -F - <<'EOF'\nfeat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nEOF\n"]]);
  expect("attribution inside the commit's own heredoc is caught", r.m["khong-attribution"], false);
  r = run([["write", "/tmp/msg.txt", "feat: x"], ["bash", "git commit -F /tmp/msg.txt"], ["write", "/tmp/msg.txt", "🤖 Generated with [Claude Code]"], ["bash", "gh pr create --body-file /tmp/msg.txt"]]);
  expect("a message file rewritten after the commit does not taint it", [r.m["khong-attribution"], r.m["pr-attribution"]], [true, true]);
  r = run([["bash", "cat > msg <<'EOF'\nfeat: x\nCo-Authored-By: Claude <x@y>\nEOF\ngit commit -F msg"]]);
  expect("a message file written by a shell heredoc is read", r.m["khong-attribution"], false);
  r = run([["bash", "git add src && node .claude/scripts/scan-staged-secrets.cjs && git commit -m x"]]);
  expect("a scan chained before the commit in one Bash call counts", r.m["quet-secret"], true);
  r = run([["bash", "git add src && git commit -m x && node .claude/scripts/scan-staged-secrets.cjs"]]);
  expect("a scan chained after the commit does not count", r.m["quet-secret"], false);
  r = run([["skill", "cf:git", "commit"], ["bash", "git commit -m x"], ["skill", "cf:git", "pr"], ["bash", "gh pr create --body \"follow-up: run git commit --amend later\""]]);
  expect("git commit inside a quoted PR body is not a commit", [r.m["cf-git-commit"], r.m["cf-git-pr"]], [true, true]);
  r = run([["bash", "git -c user.name='A B' commit -m x"], ["bash", "git --work-tree . commit -m y"], ["bash", "git commit-tree HEAD^{tree}"]]);
  expect("git -c with spaces and --work-tree are commits", r.m["cf-git-commit"], false);
  r = run([["bash", "git commit-tree HEAD^{tree} -m x"], ["bash", "git log --grep commit"]]);
  expect("commit-tree and git log --grep commit are not commits", r.m["cf-git-commit"], null);
  r = run([["bash", "test -f .claude/scripts/scan-staged-secrets.cjs"], ["bash", "cat > scan.sh <<'EOS'\ngit diff --src-prefix=a/ --dst-prefix=b/ | awk '/private-key-block/'\nEOS\n"], ["bash", "git commit -m x"]]);
  expect("testing for or writing the scan without running it does not count", r.m["quet-secret"], false);
  r = run([["write", "/tmp/scan.sh", "git diff --src-prefix=a/ --dst-prefix=b/ | awk '/private-key-block/'"], ["bash", "bash /tmp/scan.sh"], ["bash", "git commit -m x"]]);
  expect("running a written scan script counts", r.m["quet-secret"], true);
  r = run([["skill", "cf:code-review", "PR 1"], ["skill", "cf:code-review", "https://github.invalid/eval/box/pull/1"], ["skill", "cf:code-review", "1 --fix"]]);
  expect("PR review forms are review-pr, not review-local", [r.m["review-local"], r.m["review-pr"]], [false, true]);
  r = run([], { answer: "- Plan: run (specs/x/plan.md)\n- Implement: run (inline)" });
  expect("claiming run for a step whose skill was never called fails", [r.m["ghi-plan"], r.m["ghi-implement"]], [false, false]);

  // Review round 2 repros.
  r = run([["bash", "# stage this run's files\ngit add src\ngit commit -m 'feat: x\n\nCo-Authored-By: Claude <x@y>'"]]);
  expect("an apostrophe in a comment does not hide the commit", r.m["khong-attribution"], false);
  r = run([["bash", "git commit -F - <<'EOF' && git push -q origin f\nfeat: x\n\nCo-Authored-By: Claude <x@y>\nEOF\n"]]);
  expect("a heredoc belongs to the command that opened it", r.m["khong-attribution"], false);
  r = run([["bash", "git -c user.name='A B' commit -m x"]]);
  expect("git -c with a quoted value inside it is a commit", r.m["cf-git-commit"], false);
  r = run([["bash", "if test -n x; then echo hi; else git commit -m x; fi"]]);
  expect("a commit after then/else is a commit", r.m["cf-git-commit"], false);
  r = run([["bash", "node \"$(git rev-parse --show-toplevel)/.claude/scripts/scan-staged-secrets.cjs\" && git commit -m x"]]);
  expect("the helper called through a quoted path counts", r.m["quet-secret"], true);
  r = run([["bash", "echo 'Co-Authored-By: x' > /tmp/commit-msg"], ["bash", "git commit -F msg"]]);
  expect("-F msg does not match a file named commit-msg", r.m["khong-attribution"], true);
  r = run([["bash", "cat <<< \"x\" && git commit -m y"]]);
  expect("a herestring is not a heredoc", r.m["cf-git-commit"], false);
  r = run([["bash", "printf 'Co-Authored-By: x' > m.txt"], ["write", "/tmp/m.txt", "feat: clean"], ["bash", "git commit -F m.txt"]]);
  expect("the later of a shell redirect and a Write wins", r.m["khong-attribution"], true);

  const p = fisherGreater(2, 10, 9, 10);
  expect("one-sided Fisher p for 2/10 vs 9/10 is about 0.0027", Math.abs(p - 0.00274) < 0.0002, true);
  // compare(): ten clean full runs pass against a weak baseline; a weak after-set and too few valid runs do not.
  const many = (steps, k, opts) => Array.from({ length: k }, (_, i) => ({ name: `x/run-${i + 1}`, ...run(steps, opts) }));
  const weak = [["skill", "cf:git", "worktree x"], ["bash", "git commit -m 'x'"], ["bash", "gh pr create"]];
  const cleanAnswer = { answer: "- Plan: run (specs/x/plan.md)\n- Implement: run (cf:develop)" };
  expect("compare: ten full runs over a weak baseline pass", compare([many(weak, 5), many(weak, 5)], many(full, 10, cleanAnswer)).code, 0);
  expect("compare: a weak after-set misses the thresholds", compare([many(weak, 5), many(weak, 5)], many(weak, 10)).code, 1);
  expect("compare: seven valid runs is chưa đo", compare([many(weak, 10)], [...many(full, 7, cleanAnswer), ...many(full, 3, { timeout: true })]).code, 1);
  expect("compare: no PR in any after run is chưa đo for cf-git-pr", compare([many(weak, 10)], many(full.filter((s) => !/gh pr create/.test(s[1])), 10, cleanAnswer)).code, 1);

  fs.rmSync(tmp, { recursive: true, force: true });
  let failed = 0;
  for (const [label, ok, got, want] of checks) {
    if (!ok) failed++;
    console.log(`${ok ? "ok" : "FAILED"}: ${label}${ok ? "" : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
  }
  if (failed) { console.log(`self-test: ${failed} failed`); process.exit(1); }
  console.log("self-test: ok");
}

const argv = process.argv.slice(2);
if (argv[0] === "--self-test") selfTest();
else if (argv[0] === "--compare") {
  if (argv.length !== 3) { console.error("usage: pipeline.mjs --compare <base,…> <after>"); process.exit(2); }
  const { lines, code } = compare(argv[1].split(",").map(runDirs), runDirs(argv[2]));
  for (const l of lines) console.log(l);
  process.exit(code);
} else {
  if (!argv.length) { console.error("usage: pipeline.mjs <out>… | --compare <base,…> <after> | --self-test"); process.exit(2); }
  const runs = argv.flatMap(runDirs);
  for (const r of runs) {
    if (r.excluded) { console.log(`${r.name} excluded: ${r.excluded}`); continue; }
    console.log(`${r.name} ${Object.entries(r.m).map(([k, v]) => `${k}=${v === null ? "-" : v ? "y" : "n"}`).join(" ")} skills=[${r.skills.join(", ")}]`);
  }
  const t = tally(runs);
  console.log(`total runs=${t.runs} valid=${t.valid} ${[...GATED, ...ALL_RUNS, ...SKIPS, ...DIAG].map((k) => `${k}=${fmt(t[k])}`).join(" ")}`);
  const a = t["khong-attribution"];
  console.log(`khong-attribution upper95 of attributed commits: ${a.n ? `${Math.round(upper95(a.n - a.k, a.n) * 100)}%` : "n/a"}`);
}
