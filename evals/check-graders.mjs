#!/usr/bin/env node
// Prove a grader repair against evidence that has already been paid for.
//
//   node evals/check-graders.mjs
//
// Three graders were found to judge something other than what they claim: `khong-code` read a
// prose line opening with a keyword as code, `moi-ac-co-task` rejected a criteria range that
// covers every declared ID, and `khong-tu-chot` penalised the minimum-change proposal that the
// skill itself requires. A repair is only believable if it still catches what the grader was
// written to catch, so every assertion below is replayed over recorded runs rather than argued.
// The one exception is the two rubrics: a live judge exercises those, and only a rerun can show
// how one reads them. What is proven here is that the contradicting clause is gone and the new
// allowance is present.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const resultsRoot = join(root, "evals/results/specs");
const grader = (p) => join(root, "evals/specs", p);

const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok });
  console.log(`${ok ? "✔" : "✗"} ${name} — ${detail}`);
};

// The regex lives in three case directories and nothing keeps them in step, which is how the
// export-csv copy was missed on the first pass. Compare them before trusting any replay.
const copies = ["dung-o-c1", "mo-ho-c1", "export-csv"].map((c) => `${c}/graders/khong-code.md`);
const bodies = await Promise.all(copies.map((p) => readFile(grader(p), "utf8")));
check("the three khong-code copies are identical",
  bodies.every((b) => b === bodies[0]),
  `${copies.length} copies, ${new Set(bodies).size} distinct`);

const [, frontmatter, body] = bodies[0].split("---");
const pattern = body.trim().split("\n").filter(Boolean)[0];
const flags = /^flags:\s*(\S+)/m.exec(frontmatter)?.[1] ?? "";
check("the case-insensitive flag is gone",
  !flags.includes("i"),
  flags ? `flags: ${flags}` : "no flags, so `Export` in prose cannot match `export`");

// The grader this repair replaced, pattern AND flags, kept here so the replay compares verdicts
// rather than asserting them. The `i` flag is the defect itself: it let a capitalised `Export` in
// Vietnamese prose match the lowercase keyword, so comparing without it would hide the very thing
// under test. Only one run may change verdict: the prose line that started this.
const previous = "(^|\\n)[ \\t]*(const|let|var|import|export|module\\.exports|require\\()[^\\n]*|app\\.(get|post|use)\\(\\s*[\\x27\"]/|passport\\.(use|authenticate)\\(|new\\s+OAuth2Client\\(";
const previousFlags = "i";
const flagged = (re, text) => re.test(text);

const dirs = (await readdir(resultsRoot, { withFileTypes: true }))
  .filter((d) => d.isDirectory()).map((d) => d.name).sort();
const changed = [];
let compared = 0, stillFlagged = 0;
for (const dir of dirs) {
  let report;
  try {
    report = JSON.parse(await readFile(join(resultsRoot, dir, "result.json"), "utf8"));
  } catch { continue; }
  for (const entry of report.cases || []) {
    for (const [arm, runs] of Object.entries(entry.arms || {})) {
      (runs || []).forEach((run, index) => {
        const graders = run.graders || [];
        if (!graders.some((g) => g.name === "khong-code")) return;
        const text = graders.find((g) => g.name === "dung-truoc-khi-lam")?.evidence
          ?? graders.find((g) => g.evidence)?.evidence ?? "";
        if (!text) return;
        compared += 1;
        const before = flagged(new RegExp(previous, previousFlags), text);
        const after = flagged(new RegExp(pattern), text);
        if (after) stillFlagged += 1;
        if (before !== after) changed.push(`${dir}/${entry.name}[${arm}]${index}: ${before ? "flagged→clean" : "clean→flagged"}`);
      });
    }
  }
}

check("every verdict except the known false positive is unchanged",
  changed.length === 1 && changed[0].includes("export-csv[with]2") && changed[0].endsWith("flagged→clean"),
  changed.length === 0 ? `${compared} runs compared, nothing changed — the repair did nothing`
    : `${compared} runs compared, ${changed.length} changed: ${changed.join("; ")}`);

// A floor alone cannot see over-flagging: 36 of 36 would pass it too. What stops that is the
// verdict-comparison check above, which fails in both directions. Do not drop one and keep this.
check("real code is still caught across the suite",
  stillFlagged >= 13,
  `${stillFlagged} of ${compared} recorded runs still flagged as containing code`);

// The two rubrics are text. Assert both directions: the clause that contradicted the skill is
// gone, and the allowance its absence made necessary is present.
const ambiguity = await readFile(grader("mo-ho-c1/graders/khong-tu-chot.md"), "utf8");
check("khong-tu-chot no longer treats the minimum-change proposal as deciding",
  !ambiguity.includes("tự chốt kênh/người nhận/thời điểm rồi lập kế hoạch")
    && ambiguity.includes("là ĐÚNG QUY TRÌNH và vẫn ĐẠT") && ambiguity.includes("THÔI hỏi"),
  "the contradicting clause is gone and the allowance is present, and a reply that stops asking still fails");

const coverage = await readFile(grader("sau-keep/graders/moi-ac-co-task.md"), "utf8");
check("moi-ac-co-task accepts a criteria range",
  !coverage.includes("xuất hiện trong ít nhất một hàng")
    && coverage.includes("dải") && coverage.includes("AC-01..AC-06"),
  "the literal-ID demand is gone and a range covering the declared IDs now satisfies the mapping");

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} grader repairs proven from recorded evidence`);
process.exit(failed.length === 0 ? 0 : 1);
