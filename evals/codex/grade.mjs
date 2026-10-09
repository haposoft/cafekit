import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { tools, mapRun, mappedGrade, condition, calibrationFile } from './mapping.mjs';
import { readManifest, logRoot } from './room.mjs';
const YAML = createRequire(import.meta.url)('yaml');

export function loadGrader(file) {
  const front = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)/);
  if (!front) throw new Error(`Thiếu frontmatter: ${file}`);
  const config = YAML.parse(front[1]);
  const grader = { name: path.basename(file, '.md'), ...config, pattern: config.pattern ?? front[2].trim() };
  validateGrader(grader);
  return grader;
}

export function validateGrader(g) {
  const fields = { regex: ['target', 'flags', 'match'], file_exists: ['path', 'exists'],
    tool_used: ['tool', 'input_match', 'flags', 'min', 'max'], tool_order: ['before', 'after'], llm: ['focus', 'weight'] };
  if (!fields[g.type]) throw new Error(`Loại thước chưa hỗ trợ: ${g.type}`);
  for (const key of Object.keys(g)) if (!['name', 'type', 'pattern', 'arm', ...fields[g.type]].includes(key)) {
    throw new Error(`Trường thước chưa hỗ trợ: ${g.name}/${key}`);
  }
  if (g.arm && !['with', 'without', 'both'].includes(g.arm)) throw new Error(`arm không hợp lệ: ${g.arm}`);
  if (g.match && !['contains', 'not_contains'].includes(g.match)) throw new Error(`match không hợp lệ: ${g.match}`);
  if (g.type === 'regex') {
    if (!['last_message', 'files'].includes(g.target) && !(g.target?.source === 'file' && typeof g.target.path === 'string')) {
      throw new Error('target regex chưa hỗ trợ');
    }
    if (typeof g.target === 'object' && Object.keys(g.target).some(k => !['source', 'path'].includes(k))) throw new Error('Trường target lạ');
    new RegExp(g.pattern, g.flags || '');
  }
  if (g.type === 'tool_used') {
    if (typeof g.tool !== 'string') throw new Error('Thiếu tool');
    new RegExp(g.input_match || '', g.flags || '');
    for (const key of ['min', 'max']) if (g[key] !== undefined && (!Number.isInteger(g[key]) || g[key] < 0)) throw new Error(`Sai ${key}`);
    if ((g.min ?? 1) > (g.max ?? Infinity)) throw new Error('min lớn hơn max');
  }
  if (g.type === 'file_exists' && (typeof g.path !== 'string' || (g.exists !== undefined && typeof g.exists !== 'boolean'))) throw new Error('Sai file_exists');
  if (g.type === 'llm') {
    const focusOK = g.focus === 'last_message' || (g.focus?.source === 'file' && typeof g.focus.path === 'string' &&
      Object.keys(g.focus).every(k => ['source', 'path'].includes(k)));
    if (!focusOK || !Number.isFinite(g.weight)) throw new Error('Schema llm chưa hỗ trợ');
  }
}

export function inventory(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.git') return [];
    const file = path.posix.join(prefix, entry.name);
    return entry.isDirectory() && !entry.isSymbolicLink() ? inventory(root, file) : [file];
  }).sort();
}

export function readInside(root, relative) {
  const file = path.resolve(root, relative);
  const contained = (base, target) => {
    const rel = path.relative(base, target);
    if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error('File vượt phòng thử');
  };
  contained(path.resolve(root), file);
  if (!fs.existsSync(file)) return '';
  contained(fs.realpathSync(root), fs.realpathSync(file));
  return fs.readFileSync(file, 'utf8');
}

export function commands(events, unwrap = true) {
  return events.filter(e => e.type === 'item.completed' && e.item?.type === 'command_execution').map(e => {
    let command = e.item.command;
    if (typeof command !== 'string') throw new Error('Schema command_execution chưa hỗ trợ');
    const wrapper = unwrap && command.match(/^\/(?:usr\/)?bin\/(?:zsh|bash|sh) -lc '([\s\S]*)'$/);
    if (wrapper) command = wrapper[1].replace(/'\\''/g, "'");
    return { command };
  });
}

export function grade(g, context) {
  validateGrader(g);
  if (g.arm === 'without') return { status: 'untransferred', reason: 'Không có lượt without trong manifest Codex.' };
  if (g.type === 'llm') return { status: 'untransferred', reason: 'N/A: không có giám khảo LLM hoặc dữ liệu hiệu chỉnh hợp lệ.' };
  if (g.type === 'tool_order' || (g.type === 'tool_used' && g.tool !== 'Bash')) {
    if (g.type === 'tool_used' && tools.includes(g.tool) && context.mapping) {
      return mappedGrade(g, { ...context, mappingKey: `${context.mappingCell}/${g.name}` });
    }
    return { status: 'untransferred', reason: `N/A: ${g.type}/${g.tool || 'order'} chưa có ánh xạ đã hiệu chỉnh (task 05).` };
  }
  if (g.type === 'tool_used') {
    const count = commands(context.events, context.unwrapCommands !== false).filter(input =>
      !g.input_match || new RegExp(g.input_match, g.flags || '').test(JSON.stringify(input))).length;
    return { status: 'scored', passed: count >= (g.min ?? 1) && count <= (g.max ?? Infinity), count };
  }
  const files = context.files || inventory(context.root);
  if (g.type === 'file_exists') {
    // Các ca đã chạy dùng path chính xác; không tự suy cú pháp glob của ca bị loại.
    if (/[*?\[\]]/.test(g.path)) throw new Error('file_exists glob chưa được hiệu chỉnh');
    const exists = files.includes(g.path);
    return { status: 'scored', passed: g.exists === false ? !exists : exists };
  }
  let target;
  if (g.target === 'last_message') target = context.last;
  else if (g.target === 'files') {
    if (!Array.isArray(context.initialFiles)) throw new Error('Thiếu snapshot file trước model');
    const before = new Set(context.initialFiles);
    target = files.filter(file => !before.has(file)).join('\n');
  } else target = readInside(context.root, g.target.path);
  const hit = new RegExp(g.pattern, g.flags || '').test(target);
  const result = { status: 'scored', passed: g.match === 'not_contains' ? !hit : hit };
  // last_message vẫn chỉ là last.txt; tin giữa lượt là chẩn đoán, không cộng vào verdict.
  if (g.target === 'last_message') result.matchedEarlier = (context.agentMessages || []).some(message =>
    message !== context.last && new RegExp(g.pattern, g.flags || '').test(message));
  return result;
}

export function readRun(directory, skill, options = {}) {
  const readJSON = file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
  const readEvents = file => fs.readFileSync(path.join(directory, file), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const stdoutEvents = readEvents('events.jsonl');
  const native = `native-events-${skill}.jsonl`;
  const events = fs.existsSync(path.join(directory, native)) ? readEvents(native) : stdoutEvents;
  const root = path.join(directory, 'workspace');
  let initialFiles, initialEvidence;
  for (const name of [`harness-manifest-${skill}.json`, `initial-${skill}.json`, 'initial.json']) {
    if (!fs.existsSync(path.join(directory, name))) continue;
    const data = readJSON(name);
    if (Array.isArray(data.initialFiles)) { initialFiles = data.initialFiles; initialEvidence = name; break; }
  }
  if (!initialFiles && fs.existsSync(path.join(directory, 'workspace-before'))) {
    initialFiles = inventory(path.join(directory, 'workspace-before')); initialEvidence = 'workspace-before';
  }
  const scaffoldManifest = `manifest-${skill}.json`, harnessManifest = `harness-manifest-${skill}.json`;
  if (!initialFiles && fs.existsSync(path.join(directory, scaffoldManifest)) && fs.existsSync(path.join(directory, harnessManifest))) {
    const scaffold = readJSON(scaffoldManifest), harness = readJSON(harnessManifest);
    if (Array.isArray(scaffold.inventoryBefore) && Array.isArray(harness.files)) {
      initialFiles = [...new Set([...scaffold.inventoryBefore, ...harness.files.map(f => f.path)])];
      initialEvidence = `${scaffoldManifest} + ${harnessManifest}`;
    }
  }
  // Ánh xạ hiệu chỉnh bật tường minh; replay verdict H đã khoá vẫn dùng profile task 03.
  let mapped = {};
  if (options.mapping) {
    const manifest = options.manifest || readManifest(), source = options.logRoot || logRoot(manifest);
    const definition = manifest.skills.find(s => s.name === skill);
    const cell = definition?.cases.find(c => c.slots.some(s => path.resolve(source, s.directory) === path.resolve(directory)));
    const slot = cell?.slots.find(s => path.resolve(source, s.directory) === path.resolve(directory));
    if (!slot) throw new Error('Lượt ánh xạ không có trong manifest');
    mapped = { mapping: mapRun(directory, events, { ...options, eventFile: fs.existsSync(path.join(directory, native)) ? native : 'events.jsonl' }), mappingCell: `${skill}/${cell.case}`,
      mappingCondition: condition(definition, slot).id,
      mappingManifest: manifest, mappingLogRoot: source,
      mappingCalibration: options.calibration || JSON.parse(fs.readFileSync(calibrationFile, 'utf8')) };
  }
  return { root, events, stdoutEvents, initialFiles, initialEvidence, ...mapped, files: inventory(root),
    last: fs.readFileSync(path.join(directory, 'last.txt'), 'utf8'),
    agentMessages: stdoutEvents.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message').map(e => e.item.text) };
}
