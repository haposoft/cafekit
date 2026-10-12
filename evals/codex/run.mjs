import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { repo, readManifest, installProjection, buildRoom, inventory } from './room.mjs';

const require = createRequire(import.meta.url), YAML = require('yaml');
const { normalizeCodexBody } = require('../../packages/spec/bin/lib/codex-install.js');

export const MODEL = 'gpt-6.1-sol';
export const EFFORT = 'medium';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

export function historyTurn1(skill, cell) {
  const directory = path.join(repo, 'evals', skill.name, cell.case);
  const spec = YAML.parse(fs.readFileSync(path.join(directory, 'case.yaml'), 'utf8'));
  if (!spec.context?.history_file) throw new Error('Ô không có history_file');
  const first = fs.readFileSync(path.join(directory, spec.context.history_file), 'utf8').split('\n').filter(Boolean)
    .map(JSON.parse).find(e => e.type === 'user' && !e.isMeta);
  const content = first?.message?.content;
  const text = typeof content === 'string' ? content : (content || []).map(c => c.text || '').join('\n');
  if (!text.trim()) throw new Error('Thiếu prompt lượt 1');
  const command = text.match(/<command-name>([\s\S]*?)<\/command-name>/)?.[1];
  const args = text.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1];
  if (command && args === undefined) throw new Error('Thiếu command-args');
  return normalizeCodexBody(command ? `${command.trim()} ${args.trim()}` : text);
}

function checkHistoryCapture(output, room, thread, prompt1, prompt2) {
  const contained = cwd => {
    if (typeof cwd !== 'string') return false;
    const relative = path.relative(room, path.resolve(cwd));
    return relative === '' || relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  let root;
  for (const file of fs.readdirSync(path.join(output, 'sessions'))) {
    const raw = fs.readFileSync(path.join(output, 'sessions', file), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    const contexts = raw.filter(e => e.type === 'turn_context').map(e => e.payload);
    if (contexts.some(c => !contained(c.cwd) || c.workspace_roots && !c.workspace_roots.every(contained))) throw new Error('History turn_context ngoài phòng');
    if (raw[0]?.payload?.id === thread) root = raw;
  }
  const users = (root || []).filter(e => e.type === 'response_item' && e.payload?.role === 'user')
    .flatMap(e => e.payload.content || []).map(c => c.text || '');
  if (!root || root.filter(e => e.type === 'turn_context').length < 2 || ![prompt1, prompt2].every(p => users.some(t => t.includes(p)))) throw new Error('History mất ngữ cảnh');
}

function runHistory(prepared, output, home, startedAt, invocation) {
  const { room, prompt, promptTurn1 } = prepared;
  const env = { ...process.env, CODEX_HOME: home };
  let calls = 0;
  const invoke = (argv, prefix) => {
    calls++;
    const result = spawnSync('codex', argv, { cwd: room, env, encoding: 'utf8', timeout: prepared.timeoutSeconds * 1000, maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(path.join(output, `${prefix}events.jsonl`), result.stdout || '');
    fs.writeFileSync(path.join(output, `${prefix}stderr.txt`), result.stderr || '');
    let events = [], parseError;
    try { events = (result.stdout || '').split('\n').filter(Boolean).map(JSON.parse); } catch (e) { parseError = e.message; }
    const file = path.join(output, `${prefix}last.txt`), last = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return { result, events, check: executionCheck(events, last, result.stderr || '', result.status, parseError || result.error?.message) };
  };
  invocation.turn1Argv = commandFor(room, promptTurn1, path.join(output, 'turn1-last.txt'));
  invocation.historyTwoTurn = true;
  json(path.join(output, 'invocation.json'), invocation);
  const first = invoke(invocation.turn1Argv, 'turn1-');
  fs.cpSync(room, path.join(output, 'workspace-turn1'), { recursive: true });
  const thread = first.events.find(e => e.type === 'thread.started')?.thread_id;
  first.check.error ||= !thread ? 'Thiếu thread_id lượt 1' : null;
  let second;
  if (!first.check.error) {
    invocation.argv = [...commandFor(room, prompt, path.join(output, 'last.txt')).slice(0, -3), 'resume', thread, '-o', path.join(output, 'last.txt'), prompt];
    json(path.join(output, 'invocation.json'), invocation);
    second = invoke(invocation.argv, '');
    if (second.events.find(e => e.type === 'thread.started')?.thread_id !== thread) second.check.error ||= 'Lượt 2 khác thread';
  }
  fs.cpSync(room, path.join(output, 'workspace'), { recursive: true });
  const check = { ...(second || first).check };
  try {
    captureSessions(home, output, room, first.events, startedAt);
    if (second) checkHistoryCapture(output, room, thread, promptTurn1, prompt);
  } catch (error) { check.error ||= error.message; }
  json(path.join(output, 'result.json'), { status: check.error ? 'run_error' : 'completed', exit: (second || first).result.status,
    requestedModel: MODEL, reasoningEffort: EFFORT, ...check, codexInvocations: calls, scored: 0 });
  if (check.error) throw new Error(check.error);
}

export function commandFor(room, prompt, lastFile, research = false, { askGuard = false } = {}) {
  return ['exec', '--json', '-m', MODEL, '-c', `model_reasoning_effort="${EFFORT}"`,
    '-s', 'workspace-write', '-C', room, '--skip-git-repo-check', '--enable', 'multi_agent',
    '-c', `projects.${JSON.stringify(room)}.trust_level="trusted"`,
    ...(research ? ['-c', 'web_search="live"', '-c', 'sandbox_workspace_write.network_access=true'] : []),
    ...(askGuard ? ['--dangerously-bypass-hook-trust'] : []),
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

export function runCell(skill, cell, output, projection, { execute = false, userHome = false, askGuard = false, promptOverride, historyTwoTurn = false } = {}) {
  if (!execute) throw new Error('Cần opt-in execute; không gọi model mặc định');
  if (promptOverride !== undefined && (typeof promptOverride !== 'string' || !promptOverride.trim())) {
    throw new Error('--prompt-override cần một prompt không rỗng');
  }
  const historyPrompt = historyTwoTurn ? historyTurn1(skill, cell) : null;
  if (cell.excludedReason && !historyTwoTurn) throw new Error(cell.excludedReason);
  if (historyTwoTurn && (userHome || askGuard || promptOverride !== undefined)) throw new Error('History chỉ dùng clean home và prompt gốc');
  fs.mkdirSync(output, { recursive: true });
  if (fs.readdirSync(output).length) throw new Error('Output phải mới; không ghi đè lượt đã lưu');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-run-'));
  const original = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const home = userHome ? original : path.join(temporary, 'home');
  if (!userHome) fs.mkdirSync(home, { mode: 0o700 });
  try {
    const prepared = buildRoom(skill, cell, projection, path.join(temporary, 'room'), { askGuard });
    if (promptOverride !== undefined) prepared.prompt = promptOverride;
    if (prepared.historyFile && !historyTwoTurn) throw new Error('Chưa có native history replay');
    if (historyTwoTurn) prepared.promptTurn1 = historyPrompt;
    const { room, prompt } = prepared;
    const config = userHome ? null : `model = "${MODEL}"\nmodel_reasoning_effort = "${EFFORT}"\n[features]\nmulti_agent = true\n[projects.${JSON.stringify(room)}]\ntrust_level = "trusted"\n`;
    if (!userHome) {
      fs.copyFileSync(path.join(original, 'auth.json'), path.join(home, 'auth.json'));
      fs.chmodSync(path.join(home, 'auth.json'), 0o600);
      fs.writeFileSync(path.join(home, 'config.toml'), config, { mode: 0o600 });
    }
    fs.cpSync(room, path.join(output, 'workspace-before'), { recursive: true });
    json(path.join(output, 'initial.json'), prepared);
    const argv = commandFor(room, prompt, path.join(output, 'last.txt'), skill.name === 'research', { askGuard });
    const guardDirectory = path.join(temporary, 'ask-guard');
    const startedAt = Date.now();
    json(path.join(output, 'invocation.json'), { executable: 'codex', argv, startedAt,
      configuration: userHome ? 'C-user-home-5d' : 'C-clean-home-5d',
      runnerSha256: sha(fileURLToPath(import.meta.url)), cleanHome: !userHome,
      globalAgentsAbsent: !fs.existsSync(path.join(home, 'AGENTS.md')), config });
    if (historyTwoTurn) {
      runHistory(prepared, output, home, startedAt, JSON.parse(fs.readFileSync(path.join(output, 'invocation.json'), 'utf8')));
      return;
    }
    const result = spawnSync('codex', argv, { env: { ...process.env, CODEX_HOME: home,
      ...(askGuard ? { CAFEKIT_ASK_GUARD_DIR: guardDirectory } : {}) },
      encoding: 'utf8', timeout: prepared.timeoutSeconds * 1000, maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(path.join(output, 'events.jsonl'), result.stdout || '');
    fs.writeFileSync(path.join(output, 'stderr.txt'), result.stderr || '');
    fs.cpSync(room, path.join(output, 'workspace'), { recursive: true });
    let events = [], parseError;
    try { events = (result.stdout || '').split('\n').filter(Boolean).map(JSON.parse); } catch (error) { parseError = error.message; }
    if (askGuard) {
      const thread = events.find(e => e.type === 'thread.started')?.thread_id;
      const sessionHash = thread && crypto.createHash('sha256').update(thread).digest('hex');
      const denials = sessionHash && path.join(guardDirectory, sessionHash, 'denials.jsonl');
      if (denials && fs.existsSync(denials)) fs.copyFileSync(denials, path.join(output, 'denials.jsonl'));
    }
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
    if (args.includes('--print-history-turn1')) {
      const [name, caseName] = (args[args.indexOf('--print-history-turn1') + 1] || '').split('/');
      const skill = manifest.skills.find(s => s.name === name), cell = skill?.cases.find(c => c.case === caseName);
      if (!cell) throw new Error('Không tìm thấy ca');
      console.log(historyTurn1(skill, cell));
    } else if (!args.includes('--run')) console.log(JSON.stringify({ model: MODEL, reasoningEffort: EFFORT,
      configuration: 'C-clean-home-5d', cells: manifest.skills.flatMap(s => s.cases.map(c => `${s.name}/${c.case}`)) }, null, 2));
    else {
      const value = name => args[args.indexOf(name) + 1];
      if (!args.includes('--only') || !args.includes('--out')) throw new Error('Cần --only skill/case --out <new-directory>');
      if (args.includes('--prompt-override') && (!value('--prompt-override') || value('--prompt-override').startsWith('--'))) {
        throw new Error('--prompt-override cần một prompt không rỗng');
      }
      const [name, caseName] = value('--only').split('/');
      const skill = manifest.skills.find(s => s.name === name), cell = skill?.cases.find(c => c.case === caseName);
      if (!cell || cell.excludedReason && !args.includes('--history-two-turn')) throw new Error(cell?.excludedReason || 'Không tìm thấy ca');
      const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-run-projection-'));
      try { runCell(skill, cell, path.resolve(value('--out')), installProjection(temporary),
        { execute: true, userHome: args.includes('--user-home'), askGuard: args.includes('--ask-guard'),
          promptOverride: args.includes('--prompt-override') ? value('--prompt-override') : undefined,
          historyTwoTurn: args.includes('--history-two-turn') }); }
      finally { fs.rmSync(temporary, { recursive: true, force: true }); }
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
