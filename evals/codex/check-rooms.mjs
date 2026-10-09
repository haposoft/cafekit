import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readManifest, logRoot, repo, installProjection, buildRoom, inventory } from './room.mjs';

function validateRunCondition(slot, skill, root) {
  const condition = slot.runCondition;
  if (!condition?.evidence?.path || !['C', 'ignore-user-config'].includes(condition.configuration)) return false;
  const resolveEvidence = file => path.join(file.startsWith('plans/') ? repo : root, file);
  const file = resolveEvidence(condition.evidence.path);
  if (!fs.existsSync(file) || condition.report !== skill.conditions.evidence ||
    !fs.existsSync(resolveEvidence(condition.report))) return false;
  if (file.endsWith('.json') && path.dirname(condition.evidence.path) !== slot.directory) return false;
  const evidence = file.endsWith('.json') ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const contextsValid = session => {
    const contexts = session.turnContexts || session.contexts;
    return contexts?.length > 0 && contexts.every(c => c.model === 'gpt-6.1-sol' &&
      c.effort === 'medium' && c.sandbox?.type === 'workspace-write');
  };
  if (condition.home === 'clean-home') {
    if (condition.evidence.kind === 'clean-home-policy') return evidence?.runnerSha256 === slot.runnerSha256 &&
      evidence.codexHomePolicy === 'temporary-clean-auth-only-no-global-agents';
    return condition.evidence.kind === 'clean-home' && (evidence?.globalAgentsAbsent === true ||
      (evidence?.isolated === true && evidence.globalAgents === false));
  }
  if (condition.home === 'user-home-role-verified') {
    if (condition.evidence.kind !== 'role-model-replay' || !evidence?.sessions?.length) return false;
    if (skill.name === 'fix') return evidence.verified === true && evidence.sessions.every(s =>
      s.models?.length > 0 && s.models.every(m => m === 'gpt-6.1-sol') &&
      s.efforts?.length > 0 && s.efforts.every(e => e === 'medium') &&
      s.reasons?.length === 0 && (s.root || s.projectRoleVerified === true));
    return evidence.sessions.every(s => contextsValid(s) && (s.root || s.brainstormerInstructionsLoaded === true));
  }
  if (condition.home !== 'user-home') return false;
  if (['fix', 'brainstorm'].includes(skill.name)) return false;
  if (skill.name === 'code-review' && !condition.roleModelEvidence) return false;
  if (condition.evidence.kind === 'invocation') {
    if (evidence?.runnerSha256 !== slot.runnerSha256 || !evidence.argv) return false;
    if (evidence.argv.includes('--ignore-user-config') !== (condition.configuration === 'ignore-user-config')) return false;
  } else if (condition.evidence.kind !== 'report' || evidence !== null) return false;
  // Code-review giữ cấu hình người dùng và role thực tế, không suy mọi con là auditor.
  if (condition.roleModelEvidence) {
    if (path.dirname(condition.roleModelEvidence) !== slot.directory) return false;
    const captureFile = resolveEvidence(condition.roleModelEvidence);
    if (!fs.existsSync(captureFile)) return false;
    const capture = JSON.parse(fs.readFileSync(captureFile, 'utf8'));
    if (!capture.sessions?.length || !capture.sessions.every(contextsValid)) return false;
  }
  return true;
}

export function validateManifest(manifest) {
  const expected = { ask: 5, brainstorm: 5, 'code-review': 10, debug: 4, develop: 2,
    fix: 4, git: 4, research: 8, scout: 1, specs: 11, sync: 4, test: 10 };
  const errors = [], seenSkills = new Set(), seenSlots = new Set();
  let duplicateSlots = 0, missingSlots = 0;
  const root = logRoot(manifest);
  if (manifest.model !== 'gpt-6.1-sol' || manifest.reasoningEffort !== 'medium' || manifest.runsPerCell !== 10) {
    errors.push('Sai cấu hình model/effort/slots');
  }
  for (const skill of manifest.skills) {
    if (seenSkills.has(skill.name) || !expected[skill.name]) errors.push(`Skill không hợp lệ: ${skill.name}`);
    seenSkills.add(skill.name);
    const batch = skill.name === 'research' ? 'batch-all-B' : skill.name === 'fix' ? 'batch-all-C' : 'batch-all';
    if (skill.canonicalDirectory !== `${batch}/${skill.name}`) errors.push(`Sai thư mục chuẩn: ${skill.name}`);
    const names = fs.readdirSync(path.join(repo, 'evals', skill.name)).filter(name =>
      fs.existsSync(path.join(repo, 'evals', skill.name, name, 'case.yaml'))).sort();
    if (skill.cases.length !== expected[skill.name] ||
      JSON.stringify(skill.cases.map(cell => cell.case).sort()) !== JSON.stringify(names)) errors.push(`Sai bộ ca: ${skill.name}`);
    const conditions = skill.conditions;
    if (!conditions || !conditions.homeModes?.length || !conditions.configurations?.length ||
      !conditions.runnerSha256?.length || conditions.runnerSha256.some(sha => !/^[a-f0-9]{64}$/.test(sha))) {
      errors.push(`Thiếu điều kiện chạy: ${skill.name}`);
    }
    const source = path.join(repo, conditions.runnerSource);
    if (crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex') !== conditions.runnerSourceSha256) {
      errors.push(`Source runner đã đổi: ${skill.name}`);
    }
    for (const cell of skill.cases) {
      const caseText = fs.readFileSync(path.join(repo, 'evals', skill.name, cell.case, 'case.yaml'), 'utf8');
      const history = /^\s*history_file:/m.test(caseText);
      if (history !== Boolean(cell.excludedReason) || (history && cell.slots.length)) errors.push(`Sai loại history: ${skill.name}/${cell.case}`);
      const seen = new Set();
      for (const slot of cell.slots) {
        const wanted = `${skill.canonicalDirectory}/${cell.case}/${slot.slot}`;
        if (!Number.isInteger(slot.slot) || slot.slot < 1 || slot.slot > 10 || slot.directory !== wanted ||
          !/\/(?:[1-9]|10)$/.test(slot.directory) || /\.attempt-|\.replacement-history-/.test(slot.directory)) {
          errors.push(`Slot không hợp lệ: ${slot.directory}`);
          continue;
        }
        const key = `${skill.name}/${cell.case}/${slot.slot}`;
        if (seenSlots.has(key)) { duplicateSlots++; errors.push(`Slot trùng: ${key}`); }
        seenSlots.add(key); seen.add(slot.slot);
        const directory = path.join(root, slot.directory);
        if (!fs.existsSync(directory) || fs.lstatSync(directory).isSymbolicLink()) {
          errors.push(`Thiếu thư mục slot: ${key}`); continue;
        }
        const regraded = fs.readdirSync(directory).filter(file => /^result-regraded-.*\.json$/.test(file)).sort();
        if (regraded.length > 1) errors.push(`Nhiều kết quả regraded: ${key}`);
        const chosen = regraded[0] || 'result.json';
        if (slot.result !== chosen || !fs.existsSync(path.join(directory, chosen))) errors.push(`Sai kết quả chuẩn: ${key}`);
        if (!conditions.runnerSha256.includes(slot.runnerSha256)) errors.push(`Sai runner SHA: ${key}`);
        const evidenceFile = slot.conditionEvidence.startsWith('plans/')
          ? path.join(repo, slot.conditionEvidence) : path.join(root, slot.conditionEvidence);
        if (!fs.existsSync(evidenceFile)) errors.push(`Thiếu bằng chứng điều kiện: ${key}`);
        else if (evidenceFile.endsWith('.json')) {
          const evidence = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
          if (evidence.runnerSha256 !== slot.runnerSha256) errors.push(`SHA không khớp bằng chứng: ${key}`);
          if (evidence.argv && evidence.argv.includes('--ignore-user-config') !==
            (slot.runCondition?.configuration === 'ignore-user-config')) errors.push(`Cấu hình không khớp: ${key}`);
        }
        if (!validateRunCondition(slot, skill, root) || !conditions.homeModes.includes(slot.runCondition?.home) ||
          !conditions.configurations.includes(slot.runCondition?.configuration)) errors.push(`Thiếu điều kiện chạy kèm bằng chứng hợp lệ: ${key}`);
        for (const file of ['events.jsonl', 'last.txt', 'stderr.txt']) {
          if (!fs.existsSync(path.join(directory, file))) errors.push(`Thiếu ${file}: ${key}`);
        }
      }
      if (!history) for (let n = 1; n <= 10; n++) if (!seen.has(n)) missingSlots++;
    }
  }
  if (seenSkills.size !== 12 || Object.keys(expected).some(name => !seenSkills.has(name))) errors.push('Manifest phải có 12 skill');
  if (missingSlots) errors.push(`Thiếu ${missingSlots} slot`);
  if (errors.length) throw new Error(errors.join('\n'));
  return { duplicateSlots, missingSlots };
}

export function checkRooms(manifest) {
  const stats = validateManifest(manifest);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-check-rooms-'));
  let built = 0;
  try {
    const projection = installProjection(path.join(temporary, 'projection'));
    for (const skill of manifest.skills) for (const cell of skill.cases) {
      const result = buildRoom(skill, cell, projection, path.join(temporary, 'rooms', skill.name, cell.case));
      const actualScripts = inventory(result.room).filter(file => file.startsWith('.codex/scripts/'));
      const wanted = result.scripts.map(file => file.replace('.claude/', '.codex/')).sort();
      if (JSON.stringify(actualScripts) !== JSON.stringify(wanted)) throw new Error(`Sai tập script: ${skill.name}/${cell.case}`);
      for (const file of result.scripts) if (!fs.readFileSync(path.join(result.room, file)).equals(
        fs.readFileSync(path.join(result.room, file.replace('.claude/', '.codex/'))))) throw new Error(`Script lệch byte: ${file}`);
      for (const name of cell.loadedSkills) if (!fs.existsSync(path.join(result.room, '.agents/skills', `cf-${name}`, 'SKILL.md'))) {
        throw new Error(`Thiếu skill installer: ${name}`);
      }
      built++;
    }
    if (built !== 68) throw new Error(`Sai số phòng: ${built}/68`);
    console.log(`rooms: ${built}/68`);
    console.log(`manifest: 12 skills, duplicate slots ${stats.duplicateSlots}, missing slots ${stats.missingSlots}`);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--manifest')) throw new Error('Dùng: --manifest <file>');
    checkRooms(readManifest(args[1]));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
