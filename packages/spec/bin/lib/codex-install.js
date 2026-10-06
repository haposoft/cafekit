'use strict';

const path = require('path');
const { normalizeSourcePaths } = require('./copy-utils');
const { splitFrontmatter } = require('./codex-frontmatter');
const { preserveAddressingSection } = require('./instruction-blocks');

const CODEX_BLOCK_START = '<!-- CAFEKIT CODEX START -->';
const CODEX_BLOCK_END = '<!-- CAFEKIT CODEX END -->';
const INSTRUCTION_EXTENSIONS = new Set(['.md', '.mdx', '.txt']);

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
      + `(\\bAskUserQuestion\\b|${masked.askMarkerPattern})`,
    'g'
  );
  const normalized = masked.content.replace(pattern, (match, determiner, spacing, _token, offset, source) => {
    const literalIndex = match.indexOf('AskUserQuestion');
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
      return `${normalizedDeterminer}${spacing}structured user-input request`;
    }

    const trailing = source.slice(offset + match.length);
    const pluralContext = new RegExp(`^${oneSeparator}(?:calls|batches)\\b`, 'i').test(trailing);
    return `${pluralContext ? '' : 'a '}structured user-input request`;
  });
  return masked.restore(normalized);
}

function normalizeRuntimePaths(content) {
  return normalizeSourcePaths(content, {
    runtimeRoot: '.codex',
    skillsRoot: '.agents/skills'
  })
    .replace(/(?<!~\/)\.claude\/skills\b/g, '.agents/skills')
    .replace(/(?<!~\\)\.claude\\skills\b/g, '.agents\\skills')
    .replace(/(?<!~\/)\.claude(?=[/\\])/g, '.codex')
    .replace(/(['"])\.claude\1/g, '$1.codex$1')
    .replace(/`\.claude`/g, '`.codex`');
}

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
  let next = normalizeRuntimePaths(String(content));
  next = next
    .replace(/\bCLAUDE\.md\b/g, 'AGENTS.md')
    .replace(/\bClaude Code\b/g, 'Codex CLI');

  if (!isInstructionAsset(sourcePath)) return next;

  next = normalizeAgentInvocations(normalizeAgentNames(normalizeSkillNames(next)));
  return applyReplacements(normalizeAskUserQuestion(next), INSTRUCTION_REPLACEMENTS);
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
  const description = normalizeCodexBody(
    frontmatter.description || `CafeKit Codex agent: ${name}`
  );
  const instructions = normalizeCodexBody(body).trim();

  return [
    `name = ${JSON.stringify(name)}`,
    `description = ${JSON.stringify(description)}`,
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
  normalizeCodexBody,
  getCodexCopyOptions,
  codexAgentName,
  convertCodexAgentContent,
  managedRange,
  upsertManagedCodexBlock,
  transformManagedCodexContent
};
