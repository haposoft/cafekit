#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * Multi-event Hook — state.cjs
 *
 * Persists and restores session progress across Claude Code sessions.
 *
 * Events:
 *   SessionStart  → load previous state and print to context
 *   PostToolUse   → refresh state after Task/TaskCreate/TaskUpdate/TodoWrite
 *   Stop          → persist full session state and archive
 *   SubagentStop  → append agent completion note to current state
 *
 * Storage: <runtime>/session-state/latest.md (+ archive/)
 * Exit: 0 always (fail-open)
 */

try {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const crypto = require('crypto');
  const { execSync } = require('child_process');
  const { parseTranscript } = require('./lib/parser.cjs');
  const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');

  const EXPIRY_DAYS = 7;
  const MAX_ARCHIVES = 5;
  const MAX_AGENT_SECTIONS = 3;
  const MAX_MODIFIED_FILES_DISPLAY = 5;
  const TRACKED_POST_TOOL_EVENTS = new Set(['Task', 'TaskCreate', 'TaskUpdate', 'TodoWrite']);

  function stateDir(cwd) {
    try {
      const local = runtimePath(cwd, 'session-state');
      if (fs.existsSync(runtimeDir(cwd))) {
        if (!fs.existsSync(local)) fs.mkdirSync(local, { recursive: true });
        return local;
      }

      const hash = crypto.createHash('md5').update(cwd).digest('hex').slice(0, 12);
      const global = path.join(os.homedir(), '.claude', 'session-states', hash);
      if (!fs.existsSync(global)) fs.mkdirSync(global, { recursive: true });
      return global;
    } catch {
      return null;
    }
  }

  function loadLatest(cwd) {
    try {
      const dir = stateDir(cwd);
      if (!dir) return null;

      const file = path.join(dir, 'latest.md');
      if (!fs.existsSync(file)) return null;

      const text = fs.readFileSync(file, 'utf8');
      const match = text.match(/<!-- Generated: (.+?) -->/);
      if (match) {
        const generatedAt = new Date(match[1]).getTime();
        if (Number.isNaN(generatedAt)) return null;
        if (Date.now() - generatedAt > EXPIRY_DAYS * 24 * 60 * 60 * 1000) return null;
      }

      return text;
    } catch {
      return null;
    }
  }

  function writeAtomic(filePath, content) {
    const tempFile = `${filePath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    fs.writeFileSync(tempFile, content);
    fs.renameSync(tempFile, filePath);
  }

  function archive(dir) {
    try {
      const latestFile = path.join(dir, 'latest.md');
      if (!fs.existsSync(latestFile)) return;

      const archiveDir = path.join(dir, 'archive');
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);

      const now = new Date();
      const pad = (value) => String(value).padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

      fs.copyFileSync(latestFile, path.join(archiveDir, `${stamp}.md`));

      const files = fs.readdirSync(archiveDir).filter((file) => file.endsWith('.md')).sort();
      while (files.length > MAX_ARCHIVES) {
        const oldest = files.shift();
        try {
          fs.unlinkSync(path.join(archiveDir, oldest));
        } catch {
          // fail-open
        }
      }
    } catch {
      // fail-open
    }
  }

  async function extractSessionData(stdinData) {
    const data = {
      timestamp: new Date().toISOString(),
      branch: process.env.GIT_BRANCH || '',
      todos: [],
      modifiedFiles: []
    };

    if (stdinData.transcript_path && fs.existsSync(stdinData.transcript_path)) {
      try {
        const transcript = await parseTranscript(stdinData.transcript_path);
        data.todos = transcript.todos;
      } catch {
        // fail-open
      }
    }

    const changed = [];
    try {
      const diff = execSync('git diff --name-only HEAD', {
        encoding: 'utf8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      if (diff) changed.push(...diff.split('\n'));
    } catch {
      // A repository without HEAD can still report untracked files below.
    }

    try {
      const untracked = execSync('git ls-files --others --exclude-standard', {
        encoding: 'utf8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      if (untracked) changed.push(...untracked.split('\n'));
    } catch {
      // fail-open
    }
    data.modifiedFiles = [...new Set(changed)].slice(0, MAX_MODIFIED_FILES_DISPLAY);

    return data;
  }

  /**
   * True when latest.md holds something beyond the filler this hook writes itself:
   * headings, HTML comments, the three placeholder bullets and timestamp-only agent results.
   */
  function hasPriorContent(text) {
    const filler = [
      /^#{1,6}\s/,
      /^<!--.*-->$/,
      /^- \((No completed tasks recorded|All tasks completed|No file changes detected)\)$/,
      /^- Completed at \d{2}:\d{2}:\d{2}$/,
    ];
    return text.split('\n').map((line) => line.trim())
      .some((line) => line && !filler.some((pattern) => pattern.test(line)));
  }

  function buildStateContent(data) {
    const done = data.todos.filter((todo) => todo.status === 'completed' || todo.status === 'done');
    const pending = data.todos.filter((todo) => !['completed', 'done'].includes(todo.status));

    return [
      '# Session State',
      `<!-- Generated: ${data.timestamp} -->`,
      `<!-- Branch: ${data.branch || 'unknown'} -->`,
      '',
      '## What Worked (Verified)',
      ...(done.length ? done.map((todo) => `- ${todo.content}`) : ['- (No completed tasks recorded)']),
      '',
      "## What's Left",
      ...(pending.length ? pending.map((todo) => `- [ ] ${todo.content}`) : ['- (All tasks completed)']),
      '',
      '## Key Files Modified',
      ...(data.modifiedFiles.length ? data.modifiedFiles.map((file) => `- ${file}`) : ['- (No file changes detected)']),
      ''
    ].join('\n');
  }

  function buildAgentSection(data) {
    const agentType = data.agent_type || '';
    if (!agentType || agentType === 'unknown') return '';
    const time = new Date().toISOString().slice(11, 19);
    return `\n## Agent Result: ${agentType} (${time})\n- Completed at ${time}\n`;
  }

  function takeRecentAgentSections(sections) {
    if (!Array.isArray(sections) || sections.length <= MAX_AGENT_SECTIONS) return sections || [];
    return sections.slice(-MAX_AGENT_SECTIONS);
  }

  function mergeAgentSections(existing, content) {
    if (!existing) return content;

    const agentSections = existing.match(/## Agent Result:.+?(?=\n## |$)/gs);
    if (!agentSections) return content;

    const kept = takeRecentAgentSections(agentSections);
    const marker = '\n## Key Files Modified';
    if (content.includes(marker)) {
      return content.replace(marker, `\n${kept.join('\n')}${marker}`);
    }

    return `${content.trimEnd()}\n\n${kept.join('\n')}\n`;
  }

  function appendAgentSection(existing, agentSection) {
    if (!existing) return agentSection.trimStart();
    if (!agentSection) {
      const sections = existing.match(/## Agent Result:.+?(?=\n## |$)/gs) || [];
      if (sections.length <= MAX_AGENT_SECTIONS) return existing;
      const kept = takeRecentAgentSections(sections);
      return existing.replace(/(## Agent Result:.+?(?=\n## |$))+/gs, kept.join('\n'));
    }

    const marker = '\n## Key Files Modified';
    if (existing.includes(marker)) {
      return existing.replace(marker, `\n${agentSection}${marker}`);
    }

    return `${existing.trimEnd()}\n${agentSection}`;
  }

  async function persistSnapshot(dir, data, options = {}) {
    const file = path.join(dir, 'latest.md');
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const content = mergeAgentSections(existing, buildStateContent(data));
    writeAtomic(file, content);
    if (options.archive) archive(dir);
  }

  async function main() {
    const stdin = fs.readFileSync(0, 'utf8').trim();
    if (!stdin) process.exit(0);

    const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
    const rawPayload = JSON.parse(stdin);
    const data = normalizeHookPayload(rawPayload);
    const event = data.hook_event_name || '';
    const cwd = data.cwd || process.cwd();
    const dir = stateDir(cwd);

    if (event === 'SessionStart') {
      const previous = loadLatest(cwd);
      // Claude only: grok (camelCase sessionId), omp and Codex keep printing the block.
      const claudeSession = runtimeDirName() === '.claude'
        && typeof rawPayload.session_id === 'string' && rawPayload.session_id.length > 0;
      if (previous && (!claudeSession || hasPriorContent(previous))) {
        console.log('\n=== Prior Execution Context ===');
        console.log(previous.trim());
        console.log('=== End of Prior Context ===\n');
      }
      process.exit(0);
    }

    if (!dir) process.exit(0);

    if (event === 'PostToolUse') {
      const toolName = data.tool_name || '';
      if (TRACKED_POST_TOOL_EVENTS.has(toolName)) {
        const sessionData = await extractSessionData(data);
        await persistSnapshot(dir, sessionData);
      }
      process.exit(0);
    }

    if (event === 'SubagentStop') {
      const agentSection = buildAgentSection(data);
      if (!agentSection) process.exit(0);

      const file = path.join(dir, 'latest.md');
      const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      const updated = existing
        ? appendAgentSection(existing, agentSection)
        : `${buildStateContent(await extractSessionData(data))}\n${agentSection}`;

      writeAtomic(file, updated);
      process.exit(0);
    }

    if (event === 'Stop') {
      const sessionData = await extractSessionData(data);
      await persistSnapshot(dir, sessionData, { archive: true });
      process.exit(0);
    }

    process.exit(0);
  }

  main().catch(() => {
    process.exit(0);
  });
} catch (error) {
  try {
    const fs = require('fs');
    const path = require('path');
    const logDir = require('./lib/hook-state-dir.cjs').hookStateDir();
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      path.join(logDir, 'hook-log.jsonl'),
      JSON.stringify({
        ts: new Date().toISOString(),
        hook: 'state',
        status: 'crash',
        error: error.message
      }) + '\n'
    );
  } catch (_) {}
  process.exit(0);
}
