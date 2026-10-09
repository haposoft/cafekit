import fs from 'node:fs';
import path from 'node:path';
import { commands, inventory, readRun } from './grade.mjs';
import { GRADERS as syncGraders, copyWorkspace } from '../sync/verify-run.mjs';
import { GRADERS as gitGraders, repairedCopy } from '../git/verify-run.mjs';

export const registries = { sync: syncGraders, git: gitGraders };
const jsonl = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

// Chiếu văn bản quan sát được cho extractor gốc; không khẳng định có tool Claude.
function gitTextEvents(directory, events, last) {
  const capture = JSON.parse(fs.readFileSync(path.join(directory, 'capture-git.json'), 'utf8'));
  const projected = [];
  for (const session of capture.sessions) {
    // Dùng bản capture thuộc slot, kể cả khi nhật ký được chép sang vị trí khác.
    const file = path.join(directory, 'sessions-git', path.basename(session.file));
    for (const event of jsonl(file)) {
      const message = event.payload;
      if (event.type !== 'response_item' || message?.type !== 'message' || message.role !== 'assistant') continue;
      const text = message.content.filter(c => ['output_text', 'text'].includes(c.type)).map(c => c.text).join('\n');
      projected.push({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
    }
  }
  for (const event of events) projected.push({ type: 'user', message: { content: [
    { type: 'tool_result', content: event.item.aggregated_output || '' },
  ] } });
  projected.push({ type: 'assistant', message: { content: [{ type: 'text', text: last }] } });
  return projected;
}

export function gradeV(skill, caseName, directory) {
  const registry = registries[skill]?.[caseName];
  if (!registry) throw new Error(`Không có thước V gốc: ${skill}/${caseName}`);
  const run = readRun(directory, skill);
  const copy = skill === 'sync' ? copyWorkspace(run.root) : repairedCopy(run.root);
  try {
    let context;
    if (skill === 'sync') {
      const completed = run.events.filter(e => e.type === 'item.completed' && e.item?.type === 'command_execution');
      const calls = commands(run.events).map((command, i) => ({ id: completed[i].item.id,
        command: command.command, result: typeof completed[i].item.aggregated_output === 'string'
          ? completed[i].item.aggregated_output : null }));
      const box = path.join(copy.ws, 'box'), shim = path.join(box, '.eval/shim.log');
      context = { ws: copy.ws, box, events: run.events, calls, finalText: run.last,
        shimLog: fs.existsSync(shim) ? fs.readFileSync(shim, 'utf8') : '' };
    } else {
      const shimLog = inventory(copy.ws).filter(file => path.basename(file) === 'shim.log')
        .map(file => fs.readFileSync(path.join(copy.ws, file), 'utf8')).join('');
      context = { ws: copy.ws, events: gitTextEvents(directory, run.events, run.last),
        commands: commands(run.events).map(c => c.command), shimLog };
    }
    return Object.entries(registry).map(([grader, check]) => {
      // Giữ N/A của adapter cũ: Codex không có max_turns Claude và chưa có exact Write/Edit.
      if (grader === 'khong-cham-tran' || (skill === 'git' && grader === 'khong-bashism')) {
        return { grader, family: 'V', status: 'untransferred', reason: grader === 'khong-cham-tran'
          ? 'Không có sự kiện giới hạn max_turns tương đương Claude.' : 'Chưa phục hồi exact Write/Edit cho writtenTexts.' };
      }
      // Lỗi prerequisite phải chặn replay; tuyệt đối không biến lỗi adapter thành verdict.
      return { grader, family: 'V', status: 'scored', passed: Boolean(check(context)) };
    });
  } finally { copy.cleanup(); }
}
