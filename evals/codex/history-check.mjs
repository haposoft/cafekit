import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { repo } from './room.mjs';
import { readRun, inventory, loadGrader, grade, commands } from './grade.mjs';
import { flags, hashFor, parseVote } from './llm-judge-prompt.mjs';
const require = createRequire(import.meta.url), YAML = require('yaml');
const { normalizeCodexBody } = require('../../packages/spec/bin/lib/codex-install.js');
const logs = path.join(os.homedir(), 'Desktop/cafekit-codex-eval');
export const defaultRoot = path.join(logs, 'history');
export const cells = ['specs/sau-keep', 'brainstorm/duyet-khong-trien-khai', 'brainstorm/ne-cau-hoi', 'brainstorm/tham-do-nap-skill'];
const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const events = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const list = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => /^\d+(?:\.attempt-\d+)?$/.test(n)) : [];
const tree = dir => inventory(dir).filter(f => fs.statSync(path.join(dir, f)).isFile());
const changed = (before, after, pattern) => [...new Set([...tree(before), ...tree(after)])].filter(f => pattern.test(f) && read(path.join(before, f)) !== read(path.join(after, f)) || pattern.test(f) && fs.existsSync(path.join(before, f)) !== fs.existsSync(path.join(after, f)));
const inside = (base, target) => typeof target === 'string' && !path.isAbsolute(path.relative(base, target)) && !/^\.\.(?:\/|$)/.test(path.relative(base, target));
const content = payload => typeof payload?.content === 'string' ? payload.content : (payload?.content || []).map(c => c.text || '').join('\n');
const question = text => /\?\s*[*_`"'\])]*$/.test(text.trim());
function expectedPrompts(cell) {
  const dir = path.join(repo, 'evals', cell), spec = YAML.parse(read(path.join(dir, 'case.yaml')));
  const first = events(path.join(dir, spec.context.history_file)).find(e => e.type === 'user' && !e.isMeta).message.content;
  const name = first.match(/<command-name>(.*?)<\/command-name>/s)?.[1], args = first.match(/<command-args>(.*?)<\/command-args>/s)?.[1] || '';
  return [normalizeCodexBody(name ? `${name} ${args}` : first), normalizeCodexBody(spec.execution.prompt)];
}
function validate(directory, cell) {
  const result = json(path.join(directory, 'result.json')), inv = json(path.join(directory, 'invocation.json')), initial = json(path.join(directory, 'initial.json'));
  if (result.status !== 'completed' || result.exit !== 0) throw new Error(result.error || result.status);
  if (result.requestedModel !== 'gpt-6.1-sol' || result.reasoningEffort !== 'medium' || inv.cleanHome !== true || inv.configuration !== 'C-clean-home-5d' || inv.historyTwoTurn !== true) throw new Error('Sai điều kiện chạy hai lượt/home/model');
  const [p1, p2] = expectedPrompts(cell), e1 = events(path.join(directory, 'turn1-events.jsonl')), e2 = events(path.join(directory, 'events.jsonl'));
  const ids1 = e1.filter(e => e.type === 'thread.started').map(e => e.thread_id), ids2 = e2.filter(e => e.type === 'thread.started').map(e => e.thread_id), id = ids1[0];
  const resume = inv.argv?.indexOf('resume');
  if (!id || ids1.length !== 1 || ids2.length !== 1 || ids2[0] !== id || resume < 1 || inv.argv[resume + 1] !== id || inv.argv[0] !== 'exec' || inv.turn1Argv?.[0] !== 'exec' || inv.turn1Argv.includes('resume') || inv.turn1Argv.at(-1) !== p1 || inv.argv.at(-1) !== p2 || initial.promptTurn1 !== p1 || initial.prompt !== p2) throw new Error('Sai prompt/argv/thread hai lượt');
  const capture = json(path.join(directory, 'capture.json'));
  if (capture.threadId !== id || !capture.sessions?.some(s => s.root && s.threadId === id) || !capture.sessions.every(s => s.valid === true)) throw new Error('Capture không hợp lệ');
  const sessionDir = path.join(directory, 'sessions'), files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.jsonl'));
  const sessions = files.map(f => { const text = read(path.join(sessionDir, f)), raw = events(path.join(sessionDir, f)); return { raw, hash: crypto.createHash('sha256').update(text).digest('hex'), id: raw.find(e => e.type === 'session_meta')?.payload?.id }; });
  if (sessions.length !== capture.sessions.length || capture.sessions.some(s => !sessions.some(raw => raw.id === s.threadId && raw.hash === s.sha256))) throw new Error('Session khác capture');
  for (const s of sessions) {
    const contexts = s.raw.filter(e => e.type === 'turn_context').map(e => e.payload);
    if (!contexts.length || contexts.some(c => !inside(initial.room, c.cwd) || (c.workspace_roots || []).some(root => !inside(initial.room, root)) || c.model !== 'gpt-6.1-sol' || c.effort !== 'medium' || c.sandbox_policy?.type !== 'workspace-write')) throw new Error('Native cwd/model/effort/sandbox ngoài điều kiện');
  }
  const root = sessions.find(s => s.id === id)?.raw || [], contexts = root.filter(e => e.type === 'turn_context');
  const users = root.filter(e => e.type === 'response_item' && e.payload?.role === 'user').map(e => content(e.payload));
  const contextKept = contexts.length >= 2 && [p1, p2].every(prompt => users.some(text => text === prompt || text.includes(prompt)));
  if (!contextKept) throw new Error('Không giữ đủ hai prompt/turn_context');
  const boundary = root.findIndex(e => e.type === 'response_item' && e.payload?.role === 'user' && content(e.payload).includes(p2));
  return { contextKept, nativeTurn1: root.slice(0, boundary), nativeTurn2: root.slice(boundary), initial, result, capture, e1, e2 };
}
function judge(directory, slot, version) {
  const plan = path.join(directory, 'workspace/specs/google-login/plan.md');
  if (!fs.existsSync(plan)) return { status: 'scored', passed: false, reason: 'missing file' };
  const body = read(path.join(repo, 'evals/specs/sau-keep/graders/moi-ac-co-task.md')).match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)([\s\S]*)$/)?.[1];
  const votes = [1, 2, 3].map(n => {
    const file = path.join(logs, 'llm-judge/history/specs/sau-keep/moi-ac-co-task', slot, `vote-${n}.json`), cache = json(file);
    if (cache.exit !== 0 || cache.version !== version || cache.hash !== hashFor(body, read(plan), version) || JSON.stringify(cache.argv) !== JSON.stringify(flags)) throw new Error(`Cache giám khảo lệch: ${file}`);
    return parseVote(cache.stdout).pass;
  });
  return { status: 'scored', passed: votes.filter(Boolean).length >= 2 };
}
export function brainstormTurn1Match(cell, last, native = []) {
  if (cell.endsWith('ne-cau-hoi')) {
    const option = /(?:LRU|in-process|Redis|index|chỉ mục)/i;
    const labels = (last.match(/(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?(?:[ABC][.):\s]|[123][.)]\s|(?:LRU|[Ii]n-process|Redis|[Ii]ndex|[Cc]hỉ mục)\b)[^\n]*/g) || []).filter(line => option.test(line));
    const declarations = (last.match(/[^.!?\n]+[.!?]?/g) || []).filter(sentence => !sentence.trim().endsWith('?'));
    const chosen = declarations.some(sentence => /(?:đã chọn|quyết định dùng|(?:mình|tôi) chọn|I choose|I pick)|(?:chọn|chốt(?: dùng)?|choose|pick)\s+(?:\*\*)?(?:LRU|in-process|Redis|index|chỉ mục)\b/i.test(sentence));
    return labels.length >= 2 && question(last) && !chosen;
  }
  return native.some(e => {
    const p = e.payload;
    if (e.type !== 'response_item' || !(p?.role === 'user' || ['function_call_output', 'custom_tool_call_output'].includes(p?.type))) return false;
    const text = content(p) + (typeof p.output === 'string' ? p.output : Array.isArray(p.output) ? p.output.map(c => c.text || '').join('\n') : '');
    const block = text.match(/<HARD-GATE>([\s\S]*?)<\/HARD-GATE>/)?.[1];
    return /cf-brainstorm/.test(text) && Boolean(block?.trim());
  });
}
function score(directory, cell, slot, evidence, getVersion) {
  const context = readRun(directory, cell.split('/')[0]);
  context.initialFiles = inventory(path.join(directory, 'workspace-turn1'));
  const turn1Last = read(path.join(directory, 'turn1-last.txt')), before = path.join(directory, 'workspace-before'), turn1 = path.join(directory, 'workspace-turn1');
  let turn1Match;
  if (cell === 'specs/sau-keep') turn1Match = ['EXPAND', 'KEEP', 'CUT'].every(w => new RegExp(`\\b${w}\\b`).test(turn1Last)) && changed(before, turn1, /^(src|specs)\//).length === 0;
  else if (cell.endsWith('duyet-khong-trien-khai')) {
    const g = loadGrader(path.join(repo, 'evals', cell, 'graders/co-hop-dong.md'));
    turn1Match = new RegExp(g.pattern, g.flags || '').test(turn1Last) && question(turn1Last) && /(?:duyệt|đồng ý|chấp thuận|approve|approval|ổn|được|chốt)[^?]*\?\s*[*_`"'\])]*$/i.test(turn1Last.trim());
  } else turn1Match = brainstormTurn1Match(cell, turn1Last, evidence.nativeTurn1);
  const scores = fs.readdirSync(path.join(repo, 'evals', cell, 'graders')).filter(f => f.endsWith('.md') && !f.startsWith('dem-')).map(file => {
    const name = file.slice(0, -3);
    try {
      const g = loadGrader(path.join(repo, 'evals', cell, 'graders', file));
      if (name === 'bao-goi-specs') return { name, status: 'untransferred', reason: 'N/A cấu trúc: installer đổi cf: thành cf-' };
      return { name, ...(name === 'moi-ac-co-task' ? judge(directory, slot, fs.existsSync(path.join(context.root, 'specs/google-login/plan.md')) ? getVersion() : '') : grade(g, context)) };
    } catch (error) { return { name, status: 'untransferred', reason: `N/A: ${error.message}`, cacheError: name === 'moi-ac-co-task' }; }
  });
  const fixtureChanged = changed(turn1, context.root, /^(src|bin)\//);
  const add = (name, passed, extra = {}) => scores.push({ name, status: 'scored', passed, ...extra });
  add('turn2-fixture-changed', fixtureChanged.length > 0, { paths: fixtureChanged });
  if (/duyet-khong-trien-khai|ne-cau-hoi/.test(cell)) {
    add('native-cf-specs-mentioned', /\$?cf-specs\b/.test(context.last));
    const readPath = /\.agents\/skills\/cf-(?:specs|develop)\/SKILL\.md/, readCommand = /\b(?:cat|head|tail|sed|rg|readFileSync|read_text)\b/;
    const stdoutRead = context.stdoutEvents.some(e => e.item?.type === 'command_execution' && readPath.test(e.item.command || '') && readCommand.test(e.item.command || '') && /name: cf-(?:specs|develop)\b/.test(e.item.aggregated_output || ''));
    const nativeRead = evidence.nativeTurn2.some(e => e.type === 'response_item' && e.payload?.type === 'function_call' && readPath.test(e.payload.arguments || '') && readCommand.test(e.payload.arguments || '') && evidence.nativeTurn2.some(o => o.payload?.type === 'function_call_output' && o.payload.call_id === e.payload.call_id && /name: cf-(?:specs|develop)\b/.test(JSON.stringify(o.payload.output || ''))));
    add('turn2-read-specs-develop', stdoutRead || nativeRead);
  }
  if (cell.endsWith('tham-do-nap-skill')) { const count = commands(context.events).length; add('turn2-command-execution-zero', count === 0, { count }); }
  return { slot: Number(slot), directory, ...evidence, turn1Last, last: context.last, turn1Match, scores };
}
export function measure(root = defaultRoot) {
  const data = { cells: [], excluded: [], errors: [], runs: 0, invocations: 0 };
  let version; const getVersion = () => version ||= execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim();
  const count = directory => {
    data.runs++;
    try { const result = json(path.join(directory, 'result.json')); if (Number.isInteger(result.codexInvocations)) { data.invocations += result.codexInvocations; return; } } catch {}
    try { const inv = json(path.join(directory, 'invocation.json')); data.invocations += Number(Array.isArray(inv.turn1Argv)) + Number(Array.isArray(inv.argv)); } catch {}
  };
  for (const cell of cells) {
    const dir = path.join(root, cell), runs = [];
    for (const slot of list(dir)) {
      const directory = path.join(dir, slot); count(directory);
      try {
        const evidence = validate(directory, cell);
        if (slot.includes('.attempt-')) { data.errors.push(`${cell}/${slot}: attempt hợp lệ bị loại`); throw new Error('attempt hợp lệ bị loại'); }
        if (+slot < 1 || +slot > 10) throw new Error('slot ngoài 1..10');
        const scored = score(directory, cell, slot, evidence, getVersion);
        for (const s of scored.scores.filter(s => s.cacheError)) data.errors.push(`${cell}/${slot} ${s.name}: ${s.reason}`);
        runs.push(scored);
      } catch (error) { data.excluded.push({ run: `${cell}/${slot}`, reason: error.message }); }
    }
    if (runs.length !== 10) data.errors.push(`${cell}: runs ${runs.length}/10`);
    data.cells.push({ cell, runs });
  }
  for (const slot of list(path.join(logs, 'history-preflight'))) count(path.join(logs, 'history-preflight', slot));
  if (data.runs > 50) data.errors.push(`runs ${data.runs}/50 vượt trần`);
  return data;
}
export function print(data) {
  const baselines = json(path.join(repo, 'evals/codex/fixtures/baselines.json')).rows;
  for (const c of data.cells) {
    const matching = c.runs.filter(r => r.turn1Match), m = matching.length;
    console.log(`${c.cell}: runs ${c.runs.length}/10`);
    console.log(`${c.cell}: context-kept ${c.runs.filter(r => r.contextKept).length}/10`);
    console.log(`${c.cell}: turn1-match ${m}/10`);
    const names = [...new Set(c.runs.flatMap(r => r.scores.map(s => s.name)))];
    for (const name of names) {
      const scores = c.runs.map(r => r.scores.find(s => s.name === name)), matches = matching.map(r => r.scores.find(s => s.name === name));
      const na = [...new Set(scores.filter(s => s.status !== 'scored').map(s => s.reason))];
      const passed = scores.filter(s => s.passed).length, mp = matches.filter(s => s.passed).length;
      if (scores.every(s => s.status !== 'scored')) { console.log(`${c.cell} ${name}: match N/A; all N/A; ${na.join('; ')}`); continue; }
      console.log(`${c.cell} ${name}: ${m < 5 ? 'match không đo được (lượt 1 lệch kịch bản)' : `match ${mp}/${m}`}; all ${passed}/10${name === 'moi-ac-co-task' ? ' (judge, uncalibrated)' : ''}${na.length ? `; ${na.join('; ')}` : ''}`);
      for (const reason of [...new Set(scores.filter(s => s.reason === 'missing file').map(s => s.reason))]) console.log(`${c.cell} ${name}: FAIL ${reason}`);
    }
    for (const b of baselines.filter(b => `${b.skill}/${b.case}` === c.cell && b.status === 'current_small_sample' && !b.grader.startsWith('dem-') && Number.isInteger(b.passed) && b.scored > 0)) console.log(`claude ${c.cell} ${b.grader} ${b.reported_model || b.model}: ${b.passed}/${b.scored} (current_small_sample, không so được)`);
  }
  for (const e of data.excluded) console.log(`excluded: ${e.run}: ${e.reason}`);
  for (const e of data.errors) console.error(e);
  console.log(`calls: ${data.invocations} Codex CLI`);
  console.log(`runs: ${data.runs}/50; codex invocations: ${data.invocations}`);
  console.log(`verdict: ${data.errors.length ? 'INCOMPLETE' : 'DESCRIBED'}`);
  return !data.errors.length;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const args = process.argv.slice(2); if (args.length && (args.length !== 2 || args[0] !== '--log-root')) throw new Error('Dùng [--log-root <dir>]'); if (!print(measure(args[1] ? path.resolve(args[1]) : defaultRoot))) process.exitCode = 1; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
