#!/usr/bin/env node
/** Generate a fail-closed catalog from the current runtime's installed skills. */

'use strict';

const fs = require('fs');
const path = require('path');

// Keep synchronized with migration-manifest.json obsolete.skills. Modified
// retired directories may remain on disk, but they are never automatic routes.
const RETIRED_DIRECTORIES = new Set([
  'backend-development',
  'frontend-development',
  'frontend-design',
  'mobile-development',
  'devops',
  'react-best-practices',
  'inspect',
  'hotfix',
  'question',
]);

function usage() {
  console.log(`Usage:
  node <runtime>/scripts/generate-skill-catalog.cjs [--skills] [--json] [--root <skills-dir>]

The default root is bound to the script runtime: .claude/skills for Claude,
.agents/skills for Codex, and ../skills for the source tree.`);
}

function parseArgs(argv) {
  const args = { json: false, help: false, root: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--skills') continue;
    else if (arg === '--root') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) {
        throw new Error('--root requires a skills directory');
      }
      args.root = argv[++index];
    } else throw new Error(`unknown option: ${arg}`);
  }
  return args;
}

function defaultSkillsRoot() {
  const runtimeRoot = path.dirname(__dirname);
  const runtimeName = path.basename(runtimeRoot);
  if (runtimeName === '.codex') return path.join(path.dirname(runtimeRoot), '.agents', 'skills');
  const claudeRuntimeName = `.${['cla', 'ude'].join('')}`;
  if (runtimeName === claudeRuntimeName) return path.join(runtimeRoot, 'skills');
  return path.resolve(__dirname, '..', 'skills');
}

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const frontmatter = {};
  const lines = match[1].split(/\r?\n/);
  const seen = new Set();
  let nestedKey = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\s+/.test(line)) {
      const nested = line.match(/^  ([A-Za-z0-9_-]+):\s*(\S.*)$/);
      if (!nestedKey || !nested) return null;
      const identity = `${nestedKey}.${nested[1]}`;
      if (seen.has(identity) || quotedValue(nested[2]) === null) return null;
      seen.add(identity);
      continue;
    }
    nestedKey = null;
    const parsed = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!parsed || seen.has(parsed[1])) return null;
    seen.add(parsed[1]);
    let value = parsed[2].trim();
    if (['>', '>-', '|', '|-'].includes(value)) {
      const block = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        block.push(lines[++index].trim());
      }
      if (block.length === 0) return null;
      value = block.join(' ');
    }
    if (value === '') {
      nestedKey = parsed[1];
      frontmatter[parsed[1]] = '';
      continue;
    }
    value = quotedValue(value);
    if (value === null) return null;
    frontmatter[parsed[1]] = value;
  }
  return frontmatter;
}

function quotedValue(value) {
  const startsQuote = value.startsWith('"') || value.startsWith("'");
  const endsQuote = value.endsWith('"') || value.endsWith("'");
  const startsFlow = value.startsWith('[') || value.startsWith('{');
  const endsFlow = value.endsWith(']') || value.endsWith('}');
  if (startsFlow || endsFlow) {
    const expected = value.startsWith('[') ? ']' : value.startsWith('{') ? '}' : null;
    if (!expected || !value.endsWith(expected)) return null;
  }
  if (!startsQuote && !endsQuote) return value;
  if (value.length < 2 || value[0] !== value[value.length - 1]) return null;
  return value.slice(1, -1);
}

function parseKeywords(value) {
  if (!value || !/^\[[^\]]*\]$/.test(value)) return [];
  return value.slice(1, -1).split(',').map((item) => item.trim()).filter(Boolean);
}

function publicIdentity(name) {
  const match = String(name).match(/^cf(?::|-)([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  return match ? `cf:${match[1]}` : null;
}

function expectedIdentity(directory) {
  return `cf:${directory}`;
}

function diagnostic(code, directory, message) {
  return { code, directory, message };
}

function scanSkills(requestedRoot) {
  if (!fs.existsSync(requestedRoot)) throw new Error(`skills root not found: ${requestedRoot}`);
  const root = fs.realpathSync(requestedRoot);
  const diagnostics = [];
  const candidates = [];
  const entries = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const skillPath = path.join(root, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    if (RETIRED_DIRECTORIES.has(entry.name)) {
      diagnostics.push(diagnostic('retired_skill', entry.name, 'excluded from automatic routing'));
      continue;
    }
    const frontmatter = extractFrontmatter(fs.readFileSync(skillPath, 'utf8'));
    if (!frontmatter) {
      diagnostics.push(diagnostic('malformed_frontmatter', entry.name, 'missing frontmatter block'));
      continue;
    }
    const identity = publicIdentity(frontmatter.name);
    if (!identity || !frontmatter.description || frontmatter.description.trim() === '') {
      diagnostics.push(diagnostic('missing_routing_metadata', entry.name, 'requires valid name and description'));
      continue;
    }
    if (identity !== expectedIdentity(entry.name)) {
      diagnostics.push(diagnostic('folder_name_mismatch', entry.name, `${identity} does not match directory`));
      continue;
    }
    candidates.push({
      name: frontmatter.name,
      public_id: identity,
      directory: entry.name,
      description: frontmatter.description,
      when_to_use: frontmatter.when_to_use || '',
      category: frontmatter.category || 'other',
      keywords: parseKeywords(frontmatter.keywords),
      user_invocable: frontmatter['user-invocable'] !== 'false',
      has_references: fs.existsSync(path.join(root, entry.name, 'references')),
      has_scripts: fs.existsSync(path.join(root, entry.name, 'scripts')),
    });
  }

  const counts = new Map();
  for (const skill of candidates) counts.set(skill.public_id, (counts.get(skill.public_id) || 0) + 1);
  const skills = candidates.filter((skill) => {
    if (counts.get(skill.public_id) === 1) return true;
    diagnostics.push(diagnostic('duplicate_public_name', skill.directory, `${skill.public_id} requires explicit user disambiguation`));
    return false;
  }).sort((left, right) => left.public_id.localeCompare(right.public_id));

  return { root, skills, diagnostics: diagnostics.sort((left, right) =>
    `${left.directory}:${left.code}`.localeCompare(`${right.directory}:${right.code}`)) };
}

function renderMarkdown(catalog) {
  const lines = ['# CafeKit Skills Catalog', '', `Skills root: \`${catalog.root}\``,
    `Routable skills: ${catalog.skills.length}`, ''];
  for (const skill of catalog.skills) {
    const intent = skill.when_to_use ? ` Use: ${skill.when_to_use}` : '';
    lines.push(`- \`${skill.name}\` (${skill.directory}, ${skill.category}): ${skill.description}${intent}`);
  }
  if (catalog.diagnostics.length > 0) {
    lines.push('', '## Diagnostics', '');
    for (const item of catalog.diagnostics) lines.push(`- ${item.code} (${item.directory}): ${item.message}`);
  }
  return `${lines.join('\n').trim()}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  const requestedRoot = path.resolve(process.cwd(), args.root || defaultSkillsRoot());
  const catalog = scanSkills(requestedRoot);
  if (args.json) console.log(JSON.stringify({ ...catalog, total: catalog.skills.length }, null, 2));
  else console.log(renderMarkdown(catalog));
}

try {
  main();
} catch (error) {
  console.error(`[skill-catalog] ${error.message}`);
  process.exitCode = 1;
}
