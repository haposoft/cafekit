// Records each run of the test file that requires it: one line per process in .test-runs.log.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const hash = (update) => { const h = crypto.createHash("sha256"); update(h); return h.digest("hex").slice(0, 12); };
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const treeHash = (dir) => hash((h) => {
  // Only source files count: a backup such as paginate.js.bak left by `sed -i.bak` is not source.
  const files = fs.existsSync(dir) ? walk(dir).map((f) => path.relative(root, f).split(path.sep).join("/")).filter((f) => /\.(?:c|m)?js$|\.json$/.test(f)).sort() : [];
  for (const rel of files) h.update(rel + "\0").update(fs.readFileSync(path.join(root, rel))).update("\0");
});
const fileHash = (file) => hash((h) => { try { h.update(fs.readFileSync(file)); } catch { h.update("missing"); } });

if (require.main !== module && require.main && require.main.filename) {
  const testFile = require.main.filename;
  process.on("exit", (code) => {
    const exit = process.exitCode ?? code;
    const line = `${new Date().toISOString()} file=${path.basename(testFile)} src=${treeHash(path.join(root, "src"))} test=${fileHash(testFile)} exit=${exit}\n`;
    fs.appendFileSync(path.join(root, ".test-runs.log"), line);
  });
}
