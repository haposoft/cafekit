#!/usr/bin/env node
'use strict';

/**
 * Custom Claude Code statusline for Node.js - one-line default
 * Cross-platform support: Windows, macOS, Linux
 * Features: ANSI colors, tool/agent/todo tracking, context window, session timer
 * No external dependencies - uses only Node.js built-in modules
 */

const { stdin, env } = require('process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Import modular components
const colors = require('./hooks/lib/color.cjs');
const { green, yellow, red, cyan, magenta, dim, coloredBar, RESET } = colors;
const { parseTranscript } = require('./hooks/lib/parser.cjs');
const { countConfigs } = require('./hooks/lib/counter.cjs');
const { loadConfig } = require('./hooks/lib/config.cjs');
const { getGitInfo } = require('./hooks/lib/git.cjs');

// Autocompact reserve as a fraction of the ACTUAL window size from the payload.
// Derived from /context on a 200k window (45000/200000 = 22.5%); expressed as a
// ratio so 1M-context models are not treated as if they were 200k.
const AUTOCOMPACT_BUFFER_RATIO = 0.225;

/**
 * Expand home directory to ~
 */
function expandHome(filePath) {
  const homeDir = os.homedir();
  return filePath.startsWith(homeDir) ? filePath.replace(homeDir, '~') : filePath;
}

/**
 * Get terminal width with fallback chain
 * Piped context (statusline) needs alternative detection
 */
function getTerminalWidth() {
  // Try multiple sources - stderr might still be TTY even when stdout is piped
  if (process.stderr.columns) return process.stderr.columns;
  if (env.COLUMNS) {
    const parsed = parseInt(env.COLUMNS, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 120; // Safe default
}

/**
 * Calculate visible string length (strip ANSI codes, account for emoji width)
 * Emojis typically render as 2 columns in terminals
 */
function visibleLength(str) {
  if (!str || typeof str !== 'string') return 0;
  // Strip ANSI escape codes
  const noAnsi = str.replace(/\x1b\[[0-9;]*m/g, '');
  // Count emojis (they render as ~2 cols) - common emoji ranges
  const emojiMatches = noAnsi.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || [];
  return noAnsi.length + emojiMatches.length; // +1 per emoji (base length + 1 = 2 cols)
}

/**
 * Format elapsed time from start to end (or now)
 */
function formatElapsed(startTime, endTime) {
  if (!startTime) return '0s';
  const start = startTime instanceof Date ? startTime.getTime() : new Date(startTime).getTime();
  if (isNaN(start)) return '0s';
  const end = endTime ? (endTime instanceof Date ? endTime.getTime() : new Date(endTime).getTime()) : Date.now();
  if (isNaN(end)) return '0s';
  const ms = end - start;
  if (ms < 0 || ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Read stdin asynchronously
 */
async function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stdin.setEncoding('utf8');
    stdin.on('data', chunk => chunks.push(chunk));
    stdin.on('end', () => resolve(chunks.join('')));
    stdin.on('error', reject);
  });
}

// ============================================================================
// LINE RENDERERS
// ============================================================================

/**
 * Build usage time string with optional percentage
 * @returns {string|null} Formatted usage string or null if unavailable
 */
function buildUsageString(ctx) {
  if (!ctx.sessionText) return null;
  let str = ctx.sessionText.replace(' until reset', ' left');
  if (ctx.usagePercent != null) str += ` (${Math.round(ctx.usagePercent)}%)`;
  return str;
}

/**
 * Render session lines with multi-level responsive wrapping
 * Combines parts based on content length vs terminal width
 * Tries to minimize lines while keeping content readable
 */
function buildBranchPart(ctx) {
  if (!ctx.gitBranch) return '';
  let branchPart = `🌿 ${ctx.gitBranch}`;
  // Build git status indicators: (unstaged, +staged, ahead↑, behind↓)
  const gitIndicators = [];
  if (ctx.gitUnstaged > 0) gitIndicators.push(`${ctx.gitUnstaged}`);
  if (ctx.gitStaged > 0) gitIndicators.push(`+${ctx.gitStaged}`);
  if (ctx.gitAhead > 0) gitIndicators.push(`${ctx.gitAhead}↑`);
  if (ctx.gitBehind > 0) gitIndicators.push(`${ctx.gitBehind}↓`);
  if (gitIndicators.length > 0) {
    branchPart += ` ${yellow(`(${gitIndicators.join(', ')})`)}`;
  }
  return branchPart;
}

// Default session line: one row of single-width symbols, each value labelled by
// its glyph so the line stays short and every number says what it measures.
//   ◆ model (effort) ϟfast ✱thinking  ◔ context%  ⧗ 5h-quota% reset  ◷ weekly%  ⎇ branch ●changed ↑ahead ↓behind  ± +added/-removed  ⏱ session  ↻ cache-hit%

/** Quarter-circle glyph that fills with the percentage. */
function fillGlyph(percent) {
  if (percent >= 88) return '●';
  if (percent >= 63) return '◕';
  if (percent >= 38) return '◑';
  if (percent >= 13) return '◔';
  return '○';
}

/** Same thresholds as the context bar; plain text when colours are off. */
function tintPercent(percent, text) {
  if (percent >= 85) return red(text);
  if (percent >= 70) return yellow(text);
  return green(text);
}

/** "2h 48m until reset" → "2h48m"; anything else → null. */
function shortReset(sessionText) {
  const match = /^(\d+)h (\d+)m/.exec(sessionText || '');
  return match ? `${match[1]}h${match[2]}m` : null;
}

/** 28147114 → "7h49m"; under an hour → "12m". */
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`;
}

/** "#80✓" approved, "#80✗" changes requested, "#80" pending, dim "#80" draft; "!80" for a GitLab MR. */
function formatPr(pr) {
  const label = `${pr.kind === 'mr' ? '!' : '#'}${pr.number}`;
  if (pr.review_state === 'approved') return `${label}${green('✓')}`;
  if (pr.review_state === 'changes_requested') return `${label}${red('✗')}`;
  if (pr.review_state === 'draft') return dim(label);
  return label;
}

/**
 * Parts of the default line in display order. `drop` ranks what goes first
 * when the terminal is too narrow (higher drops earlier); 0 never drops.
 */
function buildLineParts(ctx, { minimal = false } = {}) {
  let model = `◆ ${ctx.modelName}`;
  if (ctx.effortLevel) model += ` ${dim(`(${ctx.effortLevel})`)}`;
  const flags = `${ctx.fastMode ? 'ϟ' : ''}${ctx.thinking ? '✱' : ''}`;
  if (flags) model += ` ${flags}`;
  const parts = [{ text: model, drop: 0 }];

  if (ctx.contextPercent > 0) {
    parts.push({ text: tintPercent(ctx.contextPercent, `${fillGlyph(ctx.contextPercent)} ${ctx.contextPercent}%`), drop: 0 });
  }

  if (!minimal && ctx.usagePercent != null) {
    const pct = Math.round(ctx.usagePercent);
    const reset = shortReset(ctx.sessionText);
    parts.push({ text: `⧗ ${tintPercent(pct, `${pct}%`)}${reset ? ` ${dim(reset)}` : ''}`, drop: 2 });
  }

  if (!minimal && ctx.weeklyPercent != null) {
    parts.push({ text: `◷ ${tintPercent(ctx.weeklyPercent, `${ctx.weeklyPercent}%`)}`, drop: 3 });
  }

  if (ctx.gitBranch) {
    let git = `⎇ ${ctx.gitBranch}`;
    if (!minimal) {
      const changed = ctx.gitUnstaged + ctx.gitStaged;
      if (changed > 0) git += ` ${yellow(`●${changed}`)}`;
      if (ctx.gitAhead > 0) git += ` ↑${ctx.gitAhead}`;
      if (ctx.gitBehind > 0) git += ` ↓${ctx.gitBehind}`;
      if (ctx.pr) git += ` ${formatPr(ctx.pr)}`;
      if (ctx.inWorktree) git += ' ⊟';
    }
    parts.push({ text: git, drop: 1 });
  }

  if (!minimal && (ctx.linesAdded > 0 || ctx.linesRemoved > 0)) {
    parts.push({ text: `± ${green(`+${ctx.linesAdded}`)}/${red(`-${ctx.linesRemoved}`)}`, drop: 4 });
  }

  if (!minimal && ctx.durationMs >= 60000) {
    parts.push({ text: `⏱ ${formatDuration(ctx.durationMs)}`, drop: 5 });
  }

  if (!minimal && ctx.cacheHitRatio != null) {
    const pct = Math.round(ctx.cacheHitRatio * 100);
    const tinted = pct < 50 ? red(`${pct}%`) : pct < 80 ? yellow(`${pct}%`) : green(`${pct}%`);
    parts.push({ text: `↻ ${tinted}`, drop: 6 });
  }

  return parts;
}

/** Join parts, dropping the highest-ranked ones until the line fits the terminal. */
function fitLine(parts) {
  const width = getTerminalWidth() - 2;
  const kept = [...parts];
  const join = () => kept.map((part) => part.text).join('  ');
  while (visibleLength(join()) > width) {
    const candidates = kept.filter((part) => part.drop > 0);
    if (candidates.length === 0) break;
    const victim = candidates.reduce((a, b) => (b.drop > a.drop ? b : a));
    kept.splice(kept.indexOf(victim), 1);
  }
  return join();
}

/**
 * Safe date parsing - returns epoch ms or 0 for invalid dates
 */
function safeGetTime(dateValue) {
  if (!dateValue) return 0;
  const time = new Date(dateValue).getTime();
  return isNaN(time) ? 0 : time;
}

/**
 * Render agents lines as compact chronological flow with duplicate collapsing
 * Format: ○ type ×N → ● type (N done)
 *         ▸ description (elapsed)
 * @returns {string[]} Array of lines (flow line + optional task line)
 */
function renderAgentsLines(transcript) {
  const { agents } = transcript;
  if (!agents || agents.length === 0) return [];

  const running = agents.filter(a => a.status === 'running');
  const completed = agents.filter(a => a.status === 'completed');

  // Sort all by startTime (safe NaN handling)
  const allAgents = [...running, ...completed];
  allAgents.sort((a, b) => safeGetTime(a.startTime) - safeGetTime(b.startTime));

  if (allAgents.length === 0) return [];

  // Collapse consecutive duplicate types FIRST (before slicing)
  const collapsed = [];
  for (const agent of allAgents) {
    const type = agent.type || 'agent'; // fallback for missing type
    const last = collapsed[collapsed.length - 1];
    if (last && last.type === type && last.status === agent.status) {
      last.count++;
      last.agents.push(agent);
    } else {
      collapsed.push({ type, status: agent.status, count: 1, agents: [agent] });
    }
  }

  // THEN slice to show last 4 collapsed groups
  const toShow = collapsed.slice(-4);

  // Build compact flow line with dots and ×N for duplicates
  const flowParts = toShow.map(group => {
    const icon = group.status === 'running' ? yellow('●') : dim('○');
    const suffix = group.count > 1 ? ` ×${group.count}` : '';
    return `${icon} ${group.type}${suffix}`;
  });

  const lines = [];
  const completedCount = agents.filter(a => a.status === 'completed').length;
  const flowSuffix = completedCount > 2 ? ` ${dim(`(${completedCount} done)`)}` : '';
  lines.push(flowParts.join(' → ') + flowSuffix);

  // Add indented task description for running agent, or last completed if none running
  const runningAgent = running[0];
  const lastCompleted = completed[completed.length - 1];
  const detailAgent = runningAgent || lastCompleted;

  if (detailAgent && detailAgent.description) {
    const desc = detailAgent.description.length > 50
      ? detailAgent.description.slice(0, 47) + '...'
      : detailAgent.description;
    const elapsed = formatElapsed(detailAgent.startTime, detailAgent.endTime);
    const icon = detailAgent.status === 'running' ? yellow('▸') : dim('▸');
    lines.push(`   ${icon} ${desc} ${dim(`(${elapsed})`)}`);
  }

  return lines;
}

/**
 * Render todos line (if todos exist)
 * In-progress task with activeForm + detailed progress (done/pending)
 */
function renderTodosLine(transcript) {
  const { todos } = transcript;
  if (!todos || todos.length === 0) return null;

  const inProgress = todos.find(t => t.status === 'in_progress');
  const completedCount = todos.filter(t => t.status === 'completed').length;
  const pendingCount = todos.filter(t => t.status === 'pending').length;
  const total = todos.length;

  if (!inProgress) {
    if (completedCount === total && total > 0) {
      return `${green('✓')} All ${total} todos complete`;
    }
    // Show pending if no in_progress
    if (pendingCount > 0) {
      const nextPending = todos.find(t => t.status === 'pending');
      const nextTask = nextPending?.content || 'Next task';
      const display = nextTask.length > 40 ? nextTask.slice(0, 37) + '...' : nextTask;
      return `${dim('○')} Next: ${display} ${dim(`(${completedCount} done, ${pendingCount} pending)`)}`;
    }
    return null;
  }

  // Show activeForm (present continuous) if available, else content
  const displayText = inProgress.activeForm || inProgress.content;
  const display = displayText.length > 50 ? displayText.slice(0, 47) + '...' : displayText;
  return `${yellow('▸')} ${display} ${dim(`(${completedCount} done, ${pendingCount} pending)`)}`;
}

/** minimal mode: model, context and branch only. */
function renderMinimal(ctx) {
  writeStyledLines([fitLine(buildLineParts(ctx, { minimal: true }))]);
}

/** compact mode: the default line without the agent and todo lines. */
function renderCompact(ctx) {
  render(ctx, true);
}

/**
 * full mode: the default line, then agent and todo lines only while they exist.
 */
function render(ctx, singleLineMode = false) {
  const lines = [fitLine(buildLineParts(ctx))];

  if (!singleLineMode) {
    // Agents lines (one per agent for clarity)
    const agentsLines = renderAgentsLines(ctx.transcript);
    lines.push(...agentsLines);

    // Todos line (if exist)
    const todosLine = renderTodosLine(ctx.transcript);
    if (todosLine) lines.push(todosLine);
  }

  writeStyledLines(lines);
}

/**
 * Output lines with non-breaking spaces for alignment
 */
function writeStyledLines(lines) {
  for (const line of lines) {
    const outputLine = colors.shouldUseColor ? `${RESET}${line.replace(/ /g, '\u00A0')}` : line;
    console.log(outputLine);
  }
}

// ============================================================================
// CONFIGURABLE LAYOUT
// Global shape: { lines: [[sectionId, ...], ...] } — each inner array is one
// output line; modes only slice the line count (minimal = 1, compact = 2,
// full = all). Agents/todos stay outside `lines` behind their own flags.
// ============================================================================

const LAYOUT_SECTION_IDS = ['model', 'context', 'quota', 'directory', 'git', 'plan', 'cost', 'changes'];

const LAYOUT_SECTIONS = {
  model: (ctx) => `🤖 ${ctx.modelName}`,
  context: (ctx) => ctx.contextPercent > 0
    ? `${coloredBar(ctx.contextPercent, 12)} ${ctx.contextPercent}%`
    : null,
  quota: (ctx) => {
    const usageStr = buildUsageString(ctx);
    if (!usageStr) return null;
    let out = `\u231B ${usageStr.replace(/\)$/, ' used)')}`;
    if (ctx.weeklyText) out += `  ${ctx.weeklyText}`;
    return out;
  },
  directory: (ctx) => `📁 ${ctx.currentDir}`,
  git: (ctx) => buildBranchPart(ctx) || null,
  plan: (ctx) => ctx.activePlan ? `📋 ${ctx.activePlan}` : null,
  cost: (ctx) => ctx.costText ? `💵 ${ctx.costText.replace(/(\.\d{2})\d+/, '$1')}` : null,
  changes: (ctx) => (ctx.linesAdded > 0 || ctx.linesRemoved > 0)
    ? `📝 ${green(`+${ctx.linesAdded}`)} ${red(`-${ctx.linesRemoved}`)}`
    : null,
};

/**
 * Normalize a raw statuslineLayout config value.
 * Unknown section ids are ignored; an empty or invalid layout returns null so
 * rendering falls back to the default renderers.
 */
function normalizeStatuslineLayout(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.lines)) return null;
  const lines = raw.lines
    .filter((line) => Array.isArray(line))
    .map((line) => line.filter((id) => LAYOUT_SECTION_IDS.includes(id)))
    .filter((line) => line.length > 0);
  if (lines.length === 0) return null;
  return { lines, agents: raw.agents !== false, todos: raw.todos !== false };
}

/**
 * Render with a user-configured layout. Modes only slice the line count.
 */
function renderLayout(ctx, layout, mode) {
  const lineLimit = mode === 'minimal' ? 1 : mode === 'compact' ? 2 : layout.lines.length;
  const lines = [];
  for (const ids of layout.lines.slice(0, lineLimit)) {
    const parts = ids.map((id) => LAYOUT_SECTIONS[id](ctx)).filter(Boolean);
    if (parts.length > 0) lines.push(parts.join('  '));
  }
  if (mode !== 'minimal' && mode !== 'compact') {
    if (layout.agents) lines.push(...renderAgentsLines(ctx.transcript));
    if (layout.todos) {
      const todosLine = renderTodosLine(ctx.transcript);
      if (todosLine) lines.push(todosLine);
    }
  }
  writeStyledLines(lines);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) {
      console.error('No input provided');
      process.exit(1);
    }

    const data = JSON.parse(input);

    // Extract basic information
    let currentDir = data.workspace?.current_dir || data.cwd || 'unknown';
    currentDir = expandHome(currentDir);

    const modelName = data.model?.display_name || 'Claude';
    // Live /effort value; absent when the model has no effort parameter.
    const effortLevel = typeof data.effort?.level === 'string' ? data.effort.level : '';

    // Git detection using batched cache
    const rawDir = data.workspace?.current_dir || data.cwd || process.cwd();
    const gitInfo = getGitInfo(rawDir);
    const gitBranch = gitInfo?.branch || '';
    const gitUnstaged = gitInfo?.unstaged || 0;
    const gitStaged = gitInfo?.staged || 0;
    const gitAhead = gitInfo?.ahead || 0;
    const gitBehind = gitInfo?.behind || 0;

    // Active plan detection - read from session temp file
    let activePlan = '';
    try {
      const sessionId = data.session_id;
      if (sessionId) {
        const sessionPath = path.join(os.tmpdir(), `ck-session-${sessionId}.json`);
        if (fs.existsSync(sessionPath)) {
          const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
          const planPath = session.activePlan?.trim();
          if (planPath) {
            // Extract slug from path like "specs/auth-login" or legacy "plans/260106-1554-feature"
            const match = planPath.match(/(?:specs|plans)\/(?:\d+-\d+-)?(.+?)(?:\/|$)/);
            activePlan = match ? match[1] : planPath.split('/').pop();
          }
        }
      }
    } catch {}

    // Context window - use current_usage fields with a proportional reserve
    const usage = data.context_window?.current_usage || {};
    const contextSize = data.context_window?.context_window_size || 0;
    let contextPercent = 0;
    let totalTokens = 0;

    if (contextSize > 0) {
      totalTokens = (usage.input_tokens ?? 0) +
                    (usage.cache_creation_input_tokens ?? 0) +
                    (usage.cache_read_input_tokens ?? 0);

      // Add the reserve to match /context calculation on any window size
      const buffer = Math.round(contextSize * AUTOCOMPACT_BUFFER_RATIO);
      contextPercent = Math.min(100, Math.round(((totalTokens + buffer) / contextSize) * 100));
    }

    // Write context data to temp file for hooks to read
    const sessionId = data.session_id;
    if (sessionId && contextSize > 0) {
      try {
        const contextDataPath = path.join(os.tmpdir(), `ck-context-${sessionId}.json`);
        fs.writeFileSync(contextDataPath, JSON.stringify({
          percent: contextPercent,
          tokens: totalTokens,
          size: contextSize,
          usage: usage,
          timestamp: Date.now()
        }));
      } catch {}
    }

    // Quota text, filled from the payload's rate_limits below
    let sessionText = '';
    let weeklyText = '';
    let weeklyPercent = null;
    const transcriptPath = data.transcript_path;

    // Parse transcript for tools/agents/todos
    const transcript = transcriptPath ? await parseTranscript(transcriptPath) : { tools: [], agents: [], todos: [], sessionStart: null };

    // Quota windows come only from Claude Code's own rate_limits, sent for Pro/Max after
    // the session's first API response; without it the quota segments stay hidden.
    let usagePercent = null;
    const applyWindows = (fiveHour, sevenDay) => {
      if (fiveHour?.percent != null) {
        usagePercent = fiveHour.percent;
        const remaining = Math.floor(fiveHour.resetsAtMs / 1000) - Math.floor(Date.now() / 1000);
        if (remaining > 0 && remaining < 18000) {
          sessionText = `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m until reset`;
        }
      }
      if (sevenDay?.percent != null) {
        weeklyPercent = Math.round(sevenDay.percent);
        weeklyText = `wk ${weeklyPercent}%`;
        const wkRemaining = Math.floor(sevenDay.resetsAtMs / 1000) - Math.floor(Date.now() / 1000);
        if (wkRemaining > 0) {
          weeklyText += ` (${Math.floor(wkRemaining / 86400)}d ${Math.floor((wkRemaining % 86400) / 3600)}h)`;
        }
      }
    };
    const fromPayload = (window) => (window && typeof window.used_percentage === 'number'
      ? { percent: window.used_percentage, resetsAtMs: Number(window.resets_at) * 1000 }
      : null);
    applyWindows(fromPayload(data.rate_limits?.five_hour), fromPayload(data.rate_limits?.seven_day));

    // Cost and lines changed
    const billingMode = env.CLAUDE_BILLING_MODE || 'api';
    const costUSD = data.cost?.total_cost_usd;
    const costText = billingMode === 'api' && costUSD && /^\d+(\.\d+)?$/.test(String(costUSD))
      ? `$${parseFloat(costUSD).toFixed(4)}`
      : null;
    const linesAdded = data.cost?.total_lines_added || 0;
    const linesRemoved = data.cost?.total_lines_removed || 0;
    const durationMs = Number(data.cost?.total_duration_ms) || 0;
    const cacheHitRatio = data.prompt_cache?.requests > 0 && typeof data.prompt_cache.hit_ratio === 'number'
      ? data.prompt_cache.hit_ratio
      : null;
    const fastMode = data.fast_mode === true;
    const thinking = data.thinking?.enabled === true;
    const pr = typeof data.pr?.number === 'number' ? data.pr : null;
    const inWorktree = Boolean(data.worktree?.name || data.workspace?.git_worktree);

    // Config counts
    const configs = countConfigs(rawDir);

    // Build render context
    const ctx = {
      modelName,
      effortLevel,
      currentDir,
      gitBranch,
      gitUnstaged,
      gitStaged,
      gitAhead,
      gitBehind,
      activePlan,
      contextPercent,
      sessionText,
      weeklyText,
      weeklyPercent,
      usagePercent,
      costText,
      linesAdded,
      linesRemoved,
      durationMs,
      cacheHitRatio,
      fastMode,
      thinking,
      pr,
      inWorktree,
      configs,
      transcript
    };

    // Load config and get statusline mode
    const config = loadConfig({ includeProject: false, includeAssertions: false, includeLocale: false });
    const statuslineMode = config.statusline || 'full';
    colors.setColorEnabled(config.statuslineColors !== false);

    // Render based on mode. A valid statuslineLayout takes over line
    // composition; an absent, empty, or invalid layout falls back to the
    // default renderers below.
    const layout = normalizeStatuslineLayout(config.statuslineLayout);
    if (statuslineMode !== 'none' && layout) {
      renderLayout(ctx, layout, statuslineMode);
    } else {
      switch (statuslineMode) {
        case 'none':
          console.log('');
          break;
        case 'minimal':
          renderMinimal(ctx);
          break;
        case 'compact':
          renderCompact(ctx);
          break;
        case 'full':
        default:
          render(ctx, false);
          break;
      }
    }

  } catch (err) {
    // Fallback: output minimal single line on any error
    console.log(`◆ ${expandHome(process.cwd() || 'unknown')}`);
  }
}

main().catch(() => {
  console.log('◆ statusline error');
  process.exit(1);
});
