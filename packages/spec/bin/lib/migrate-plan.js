'use strict';

/**
 * Plan which files of an npx install `migrate` removes and which it keeps.
 *
 * Pure planner: it reads the Claude and Codex install manifests and the files on
 * disk and never writes. A file is removed only when every check below agrees it
 * is CafeKit's untouched copy of something a plugin now ships; any doubt keeps it
 * and names the reason, so the dry-run shows exactly what `--apply` will do.
 */

const fs = require('fs');
const path = require('path');
const { sha256, MANIFEST_FILE } = require('./manifest');
const { isInside } = require('./path-safety');
const { PLATFORMS } = require('./context');
const { codexAgentName } = require('./codex-install');
const { pluginSkills, pluginAgents } = require('./plugin-inventory');

const MIGRATED_PLATFORMS = ['claude', 'codex'];
const METADATA_FILES = ['cafekit.json', MANIFEST_FILE];
// Written by the installer outside the manifest; the merged-file planner owns them.
const MERGED_FILES = new Set(['.claude/settings.json', '.codex/hooks.json']);
// Claude Code stores an /output-style choice in settings.local.json, which overrides settings.json.
const STYLE_SETTINGS = ['.claude/settings.json', '.claude/settings.local.json'];
const MAX_SCANNED_BYTES = 1024 * 1024;
// Hook logs and dependency installs name runtime paths without depending on them.
const UNSCANNED_DIRS = new Set(['.logs', '.privacy', 'session-state', 'agent-memory', 'worktrees', 'node_modules', '.venv', 'venv', '__pycache__']);
// Created by the operating system, not by a user customizing a skill.
const SYSTEM_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

const REASONS = {
  merged: 'written outside the manifest, planned separately',
  'outside-root': 'manifest key points outside the platform folders',
  symlinked: 'path goes through a symlink',
  modified: 'edited since install',
  runtime: 'runtime configuration stays',
  'npx-only': 'no plugin ships this skill or agent',
  'group-kept': 'another file of the same skill or agent is kept',
  'required-by-kept': 'a kept file names it',
  'protects-kept': 'ignore rules still protect kept files',
  missing: 'already gone',
  untracked: 'not installed by CafeKit'
};

const toPosix = (value) => value.split(path.sep).join('/');

function lstatOrNull(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

/** True when any existing component of `rel` below `root` is a symlink. */
function createSymlinkProbe(root) {
  const cache = new Map();
  return (rel) => {
    let cursor = root;
    for (const segment of rel.split('/').filter(Boolean)) {
      cursor = path.join(cursor, segment);
      if (!cache.has(cursor)) {
        const stat = lstatOrNull(cursor);
        cache.set(cursor, stat ? (stat.isSymbolicLink() ? 'link' : 'ok') : 'absent');
      }
      const state = cache.get(cursor);
      if (state === 'link') return true;
      if (state === 'absent') return false;
    }
    return false;
  };
}

function readManifestRaw(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'absent' };
    return { state: 'corrupt' };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.files || typeof parsed.files !== 'object' || Array.isArray(parsed.files)) {
      return { state: 'corrupt' };
    }
    return { state: 'ok', files: parsed.files };
  } catch {
    return { state: 'corrupt' };
  }
}

/** Skill folder or agent file an installed path belongs to; null for shared runtime files. */
function groupOf(rel) {
  let match = rel.match(/^(\.claude\/skills|\.agents\/skills)\/([^/]+)\//);
  if (match) return { kind: 'skill', name: match[2], label: `${match[1]}/${match[2]}/` };
  match = rel.match(/^\.claude\/agents\/([^/]+)\.md$/);
  if (match) return { kind: 'agent', name: match[1], label: rel };
  match = rel.match(/^\.codex\/agents\/([^/]+)\.toml$/);
  if (match) return { kind: 'codex-agent', name: match[1], label: rel };
  return null;
}

function createPluginShips() {
  const skills = new Set(pluginSkills());
  const agents = new Set(pluginAgents());
  const codexAgents = new Set([...agents].map(codexAgentName));
  return (group) => {
    if (group.kind === 'skill') return skills.has(group.name);
    if (group.kind === 'agent') return agents.has(group.name);
    return codexAgents.has(group.name);
  };
}

function platformFolders(key) {
  return PLATFORMS[key].ownership?.allowedRoots || [PLATFORMS[key].folder];
}

function planEntry(root, platform, folders, recordRoot, key, record, isSymlinked) {
  const norm = String(key).replace(/\\/g, '/');
  const recorded = record && typeof record.sha256 === 'string' ? record.sha256 : null;
  const base = { platform, key, sha256: recorded, group: null };
  const outside = !norm || path.posix.isAbsolute(norm) || /^[A-Za-z]:/.test(norm) || norm.split('/').includes('..');
  const abs = path.resolve(root, recordRoot, norm);
  const rel = toPosix(path.relative(root, abs));
  if (outside || !folders.some((folder) => {
    const folderAbs = path.join(root, folder);
    return abs !== folderAbs && isInside(folderAbs, abs);
  })) {
    return { ...base, path: rel, action: 'keep', reason: 'outside-root' };
  }
  const entry = { ...base, path: rel, group: groupOf(rel) };
  if (MERGED_FILES.has(rel) || METADATA_FILES.some((name) => folders.some((folder) => rel === `${folder}/${name}`))) {
    return { ...entry, action: 'keep', reason: 'merged' };
  }
  if (isSymlinked(rel)) return { ...entry, action: 'keep', reason: 'symlinked' };
  const stat = lstatOrNull(abs);
  if (!stat) return { ...entry, action: 'missing', reason: 'missing' };
  if (!stat.isFile() || !recorded || sha256(fs.readFileSync(abs)) !== recorded) {
    return { ...entry, action: 'keep', reason: 'modified' };
  }
  const folder = folders.find((name) => rel.startsWith(`${name}/`));
  if (rel === `${folder}/runtime.json`) return { ...entry, action: 'keep', reason: 'runtime' };
  if (rel === `${folder}/runtime.schema.json` && lstatOrNull(path.join(root, folder, 'runtime.json'))) {
    return { ...entry, action: 'keep', reason: 'runtime' };
  }
  return { ...entry, action: 'remove', reason: null };
}

function planPlatform(root, platform, isSymlinked) {
  const config = PLATFORMS[platform];
  const folders = platformFolders(platform);
  const result = { platform, name: config.name, folders, status: 'absent', reason: null, metadata: [], entries: [] };
  if (!lstatOrNull(path.join(root, config.folder))) return result;
  if (folders.some((folder) => lstatOrNull(path.join(root, folder))?.isSymbolicLink())) {
    return { ...result, status: 'refused', reason: 'a platform folder is a symlink' };
  }
  result.metadata = METADATA_FILES
    .map((name) => `${config.folder}/${name}`)
    .filter((rel) => lstatOrNull(path.join(root, rel)));
  const manifest = readManifestRaw(path.join(root, config.folder, MANIFEST_FILE));
  if (manifest.state === 'absent') {
    const managed = result.metadata.length > 0;
    return { ...result, status: managed ? 'unmanaged' : 'absent', reason: managed ? 'cafekit.json without an install manifest' : null };
  }
  if (manifest.state === 'corrupt') return { ...result, status: 'refused', reason: 'the install manifest does not parse' };

  const recordRoot = config.ownership?.recordRoot || config.folder;
  result.entries = Object.entries(manifest.files)
    .map(([key, record]) => planEntry(root, platform, folders, recordRoot, key, record, isSymlinked));
  result.status = 'planned';
  return result;
}

/** A symlink that points back into the repository keeps the files it reaches. */
function keepSymlinkTargets(root, entries) {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  for (const entry of entries) {
    if (entry.reason !== 'symlinked') continue;
    let real;
    try {
      real = fs.realpathSync(path.join(root, entry.path));
    } catch {
      continue;
    }
    if (!isInside(root, real)) continue;
    const target = byPath.get(toPosix(path.relative(root, real)));
    if (target && target.action === 'remove') Object.assign(target, { action: 'keep', reason: 'symlinked' });
  }
}

function applyGroupRules(entries, pluginShips, untracked) {
  const groups = new Map();
  for (const entry of entries) {
    if (!entry.group) continue;
    const id = `${entry.platform}:${entry.group.label}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(entry);
  }
  for (const members of groups.values()) {
    const { label } = members[0].group;
    // A user file added inside a skill folder customizes that skill, so the skill stays whole.
    const holdsUserFile = label.endsWith('/') && untracked.some((rel) => rel.startsWith(label)
      && !SYSTEM_FILES.has(path.posix.basename(rel))
      && !rel.split('/').some((segment) => UNSCANNED_DIRS.has(segment)));
    const reason = !pluginShips(members[0].group) ? 'npx-only'
      : members.some((entry) => entry.action === 'keep') || holdsUserFile ? 'group-kept' : null;
    if (!reason) continue;
    for (const entry of members) {
      if (entry.action === 'remove') Object.assign(entry, { action: 'keep', reason });
    }
  }
}

function readText(abs, { follow = false } = {}) {
  let stat;
  try {
    stat = follow ? fs.statSync(abs) : lstatOrNull(abs);
  } catch {
    return null;
  }
  if (!stat || !stat.isFile() || stat.size > MAX_SCANNED_BYTES) return null;
  const buffer = fs.readFileSync(abs);
  return buffer.includes(0) ? null : buffer.toString('utf8');
}

/** Installed paths a file names: `.claude/…`, `.codex/…`, `.agents/…`, and relative requires. */
function referencedPaths(text, fromRel) {
  const refs = new Set();
  for (const match of text.matchAll(/\.(?:claude|codex|agents)[/\\][A-Za-z0-9._/\\-]+/g)) {
    // JSON escapes a backslash as `\\`, so separators may arrive doubled.
    refs.add(match[0].replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/[./]+$/, ''));
  }
  for (const match of text.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), match[1]));
    for (const suffix of ['', '.cjs', '.js', '/index.js']) refs.add(target + suffix);
  }
  return refs;
}

function selectedStyleNames(root) {
  const names = new Set();
  for (const rel of STYLE_SETTINGS) {
    try {
      const settings = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
      if (typeof settings.outputStyle === 'string' && settings.outputStyle.trim()) names.add(settings.outputStyle.trim());
    } catch {
      // A missing or unparsable settings file selects nothing.
    }
  }
  return names;
}

/** A style is named by its frontmatter `name:`, or by its file name when that is absent. */
function styleName(text, rel) {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const name = frontmatter && frontmatter[1].match(/^name:\s*(.+)$/m);
  return name ? name[1].trim().replace(/^(['"])(.*)\1$/, '$2') : path.posix.basename(rel, '.md');
}

/**
 * Text files of the untracked list, descending into collapsed folders. Symlinks are
 * followed because reading a user's linked skill can only keep more files, never fewer.
 */
function untrackedFiles(root, untracked) {
  const files = [];
  const seen = new Set();
  const visit = (rel) => {
    if (rel.split('/').some((segment) => UNSCANNED_DIRS.has(segment))) return;
    let real;
    let stat;
    try {
      real = fs.realpathSync(path.join(root, rel));
      stat = fs.statSync(real);
    } catch {
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(real).sort()) visit(`${rel}/${name}`);
    } else if (stat.isFile()) {
      files.push(rel);
    }
  };
  for (const rel of untracked) visit(rel.replace(/\/$/, ''));
  return files;
}

/** Keep every shared file a kept or user file names, transitively, and the selected output styles. */
function keepRequiredFiles(root, entries, untracked) {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const readable = (entry) => !['outside-root', 'symlinked', 'merged'].includes(entry.reason);
  const queue = [
    ...entries.filter((entry) => entry.action === 'keep' && readable(entry)),
    ...untrackedFiles(root, untracked).map((rel) => ({ path: rel, follow: true }))
  ];
  const keep = (entry) => {
    if (entry.action !== 'remove') return;
    Object.assign(entry, { action: 'keep', reason: 'required-by-kept' });
    queue.push(entry);
  };

  const styles = selectedStyleNames(root);
  if (styles.size > 0) {
    for (const entry of entries) {
      if (!/^\.claude\/output-styles\/[^/]+\.md$/.test(entry.path) || entry.action === 'missing') continue;
      const text = readText(path.join(root, entry.path));
      if (text && styles.has(styleName(text, entry.path))) keep(entry);
    }
  }

  while (queue.length > 0) {
    const entry = queue.pop();
    const text = readText(path.join(root, entry.path), { follow: entry.follow === true });
    if (!text) continue;
    for (const ref of referencedPaths(text, entry.path)) {
      const target = byPath.get(ref);
      if (target && !target.group) keep(target);
    }
  }
}

/** Files in the platform folders that no manifest records, collapsing folders that hold none. */
function listUntracked(root, platforms, entries) {
  const managed = new Set(entries.map((entry) => entry.path));
  const managedPrefixes = new Set();
  for (const rel of managed) {
    const parts = rel.split('/');
    for (let i = 1; i < parts.length; i++) managedPrefixes.add(parts.slice(0, i).join('/'));
  }
  const skipped = new Set([...MERGED_FILES]);
  for (const platform of platforms) for (const rel of platform.metadata) skipped.add(rel);

  const untracked = [];
  const visit = (rel) => {
    if (managed.has(rel) || skipped.has(rel)) return;
    const stat = lstatOrNull(path.join(root, rel));
    if (!stat) return;
    if (stat.isDirectory() && !stat.isSymbolicLink() && managedPrefixes.has(rel)) {
      for (const name of fs.readdirSync(path.join(root, rel)).sort()) visit(`${rel}/${name}`);
      return;
    }
    // A symlink that holds manifest keys is already reported as `symlinked`.
    if (stat.isSymbolicLink() && managedPrefixes.has(rel)) return;
    untracked.push(stat.isDirectory() ? `${rel}/` : rel);
  };
  for (const platform of platforms) {
    if (platform.status !== 'planned') continue;
    for (const folder of platform.folders) visit(folder);
  }
  return untracked;
}

/** A shared `.gitignore` stays while anything below its folder stays. */
function keepIgnoreFiles(entries, untracked) {
  for (const entry of entries) {
    if (entry.group || entry.action !== 'remove' || path.posix.basename(entry.path) !== '.gitignore') continue;
    const prefix = `${path.posix.dirname(entry.path)}/`;
    const kept = entries.some((other) => other !== entry && other.action === 'keep' && other.path.startsWith(prefix))
      || untracked.some((rel) => rel.startsWith(prefix));
    if (kept) Object.assign(entry, { action: 'keep', reason: 'protects-kept' });
  }
}

function planManifestFiles(projectRoot) {
  const root = fs.realpathSync(projectRoot);
  const isSymlinked = createSymlinkProbe(root);
  const platforms = MIGRATED_PLATFORMS.map((platform) => planPlatform(root, platform, isSymlinked));
  const entries = platforms.flatMap((platform) => platform.entries);
  const untracked = listUntracked(root, platforms, entries);
  keepSymlinkTargets(root, entries);
  applyGroupRules(entries, createPluginShips(), untracked);
  keepRequiredFiles(root, entries, untracked);
  keepIgnoreFiles(entries, untracked);
  return {
    projectRoot: root,
    platforms: Object.fromEntries(platforms.map(({ entries: _entries, ...platform }) => [platform.platform, platform])),
    entries,
    untracked
  };
}

function renderManifestPlan(plan) {
  const lines = [];
  for (const platform of Object.values(plan.platforms)) {
    if (platform.status === 'absent') continue;
    const where = platform.folders.map((folder) => `${folder}/`).join(', ');
    lines.push(`${platform.name} (${where}): ${platform.status}${platform.reason ? ` — ${platform.reason}` : ''}`);
  }
  const buckets = new Map();
  for (const entry of plan.entries) {
    const id = entry.action === 'remove' ? 'remove' : `${entry.action}:${entry.reason}`;
    if (!buckets.has(id)) buckets.set(id, new Map());
    const label = entry.group && entry.group.kind === 'skill' ? entry.group.label : entry.path;
    const bucket = buckets.get(id);
    bucket.set(label, (bucket.get(label) || 0) + 1);
  }
  const order = ['remove', ...Object.keys(REASONS).map((reason) => `${reason === 'missing' ? 'missing' : 'keep'}:${reason}`)];
  for (const id of order) {
    const bucket = buckets.get(id);
    if (!bucket) continue;
    const total = [...bucket.values()].reduce((sum, count) => sum + count, 0);
    const reason = id.split(':')[1];
    lines.push('', id === 'remove' ? `Remove (${total} files):` : `${id.startsWith('missing') ? 'Missing' : 'Keep'} — ${REASONS[reason]} (${total} files):`);
    for (const [label, count] of [...bucket.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`  ${label}${label.endsWith('/') ? ` (${count} files)` : ''}`);
    }
  }
  if (plan.untracked.length > 0) {
    lines.push('', `Keep — ${REASONS.untracked} (${plan.untracked.length}):`);
    for (const rel of plan.untracked) lines.push(`  ${rel}`);
  }
  return lines.join('\n');
}

module.exports = { REASONS, planManifestFiles, renderManifestPlan, groupOf };
