'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const RESOLVER = path.join(ROOT, 'src/claude/scripts/spec-resolver.cjs');
const SPEC_RESOLVER = require(RESOLVER);
const { normalizeCodexBody } = require(path.join(ROOT, 'bin/lib/codex-install.js'));

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function task({
  id = 'R1-01',
  mapping = '1.1',
  related = '`src/one.js` | Modify',
  relatedRows = null,
  dependencies = 'none',
  status = 'pending',
  parallel = false,
  extra = '',
} = {}) {
  const relatedPath = related.match(/`([^`]+)`/)?.[1] || 'src/one.js';
  const action = related.match(/\|\s*([A-Za-z]+)\b/i)?.[1] || 'Modify';
  const acceptanceId = mapping.match(/\d+\.\d+/)?.[0];
  const lifecycleRows = relatedRows === null ? (action.toLowerCase() === 'modify'
    ? `| \`${relatedPath}\` | Read | Inspect existing implementation |\n| ${related} | Update implementation |`
    : `| ${related} | Apply declared lifecycle action |`) : relatedRows;
  return `# Task ${id}: One\n\n**Status:** ${status}\n\n## Outcome\n\nCalling the real fixture entrypoint returns status value 1.\n\n## Scope and Typed Anchors\n\n- **In scope:** Implement the mapped observable behavior.\n- **Out of scope:** Unrelated runtime behavior.\n- **Contracts/Invariants:** none\n- **Canonical design anchors consumed:** A-D-01\n\n| ID | Type | Target | Role |\n|---|---|---|---|\n| A-${id}-01 | command | \`node --test test/one.test.js\` | planned verification command |\n\n## Changes\n\n- [ ] ${parallel ? '(P) ' : ''}Update the source boundary and preserve its negative path.${mapping ? ` _Requirements: ${mapping}_` : ''}\n\n## Acceptance\n\n${acceptanceId ? `- **R${acceptanceId}:**` : '-'} Calling \`${relatedPath}\` returns an observable result with status value 1.\n\n## Dependencies\n\n- ${dependencies}\n\n## Verification Plan\n\n- **Command:** \`node --test test/one.test.js\`\n- **Expected:** exit code 0 and one assertion for status value 1\n- **Negative path:** invalid input returns a deterministic error result\n- **Reachability:** \`${relatedPath}\` is invoked by the focused test\n\n## Related Files\n\n| Path | Action | Description |\n|---|---|---|---|\n${lifecycleRows}\n${extra}`;
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

test('Codex installer transform preserves all owned spec assets idempotently', () => {
  for (const relative of [
    'src/claude/skills/specs/SKILL.md',
    'src/claude/skills/specs/references/review.md',
    'src/claude/skills/specs/references/templates.md',
    'src/claude/scripts/spec-receipt.cjs',
  ]) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    const transformed = normalizeCodexBody(source, relative);
    assert.equal(normalizeCodexBody(transformed, relative), transformed, `${relative} must normalize idempotently`);
    assert.doesNotMatch(transformed, /node \.claude\/scripts\//, `${relative} retained a Claude executable path`);
    if (/node \.claude\/scripts\//.test(source)) {
      assert.match(transformed, /node \.codex\/scripts\//, `${relative} lost its Codex executable path`);
    }
    if (/implementation-obligation:/.test(source)) {
      assert.match(transformed, /implementation-obligation:/, `${relative} lost closure semantics`);
    }
  }

  const skill = fs.readFileSync(path.join(ROOT, 'src/claude/skills/specs/SKILL.md'), 'utf8');
  const review = fs.readFileSync(path.join(ROOT, 'src/claude/skills/specs/references/review.md'), 'utf8');
  const templates = fs.readFileSync(path.join(ROOT, 'src/claude/skills/specs/references/templates.md'), 'utf8');
  assert.match(skill, /specs\/<feature>\/[\s\S]{0,160}plan\.md[\s\S]{0,160}task-01-<slug>\.md/);
  assert.match(skill, /GATE-SCOPE[\s\S]*GATE-REVIEW[\s\S]*GATE-DONE/);
  assert.doesNotMatch(skill, /--(?:status|validate|archive)\b/);
  assert.match(review, /path:line/);
  assert.match(review, /Cap the presented[\s\S]{0,40}list at 15/);
  assert.match(review, /Round three requires runtime evidence/);
  assert.match(templates, /\| ID \| EARS criterion \| Proof \|/);
  assert.match(templates, /## Canonical inline Receipt[\s\S]*Verification: PASS[\s\S]*Exit: 0[\s\S]*Base:[\s\S]*Head:/);

});

test('resolver binds feature identity and rejects cross-feature plan aliases', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-resolver-identity-'));
  const packet = (dir) => {
    write(path.join(dir, 'plan.md'), '# Plan\nSpecs-Contract: process-first-ready-v1\n');
    write(path.join(dir, 'task-01-x.md'), '# Task 01\n\nStatus: pending\n\n## Dependencies\n\n- none\n');
  };
  try {
    const specsDir = path.join(root, 'specs');
    packet(path.join(specsDir, 'bar'));
    fs.mkdirSync(path.join(specsDir, 'foo'), { recursive: true });
    fs.symlinkSync('../bar/plan.md', path.join(specsDir, 'foo', 'plan.md'));

    const explicit = SPEC_RESOLVER.resolveWorkflowCandidate({ projectRoot: root, explicitFeature: 'foo' });
    assert.equal(explicit.error, 'explicit_malformed');
    assert.match(explicit.reason, /plan\.md must be a regular non-symlink file/);

    const implicit = SPEC_RESOLVER.resolveWorkflowCandidate({ projectRoot: root });
    assert.equal(implicit.error, 'invalid_specs');
    assert.deepEqual(implicit.candidates, ['foo']);
    assert.doesNotMatch(implicit.reason, /Multiple active/);

    // A directory alias is refused rather than resolved to the packet it points at.
    const aliasRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-resolver-directory-alias-'));
    try {
      const aliasSpecs = path.join(aliasRoot, 'specs');
      packet(path.join(aliasSpecs, 'bar'));
      fs.symlinkSync('bar', path.join(aliasSpecs, 'foo'), 'dir');
      const resolved = SPEC_RESOLVER.resolveWorkflowCandidate({ projectRoot: aliasRoot });
      assert.equal(resolved.error, 'invalid_specs');
      assert.deepEqual(resolved.candidates, ['foo']);
    } finally {
      fs.rmSync(aliasRoot, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('benchmark gate fails Critical when both arms correctness is zero', () => {
  const BENCHMARK = path.join(ROOT, 'scripts/benchmark-workflow.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-benchmark-critical-zero-'));
  try {
    function canon(v) {
      if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
      if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
      return JSON.stringify(v);
    }
    function shaCanon(v) { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(canon(v)).digest('hex')}`; }
    function hash(v) { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(JSON.stringify(v)).digest('hex')}`; }
    function rawHash(buf) { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(buf).digest('hex')}`; }
    const corpus = {
      schema_version: 'b1.v1',
      status: 'frozen',
      corpus_id: 'zero-critical-test',
      tasks: [
        { task_id: 'c1', lane: 'Critical', prompt: 'critical task', repo_sample: 'r/a', acceptance: { criteria: ['x'] }, risk: { level: 'high', reasons: ['x'] } },
        { task_id: 'd1', lane: 'Direct', prompt: 'direct task', repo_sample: 'r/a', acceptance: { criteria: ['x'] }, risk: { level: 'low', reasons: ['x'] } },
      ],
    };
    const corpusSha = shaCanon(corpus);
    const corpusPath = path.join(root, 'corpus.json');
    fs.writeFileSync(corpusPath, JSON.stringify(corpus));
    function makeConfig(arm) {
      const cfg = {
        schema_version: 'b1.v1',
        status: 'frozen',
        experiment_id: 'exp-zero',
        arm,
        model: { name: 'm', version: 'v' },
        reasoning_effort: 'standard',
        repo: { identifier: 'r', commit: 'abc1234', clean_initial_tree_sha: hash('clean') },
        permissions_fingerprint: hash('perm'),
        tool_availability_fingerprint: hash('tool'),
        corpus_sha256: corpusSha,
        repeat_policy: { repeats_per_task: 1, context_isolated: true },
        input_usd_per_1k: 0.01,
        output_usd_per_1k: 0.02,
      };
      const without = { ...cfg }; delete without.config_sha256;
      cfg.config_sha256 = shaCanon(without);
      return cfg;
    }
    const baselineCfg = makeConfig('baseline');
    const treatmentCfg = makeConfig('treatment');
    const baselinePath = path.join(root, 'baseline.json');
    const treatmentPath = path.join(root, 'treatment.json');
    fs.writeFileSync(baselinePath, JSON.stringify(baselineCfg));
    fs.writeFileSync(treatmentPath, JSON.stringify(treatmentCfg));
    const artifactBytes = Buffer.from('artifact');
    const artifactSha = rawHash(artifactBytes);
    const receiptsDir = path.join(root, 'receipts');
    fs.mkdirSync(receiptsDir, { recursive: true });
    fs.writeFileSync(path.join(receiptsDir, 'artifact.json'), artifactBytes);
    const receipts = [];
    for (const t of corpus.tasks) {
      for (const arm of ['baseline', 'treatment']) {
        const cfg = arm === 'baseline' ? baselineCfg : treatmentCfg;
        receipts.push({
          task_id: t.task_id,
          lane: t.lane,
          arm,
          repeat: 1,
          model: { name: 'm', version: 'v' },
          reasoning_effort: 'standard',
          repo_commit: 'abc1234',
          clean_initial_tree_sha: hash('clean'),
          permissions_fingerprint: hash('perm'),
          tool_availability_fingerprint: hash('tool'),
          corpus_sha256: corpusSha,
          config_sha256: cfg.config_sha256,
          wall_ms: 100,
          input_tokens: 10,
          output_tokens: 10,
          context_loaded_tokens: 100,
          tool_calls: 1,
          subagent_calls: 0,
          correctness: false,
          regression: false,
          unsupported_completion_claim: false,
          user_corrections: 0,
          useful_reviewer_findings: 1,
          false_positive_reviewer_findings: 0,
          evidence: { artifact_ref: 'artifact.json', artifact_sha256: artifactSha, command: 'echo hi' },
        });
      }
    }
    const receiptsPath = path.join(receiptsDir, 'receipts.json');
    fs.writeFileSync(receiptsPath, JSON.stringify({ receipts }));
    const summary = spawnSync(process.execPath, [BENCHMARK, 'summarize', '--corpus', corpusPath, '--config', baselinePath, '--config', treatmentPath, '--receipts', receiptsPath], { encoding: 'utf8' });
    assert.equal(summary.status, 0, `${summary.stdout}\n${summary.stderr}`);
    const parsed = JSON.parse(summary.stdout);
    assert.equal(parsed.rollout_recommendation.gates.Critical.pass, false, 'Critical should not pass with zero correctness');
    assert.equal(parsed.rollout_recommendation.gates.Critical.quality_pass, false);
    assert.equal(parsed.status, 'not-ready');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('benchmark validate handles empty and invalid evidence as not-ready/invalid', () => {
  const BENCHMARK = path.join(ROOT, 'scripts/benchmark-workflow.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-benchmark-empty-'));
  try {
    function canon(v) {
      if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
      if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
      return JSON.stringify(v);
    }
    function shaCanon(v) { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(canon(v)).digest('hex')}`; }
    function hash(v) { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(JSON.stringify(v)).digest('hex')}`; }
    const corpus = {
      schema_version: 'b1.v1',
      status: 'frozen',
      corpus_id: 'empty-test',
      tasks: [{ task_id: 't1', lane: 'Direct', prompt: 'p', repo_sample: 'r/a', acceptance: { criteria: ['x'] }, risk: { level: 'low', reasons: ['x'] } }],
    };
    const corpusSha = shaCanon(corpus);
    const corpusPath = path.join(root, 'corpus.json');
    fs.writeFileSync(corpusPath, JSON.stringify(corpus));
    function makeConfig(arm) {
      const cfg = {
        schema_version: 'b1.v1', status: 'frozen', experiment_id: 'exp-empty', arm,
        model: { name: 'm', version: 'v' }, reasoning_effort: 'standard',
        repo: { identifier: 'r', commit: 'abc', clean_initial_tree_sha: hash('clean') },
        permissions_fingerprint: hash('perm'), tool_availability_fingerprint: hash('tool'),
        corpus_sha256: corpusSha, repeat_policy: { repeats_per_task: 1, context_isolated: true },
      };
      const without = { ...cfg }; delete without.config_sha256;
      cfg.config_sha256 = shaCanon(without);
      return cfg;
    }
    const cfg = makeConfig('baseline');
    const cfgPath = path.join(root, 'cfg.json');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    const emptyReceipts = path.join(root, 'empty.json');
    fs.writeFileSync(emptyReceipts, JSON.stringify({ receipts: [] }));
    const emptySummary = spawnSync(process.execPath, [BENCHMARK, 'summarize', '--corpus', corpusPath, '--config', cfgPath, '--receipts', emptyReceipts], { encoding: 'utf8' });
    assert.equal(emptySummary.status, 0);
    const emptyParsed = JSON.parse(emptySummary.stdout);
    assert.ok(['not-ready', 'exploratory/no-live-runs'].includes(emptyParsed.status));

    const artifactBytes = Buffer.from('artifact');
    const rawHash = (b) => { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(b).digest('hex')}`; };
    const artifactSha = rawHash(artifactBytes);
    const badReceipts = { receipts: [{
      task_id: 't1', lane: 'Direct', arm: 'baseline', repeat: 1,
      model: { name: 'm', version: 'v' }, reasoning_effort: 'standard',
      repo_commit: 'abc', clean_initial_tree_sha: hash('clean'),
      permissions_fingerprint: hash('perm'), tool_availability_fingerprint: hash('tool'),
      corpus_sha256: corpusSha, config_sha256: cfg.config_sha256,
      wall_ms: 100, input_tokens: 10, output_tokens: 10, context_loaded_tokens: 100, tool_calls: 1, subagent_calls: 0,
      correctness: true, regression: false, unsupported_completion_claim: false,
      user_corrections: 0, useful_reviewer_findings: 0, false_positive_reviewer_findings: 0,
      evidence: { artifact_ref: 'missing.json', artifact_sha256: artifactSha, command: 'echo hi' },
    }] };
    const badPath = path.join(root, 'bad.json');
    fs.writeFileSync(badPath, JSON.stringify(badReceipts));
    const badValidation = spawnSync(process.execPath, [BENCHMARK, 'validate', '--corpus', corpusPath, '--config', cfgPath, '--receipts', badPath], { encoding: 'utf8' });
    assert.equal(badValidation.status, 2);
    assert.match(badValidation.stderr, /artifact.*does not exist|artifact_ref/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
