import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readManifest, installProjection, buildRoom, inventory } from './room.mjs';

export const MODEL = 'gpt-6.1-sol';
export const EFFORT = 'medium';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

export function commandFor(room, prompt, lastFile, research = false) {
  return ['exec', '--json', '-m', MODEL, '-c', `model_reasoning_effort="${EFFORT}"`,
    '-s', 'workspace-write', '-C', room, '--skip-git-repo-check', '--enable', 'multi_agent',
    '-c', `projects.${JSON.stringify(room)}.trust_level="trusted"`,
    ...(research ? ['-c', 'web_search="live"', '-c', 'sandbox_workspace_write.network_access=true'] : []),
    '-o', lastFile, prompt];
}

export function executionCheck(events, last, stderr, exit, error) {
  const commandExecutions = events.filter(e => e.type === 'item.completed' && e.item?.type === 'command_execution').length;
  const text = [last, stderr, ...events.map(e =>
    [e.item?.aggregated_output, e.item?.text, e.message, e.error?.message].filter(Boolean).join('\n'))].join('\n');
  const sandboxError = /sandbox-exec:|sandbox_apply:|\bsandbox\b[^\n]*(?:Operation not permitted|permission denied|failed|failure|error|cannot|can't|unable|lỗi)|(?:lỗi|failed|failure|error)[^\n]*\bsandbox\b/i.test(text);
  const reason = error || (exit !== 0 ? `CLI exit ${exit}` : !last.trim() ? 'Thiếu câu cuối' :
    !events.some(e => e.type === 'turn.completed') ? 'Thiếu turn.completed' :
      events.some(e => e.type === 'error' || e.type === 'turn.failed') ? 'Runtime thất bại' : sandboxError ? 'Lỗi sandbox' : null);
  return { commandExecutions, error: reason };
}

export function captureSessions(home, output, room, events, startedAt) {
  const roots = ['sessions', 'archived_sessions'].filter(name => fs.existsSync(path.join(home, name)));
  const files = roots.flatMap(name => inventory(path.join(home, name)).filter(f => f.endsWith('.jsonl')).map(f => path.join(home, name, f)));
  const thread = events.find(e => e.type === 'thread.started')?.thread_id;
  if (!thread || !files.length) throw new Error('Thiếu native session để kiểm role/model');
  // A real home may contain years of history and concurrent runs: select by time AND ancestry.
  const candidates = files.filter(file => fs.statSync(file).mtimeMs >= startedAt).flatMap(file => {
    const text = fs.readFileSync(file, 'utf8');
    const first = text.split('\n', 1)[0];
    let event;
    try { event = JSON.parse(first); } catch { return []; }
    const meta = event.type === 'session_meta' ? event.payload : null;
    if (!meta || !(Date.parse(meta.timestamp || event.timestamp) >= startedAt)) return [];
    return [{ file, text, meta, parent: meta.parent_thread_id || meta.source?.subagent?.thread_spawn?.parent_thread_id }];
  });
  const selected = new Set([thread]);
  for (let previous = -1; previous !== selected.size;) {
    previous = selected.size;
    for (const candidate of candidates) if (selected.has(candidate.parent)) selected.add(candidate.meta.id);
  }
  const current = new Map();
  for (const candidate of candidates.filter(c => selected.has(c.meta.id))) {
    const { meta, text } = candidate;
    const nestedParent = meta.source?.subagent?.thread_spawn?.parent_thread_id;
    if (meta.parent_thread_id && nestedParent && meta.parent_thread_id !== nestedParent) throw new Error('Parent session không nhất quán');
    if (meta.id === thread && fs.realpathSync(meta.cwd) !== fs.realpathSync(room)) throw new Error('Root session sai phòng');
    if (current.has(meta.id) && current.get(meta.id).text !== text) throw new Error('Session ID trùng với nội dung khác');
    current.set(meta.id, candidate);
  }
  const roles = {};
  const roleDir = path.join(room, '.codex/agents');
  if (fs.existsSync(roleDir)) for (const file of fs.readdirSync(roleDir)) {
    const text = fs.readFileSync(path.join(roleDir, file), 'utf8');
    const name = text.match(/^name = (.+)$/m), instruction = text.match(/^developer_instructions = (.+)$/m);
    if (name && instruction) roles[JSON.parse(name[1])] = JSON.parse(instruction[1]);
  }
  const sessions = [];
  fs.mkdirSync(path.join(output, 'sessions'), { recursive: true });
  for (const { text, meta } of [...current.values()].sort((a, b) => a.meta.id.localeCompare(b.meta.id))) {
    const raw = text.split('\n').filter(Boolean).map(JSON.parse);
    const contexts = raw.filter(e => e.type === 'turn_context').map(e => e.payload);
    const developer = raw.filter(e => e.type === 'response_item' && e.payload?.role === 'developer')
      .flatMap(e => e.payload.content || []).map(c => c.text || '').join('\n');
    fs.writeFileSync(path.join(output, 'sessions', `${sessions.length}.jsonl`), text);
    const root = meta?.id === thread;
    const roleVerified = root || Boolean(roles[meta?.agent_role] && developer.includes(roles[meta.agent_role]));
    sessions.push({ threadId: meta?.id, parentThreadId: meta?.parent_thread_id || meta?.source?.subagent?.thread_spawn?.parent_thread_id || null,
      root, role: meta?.agent_role || null, roleVerified, sha256: crypto.createHash('sha256').update(text).digest('hex'),
      valid: roleVerified && contexts.length > 0 && contexts.every(c => c.model === MODEL && c.effort === EFFORT &&
        c.sandbox_policy?.type === 'workspace-write') });
  }
  json(path.join(output, 'capture.json'), { threadId: thread, startedAt, sessions });
  if (!sessions.some(s => s.root) || sessions.some(s => !s.valid)) throw new Error('Native role/model/effort/sandbox không khớp');
}

export function runCell(skill, cell, output, projection, { execute = false, userHome = false } = {}) {
  if (!execute) throw new Error('Cần opt-in execute; không gọi model mặc định');
  if (cell.excludedReason) throw new Error(cell.excludedReason);
  fs.mkdirSync(output, { recursive: true });
  if (fs.readdirSync(output).length) throw new Error('Output phải mới; không ghi đè lượt đã lưu');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-run-'));
  const original = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const home = userHome ? original : path.join(temporary, 'home');
  if (!userHome) fs.mkdirSync(home, { mode: 0o700 });
  try {
    const prepared = buildRoom(skill, cell, projection, path.join(temporary, 'room'));
    if (prepared.historyFile) throw new Error('Chưa có native history replay');
    const { room, prompt } = prepared;
    const config = userHome ? null : `model = "${MODEL}"\nmodel_reasoning_effort = "${EFFORT}"\n[features]\nmulti_agent = true\n[projects.${JSON.stringify(room)}]\ntrust_level = "trusted"\n`;
    if (!userHome) {
      fs.copyFileSync(path.join(original, 'auth.json'), path.join(home, 'auth.json'));
      fs.chmodSync(path.join(home, 'auth.json'), 0o600);
      fs.writeFileSync(path.join(home, 'config.toml'), config, { mode: 0o600 });
    }
    fs.cpSync(room, path.join(output, 'workspace-before'), { recursive: true });
    json(path.join(output, 'initial.json'), prepared);
    const argv = commandFor(room, prompt, path.join(output, 'last.txt'), skill.name === 'research');
    const startedAt = Date.now();
    json(path.join(output, 'invocation.json'), { executable: 'codex', argv, startedAt,
      configuration: userHome ? 'C-user-home-5d' : 'C-clean-home-5d',
      runnerSha256: sha(fileURLToPath(import.meta.url)), cleanHome: !userHome,
      globalAgentsAbsent: !fs.existsSync(path.join(home, 'AGENTS.md')), config });
    const result = spawnSync('codex', argv, { env: { ...process.env, CODEX_HOME: home },
      encoding: 'utf8', timeout: prepared.timeoutSeconds * 1000, maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(path.join(output, 'events.jsonl'), result.stdout || '');
    fs.writeFileSync(path.join(output, 'stderr.txt'), result.stderr || '');
    fs.cpSync(room, path.join(output, 'workspace'), { recursive: true });
    let events = [], parseError;
    try { events = (result.stdout || '').split('\n').filter(Boolean).map(JSON.parse); } catch (error) { parseError = error.message; }
    const last = fs.existsSync(path.join(output, 'last.txt')) ? fs.readFileSync(path.join(output, 'last.txt'), 'utf8') : '';
    const check = executionCheck(events, last, result.stderr || '', result.status, parseError || result.error?.message);
    try { captureSessions(home, output, room, events, startedAt); } catch (error) { check.error ||= error.message; }
    json(path.join(output, 'result.json'), { status: check.error ? 'run_error' : 'completed', exit: result.status,
      requestedModel: MODEL, reasoningEffort: EFFORT, ...check, scored: 0 });
    if (check.error) throw new Error(check.error);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), manifest = readManifest();
    if (!args.includes('--run')) console.log(JSON.stringify({ model: MODEL, reasoningEffort: EFFORT,
      configuration: 'C-clean-home-5d', cells: manifest.skills.flatMap(s => s.cases.map(c => `${s.name}/${c.case}`)) }, null, 2));
    else {
      const value = name => args[args.indexOf(name) + 1];
      if (!args.includes('--only') || !args.includes('--out')) throw new Error('Cần --only skill/case --out <new-directory>');
      const [name, caseName] = value('--only').split('/');
      const skill = manifest.skills.find(s => s.name === name), cell = skill?.cases.find(c => c.case === caseName);
      if (!cell || cell.excludedReason) throw new Error(cell?.excludedReason || 'Không tìm thấy ca');
      const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-run-projection-'));
      try { runCell(skill, cell, path.resolve(value('--out')), installProjection(temporary),
        { execute: true, userHome: args.includes('--user-home') }); }
      finally { fs.rmSync(temporary, { recursive: true, force: true }); }
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
