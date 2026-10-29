'use strict';

const path = require('path');
const { normalizeSourcePaths } = require('./copy-utils');
const { splitFrontmatter } = require('./codex-frontmatter');
const { preserveAddressingSection } = require('./instruction-blocks');

const CODEX_BLOCK_START = '<!-- CAFEKIT CODEX START -->';
const CODEX_BLOCK_END = '<!-- CAFEKIT CODEX END -->';
const INSTRUCTION_EXTENSIONS = new Set(['.md', '.mdx', '.txt']);
const CODEX_ASK_DESCRIPTION_BOUNDARY = 'A request to fix or change something is still answered without editing any file; point the user to $cf-fix.';
const CODEX_ASK_NOTE = 'Rule 1 (Codex): never edit, create, or delete files in this skill, '
  + 'even when the user says fix it or sửa giúp luôn. Do not run commands that write files. '
  + 'Answer the cause with evidence and tell the user to run $cf-fix.';
const CODEX_RESEARCH_DEPTH_MARKER = 'Codex research depth: treat a settled repository decision that remains in force as a known option.';
const CODEX_RESEARCH_DEPTH_NOTE = CODEX_RESEARCH_DEPTH_MARKER
  + ' Use Quick for that decision. An outdated supporting rationale alone does not raise depth '
  + 'unless correcting it changes the recommendation. Conflicting evidence that changes the '
  + 'recommendation still requires escalation under the depth table.';
const CODEX_SPECS_SCOPE_MARKER = 'Codex scope gate: put the GATE-SCOPE question in the final answer of the turn.';
const CODEX_SPECS_SCOPE_NOTE = CODEX_SPECS_SCOPE_MARKER
  + ' Ask it there, not in commentary or through `request_user_input`. Do not send a summary after the question. '
  + 'For each item needing a decision, use `[NEEDS CLARIFICATION: <question>]`, replacing <question> '
  + 'with the real question, not a placeholder or a quotation of this note. Offer EXPAND, KEEP, and CUT together. '
  + 'Preserve the exact words NEEDS CLARIFICATION, EXPAND, KEEP, and CUT; do not translate them. '
  + 'Wait for the user to decide; do not choose scope or implement code on their behalf.';

const AGENT_NAMES = [
  'brainstormer',
  'code-auditor',
  'debugger',
  'deployer',
  'docs-keeper',
  'git-ops',
  'implementer',
  'inspector',
  'project-manager',
  'researcher',
  'spec-maker',
  'test-runner',
  'ui-ux-designer'
];
const INSTRUCTION_REPLACEMENTS = [
  [/`?\bTodoWrite\b`?/g, 'task-state tracking'],
  [/`?\bTaskCreate\b`?/g, 'task creation'],
  [/`?\bTaskUpdate\b`?/g, 'task-state updates'],
  [/`?\bTaskList\b`?/g, 'task-state inspection'],
  [/`?\bTaskGet\b`?/g, 'task detail inspection'],
  [/`Bash`/g, '`exec_command`'],
  [/`Glob`/g, '`rg --files`'],
  [/`Grep`/g, '`rg`'],
  [/`Read`/g, 'targeted file reads'],
  [/`Write`|`Edit`|`NotebookEdit`/g, '`apply_patch`'],
  [/`WebSearch`/g, 'native web search'],
  [/`WebFetch`/g, 'native page retrieval'],
  [/`?Agent`?\s+\(legacy\s+`?Task`?\)/g, 'subagent delegation']
];

function codexAgentName(value) {
  const raw = path.basename(String(value || ''), path.extname(String(value || '')));
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function normalizeAgentRole(name) {
  return String(name || '').toLowerCase() === 'explore'
    ? 'explorer'
    : codexAgentName(name);
}

function applyReplacements(content, replacements) {
  let next = content;
  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function isMarkdownLinkDestination(content, offset) {
  const opener = content.lastIndexOf('](', offset);
  if (opener < 0 || content.lastIndexOf('[', opener) < 0) return false;

  let depth = 1;
  for (let index = opener + 2; index < offset; index += 1) {
    if (content[index] === '\\') {
      index += 1;
    } else if (content[index] === '(') {
      depth += 1;
    } else if (content[index] === ')') {
      depth -= 1;
      if (depth === 0) return false;
    }
  }
  return depth > 0;
}

function isUrlLikeToken(content, offset) {
  const prefix = content.slice(0, offset).split(/[\s]/).at(-1) || '';
  return /^<?(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|www\.)\S*$/i.test(prefix);
}

function maskMarkdownCodeSpans(content) {
  const spans = [];
  let markerNonce = 0;
  while (content.includes(`\uE000CAFEKIT_${markerNonce}_`)) markerNonce += 1;
  const markerPrefix = `\uE000CAFEKIT_${markerNonce}_`;
  let masked = '';
  let index = 0;

  const addMarker = (kind, original) => {
    const marker = `${markerPrefix}${kind}_${spans.length}\uE001`;
    spans.push({ marker, original });
    return marker;
  };

  const fencedBlockEnd = (openerLineEnd, delimiter, delimiterLength) => {
    let lineStart = openerLineEnd < 0 ? content.length : openerLineEnd + 1;
    while (lineStart < content.length) {
      const newline = content.indexOf('\n', lineStart);
      const lineEnd = newline < 0 ? content.length : newline;
      const line = content.slice(lineStart, lineEnd);
      const match = line.match(/^[ \t]{0,3}([`~]+)[ \t]*\r?$/);
      if (match
        && [...match[1]].every((character) => character === delimiter)
        && match[1].length >= delimiterLength) {
        return lineEnd;
      }
      lineStart = newline < 0 ? content.length : newline + 1;
    }
    return content.length;
  };

  while (index < content.length) {
    if (content[index] !== '`' && content[index] !== '~') {
      masked += content[index];
      index += 1;
      continue;
    }

    const opener = index;
    const delimiter = content[index];
    while (index < content.length && content[index] === delimiter) index += 1;
    const delimiterLength = index - opener;
    const lineStart = content.lastIndexOf('\n', opener - 1) + 1;
    const linePrefix = content.slice(lineStart, opener);
    const openerLineEnd = content.indexOf('\n', index);
    const infoEnd = openerLineEnd < 0 ? content.length : openerLineEnd;
    const info = content.slice(index, infoEnd);
    const isFence = delimiterLength >= 3
      && /^[ \t]{0,3}$/.test(linePrefix)
      && (delimiter === '~' || !info.includes('`'));

    if (isFence) {
      const end = fencedBlockEnd(openerLineEnd, delimiter, delimiterLength);
      masked += addMarker('CODE', content.slice(opener, end));
      index = end;
      continue;
    }

    if (delimiter !== '`') {
      masked += content.slice(opener, index);
      continue;
    }

    let cursor = index;
    let closer = -1;
    while (cursor < content.length) {
      const runStart = content.indexOf('`', cursor);
      if (runStart < 0) break;
      let runEnd = runStart;
      while (runEnd < content.length && content[runEnd] === '`') runEnd += 1;
      if (runEnd - runStart === delimiterLength) {
        closer = runStart;
        break;
      }
      cursor = runEnd;
    }

    if (closer < 0) {
      const newline = content.indexOf('\n', opener);
      const end = newline < 0 ? content.length : newline;
      masked += addMarker('CODE', content.slice(opener, end));
      index = end;
      continue;
    }

    const end = closer + delimiterLength;
    const original = content.slice(opener, end);
    const inner = content.slice(opener + delimiterLength, closer);
    const kind = inner.trim() === 'AskUserQuestion' ? 'ASK' : 'CODE';
    masked += addMarker(kind, original);
    index = end;
  }

  return {
    content: masked,
    askMarkerPattern: `${markerPrefix}ASK_[0-9]+\uE001`,
    askMarkerPrefix: `${markerPrefix}ASK_`,
    restore(value) {
      return spans.reduce(
        (next, { marker, original }) => next.split(marker).join(original),
        value
      );
    }
  };
}

function normalizeAskUserQuestion(content) {
  const masked = maskMarkdownCodeSpans(content);
  const determinerPattern = [
    'one', 'each', 'every', 'another', 'this', 'that', 'a', 'an', 'the'
  ].map((word) => [...word].map((letter) => `[${letter}${letter.toUpperCase()}]`).join('')).join('|');
  const oneSeparator = '(?:[^\\S\\r\\n]+|[^\\S\\r\\n]*\\r?\\n[^\\S\\r\\n]*)';
  const pattern = new RegExp(
    `(?:(\\b(?:${determinerPattern}|[0-9]+)\\b)(${oneSeparator}))?`
      + `(\\bAskUserQuestion\\b|${masked.askMarkerPattern}|\\bnative(?:\\s+structured user-input|\\s+input)\\s+tool\\b)`,
    'g'
  );
  const withoutRuntimePossessive = masked.content.replace(
    /\bthe runtime['’]s\s+native(?:\s+structured user-input|\s+input)\s+tool\b/g,
    "a question in the turn's final answer"
  );
  const normalized = withoutRuntimePossessive.replace(pattern, (match, determiner, spacing, _token, offset, source) => {
    const literalIndex = match.search(/AskUserQuestion|\bnative\b/);
    const tokenOffset = offset + (literalIndex >= 0
      ? literalIndex
      : match.indexOf(masked.askMarkerPrefix));
    const previous = source[tokenOffset - 1] || '';
    if (isMarkdownLinkDestination(source, tokenOffset)
      || isUrlLikeToken(source, tokenOffset)
      || /[/=?#&%@]/.test(previous)) {
      return match;
    }

    if (determiner) {
      const normalizedDeterminer = /^an$/i.test(determiner)
        ? (determiner[0] === 'A' ? 'A' : 'a')
        : determiner;
      return `${normalizedDeterminer}${spacing}question in the turn's final answer`;
    }

    const trailing = source.slice(offset + match.length);
    const pluralContext = new RegExp(`^${oneSeparator}(?:calls|batches)\\b`, 'i').test(trailing);
    return `${pluralContext ? '' : 'a '}question in the turn's final answer`;
  });
  return masked.restore(normalized);
}

function normalizeRuntimePaths(content, sourcePath = '') {
  const stateRootsPattern = /const RUNTIME_STATE_ROOTS = Object\.freeze\(\[[\s\S]*?\]\);/;
  const sharedStateRoots = path.basename(sourcePath) === 'provenance.cjs'
    ? content.match(stateRootsPattern)?.[0] : null;
  const preservedRoots = [];
  let markerPrefix = '\uE000CAFEKIT_HOST_';
  while (content.includes(markerPrefix)) markerPrefix += '_';
  const rootToken = /(?<![\w/\\])\.claude(?:[/\\])?(?![\w/\\.-])/g;
  const instruction = isInstructionAsset(sourcePath) ? content.replace(/^.*$/gm, line => {
    if (!/(?<![\w/\\])\.codex(?:[/\\])?(?![\w/\\.-])/.test(line)) return line;
    return line.replace(rootToken, original => {
      const marker = `${markerPrefix}${preservedRoots.length}\uE001`;
      preservedRoots.push([marker, original]);
      return marker;
    });
  }) : content;
  let next = normalizeSourcePaths(instruction, {
    runtimeRoot: '.codex',
    skillsRoot: '.agents/skills'
  })
    .replace(/(?<!~\/)\.claude\/skills\b/g, '.agents/skills')
    .replace(/(?<!~\\)\.claude\\skills\b/g, '.agents\\skills')
    .replace(/(?<!~\/)\.claude(?=[/\\])/g, '.codex')
    .replace(/(['"])\.claude\1/g, '$1.codex$1')
    .replace(/`\.claude`/g, '`.codex`');
  // This table describes every runtime's generated state, not the install root.
  if (sharedStateRoots) next = next.replace(stateRootsPattern, () => sharedStateRoots);
  if (/\/ai-multimodal\/scripts\/(?:media_optimizer|document_converter)\.py$/.test(sourcePath.replace(/\\/g, '/'))) {
    // Shared skills live under .agents; native support/config still lives in .codex.
    next = next.replace(/\bclaude_dir = skills_dir\.parent\b/g,
      "claude_dir = skills_dir.parent.parent / '.codex'");
  }
  for (const [marker, original] of preservedRoots) next = next.split(marker).join(original);
  return next;
}

// Matches the vibe invocation list across a hard line wrap.
const VIBE_INVOCATION_CLAUDE = new RegExp(
  '\\(`/cf:vibe` from the plugin, `/vibe` from a project install, `\\$cf-vibe` on Codex\\)'.replace(/ /g, '\\s+'), 'g');

function normalizeSkillNames(content) {
  return content
    .replace(/\/cf:([a-z0-9-]+)/gi, (_match, name) => `$cf-${name}`)
    .replace(/\bcf:([a-z0-9-]+)/gi, (_match, name) => `cf-${name}`)
    .replace(
      /(^|[\s("'`→])\/(brainstorm|code-review|debug|develop|docs|frontend-design|git|hotfix|inspect|question|research|specs|test)(?=$|[\s<`),.:])/gim,
      (_match, prefix, name) => `${prefix}$cf-${name}`
    );
}

function normalizeAgentNames(content) {
  let next = content;
  for (const name of AGENT_NAMES) {
    const snake = codexAgentName(name);
    next = next.replace(new RegExp(`\\b${name}\\b`, 'g'), snake);
  }
  return next;
}

function normalizeAgentInvocations(content) {
  return content
    .replace(/\bTask\s*\(\s*Explore\s*\)/g, 'spawn_agent(agent_type="explorer", fork_turns="none", task_name="explore", message="Describe the scan")')
    .replace(/\bAgent\s*\(/g, 'spawn_agent(')
    .replace(/\bsubagent_type\s*=\s*"([^"]+)"/g, (_match, name) => (
      `agent_type="${normalizeAgentRole(name)}", fork_turns="none"`
    ))
    .replace(/\bsubagent_type\s*:\s*"([^"]+)"/g, (_match, name) => (
      `agent_type: "${normalizeAgentRole(name)}"\nfork_turns: "none"`
    ))
    .replace(/\bprompt\s*=/g, 'message=')
    .replace(/\bdescription\s*=\s*"([^"]+)"/g, (_match, label) => (
      `task_name="${codexAgentName(label) || 'cafekit_task'}"`
    ))
    .replace(/`Agent`/g, '`spawn_agent`')
    .replace(/\bAgent tool\b/g, 'spawn_agent tool')
    .replace(/\bExplore subagents?\b/g, (match) => match.replace('Explore', 'explorer'))
    .replace(/`SendMessage`/g, '`send_message`')
    .replace(/\bSendMessage\s*\(/g, 'send_message(');
}

function isInstructionAsset(sourcePath) {
  if (!sourcePath) return true;
  return INSTRUCTION_EXTENSIONS.has(path.extname(sourcePath).toLowerCase());
}

function normalizeCodexBody(content, sourcePath = '') {
  let next = normalizeRuntimePaths(String(content), sourcePath);
  next = next
    .replace(/^.*$/gm, line => line.replace(/\bCLAUDE\.md\b/g, (name, offset) => (
      isInstructionAsset(sourcePath) && /(?<![\w/\\])AGENTS\.md\b/.test(line)
        && !/[\w/\\]/.test(line[offset - 1] || '') ? name : 'AGENTS.md'
    )))
    .replace(/\bClaude Code\b/g, 'Codex CLI');

  if (!isInstructionAsset(sourcePath)) return next;

  if (/(?:^|\/)rules\/orchestrator\.md$/.test(String(sourcePath).replace(/\\/g, '/'))) {
    next = next
      .replace('When the current session or a subagent runs on a model below `fable` (e.g. `opus`, `sonnet`, `haiku`) and hits a hard problem',
        'When the current session or a subagent hits a hard problem')
      .replace('It runs autonomously on the strongest available model',
        'It runs autonomously with high reasoning effort on the session model unless configuration selects another');
  }

  // The vibe-run exception lists every way to invoke vibe; on Codex only the `$cf-vibe` mention exists, and the
  // generic rename below would turn the Claude names into the false "`$cf-vibe` from the plugin".
  next = next.replace(VIBE_INVOCATION_CLAUDE, () => '(`$cf-vibe`)');
  next = normalizeAgentInvocations(normalizeAgentNames(normalizeSkillNames(next)));
  next = next.replace(/`?CLAUDE_CODE_SUBAGENT_MODEL`?/g,
    'the configured agent model (`model` in `.codex/agents/<agent>.toml`, or `[agents].default_subagent_model` in native Codex configuration)');
  next = applyReplacements(normalizeAskUserQuestion(next), INSTRUCTION_REPLACEMENTS);
  // Each projection below checks for its own output first, so projecting an installed file again is a no-op.
  const { frontmatter, body } = splitFrontmatter(next);
  if (frontmatter.when_to_use && frontmatter.description
    && !frontmatter.description.includes(` Use when: ${frontmatter.when_to_use}`)) {
    const description = `${frontmatter.description} Use when: ${frontmatter.when_to_use}`;
    if (description.length <= 1024) {
      const header = next.slice(0, next.length - body.length)
        .replace(/^description:[^\r\n]*(?:\r?\n[ \t]+[^\r\n]*)*/m,
          () => `description: ${JSON.stringify(description)}`);
      next = header + body;
    }
  }
  // Only the installed ask skill receives this Codex-specific boundary, never eval prompts.
  if (/(?:^|\/)skills\/ask\/SKILL\.md$/.test(String(sourcePath).replace(/\\/g, '/')) && !next.includes(CODEX_ASK_NOTE)) {
    const { frontmatter, body } = splitFrontmatter(next);
    const description = `${frontmatter.description} ${CODEX_ASK_DESCRIPTION_BOUNDARY}`;
    if (description.length > 1024) throw new Error('Codex ask description exceeds 1024 characters');
    const header = next.slice(0, next.length - body.length)
      .replace(/^description:[^\r\n]*$/m, () => `description: ${JSON.stringify(description)}`);
    next = `${header}\n${CODEX_ASK_NOTE}\n\n${body}`;
  }
  // Only the installed research skill receives this note, never prompts or templates.
  if (/(?:^|\/)skills\/research\/SKILL\.md$/.test(String(sourcePath).replace(/\\/g, '/')) && !next.includes(CODEX_RESEARCH_DEPTH_NOTE)) {
    const { body } = splitFrontmatter(next);
    const header = next.slice(0, next.length - body.length);
    next = `${header}\n${CODEX_RESEARCH_DEPTH_NOTE}\n\n${body}`;
  }
  // Only the installed specs skill receives this note, never prompts or templates.
  if (/(?:^|\/)skills\/specs\/SKILL\.md$/.test(String(sourcePath).replace(/\\/g, '/')) && !next.includes(CODEX_SPECS_SCOPE_NOTE)) {
    const { body } = splitFrontmatter(next);
    const header = next.slice(0, next.length - body.length);
    next = `${header}\n${CODEX_SPECS_SCOPE_NOTE}\n\n${body}`;
  }
  return next;
}

function getCodexCopyOptions(baseOptions = {}) {
  return {
    ...baseOptions,
    transform: (content, sourcePath) => normalizeCodexBody(content, sourcePath)
  };
}

function convertCodexAgentContent(content, fileName = '') {
  const { frontmatter, body } = splitFrontmatter(content);
  const name = codexAgentName(frontmatter.name || fileName);
  let description = normalizeCodexBody(
    frontmatter.description || `CafeKit Codex agent: ${name}`
  );
  let agentBody = body;
  if (['git_ops', 'project_manager'].includes(name)) {
    let inTeamSection = false;
    agentBody = body.split('\n').flatMap(line => {
      if (/^## /.test(line)) {
        inTeamSection = /^## (?:Team Mode|Collaborative Interlocking \(Swarm Protocol\))\s*$/.test(line);
      }
      if (!inTeamSection) return [line];
      if (/\b(?:TaskList|TaskGet|TaskUpdate|SendMessage|shutdown_request)\b|When instantiated as a team member|When triggered as an active teammate/.test(line)) return [];
      return [line.replace(/^(\s*)\d+\. /, '$1- ')];
    }).join('\n');
  }
  let instructions = normalizeCodexBody(agentBody).trim();
  const readOnly = ['brainstormer', 'code_auditor', 'inspector', 'researcher'].includes(name);
  if (readOnly) {
    instructions += '\n\n## Read-only role\n\nRead-only role: never create, never edit, and never delete files, and never run commands that write to disk; return findings in your reply.';
  }
  const reasoning = [];
  if (name === 'strategist') {
    description = 'Autonomous advisory counsel with high reasoning effort; inherits the session model unless native spawn or agent defaults select another. No session model switch or user interview. Mention @strategist or spawn it for hard design, debugging, or trade-off calls. Advisory-only; returns advice, not code.';
    instructions = instructions
      .replace('consulted for counsel and running on the strongest available model',
        'consulted for counsel with high reasoning effort on the configured native model')
      .replace(/## Runtime note\s+[\s\S]*$/,
        '## Runtime note\n\nThis agent sets `model_reasoning_effort = "high"` and omits `model`. It inherits the session model unless an explicit native spawn or `[agents].default_subagent_model` selects another. No strongest-model selection is guaranteed. For deployment control, set `model` in `.codex/agents/strategist.toml` or configure native agent defaults in native Codex configuration; choose a model that supports high reasoning effort. Advice remains advisory-only and never counts as execution proof.');
    reasoning.push('model_reasoning_effort = "high"');
  }

  return [
    `name = ${JSON.stringify(name)}`,
    `description = ${JSON.stringify(description)}`,
    ...(readOnly ? ['sandbox_mode = "read-only"'] : []),
    ...reasoning,
    `developer_instructions = ${JSON.stringify(instructions)}`,
    ''
  ].join('\n');
}

function managedRange(content) {
  const start = content.indexOf(CODEX_BLOCK_START);
  const end = content.indexOf(CODEX_BLOCK_END);
  if (start < 0 && end < 0) return null;
  const duplicateStart = content.indexOf(CODEX_BLOCK_START, start + CODEX_BLOCK_START.length);
  const duplicateEnd = content.indexOf(CODEX_BLOCK_END, end + CODEX_BLOCK_END.length);
  return start >= 0 && end > start && duplicateStart < 0 && duplicateEnd < 0
    ? { start, end }
    : false;
}

function upsertManagedCodexBlock(existingContent, blockContent) {
  const existing = String(existingContent || '');
  let body = String(blockContent).trim();
  // Reinstall replaces the managed block in place. If the new template dropped
  // its Addressing section, carry the exact section over from the existing
  // managed block so the saved address survives for setupAddressing. Only reads
  // the managed body — never user-owned sections outside the block.
  const range = managedRange(existing);
  if (range) {
    const existingBody = existing.slice(range.start + CODEX_BLOCK_START.length, range.end);
    body = preserveAddressingSection(body, existingBody);
  }
  const block = `${CODEX_BLOCK_START}\n${body}\n${CODEX_BLOCK_END}`;
  if (range === false) return existing;
  if (range) {
    return `${existing.slice(0, range.start)}${block}${existing.slice(range.end + CODEX_BLOCK_END.length)}`;
  }
  if (!existing) return `${block}\n`;
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${separator}${block}\n`;
}

/** Transform only the CafeKit-owned body, preserving all surrounding bytes. */
function transformManagedCodexContent(content, transform) {
  const existing = String(content || '');
  const range = managedRange(existing);
  if (!range || typeof transform !== 'function') return existing;
  const bodyStart = range.start + CODEX_BLOCK_START.length;
  const bodyEnd = range.end;
  const body = existing.slice(bodyStart, bodyEnd);
  return `${existing.slice(0, bodyStart)}${transform(body)}${existing.slice(bodyEnd)}`;
}

module.exports = {
  CODEX_RESEARCH_DEPTH_MARKER,
  CODEX_RESEARCH_DEPTH_NOTE,
  CODEX_SPECS_SCOPE_MARKER,
  CODEX_SPECS_SCOPE_NOTE,
  normalizeCodexBody,
  getCodexCopyOptions,
  codexAgentName,
  convertCodexAgentContent,
  managedRange,
  upsertManagedCodexBlock,
  transformManagedCodexContent
};
