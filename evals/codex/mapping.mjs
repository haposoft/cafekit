import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const tools = ['Agent', 'WebSearch', 'WebFetch', 'Edit', 'Write', 'Read', 'Grep', 'Glob'];
export const calibrationFile = new URL('./mapping-calibration.json', import.meta.url);
export const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export function condition(skill, slot) {
  const value = { runnerSha256: slot.runnerSha256, home: slot.runCondition.home,
    configuration: slot.runCondition.configuration, model: skill.conditions.model,
    reasoningEffort: skill.conditions.reasoningEffort, sandbox: skill.conditions.sandbox };
  return { id: hash(JSON.stringify(value)).slice(0, 16), ...value };
}
export const readJSONL = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line, i) =>
  ({ event: JSON.parse(line), line: i + 1 }));

// Chỉ giải mã literal, không eval JavaScript do model sinh ra.
export function patches(payload) {
  if (payload.name === 'apply_patch') return [payload.input ?? payload.arguments];
  if (payload.name !== 'exec' || typeof payload.input !== 'string') return [];
  return [...payload.input.matchAll(/tools\.apply_patch\(\s*("(?:[^"\\]|\\[\s\S])*")\s*\)/g)]
    .map(match => { try { return JSON.parse(match[1]); } catch { return null; } }).filter(Boolean);
}

// Tokenizer chỉ đọc lệnh; không chạy shell. Chỉ nhận các lệnh đọc/tìm minh bạch.
function words(command) {
  return [...command.matchAll(/'([^']*)'|"((?:[^"\\]|\\.)*)"|([^\s;&|]+)/g)]
    .map(m => m[1] ?? m[2] ?? m[3]);
}
function commandInputs(command) {
  const result = [];
  const segments = []; let start = 0, quote = null;
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (char === '\\' && quote !== "'") { i++; continue; }
    if (quote) { if (char === quote) quote = null; continue; }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (';&|\n'.includes(char)) { segments.push(command.slice(start, i)); start = i + 1; }
  }
  if (!quote) segments.push(command.slice(start));
  for (const segment of segments) {
    const argv = words(segment), name = path.basename(argv[0] || '');
    if (['cat', 'head', 'tail', 'sed'].includes(name)) {
      let skip = name === 'sed';
      for (let i = 1; i < argv.length; i++) {
        const token = argv[i];
        if (['-n', '-c', '-e', '-f'].includes(token)) { i++; if (name === 'sed') skip = false; continue; }
        if (token.startsWith('-')) continue;
        if (skip) { skip = false; continue; }
        if (!/[<>`$]/.test(token)) result.push({ tool: 'Read', input: { path: token } });
      }
    } else if (['rg', 'grep'].includes(name)) {
      if (argv.includes('--files')) {
        let target = '.', pattern = '**/*';
        for (let i = 1; i < argv.length; i++) {
          if (['-g', '--glob'].includes(argv[i])) { pattern = argv[++i]; continue; }
          if (!argv[i].startsWith('-')) target = argv[i];
        }
        result.push({ tool: 'Glob', input: { path: target, pattern } });
      } else {
        const args = [];
        for (let i = 1; i < argv.length; i++) {
          if (['-g', '--glob', '-t', '--type', '-m', '--max-count', '-A', '-B', '-C'].includes(argv[i])) { i++; continue; }
          if (!argv[i].startsWith('-')) args.push(argv[i]);
        }
        if (args.length) result.push({ tool: 'Grep', input: { pattern: args[0], path: args[1] || '.' } });
      }
    } else if (['find', 'ls'].includes(name)) {
      result.push({ tool: 'Glob', input: { path: argv[1]?.startsWith('-') ? '.' : (argv[1] || '.'), pattern: '**/*' } });
    }
  }
  return result;
}

export function mapRun(directory, events, { translatePath = true, eventFile = 'events.jsonl' } = {}) {
  const records = [], unsupported = new Set(), limitations = ['Ghi file qua shell không có count Edit/Write tương đương; không đếm shell write.'];
  const sessions = fs.readdirSync(directory).filter(f => f.startsWith('sessions-') && fs.statSync(path.join(directory, f)).isDirectory());
  const roots = new Set([path.join(directory, 'workspace')]);
  const location = path.join(directory, 'workspace-location.txt');
  if (fs.existsSync(location)) roots.add(fs.readFileSync(location, 'utf8').trim());
  const add = (tool, input, evidence) => records.push({ tool, input, evidence });
  const calls = new Set();
  for (const folder of sessions) for (const file of fs.readdirSync(path.join(directory, folder)).filter(f => f.endsWith('.jsonl')).sort()) {
    const relative = path.join(folder, file);
    for (const { event, line } of readJSONL(path.join(directory, relative))) {
      const payload = event.payload;
      if (event.type === 'session_meta' && payload?.cwd) roots.add(payload.cwd);
      if (event.type !== 'response_item' || !['function_call', 'custom_tool_call'].includes(payload?.type)) continue;
      const id = payload.call_id || `${relative}:${line}`;
      if (calls.has(id)) continue;
      calls.add(id);
      const evidence = { file: relative, line, sha256: hash(JSON.stringify(event)) };
      if (payload.type === 'function_call' && payload.name === 'spawn_agent') {
        const input = JSON.parse(payload.arguments);
        add('Agent', { ...input, ...(input.agent_type ? { subagent_type: input.agent_type } : {}), role: input.agent_type ?? null }, evidence);
      }
      for (const patch of patches(payload)) for (const header of patch.matchAll(/^\*\*\* (Add|Update) File: (.+)$/gm)) {
        add(header[1] === 'Add' ? 'Write' : 'Edit', { path: header[2], patch }, evidence);
      }
      if (payload.name === 'exec' && /tools\.apply_patch\s*\(/.test(payload.input || '') &&
        patches(payload).length !== [...payload.input.matchAll(/tools\.apply_patch\s*\(/g)].length) {
        unsupported.add('Edit'); unsupported.add('Write');
        limitations.push(`Không giải mã được patch: ${relative}:${line}`);
      }
    }
  }
  // Snapshot + file_change chỉ dùng khi không có capture session; không suy từ file shell tạo.
  const initial = fs.readdirSync(directory).find(f => /^(?:harness-manifest-|initial-).*\.json$/.test(f));
  const before = initial ? JSON.parse(fs.readFileSync(path.join(directory, initial), 'utf8')).initialFiles : null;
  const seen = new Set();
  for (const [index, event] of events.entries()) {
    if (event.type !== 'item.completed') continue;
    const item = event.item, id = `${item?.type}:${item?.id}`;
    if (!item || seen.has(id)) continue;
    seen.add(id);
    const evidence = { file: eventFile, line: index + 1, sha256: hash(JSON.stringify(event)) };
    if (item.type === 'web_search' && eventFile === 'events.jsonl') {
      const action = item.action?.type;
      if (action === 'search') add('WebSearch', { ...item.action, query: item.query }, evidence);
      else if (['open_page', 'find_in_page'].includes(action)) add('WebFetch', { ...item.action }, evidence);
      else limitations.push(`Web action ${action || 'other'} chưa ánh xạ: ${id}`);
    }
    if (item.type === 'command_execution') {
      let command = item.command;
      const wrapper = command.match(/^\/(?:usr\/)?bin\/(?:zsh|bash|sh) -lc '([\s\S]*)'$/);
      if (wrapper) command = wrapper[1].replace(/'\\''/g, "'");
      if (/\b(?:cat|sed|head|tail)\s[^;\n]*(?:\$|\*|\?)/.test(command)) {
        unsupported.add('Read'); limitations.push('Read dùng biến/glob shell chưa phục hồi chính xác.');
      }
      for (const record of commandInputs(command)) add(record.tool, record.input, evidence);
    }
    if (!sessions.length && Array.isArray(before) && item.type === 'file_change' && item.status === 'completed') {
      for (const change of item.changes || []) {
        if (!['add', 'update'].includes(change.kind)) continue;
        const relative = [...roots].reduce((p, root) => p.startsWith(`${root}/`) ? p.slice(root.length + 1) : p, change.path);
        add(before.includes(relative) ? 'Edit' : 'Write', { path: change.path }, evidence);
      }
    }
  }
  if (eventFile !== 'events.jsonl') {
    for (const { event, line } of readJSONL(path.join(directory, 'events.jsonl'))) {
      if (event.type !== 'item.completed' || event.item?.type !== 'web_search') continue;
      const item = event.item, action = item.action?.type;
      const evidence = { file: 'events.jsonl', line, sha256: hash(JSON.stringify(event)) };
      if (action === 'search') add('WebSearch', { ...item.action, query: item.query }, evidence);
      else if (['open_page', 'find_in_page'].includes(action)) add('WebFetch', { ...item.action }, evidence);
      else limitations.push(`Web action ${action || 'other'} chưa ánh xạ: ${item.id}`);
    }
  }
  for (const root of [...roots]) {
    if (root.startsWith('/private/')) roots.add(root.slice('/private'.length));
    else if (root.startsWith('/var/')) roots.add(`/private${root}`);
  }
  const normalize = value => {
    for (const root of [...roots].filter(Boolean).sort((a, b) => b.length - a.length)) {
      if (value === root || value.startsWith(`${root}/`)) return `/home/cwd/${value.slice(root.length).replace(/^\//, '')}`;
    }
    return value.startsWith('/') || value.startsWith('~') ? value : `/home/cwd/${value.replace(/^\.\//, '')}`;
  };
  for (const record of records) if (typeof record.input.path === 'string') {
    record.input.path = normalize(record.input.path);
    if (translatePath && ['Read', 'Edit', 'Write'].includes(record.tool)) {
      record.input.file_path = record.input.path; delete record.input.path;
    }
  }
  return { records, hasSessions: sessions.length > 0, unsupported: [...unsupported], limitations: [...new Set(limitations)] };
}

export function countMatches(g, mapping) {
  return mapping.records.filter(record => record.tool === g.tool &&
    (!g.input_match || new RegExp(g.input_match, g.flags || '').test(JSON.stringify(record.input)))).length;
}
export const ruleSignature = g => hash(JSON.stringify([g.name, g.tool, g.input_match ?? null, g.flags ?? '', g.min ?? 1, g.max ?? null]));
function validControls(row, g, context) {
  if (row.tool !== g.tool || row.ruleSignature !== ruleSignature(g)) return false;
  const rubric = new URL(`../${row.key.split('/').slice(0, 2).join('/')}/graders/${g.name}.md`, import.meta.url);
  if (row.graderSha256 !== hash(fs.readFileSync(rubric))) return false;
  for (const [kind, controls] of [['positive', row.positive], ['negative', row.negative]]) for (const control of controls) {
    const skill = context.mappingManifest.skills.find(s => s.name === row.key.split('/')[0]);
    const slot = skill?.cases.flatMap(c => c.slots).find(s => s.directory === control.directory);
    if (!slot || condition(skill, slot).id !== row.condition.id || !control.proofs?.length) return false;
    const directory = path.resolve(context.mappingLogRoot, control.directory);
    for (const proof of control.proofs) {
      const file = path.resolve(directory, proof.file);
      if (!file.startsWith(`${directory}/`) || hash(fs.readFileSync(file)) !== proof.sha256) return false;
    }
    const native = `native-events-${skill.name}.jsonl`, eventFile = fs.existsSync(path.join(directory, native)) ? native : 'events.jsonl';
    // Gate luôn kiểm phép dịch chuẩn; phản ví dụ chỉ tắt phép dịch khi chấm lượt đích.
    const mapping = mapRun(directory, readJSONL(path.join(directory, eventFile)).map(r => r.event), { eventFile });
    const count = countMatches(g, mapping);
    if (mapping.unsupported.includes(g.tool) || (g.tool === 'Agent' && !mapping.hasSessions) ||
      (kind === 'positive' ? control.count <= 0 : control.count !== 0) || count !== control.count ||
      control.passed !== (count >= (g.min ?? 1) && count <= (g.max ?? Infinity))) return false;
  }
  return true;
}
export function mappedGrade(g, context) {
  const row = context.mappingCalibration?.graders.find(r => r.key === context.mappingKey && r.condition.id === context.mappingCondition);
  const roles = g.tool === 'Agent' ? { roles: context.mapping.records.filter(r => r.tool === 'Agent').map(r => r.input.role) } : {};
  if (!row?.enabled || !row.positive?.length || !row.negative?.length) return { status: 'untransferred', reason: row?.reason || 'N/A: thiếu đối chứng dương/âm cùng điều kiện chạy.', ...roles };
  try {
    if (!validControls(row, g, context)) return { status: 'untransferred', reason: 'N/A: đối chứng hoặc rubric không còn hợp lệ.', ...roles };
  } catch (error) { return { status: 'untransferred', reason: `N/A: không đọc được bằng chứng đối chứng: ${error.message}`, ...roles }; }
  if (g.tool === 'Agent' && !context.mapping.hasSessions) return { status: 'untransferred', reason: 'N/A: không có sessions-* để kiểm spawn_agent.' };
  if (context.mapping.unsupported.includes(g.tool)) return { status: 'untransferred', reason: `N/A: ${g.tool} có biến/glob shell chưa phục hồi chính xác.` };
  const count = countMatches(g, context.mapping);
  return { status: 'scored', count, passed: count >= (g.min ?? 1) && count <= (g.max ?? Infinity),
    limitations: context.mapping.limitations,
    ...roles };
}
