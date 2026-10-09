import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const YAML = require('yaml');
const { normalizeCodexBody } = require('../../packages/spec/bin/lib/codex-install.js');
export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const manifestPath = path.join(repo, 'evals/codex/manifest.json');
export const readManifest = (file = manifestPath) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const logRoot = manifest => manifest.logRoot.replace(/^~(?=\/)/, os.homedir());

export function inventory(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.git' || entry.isSymbolicLink()) return [];
    const rel = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? inventory(root, rel) : [rel];
  }).sort();
}

export function installProjection(destination) {
  fs.mkdirSync(destination, { recursive: true });
  const result = spawnSync(process.execPath, [path.join(repo, 'packages/spec/bin/install.js'),
    '--platform', 'codex', '--yes', '--with-document-skills'],
  { cwd: destination, encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0 || result.error) throw new Error(`Installer: ${result.error?.message || result.stderr}`);
  if (!fs.existsSync(path.join(destination, '.codex/cafekit.json'))) throw new Error('Thiếu output installer');
  return destination;
}

export function buildRoom(skill, cell, projection, destination) {
  fs.mkdirSync(destination, { recursive: true });
  if (fs.readdirSync(destination).length) throw new Error('Phòng thử phải rỗng');
  const room = fs.realpathSync(destination);
  const caseDir = path.join(repo, 'evals', skill.name, cell.case);
  const spec = YAML.parse(fs.readFileSync(path.join(caseDir, 'case.yaml'), 'utf8'));
  if (spec.context?.scaffold_script) {
    const result = spawnSync('bash', [path.join(caseDir, spec.context.scaffold_script)],
      { cwd: room, encoding: 'utf8', timeout: 120000 });
    if (result.status !== 0 || result.error) throw new Error(`Scaffold ${skill.name}/${cell.case}: ${result.stderr}`);
  }
  const scaffoldFiles = inventory(room);
  const copy = (source, target) => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true });
  };
  for (const name of cell.loadedSkills) {
    const native = path.join(projection, '.agents/skills', `cf-${name}`);
    const source = fs.existsSync(native) ? native : path.join(projection, '.agents/skills', name);
    copy(source, path.join(room, '.agents/skills', `cf-${name}`));
  }
  // Giữ đúng tập script fixture; dự án thường không nhận thêm script runtime.
  const scripts = scaffoldFiles.filter(file => file.startsWith('.claude/scripts/'));
  for (const file of scripts) copy(path.join(room, file), path.join(room, file.replace('.claude/', '.codex/')));
  const agents = cell.loadedAgents === 'all-installed'
    ? fs.readdirSync(path.join(projection, '.codex/agents')).filter(f => f.endsWith('.toml')).map(f => f.slice(0, -5))
    : cell.loadedAgents.map(name => name.replaceAll('-', '_'));
  for (const agent of agents) copy(path.join(projection, '.codex/agents', `${agent}.toml`),
    path.join(room, '.codex/agents', `${agent}.toml`));
  // Manuals của role là output installer, không chép hook hay policy toàn runtime.
  if (agents.length && fs.existsSync(path.join(projection, '.codex/references'))) {
    copy(path.join(projection, '.codex/references'), path.join(room, '.codex/references'));
  }
  let prompt = normalizeCodexBody(spec.execution.prompt);
  for (const agent of agents) prompt = prompt.replaceAll(`agent ${agent.replaceAll('_', '-')}`, `agent ${agent}`);
  return { room, prompt, agents, scaffoldFiles, scripts, initialFiles: inventory(room),
    timeoutSeconds: spec.execution.timeout_seconds, historyFile: spec.context?.history_file || null };
}
