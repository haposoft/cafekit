#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * SessionStart Hook — docs-sync.cjs
 *
 * Kiểm tra phân vùng docs/ và so chiếu với Source Code.
 * Nếu chưa có docs nhưng có code -> Ép tạo docs.
 * Nếu đã có docs và code thay đổi (Git Hash) -> Ép update docs.
 *
 * Exit: 0 always (fail-open)
 */

try {
  const fs = require('fs');
  const path = require('path');
  const { execFileSync } = require('child_process');
  const { loadConfig } = require('./lib/config.cjs');

  // Đọc stdin theo chuẩn hook
  const stdin = fs.readFileSync(0, 'utf8').trim();
  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const payload = stdin ? normalizeHookPayload(JSON.parse(stdin)) : {};
  const cwd = payload.cwd || process.cwd();
  const config = loadConfig({ cwd, includeProject: false, includeAssertions: false, includeLocale: false });

  const docsDir = path.join(cwd, config.paths?.docs || 'docs');
  const specsDir = path.join(cwd, config.paths?.specs || 'specs');
  const docsRelative = path.relative(cwd, docsDir).replace(/\\/g, '/');
  const specsRelative = path.relative(cwd, specsDir).replace(/\\/g, '/');
  
  // Xác định dự án đã có cốt lõi code hay chưa?
  const hasCode = fs.existsSync(path.join(cwd, 'src')) ||
                  fs.existsSync(path.join(cwd, 'app')) ||
                  fs.existsSync(path.join(cwd, 'lib')) ||
                  fs.existsSync(path.join(cwd, 'package.json')) ||
                  fs.existsSync(path.join(cwd, 'index.js')) ||
                  fs.existsSync(path.join(cwd, 'main.py'));

  if (!hasCode) {
    process.exit(0);
  }

  const lines = [];

  // Case 1: source present but docs/ missing
  if (!fs.existsSync(docsDir)) {
    lines.push('');
    lines.push('### Missing docs/');
    lines.push('> Source exists but `docs/` does not. Create baseline docs first:');
    lines.push('> 1. `docs/system-architecture.md` — system architecture and flows');
    lines.push('> 2. `docs/project-overview-pdr.md` — overview, goals, features');
    lines.push('> 3. Write the latest non-docs/non-Specs source hash to `docs/.sync_hash`.');
    lines.push('');
  }
  // Case 2: docs exist — check continuous sync vs source-only git hash
  else {
    try {
      // Latest SOURCE-only hash (ignore docs-only commits)
      const currentHash = execFileSync('git', [
        'log', '-1', '--format=%H', '--', '.',
        `:(exclude,literal)${docsRelative}`,
        `:(exclude,literal)${specsRelative}`,
      ], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

      if (currentHash) {
        const syncTrackingFile = path.join(docsDir, '.sync_hash');
        const lastSyncHash = fs.existsSync(syncTrackingFile) 
          ? fs.readFileSync(syncTrackingFile, 'utf8').trim() 
          : '';

        if (lastSyncHash !== currentHash) {
          lines.push('');
          lines.push('### Docs sync needed');
          lines.push(`> Source changed (\`${currentHash}\`) since last docs sync (\`${lastSyncHash || 'none'}\`).`);
          lines.push(`> 1. Review recent changes (\`git diff ${lastSyncHash} ${currentHash}\` or \`git log\`).`);
          lines.push('> 2. Update architecture/code-standards docs and changelog as needed.');
          lines.push(`> 3. Write \`${currentHash}\` to \`docs/.sync_hash\` when done.`);
          lines.push('');
        }
      }
    } catch (e) {
      // Git not initialized or no commits — fail-open
    }
  }

  if (lines.length > 0) {
    console.log(lines.join('\n'));
  }

  process.exit(0);

} catch (e) {
  // Ghi log lỗi ẩn danh nếu sập hook
  try {
    const fs = require('fs'), p = require('path');
    const d = require('./lib/hook-state-dir.cjs').hookStateDir();
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.appendFileSync(p.join(d, 'hook-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'docs-sync', status: 'crash', error: e.message }) + '\n');
  } catch (_) {}
  process.exit(0);
}
