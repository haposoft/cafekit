'use strict';

const fs = require('fs');
const path = require('path');
const runtimeRoot = path.resolve(__dirname, '../..');

function projectRoot(payload = {}) {
  const installed = path.basename(runtimeRoot).startsWith('.') ? path.dirname(runtimeRoot) : '';
  const configured = typeof process.env.CLAUDE_PROJECT_DIR === 'string' ? process.env.CLAUDE_PROJECT_DIR.trim() : '';
  const cwd = typeof payload.cwd === 'string' ? payload.cwd.trim() : '';
  const root = path.resolve(installed || configured || cwd || process.cwd());
  try { return fs.realpathSync(root); } catch { return root; }
}

module.exports = { projectRoot };
