#!/usr/bin/env node
// Hook PreToolUse của runner: Edit/Write/MultiEdit/NotebookEdit không đi qua sandbox của Bash, nên hook này chặn mọi đường dẫn
// ghi nằm ngoài phòng thử ($VIBE_ROOM). Thoát 2 kèm lý do trên stderr là chặn lệnh; thoát 0 là cho qua.
// Fail closed: thiếu VIBE_ROOM, input không đọc được, hay bất kỳ lỗi nào cũng thoát 2 (với hook, thoát 1 là lỗi không chặn).
import fs from "node:fs";
import path from "node:path";

const block = (msg) => { console.error(`vibe guard: ${msg}`); process.exit(2); };
try {
  const room = process.env.VIBE_ROOM;
  if (!room) block("VIBE_ROOM is not set");
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const target = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  if (typeof target !== "string" || target === "") block("no file path in tool input");
  const roomReal = fs.realpathSync(room);
  const inside = (p) => p === roomReal || p.startsWith(roomReal + path.sep);

  // Walk up from the target with lstat, not existsSync: a dangling symlink "does not exist" for existsSync, yet a write
  // follows it. Any symlink on the way must resolve, and resolve inside the room.
  let probe = path.resolve(input.cwd || process.cwd(), target);
  const rest = [];
  for (;;) {
    let stat = null;
    try { stat = fs.lstatSync(probe); } catch { /* not there yet */ }
    if (stat) {
      if (stat.isSymbolicLink()) {
        let resolved;
        try { resolved = fs.realpathSync(probe); } catch { block(`dangling symlink on the write path: ${probe}`); }
        if (!inside(resolved)) block(`symlink on the write path leaves the eval room: ${probe} -> ${resolved}`);
      }
      break;
    }
    const parent = path.dirname(probe);
    if (parent === probe) break;
    rest.unshift(path.basename(probe));
    probe = parent;
  }
  const resolved = path.join(fs.realpathSync(probe), ...rest);
  if (inside(resolved)) process.exit(0);
  block(`${input.tool_name || "write"} outside the eval room is blocked: ${resolved}`);
} catch (error) {
  block(`internal error, blocking: ${error && error.message}`);
}
