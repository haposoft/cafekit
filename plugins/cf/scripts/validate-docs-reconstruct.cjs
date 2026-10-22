#!/usr/bin/env node
/**
 * CafeKit as-is reconstruction bundle validator.
 *
 * The docs workflow is LLM-authored, so the bundle shape and evidence links
 * must be checked deterministically before it is handed to human review.
 */

const fs = require('fs');
const path = require('path');

const DOCUMENT_FILES = [
  'overview.html',
  'system-overview.md',
  'requirements-as-is.md',
  'roles-and-permissions.md',
  'entities-and-statuses.md',
  'business-rules.md',
  'integrations.md',
  'architecture-c4.md',
  'constraints-risks-and-decisions.md',
  'glossary.md',
  'evidence-map.md',
  'unknowns-and-assumptions.md',
];
const REQUIRED_FILES = ['reconstruction.json', ...DOCUMENT_FILES];
const EVIDENCE_ID_RE = /\bE-[A-Z]+-\d{3}\b/g;

function usage() {
  console.error('Usage: node .claude/scripts/validate-docs-reconstruct.cjs docs/as-is/<scope>');
}

function readJson(filePath, errors) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`reconstruction.json: invalid JSON (${error.message})`);
    return null;
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function uniqueMatches(text, pattern) {
  return [...new Set(text.match(pattern) || [])].sort();
}

function validateMeta(bundle, meta, errors) {
  for (const key of [
    'scope',
    'generated_at',
    'status',
    'docs_root',
    'source_revision',
    'source_branch',
    'evidence_policy',
    'review_gate',
    'review_status',
    'approved_for_specs',
    'documents',
    'counts',
    'next_recommended_step',
  ]) {
    if (!(key in meta)) errors.push(`reconstruction.json.${key}: missing`);
  }

  for (const key of ['scope', 'generated_at', 'docs_root', 'source_revision', 'source_branch']) {
    if (key in meta && (typeof meta[key] !== 'string' || meta[key].trim() === '')) {
      errors.push(`reconstruction.json.${key}: must be a non-empty string`);
    }
  }
  if (meta.approved_for_specs !== false && meta.review_status !== 'approved') {
    errors.push('reconstruction.json.approved_for_specs: only approved review may set true');
  }
  if (!Array.isArray(meta.documents)) {
    errors.push('reconstruction.json.documents: must be an array');
    return;
  }

  const declared = [...meta.documents].sort();
  const expected = [...DOCUMENT_FILES].sort();
  if (JSON.stringify(declared) !== JSON.stringify(expected)) {
    errors.push('reconstruction.json.documents: must exactly list the as-is document bundle');
  }
  if (typeof meta.docs_root === 'string' && !meta.docs_root.includes(path.basename(bundle))) {
    errors.push('reconstruction.json.docs_root: must point at this scope bundle');
  }
}

function requirementBlocks(text) {
  const matches = [...text.matchAll(/^##\s+(R-ASIS-\d{3})\b[^\n]*$/gm)];
  return matches.map((match, index) => ({
    id: match[1],
    text: text.slice(match.index, matches[index + 1]?.index ?? text.length),
  }));
}

function validateRequirements(bundle, evidenceText, errors) {
  const requirementPath = path.join(bundle, 'requirements-as-is.md');
  const blocks = requirementBlocks(readText(requirementPath));
  if (blocks.length === 0) {
    errors.push('requirements-as-is.md: must contain at least one ## R-ASIS-### requirement');
    return;
  }

  const ledgerIds = new Set(uniqueMatches(evidenceText, EVIDENCE_ID_RE));
  for (const block of blocks) {
    if (!/- Type:\s*(Observed|Inferred|Unknown)\b/.test(block.text)) {
      errors.push(`requirements-as-is.md:${block.id}: missing Type`);
    }
    if (!/- Confidence:\s*(High|Medium|Low)\b/.test(block.text)) {
      errors.push(`requirements-as-is.md:${block.id}: missing Confidence`);
    }
    if (!/^- Evidence:\s*$/m.test(block.text)) {
      errors.push(`requirements-as-is.md:${block.id}: missing Evidence section`);
    }

    const evidenceIds = uniqueMatches(block.text, EVIDENCE_ID_RE);
    if (evidenceIds.length === 0) {
      errors.push(`requirements-as-is.md:${block.id}: must reference evidence IDs`);
    }
    for (const evidenceId of evidenceIds) {
      if (!ledgerIds.has(evidenceId)) {
        errors.push(`requirements-as-is.md:${block.id}: unknown evidence ID ${evidenceId}`);
      }
    }
  }
}

function validateBundle(bundle) {
  const errors = [];
  if (!fs.existsSync(bundle)) return { errors: [`${bundle}: bundle directory does not exist`] };

  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(bundle, file))) errors.push(`${file}: missing`);
  }
  if (errors.length > 0) return { errors };

  const meta = readJson(path.join(bundle, 'reconstruction.json'), errors);
  if (meta) validateMeta(bundle, meta, errors);

  const evidence = readText(path.join(bundle, 'evidence-map.md'));
  if (uniqueMatches(evidence, EVIDENCE_ID_RE).length === 0) {
    errors.push('evidence-map.md: must define evidence IDs');
  }
  validateRequirements(bundle, evidence, errors);

  const overview = readText(path.join(bundle, 'overview.html'));
  if (!overview.includes('data-reconstruct-overview')) {
    errors.push('overview.html: must keep reconstruct overview marker');
  }

  return { errors };
}

function main() {
  const input = process.argv[2];
  if (!input) {
    usage();
    process.exit(2);
  }

  const bundle = path.resolve(process.cwd(), input);
  const { errors } = validateBundle(bundle);
  if (errors.length > 0) {
    console.error(`FAIL ${path.relative(process.cwd(), bundle) || bundle}`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`PASS ${path.relative(process.cwd(), bundle) || bundle}`);
}

main();
