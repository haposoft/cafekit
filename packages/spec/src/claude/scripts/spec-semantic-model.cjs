'use strict';

const fs = require('fs');
const path = require('path');

const MODEL_FIELDS = ['version', 'criteria', 'anchors', 'design_records', 'verification_definitions'];
const CRITERION_FIELDS = ['id', 'text', 'kind', 'owner'];
const DESIGN_RECORD_FIELDS = ['id', 'kind', 'title', 'text'];
const ANCHOR_FIELDS = ['id', 'type', 'target', 'role', 'access', 'action'];
const VERIFICATION_FIELDS = [
  'id', 'subject_criteria', 'subject_owner', 'proof_criteria', 'proof_owner',
  'evidence_anchor', 'decision_refs', 'method', 'expected', 'negative', 'reachability',
];
const ANCHOR_TYPES = new Set([
  'file', 'symbol', 'command', 'route', 'schema', 'contract', 'artifact', 'external',
]);
const TASK_FILE_RE = /^tasks\/task-(R\d+-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const CRITERION_RE = /^\s*[-*+]\s+\*\*(R\d+\.\d+):?\*\*\s*:?[ \t]+(.+)$/gim;

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactKeys(value, fields) {
  return plain(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort());
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (plain(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function concrete(value, minimum = 8) {
  return typeof value === 'string' && value === value.trim() && value.length >= minimum
    && !/[{}]|\b(?:tbd|todo|placeholder|works?|handles? it|expected behavior)\b/i.test(value);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueStrings(value) {
  return Array.isArray(value) && value.length > 0
    && value.every((item) => typeof item === 'string' && item.trim() === item && item !== '')
    && new Set(value).size === value.length;
}

function extractSection(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(content).match(new RegExp(`^##\\s+${escaped}\\s*$`, 'im'));
  if (!match) return null;
  const after = String(content).slice(match.index + match[0].length);
  const next = after.match(/^##\s+/m);
  return next ? after.slice(0, next.index) : after;
}

function parseTable(section, expectedHeaders) {
  if (typeof section !== 'string') return [];
  const lines = section.split('\n');
  for (let index = 0; index + 1 < lines.length; index += 1) {
    if (!/^\s*\|/.test(lines[index]) || !/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[index + 1])) continue;
    const headers = lines[index].split('|').slice(1, -1).map((cell) => cell.trim().toLowerCase());
    if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders.map((header) => header.toLowerCase()))) continue;
    const rows = [];
    for (let row = index + 2; row < lines.length && /^\s*\|/.test(lines[row]); row += 1) {
      const cells = lines[row].split('|').slice(1, -1)
        .map((cell) => cell.trim().replace(/^`|`$/g, '').trim());
      if (cells.some(Boolean)) rows.push(cells);
    }
    return rows;
  }
  return [];
}

function normalizeAccessAction(rawAccess, rawAction) {
  const access = String(rawAccess || '').trim().toLowerCase();
  const action = String(rawAction || '').trim().toLowerCase();
  let error = null;
  if (!['read', 'write'].includes(access)) error = 'Access must be read or write';
  else if (access === 'read' && action !== 'read') error = 'access read requires action read';
  else if (access === 'write' && !['create', 'modify', 'delete'].includes(action)) {
    error = 'access write requires action create, modify, or delete';
  }
  return { access, action, error };
}

function parseAnchors(content, { label, design }, errors) {
  const section = extractSection(content, design ? 'Typed Anchors' : 'Anchors and Ownership') || '';
  const rows = parseTable(section, ['ID', 'Type', 'Target', 'Role', 'Access', 'Action']);
  if (rows.length === 0 && !(design === false && /\bA-D-\d{2}\b/.test(section))) {
    errors.push(`${label}: typed anchor table is missing or empty`);
  }
  const taskId = label.match(TASK_FILE_RE)?.[1];
  return rows.map(([id = '', rawType = '', target = '', role = '', rawAccess = '', rawAction = '']) => {
    const type = rawType.toLowerCase();
    const { access, action, error } = normalizeAccessAction(rawAccess, rawAction);
    const namespace = design ? /^A-D-\d{2}$/ : new RegExp(`^A-${taskId || 'INVALID'}-\\d{2}$`);
    if (!namespace.test(id)) errors.push(`${label}: anchor ${id || '(missing id)'} has invalid namespace`);
    if (!ANCHOR_TYPES.has(type)) errors.push(`${label}: anchor ${id || '(missing id)'} has unknown Type ${rawType || '(empty)'}`);
    if (!concrete(target, 1) || /[{}*?\[\]]/.test(target)) errors.push(`${label}: anchor ${id || '(missing id)'} requires one exact target`);
    if (!concrete(role, 2)) errors.push(`${label}: anchor ${id || '(missing id)'} Role must be concrete`);
    if (error) errors.push(`${label}: anchor ${id || '(missing id)'} ${error}`);
    return { id, type, target, role: role.toLowerCase(), access, action };
  });
}

function parseList(value, pattern, label, errors) {
  const values = String(value).split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (values.length === 0 || new Set(values).size !== values.length || values.some((item) => !pattern.test(item))) {
    errors.push(`design.md: ${label} must be a non-empty unique canonical list`);
  }
  return values;
}

function parseMethod(raw, errors) {
  const command = raw.match(/^command\s+`([^`]+)`$/i);
  if (command && concrete(command[1], 3)) return { kind: 'command', value: command[1] };
  const inspection = raw.match(/^inspection\s+`([^`]+)`\s+via\s+(A-(?:D|R\d+-\d{2})-\d{2})$/i);
  if (inspection && concrete(inspection[1], 1)) {
    return { kind: 'inspection', target: inspection[1], anchor_ref: inspection[2].toUpperCase() };
  }
  errors.push('design.md: Method must be exact command `...` or inspection `exact target` via one anchor');
  return { kind: 'invalid', value: raw };
}

function parseReachability(raw, errors) {
  const match = raw.match(/^entrypoint\s+`([^`]+)`\s+via\s+(.+?)\.?$/i);
  if (!match || !concrete(match[1], 1)) {
    errors.push('design.md: Reachability/grounding must be entrypoint `exact repository path` via anchor refs');
    return { entrypoint: '', anchor_refs: [] };
  }
  return {
    entrypoint: match[1],
    anchor_refs: parseList(match[2], /^A-(?:D|R\d+-\d{2})-\d{2}$/, 'reachability anchor refs', errors),
  };
}

function parseVerificationDefinitions(designText, errors) {
  const count = (String(designText).match(/^##\s+Verification Definitions\s*$/gim) || []).length;
  if (count !== 1) {
    errors.push('design.md: requires exactly one ## Verification Definitions section');
    return new Map();
  }
  const section = extractSection(designText, 'Verification Definitions') || '';
  const definitions = new Map();
  const candidates = section.split('\n').filter((line) => /^\s*[-*+]\s+\*\*V\d+(?:\.\d+)?\*\*/i.test(line));
  const grammar = /^\s*[-*+]\s+\*\*(V\d+(?:\.\d+)?)\*\*:\s*Criteria\s+(.+?)\s*;\s*Owner\s+([^;]+)\s*;(?:\s*Proof criteria\s+(.+?)\s*;\s*Proof owner\s+([^;]+)\s*;\s*Evidence anchor\s+([^;]+)\s*;)?\s*Decision refs\s+(.+?)\s*;\s*Method\s+(.+?)\s*;\s*Expected\s+(.+?)\s*;\s*Negative\/failure\s+(.+?)\s*;\s*Reachability\/grounding\s+(.+?)\s*\.?\s*$/i;
  // Read-only compatibility for persisted proof specs; new authoring uses the
  // base grammar above and its conditional proof extension.
  const legacyProofGrammar = /^\s*[-*+]\s+\*\*(V\d+(?:\.\d+)?)\*\*:\s*Subject criteria\s+(.+?)\s*;\s*Subject owner\s+([^;]+)\s*;\s*Proof criteria\s+(.+?)\s*;\s*Proof owner\s+([^;]+)\s*;\s*Evidence anchor\s+([^;]+)\s*;\s*Decision refs\s+(.+?)\s*;\s*Method\s+(.+?)\s*;\s*Expected\s+(.+?)\s*;\s*Negative\/failure\s+(.+?)\s*;\s*Reachability\/grounding\s+(.+?)\s*\.?\s*$/i;
  for (const line of candidates) {
    const match = line.match(grammar) || line.match(legacyProofGrammar);
    if (!match) {
      errors.push('design.md: V definition must use Criteria; Owner; optional Proof criteria; Proof owner; Evidence anchor; Decision refs; Method; Expected; Negative/failure; Reachability/grounding grammar');
      continue;
    }
    const id = match[1].toUpperCase();
    const subjectCriteria = parseList(match[2], /^R\d+\.\d+$/, `${id} subject criteria`, errors);
    const proofCriteria = match[4] ? parseList(match[4], /^R\d+\.\d+$/, `${id} proof criteria`, errors) : [];
    const definition = {
      id,
      subject_criteria: subjectCriteria,
      subject_owner: match[3].trim().toUpperCase(),
      proof_criteria: proofCriteria,
      proof_owner: match[5] ? match[5].trim().toUpperCase() : null,
      evidence_anchor: match[6] ? match[6].trim().toUpperCase() : null,
      decision_refs: parseList(match[7], /^[DIC]\d+(?:\.\d+)?$/, `${id} decision refs`, errors),
      method: parseMethod(match[8].trim(), errors),
      expected: match[9].trim(),
      negative: match[10].trim(),
      reachability: parseReachability(match[11].trim(), errors),
    };
    if (definitions.has(id)) errors.push(`design.md: duplicate canonical V definition ${id}`);
    else definitions.set(id, definition);
  }
  if (definitions.size === 0) errors.push('design.md: Verification Definitions requires at least one canonical V definition');
  return definitions;
}

function parseDesignRecords(designText, errors) {
  const records = [];
  const semantic = String(designText);
  const heading = /^#{3,6}\s+([DIC]\d+(?:\.\d+)?)\s+(?:—|-)\s+(.+)$/gim;
  const matches = [...semantic.matchAll(heading)];
  for (const [index, match] of matches.entries()) {
    const start = match.index + match[0].length;
    const relativeEnd = semantic.slice(start).search(/^#{1,6}\s+/m);
    const text = normalizeText(semantic.slice(start, relativeEnd < 0 ? semantic.length : start + relativeEnd));
    const id = match[1].toUpperCase();
    records.push({ id, kind: { D: 'decision', I: 'invariant', C: 'contract' }[id[0]], title: normalizeText(match[2]), text });
  }
  const ids = new Set();
  for (const record of records) {
    if (ids.has(record.id)) errors.push(`design.md: duplicate semantic record ${record.id}`);
    ids.add(record.id);
    if (!concrete(record.title, 3) || !concrete(record.text, 8)) errors.push(`design.md: ${record.id} requires concrete title and semantic text`);
  }
  return records.sort((a, b) => a.id.localeCompare(b.id));
}

function criterionIds(requirementsText) {
  return [...String(requirementsText).matchAll(CRITERION_RE)].map((match) => match[1].toUpperCase());
}

function taskFiles(specDir) {
  const directory = path.join(specDir, 'tasks');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && TASK_FILE_RE.test(`tasks/${entry.name}`))
    .map((entry) => `tasks/${entry.name}`).sort();
}

function ownerKind(owner) {
  if (/^R\d+-\d{2}$/.test(owner)) return 'task';
  if (/^A-D-\d{2}$/.test(owner)) return 'design';
  return null;
}

function modelFromMarkdown(specDir, spec = {}) {
  const errors = [];
  let requirementsText = '';
  let designText = '';
  try { requirementsText = fs.readFileSync(path.join(specDir, 'requirements.md'), 'utf8'); }
  catch (error) { errors.push(`requirements.md: cannot be read (${error.message})`); }
  try { designText = fs.readFileSync(path.join(specDir, 'design.md'), 'utf8'); }
  catch (error) { errors.push(`design.md: cannot be read (${error.message})`); }
  const criterionEntries = [...String(requirementsText).matchAll(CRITERION_RE)]
    .map((match) => ({ id: match[1].toUpperCase(), text: normalizeText(match[2]) }));
  const criteria = criterionEntries.map((entry) => entry.id);
  if (criteria.length === 0) errors.push('requirements.md: semantic model requires a non-empty RN.M inventory');
  if (new Set(criteria).size !== criteria.length) errors.push('requirements.md: semantic model criterion IDs must be unique');
  const anchors = parseAnchors(designText, { label: 'design.md', design: true }, errors);
  const taskOwners = new Map();
  for (const taskFile of taskFiles(specDir)) {
    const content = fs.readFileSync(path.join(specDir, taskFile), 'utf8');
    anchors.push(...parseAnchors(content, { label: taskFile, design: false }, errors));
    const taskId = taskFile.match(TASK_FILE_RE)[1];
    const acceptance = extractSection(content, 'Acceptance') || '';
    for (const criterion of criterionIds(acceptance)) {
      if (!taskOwners.has(criterion)) taskOwners.set(criterion, []);
      taskOwners.get(criterion).push(taskId);
    }
  }
  const definitions = parseVerificationDefinitions(designText, errors);
  const criterionSemantics = new Map();
  for (const definition of definitions.values()) {
    const overlap = definition.subject_criteria.filter((id) => definition.proof_criteria.includes(id));
    if (overlap.length) errors.push(`design.md: ${definition.id} subject/proof criteria must be distinct (${overlap.join(', ')})`);
    for (const [kind, ids, owner] of [
      ['subject', definition.subject_criteria, definition.subject_owner],
      ['proof', definition.proof_criteria, definition.proof_owner],
    ]) for (const id of ids) {
      if (criterionSemantics.has(id)) errors.push(`design.md: criterion ${id} is assigned by multiple V definitions`);
      else criterionSemantics.set(id, { kind, owner });
    }
  }
  const taskful = taskFiles(specDir).length > 0;
  const modelCriteria = criteria.map((id) => {
    const semantic = criterionSemantics.get(id);
    if (!semantic) errors.push(`requirements.md:${id}: orphan criterion has no structured V ownership`);
    let owner = semantic?.owner || '';
    const claimed = taskOwners.get(id) || [];
    if (taskful) {
      if (claimed.length !== 1) errors.push(`requirements.md:${id}: requires exactly one task implementation owner`);
      else owner = claimed[0];
      if (semantic && claimed.length === 1 && semantic.owner !== claimed[0]) {
        errors.push(`design.md: ${id} V owner ${semantic.owner} differs from task Acceptance owner ${claimed[0]}`);
      }
    } else if (ownerKind(owner) !== 'design') {
      errors.push(`requirements.md:${id}: taskless owner must be one exact A-D design anchor`);
    }
    const text = criterionEntries.find((entry) => entry.id === id)?.text || '';
    if (!concrete(text, 8)) errors.push(`requirements.md:${id}: criterion text must be concrete`);
    return { id, text, kind: semantic?.kind || 'subject', owner };
  });
  for (const id of criterionSemantics.keys()) if (!criteria.includes(id)) {
    errors.push(`design.md: V definition references orphan criterion ${id}`);
  }
  const model = {
    version: '2',
    criteria: modelCriteria.sort((a, b) => a.id.localeCompare(b.id)),
    anchors: anchors.sort((a, b) => a.id.localeCompare(b.id)),
    design_records: parseDesignRecords(designText, errors),
    verification_definitions: [...definitions.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
  errors.push(...validateSemanticModel(model, spec));
  return { model, errors: [...new Set(errors)] };
}

function validateSemanticModel(model, spec = {}) {
  const errors = [];
  if (!exactKeys(model, MODEL_FIELDS)) return ['spec.json.semantic_model: fields must be exactly version, criteria, anchors, design_records, verification_definitions'];
  if (model.version !== '2') errors.push('spec.json.semantic_model.version: must be "2"');
  if (!Array.isArray(model.criteria) || model.criteria.length === 0) errors.push('spec.json.semantic_model.criteria: must be a non-empty array');
  if (!Array.isArray(model.anchors) || model.anchors.length === 0) errors.push('spec.json.semantic_model.anchors: must be a non-empty array');
  if (!Array.isArray(model.design_records) || model.design_records.length === 0) errors.push('spec.json.semantic_model.design_records: must preserve at least one D/I/C semantic record');
  if (!Array.isArray(model.verification_definitions) || model.verification_definitions.length === 0) errors.push('spec.json.semantic_model.verification_definitions: must be a non-empty array');
  const anchorIds = new Set();
  for (const [index, anchor] of (model.anchors || []).entries()) {
    const label = `spec.json.semantic_model.anchors[${index}]`;
    if (!exactKeys(anchor, ANCHOR_FIELDS)) { errors.push(`${label}: fields must be exactly ${ANCHOR_FIELDS.join(', ')}`); continue; }
    if (!/^A-(?:D|R\d+-\d{2})-\d{2}$/.test(anchor.id) || anchorIds.has(anchor.id)) errors.push(`${label}.id: must be globally unique canonical anchor ID`);
    anchorIds.add(anchor.id);
    if (!ANCHOR_TYPES.has(anchor.type)) errors.push(`${label}.type: unsupported anchor type`);
    if (!concrete(anchor.target, 1) || !concrete(anchor.role, 2)) errors.push(`${label}: target and role must be concrete`);
    const normalized = normalizeAccessAction(anchor.access, anchor.action);
    if (normalized.error) errors.push(`${label}: ${normalized.error}`);
  }
  const taskIds = new Set(Object.values(spec.task_registry || {}).map((entry) => entry?.id));
  const designRecordIds = new Set();
  for (const [index, record] of (model.design_records || []).entries()) {
    const label = `spec.json.semantic_model.design_records[${index}]`;
    if (!exactKeys(record, DESIGN_RECORD_FIELDS)) { errors.push(`${label}: fields must be exactly ${DESIGN_RECORD_FIELDS.join(', ')}`); continue; }
    if (!/^[DIC]\d+(?:\.\d+)?$/.test(record.id) || designRecordIds.has(record.id)) errors.push(`${label}.id: must be a unique D/I/C id`);
    designRecordIds.add(record.id);
    if (record.kind !== ({ D: 'decision', I: 'invariant', C: 'contract' })[record.id?.[0]]) errors.push(`${label}.kind: does not match id`);
    if (!concrete(record.title, 3) || !concrete(record.text, 8)) errors.push(`${label}: title and text must be concrete`);
  }
  const criterionIdsSeen = new Set();
  for (const [index, criterion] of (model.criteria || []).entries()) {
    const label = `spec.json.semantic_model.criteria[${index}]`;
    if (!exactKeys(criterion, CRITERION_FIELDS)) { errors.push(`${label}: fields must be exactly ${CRITERION_FIELDS.join(', ')}`); continue; }
    if (!/^R\d+\.\d+$/.test(criterion.id) || criterionIdsSeen.has(criterion.id)) errors.push(`${label}.id: must be unique RN.M`);
    criterionIdsSeen.add(criterion.id);
    if (!['subject', 'proof'].includes(criterion.kind)) errors.push(`${label}.kind: must be subject or proof`);
    if (!concrete(criterion.text, 8)) errors.push(`${label}.text: must preserve normalized product semantics`);
    const kind = ownerKind(criterion.owner);
    if (!kind || (kind === 'task' && !taskIds.has(criterion.owner)) || (kind === 'design' && !anchorIds.has(criterion.owner))) {
      errors.push(`${label}.owner: must resolve to one task ID or A-D anchor`);
    }
  }
  const verificationIds = new Set();
  const coveredCriteria = new Set();
  const criteriaById = new Map((model.criteria || []).map((criterion) => [criterion.id, criterion]));
  const anchorsById = new Map((model.anchors || []).map((anchor) => [anchor.id, anchor]));
  for (const [index, definition] of (model.verification_definitions || []).entries()) {
    const label = `spec.json.semantic_model.verification_definitions[${index}]`;
    if (!exactKeys(definition, VERIFICATION_FIELDS)) { errors.push(`${label}: fields must be exactly ${VERIFICATION_FIELDS.join(', ')}`); continue; }
    if (!/^V\d+(?:\.\d+)?$/.test(definition.id) || verificationIds.has(definition.id)) errors.push(`${label}.id: must be unique canonical V ID`);
    verificationIds.add(definition.id);
    const hasProof = Array.isArray(definition.proof_criteria) && definition.proof_criteria.length > 0;
    for (const [kind, values] of [['subject', definition.subject_criteria], ['proof', definition.proof_criteria]]) {
      if ((kind === 'subject' && !uniqueStrings(values)) || (kind === 'proof' && hasProof && !uniqueStrings(values)) || !Array.isArray(values) || values.some((id) => !criterionIdsSeen.has(id))) errors.push(`${label}.${kind}_criteria: must be a unique known RN.M list; Criteria is non-empty and Proof criteria is conditional`);
      for (const id of values || []) {
        if (coveredCriteria.has(id)) errors.push(`${label}: criterion ${id} is covered by multiple V definitions`);
        coveredCriteria.add(id);
      }
    }
    if ((definition.subject_criteria || []).some((id) => (definition.proof_criteria || []).includes(id))) errors.push(`${label}: subject/proof criteria must be distinct`);
    if (hasProof && definition.subject_owner === definition.proof_owner) errors.push(`${label}: subject/proof owners must be distinct`);
    for (const [field, owner] of [['subject_owner', definition.subject_owner], ...(hasProof ? [['proof_owner', definition.proof_owner]] : [])]) {
      const kind = ownerKind(owner);
      if (!kind || (kind === 'task' && !taskIds.has(owner)) || (kind === 'design' && !anchorIds.has(owner))) errors.push(`${label}.${field}: unresolved owner`);
    }
    if (hasProof && !anchorIds.has(definition.evidence_anchor)) errors.push(`${label}.evidence_anchor: must resolve to a canonical anchor`);
    else if (hasProof && ((ownerKind(definition.proof_owner) === 'task' && !definition.evidence_anchor.startsWith(`A-${definition.proof_owner}-`))
      || (ownerKind(definition.proof_owner) === 'design' && definition.evidence_anchor !== definition.proof_owner))) {
      errors.push(`${label}.evidence_anchor: must be owned by the proof owner`);
    }
    for (const [kind, ids, owner] of [
      ['subject', definition.subject_criteria, definition.subject_owner],
      ['proof', definition.proof_criteria, definition.proof_owner],
    ]) for (const id of ids || []) {
      const criterion = criteriaById.get(id);
      if (criterion && (criterion.kind !== kind || criterion.owner !== owner)) errors.push(`${label}: ${id} ${kind} ownership differs from criteria inventory`);
    }
    if (!uniqueStrings(definition.decision_refs) || definition.decision_refs.some((id) => !designRecordIds.has(id))) errors.push(`${label}.decision_refs: invalid or absent from semantic design records`);
    if (!plain(definition.method) || !['command', 'inspection'].includes(definition.method.kind)) errors.push(`${label}.method: invalid structured method`);
    else if (definition.method.kind === 'command' && (!exactKeys(definition.method, ['kind', 'value']) || !concrete(definition.method.value, 3))) errors.push(`${label}.method: command must be exact and concrete`);
    else if (definition.method.kind === 'inspection' && (!exactKeys(definition.method, ['kind', 'target', 'anchor_ref'])
      || !anchorIds.has(definition.method.anchor_ref) || anchorsById.get(definition.method.anchor_ref)?.target !== definition.method.target)) {
      errors.push(`${label}.method: inspection target must exactly match one anchor`);
    }
    if (!concrete(definition.expected, 12) || !concrete(definition.negative, 12)) errors.push(`${label}: Expected and negative must be concrete non-placeholder text`);
    if (!exactKeys(definition.reachability, ['entrypoint', 'anchor_refs']) || !concrete(definition.reachability?.entrypoint, 1)
      || !uniqueStrings(definition.reachability?.anchor_refs) || definition.reachability.anchor_refs.some((id) => !anchorIds.has(id))) {
      errors.push(`${label}.reachability: requires exact entrypoint and non-empty grounded anchor refs`);
    }
  }
  for (const criterion of model.criteria || []) if (!coveredCriteria.has(criterion.id)) errors.push(`spec.json.semantic_model.criteria: orphan criterion ${criterion.id}`);
  return errors;
}

module.exports = {
  MODEL_FIELDS,
  modelFromMarkdown,
  normalizeAccessAction,
  parseAnchors,
  parseVerificationDefinitions,
  stableJson,
  validateSemanticModel,
};
