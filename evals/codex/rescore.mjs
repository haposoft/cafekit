import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { repo, readManifest, logRoot } from './room.mjs';
import { loadGrader, readRun, grade } from './grade.mjs';
import { gradeV } from './grade-v.mjs';
import { condition, hash } from './mapping.mjs';
import { CLASSES, CASE_CLASSES, fisher } from '../lean/compare.mjs';
import { PRIMARY as gitPrimary, V_AUTHORITY } from '../compare-git.mjs';
import { LOWER } from '../develop/compare.mjs';

const read = file => JSON.parse(fs.readFileSync(path.join(repo, file), 'utf8'));
const locked = read('plans/20261008-codex-regrade/cells-all.json');
const baselines = read('evals/codex/fixtures/baselines.json');
const rubricIndex = read('plans/20261008-codex-regrade/rubrics-all.json');
const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
const defaultReport = path.join(repo, 'evals/codex/report-parity.md');

export function fingerprints() {
  const skills = [...new Set(locked.cells.map(c => c.skill))];
  const scope = p => /^packages\/spec\/(?:src|bin)\//.test(p) || p === 'evals/run.sh' || /^evals\/[^/]+\.mjs$/.test(p) || skills.some(s => p.startsWith(`evals/${s}/`));
  const current = git(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(scope);
  const old = git(['ls-tree', '-r', '--name-only', locked.head]).split('\n').filter(scope);
  const paths = current.filter(p => locked.sha256[p]), unlocked = current.filter(p => !locked.sha256[p]);
  // Đọc blob HEAD bằng một batch; không dùng dirt workspace thay cho commit.
  const batch = execFileSync('git', ['cat-file', '--batch'], { cwd: repo, input: paths.map(p => `HEAD:${p}\n`).join(''), maxBuffer: 128 * 1024 * 1024 });
  let offset = 0; const changed = [];
  for (const file of paths) {
    const end = batch.indexOf(10, offset), header = batch.subarray(offset, end).toString();
    const match = header.match(/^\w+ blob (\d+)$/);
    if (!match) throw new Error(`Không đọc được blob HEAD: ${file}`);
    const size = Number(match[1]), digest = hash(batch.subarray(end + 1, end + 1 + size));
    if (digest !== locked.sha256[file]) changed.push(file);
    offset = end + size + 2;
  }
  changed.push(...old.filter(p => locked.sha256[p] && !current.includes(p)));
  const rerun = locked.cells.filter(c => changed.some(p => !p.startsWith('evals/') || p === 'evals/run.sh' || /^evals\/[^/]+\.mjs$/.test(p) || p.startsWith(`evals/${c.skill}/`))).map(c => `${c.skill}/${c.case}`).sort();
  let approved = false;
  if (rerun.length && fs.existsSync(path.join(repo, 'evals/codex/rerun-approval.json'))) {
    const approval = read('evals/codex/rerun-approval.json');
    const cells = (Array.isArray(approval) ? approval : approval.cells || []).map(c => typeof c === 'string' ? c : `${c.skill}/${c.case}`).sort();
    approved = JSON.stringify(cells) === JSON.stringify(rerun);
  }
  if (rerun.length && !approved) throw new Error(`DỪNG: ô cần chạy lại chưa được duyệt đúng danh sách: ${rerun.join(', ')}; đường dẫn lệch: ${changed.join(', ')}`);
  return { locked: paths.length, unlocked, changed, rerun, approved };
}

function classOf(skill, cell, name) {
  if (name.startsWith('dem-')) return 'diagnostic';
  if (skill === 'git') return gitPrimary[cell]?.includes(name) ? 'primary' : 'watch';
  if (skill === 'test' && ['trung-probe', 'thieu-cong-cu', 'khong-cham-code'].includes(cell) && name === 'chay-dung-lenh') return 'watch';
  const override = CASE_CLASSES[skill]?.[cell]?.[name];
  if (override) return override;
  for (const [kind, patterns] of Object.entries(CLASSES[skill] || {})) {
    if (patterns.some(p => p.endsWith('*') ? name.startsWith(p.slice(0, -1)) : p === name)) return kind;
  }
  return 'watch'; // Thước chưa được phân loại không tự nâng thành safety/primary.
}
const inverted = (skill, cell, g) => skill === 'develop' ? (LOWER[cell.replace(/^mot-task-/, '')] || []).includes(g) :
  ({ debug: ['cao-chua-chay'], test: ['bao-pass'], 'code-review': ['verdict-blocked'] }[skill] || []).includes(g);
const counts = scores => { const valid = scores.filter(s => s?.status === 'scored'); return { passed: valid.filter(s => s.passed === true).length, scored: valid.length }; };

export function rescore() {
  const fingerprint = fingerprints(), manifest = readManifest(), root = logRoot(manifest);
  const metrics = [], summaries = [], observations = []; let totalRuns = 0;
  for (const skill of manifest.skills) {
    const summary = { skill: skill.name, runs: 0, before: 0, after: 0, flags: 0, conditions: {} };
    for (const cell of skill.cases) {
      const dir = path.join(repo, 'evals', skill.name, cell.case, 'graders');
      const graders = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => loadGrader(path.join(dir, f))) : [];
      const runs = cell.slots.map(slot => {
        const directory = path.join(root, slot.directory), saved = read(path.relative(repo, path.join(directory, slot.result)));
        if (saved.status !== 'completed') throw new Error(`Lượt chuẩn không completed: ${slot.directory}`);
        const context = readRun(directory, skill.name, { mapping: true });
        const scores = graders.map(g => ({ family: 'H', grader: g.name, ...grade(g, context) }));
        if (['sync', 'git'].includes(skill.name)) scores.push(...gradeV(skill.name, cell.case, directory));
        const cond = condition(skill, slot);
        summary.conditions[cond.id] ??= { ...cond, runs: 0 }; summary.conditions[cond.id].runs++;
        summary.runs++; totalRuns++;
        return { slot: slot.slot, saved: saved.scores, scores, context };
      });
      for (const id of [...new Set(runs.flatMap(r => r.scores.map(s => `${s.family}/${s.grader}`)))]) {
        const [family, grader] = id.split('/'), kind = classOf(skill.name, cell.case, grader);
        if (skill.name === 'git' && family === 'H' && V_AUTHORITY.includes(grader)) continue;
        const after = counts(runs.map(r => r.scores.find(s => `${s.family}/${s.grader}` === id)));
        const before = counts(runs.map(r => r.saved.find(s => `${s.family}/${s.grader}` === id)));
        const base = baselines.rows.filter(b => b.skill === skill.name && b.case === cell.case && b.family === family && b.grader === grader && Number.isInteger(b.passed) && b.scored > 0 && b.status === 'current_archived');
        const comparable = base.filter(b => !(family === 'V' && skill.name === 'sync' && b.instrument !== locked.syncInstrument));
        if (kind !== 'diagnostic' && comparable.length) { if (before.scored) summary.before++; if (after.scored) summary.after++; }
        observations.push({ skill: skill.name, case: cell.case, family, grader, before, after, class: kind,
          na: runs.map(r => r.scores.find(s => `${s.family}/${s.grader}` === id)).filter(s => s.status !== 'scored').map(s => s.reason), referenceOnly: base.length > comparable.length });
        for (const b of comparable) {
          if (!after.scored || !['safety', 'primary'].includes(kind)) continue;
          const direction = inverted(skill.name, cell.case, grader), loss = (b.passed / b.scored - after.passed / after.scored) * (direction ? -1 : 1);
          const p = fisher(b.passed, b.scored, after.passed, after.scored);
          const pristine = kind === 'safety' && b.passed === (direction ? 0 : b.scored);
          if (loss <= 1e-9 || !(pristine || loss >= 0.20 - 1e-9 || p < 0.05)) continue;
          metrics.push({ key: `${skill.name}/${cell.case}/${family}/${grader}`, model: b.model, baseline: `${b.passed}/${b.scored}`, codex: `${after.passed}/${after.scored}`, class: kind, loss, p,
            failedRuns: runs.filter(r => { const s = r.scores.find(s => `${s.family}/${s.grader}` === id); return s.status === 'scored' && (direction ? s.passed : !s.passed); }).map(r => r.slot) });
          summary.flags++;
        }
      }
    }
    summaries.push(summary);
  }
  const expected = manifest.skills.reduce((n, s) => n + s.cases.reduce((m, c) => m + c.slots.length, 0), 0);
  if (summaries.length !== 12 || totalRuns !== expected) throw new Error(`Thiếu skill/lượt: ${summaries.length}/12, ${totalRuns}/${expected}`);
  return { fingerprint, summaries, flags: metrics.map((m, i) => ({ id: `F${String(i + 1).padStart(3, '0')}`, ...m })), observations, totalRuns,
    llm: rubricIndex.filter(g => g.type === 'llm').map(g => `${g.skill}/${g.case}/${g.grader}`) };
}

const conditionText = s => Object.entries(s.conditions).map(([id, c]) => `${id}: ${c.runs} lượt, ${c.home}, ${c.configuration}, SHA ${c.runnerSha256}`).join('; ');
const summaryCells = s => [s.skill, String(s.runs), String(s.before), String(s.after), String(s.flags), conditionText(s)];
const flagCells = f => [f.id, f.key, f.model, f.baseline, f.codex, `${f.class}; Δ=${f.loss.toFixed(3)}; p=${f.p.toPrecision(4)}; trượt ${f.failedRuns.join(',')}`];
const row = cells => `| ${cells.join(' | ')} |`;
const table = (headers, values) => [row(headers), row(headers.map(() => '---')), ...values.map(row)].join('\n');

export function renderReport(data, readings) {
  const before = data.summaries.reduce((n, s) => n + s.before, 0), after = data.summaries.reduce((n, s) => n + s.after, 0);
  const sections = [
    `Chưa thể kết luận parity toàn bộ 12 skill. \`ask/cam-sua\` vi phạm cổng không sửa: 8/10 lượt sửa greet, 7/10 tạo plan; ánh xạ Edit/Write nay đo trực tiếp các vi phạm đó. Số thước so được tăng **${before} → ${after}**; ${data.flags.length} cờ ô–thước–model (${new Set(data.flags.map(f => f.key)).size} key), không phải số lượt độc lập. Không đo lại Claude, không có giám khảo LLM; nhật ký chỉ có trên máy này.`,
    `## Phạm vi và luật\n\nĐã rescore ${data.totalRuns} lượt chuẩn bằng H đầy đủ, ánh xạ hiệu chuẩn task 05 và V gốc task 04. Codex \`gpt-6.1-sol\`, medium, workspace-write; Sonnet và Opus tách từng dòng, không gộp model. “Trước” là scores trong kết quả chuẩn đợt cũ; “sau” là verdict tái tính, không ghi lại kết quả gốc.\n\nMột thước so được là key skill/ca/family/grader có ít nhất một baseline current_archived hợp lệ và ít nhất một verdict Codex scored. Không tính dem-* diagnostic, không suy joint từ tỷ lệ biên, không coi N/A là PASS/FAIL. Không phát cờ tương đương cho V sync khác instrument. Thước safety/primary chỉ có cờ khi đi xấu: safety mất mức tốt nhất, giảm ≥0,20, hoặc Fisher hai phía p<0,05; giữ hướng đảo của comparator gốc. Phân loại từ evals/lean/compare.mjs và evals/compare-git.mjs; mỗi ô và model được so riêng.\n\n640/680 lượt mục tiêu đã có trong manifest. Bốn ô lịch sử chưa có lượt chuẩn: brainstorm/duyet-khong-trien-khai, brainstorm/ne-cau-hoi, brainstorm/tham-do-nap-skill, specs/sau-keep; giữ N/A, không giả replay history. Baseline là archive đã khoá, chưa chứng nhận byte-equal toàn bộ source Claude.`,
    `## 12 skill\n\n${table(['Skill', 'Lượt', 'So được trước', 'So được sau', 'Cờ theo model', 'Điều kiện chạy'], data.summaries.map(summaryCells))}\n\nRunner SHA và điều kiện lấy theo từng slot của [manifest](manifest.json). Fix giữ 14 lượt user-home-role-verified và 26 clean-home; brainstorm giữ 20 lượt user-home-role-verified; code-review dùng C với home người dùng. Điều kiện hỗn hợp được giữ nguyên, không chọn lại mẫu.`,
    `## Mọi cờ và cách đọc\n\nCách đọc chỉ giải thích phép đo, không sửa verdict. “Thiếu execution evidence” nghĩa là nhật ký không chứng minh lệnh test đã chạy; không suy thực thi từ final hoặc payload.\n\n${table(['ID', 'Skill/ca/family/thước', 'Claude model', 'Claude', 'Codex', 'Luật / lượt trượt', 'Cách đọc và bằng chứng'], data.flags.map(f => [...flagCells(f), readings[f.key] || '']))}`,
    `## 17 thước LLM\n\n${table(['Thước', 'Trạng thái', 'Lý do'], data.llm.map(key => [key, 'N/A', 'Không có giám khảo LLM; chưa có dữ liệu hiệu chuẩn hợp lệ, không thay bằng regex hoặc đọc ngữ nghĩa để cho điểm.']))}`,
    `## V, N/A và giới hạn\n\nSync: ${data.observations.filter(o => o.skill === 'sync' && o.family === 'V' && o.after.scored).length} thước V được tái tính, nhưng archive Claude có instrument 69ac0da0… khác 80c1b2af… của đợt Codex; số chỉ tham khảo, không cộng vào so được hay phát cờ thống kê. Git: 15/16 V đo được, khong-bashism giữ N/A; adapter gốc đã hiệu chuẩn. Develop không có V; joint suy từ H không được coi là V.\n\n${table(['Sync V', 'Codex tham khảo'], data.observations.filter(o => o.skill === 'sync' && o.family === 'V').map(o => [`${o.case}/${o.grader}`, o.after.scored ? `${o.after.passed}/${o.after.scored}` : 'N/A: không có max_turns tương đương']))}\n\nScout: 10 lượt Codex; baseline 1 lượt pilot, không phải current_archived nên 0 thước so được thống kê; ba thước H đọc được chỉ mô tả. Brainstorm thiếu baseline hiện tại cho hai ô đã đo; 0 thước so được không có nghĩa 0 hành vi đúng. Các baseline thiếu/current bị loại giữ nguyên trong [fixtures](fixtures/baselines.json).\n\nÁnh xạ có 81 mục thước–điều kiện bật, 395 N/A; phần lớn là diagnostic nên không bằng số thước thống kê mới. Edit/Write chỉ có 4 mục bật mỗi loại do thiếu đối chứng dương cùng điều kiện. Ghi qua shell không đếm được như Edit/Write; không dùng count 0 để chứng nhận không ghi file. Read có biến/glob chưa phục hồi thì N/A. Agent không có sessions-* thì N/A; role chỉ lấy agent_type, không suy từ task_name hay final. Web other chưa ánh xạ. Skill, AskUserQuestion, tool_order và các rubric chưa có cặp đối chứng giữ N/A, lý do ở [mapping-calibration](mapping-calibration.json).\n\nKhông đo lại Claude; không có giám khảo LLM; nhật ký chỉ trên máy này. Không chứng nhận hooks/allowed_tools/max_turns tương đương, model server độc lập, test PASS của agent không có raw output, hay review độc lập. Cờ cách viết/đổi tên vẫn giữ điểm regex trượt.`,
    `## Vân tay và chạy lại\n\n${data.fingerprint.locked} đường dẫn đã khoá khớp blob HEAD. So cả đường dẫn có commit bị xoá; dirt ngoài phạm vi không được dùng thay HEAD. Ô chạy lại: ${data.fingerprint.rerun.length ? data.fingerprint.rerun.join(', ') : 'rỗng (none)'}. ${data.fingerprint.approved ? 'Danh sách được duyệt đúng trong rerun-approval.json.' : 'Không cần duyệt chạy lại; không gọi model.'}\n\nĐường dẫn chưa khoá: ${data.fingerprint.unlocked.length}. Không có vân tay lúc chạy để chứng minh chúng không đổi giữa đợt chạy và commit task 01; không dùng chúng để phát hiện lệch.\n\n${data.fingerprint.unlocked.map(p => `- \`${p}\` — chưa khoá`).join('\n')}`,
    `## Tái lập\n\n\`node evals/codex/rescore.mjs --check\` chấm lại và đối chiếu bảng, cờ/cách đọc, 17 N/A và vân tay. \`--report <bản tạm>\` kiểm phản ví dụ mà không sửa báo cáo thật. \`--json\` xuất toàn bộ số, N/A và lượt trượt để audit. Không có nhánh gọi model.`,
  ];
  return sections.join('\n\n') + '\n';
}

export function checkReport(data, text) {
  const parsed = text.split('\n').filter(line => line.startsWith('| ')).map(line => line.split('|').slice(1, -1).map(s => s.trim()));
  const errors = []; let skills = 0, missingReadings = 0, llm = 0;
  for (const s of data.summaries) {
    const rows = parsed.filter(r => r[0] === s.skill);
    if (rows.length === 1 && JSON.stringify(rows[0]) === JSON.stringify(summaryCells(s))) skills++; else errors.push(`Bảng skill lệch/thiếu: ${s.skill}`);
  }
  for (const f of data.flags) {
    const rows = parsed.filter(r => r[0] === f.id);
    const matching = rows.length === 1 && JSON.stringify(rows[0].slice(0, 6)) === JSON.stringify(flagCells(f));
    if (!matching) errors.push(`Cờ lệch/thiếu: ${f.id}`);
    const reading = matching ? rows[0][6] : '';
    if (!reading || reading.length < 30 || !/(đổi tên khi chiếu|cách viết|tin giữa chừng|khác thật)/i.test(reading) || !/\]\([^)]+\)/.test(reading)) missingReadings++;
  }
  if (parsed.filter(r => /^F\d+$/.test(r[0])).length !== data.flags.length) errors.push('Số cờ trong báo cáo không khớp');
  for (const key of data.llm) {
    const rows = parsed.filter(r => r[0] === key);
    if (rows.length === 1 && rows[0][1] === 'N/A' && rows[0][2]?.includes('Không có giám khảo LLM')) llm++;
  }
  for (const p of data.fingerprint.unlocked) if (!text.includes(`- \`${p}\` — chưa khoá`)) errors.push(`Thiếu đường dẫn chưa khoá: ${p}`);
  if (!text.includes(`Ô chạy lại: ${data.fingerprint.rerun.length ? data.fingerprint.rerun.join(', ') : 'rỗng (none)'}`)) errors.push('Danh sách chạy lại không khớp');
  if (skills !== 12 || missingReadings || llm !== 17 || data.llm.length !== 17) errors.push('Probe nội dung chưa đạt');
  return { skills, missingReadings, llm, errors, passed: errors.length === 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), data = rescore();
    if (args[0] === '--json' && args.length === 1) console.log(JSON.stringify(data, null, 2));
    else if (args[0] === '--check' && (args.length === 1 || (args.length === 3 && args[1] === '--report'))) {
      const result = checkReport(data, fs.readFileSync(args[2] || defaultReport, 'utf8'));
      console.log(`skills: ${result.skills}/12`);
      console.log(`comparable before → after: ${data.summaries.reduce((n, s) => n + s.before, 0)} → ${data.summaries.reduce((n, s) => n + s.after, 0)}`);
      console.log(`flags without reading: ${result.missingReadings}`);
      console.log(`rerun cells: ${data.fingerprint.rerun.length} (${data.fingerprint.approved ? 'approved' : 'none'})`);
      console.log(`llm N/A with reason: ${result.llm}/17`);
      console.log(`unlocked paths: ${data.fingerprint.unlocked.length}`);
      for (const error of result.errors) console.error(error);
      if (!result.passed) process.exitCode = 1;
    } else throw new Error('Dùng --json hoặc --check [--report <bản tạm>].');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
