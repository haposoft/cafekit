'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const Module = require('node:module');
const { convertCodexAgentContent, normalizeCodexBody } = require('../lib/codex-install');
const { sha256 } = require('../lib/manifest');

const ROOT = path.resolve(__dirname, '../..');
const STRATEGIST = fs.readFileSync(path.join(ROOT, 'src/claude/agents/strategist.md'), 'utf8');

test('strategist inherits native model, configures high reasoning and keeps advisory boundaries', () => {
  const projected = convertCodexAgentContent(STRATEGIST, 'strategist.md');
  assert.match(projected, /^model_reasoning_effort = "high"$/m);
  assert.doesNotMatch(projected, /^model\s*=/m);
  assert.doesNotMatch(projected, /fable|opus|sonnet|haiku|CLAUDE_CODE_SUBAGENT_MODEL|strongest available model|model override/);
  assert.match(projected, /inherits the session model/);
  assert.match(projected, /Advisory-only/);
  assert.match(projected, /never implement, scaffold, or edit project files/);
  assert.match(projected, /spawn_agent\(agent_type=\\"explorer\\", fork_turns=\\"none\\"/);
});

test('instruction projection converts Explore shorthand and native model guidance without rewriting executable code', () => {
  const instruction = '`Task(Explore)`; set `CLAUDE_CODE_SUBAGENT_MODEL` in project settings.';
  const converted = normalizeCodexBody(instruction, 'guide.md');
  assert.doesNotMatch(converted, /Task\(Explore\)|CLAUDE_CODE_SUBAGENT_MODEL/);
  assert.match(converted, /spawn_agent\(agent_type="explorer", fork_turns="none"/);
  assert.match(converted, /configured agent model/);
  assert.equal(normalizeCodexBody(instruction, 'script.js'), instruction);
});

for (const state of ['pristine', 'modified', 'untracked', 'dry-run']) {
  test(`retired Codex init.json migration: ${state}`, () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-projection-'));
    const relative = '.agents/skills/specs/templates/init.json';
    const target = path.join(temp, relative);
    const original = '{"legacy":true}\n';
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, state === 'modified' ? '{"custom":true}\n' : original);
    const custom = path.join(path.dirname(target), 'my-custom-template.json');
    fs.writeFileSync(custom, '{"keep":true}\n');
    const before = fs.readFileSync(target, 'utf8');
    const runner = `
      const { copyPlatformFiles } = require(${JSON.stringify(path.join(ROOT, 'bin/phases/copy-payload'))});
      const { createTracker } = require(${JSON.stringify(path.join(ROOT, 'bin/lib/manifest'))});
      const tracker = createTracker('.codex', 'test', { recordRoot: '.', allowedRoots: ['.codex', '.agents'] });
      const ctx = {
        dryRun: ${state === 'dry-run'}, options: {},
        manifest: { skills: { required: [] }, agents: { required: [] } },
        ownership: { '.codex': { files: ${JSON.stringify(state === 'untracked' ? {} : { [relative]: { sha256: sha256(original) } })} } },
        trackers: { codex: tracker },
        ui: { detail() {}, warn() {}, error() {} },
        results: { installedSkills: 0, copied: 0, updated: 0, unchanged: 0, preserved: 0, missingDependencies: 0, preservedFiles: [] }
      };
      copyPlatformFiles(ctx, 'codex');
      if (${JSON.stringify(state)} !== 'dry-run' && !tracker._pruned.has(${JSON.stringify(relative)})) throw new Error('ownership baseline was not pruned');
    `;
    try {
      const result = spawnSync(process.execPath, ['-e', runner], { cwd: temp, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      if (state !== 'dry-run') assert.equal(fs.existsSync(target), false);
      else assert.equal(fs.readFileSync(target, 'utf8'), before);
      assert.equal(fs.readFileSync(custom, 'utf8'), '{"keep":true}\n');
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
}

test('shared and projected provenance ignore native generated roots while retaining source changes', () => {
  const sourcePath = path.join(ROOT, 'src/claude/scripts/provenance.cjs');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const projected = new Module(sourcePath);
  projected._compile(normalizeCodexBody(source, sourcePath), sourcePath);
  for (const runtime of [require(sourcePath), projected.exports]) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-provenance-projection-'));
    const paths = ['.claude/runtime.json', '.claude/hooks/.logs/session.json', '.claude/.logs/events.json',
      '.codex/session-state/session/context.json', '.codex/hooks/.privacy/request.json'];
    const write = (relative, data) => {
      const target = path.join(temp, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
    };
    const git = (...args) => {
      const result = spawnSync('git', ['-C', temp, ...args], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    try {
      write('app.js', 'export const value = 1;\n');
      write('specs/feature/plan.md', '# Feature\n');
      for (const relative of paths) write(relative, '{}\n');
      git('init', '--quiet'); git('add', '.');
      git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'baseline');
      const input = { projectRoot: temp, specsRoot: path.join(temp, 'specs'),
        specFile: path.join(temp, 'specs/feature/plan.md'), featureName: 'feature', runtimeSession: 'fixture' };
      const baseline = runtime.deriveRuntimeProvenance(input).Head;
      const capturedGenerated = [];
      for (const relative of paths) {
        write(relative, '{"generated":true}\n');
        assert.match(git('status', '--porcelain', '--', relative), /M/);
        if (runtime.deriveRuntimeProvenance(input).Head !== baseline) capturedGenerated.push(relative);
        write(relative, '{}\n');
      }
      write('app.js', 'export const value = 2;\n');
      assert.notEqual(runtime.deriveRuntimeProvenance(input).Head, baseline);
      assert.deepEqual(capturedGenerated, [], 'generated state changed Head');
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
});

test('optional env functions read fake native runtime global env on Claude and projected Codex', () => {
  const python = `import ast, json, sys
from pathlib import Path
from types import SimpleNamespace
case = json.load(sys.stdin)
tree = ast.parse(case['source'])
function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == case['function'])
env = {}
loaded = []
def load_dotenv(target):
    loaded.append(str(target))
    env['GEMINI_API_KEY'] = Path(target).read_text().strip()
scope = {'Path': Path, 'Optional': __import__('typing').Optional, '__file__': case['script'],
         'os': SimpleNamespace(getenv=lambda key: env.get(key)), 'load_dotenv': load_dotenv}
exec(compile(ast.Module(body=[function], type_ignores=[]), '<fixture>', 'exec'), scope)
result = scope[case['function']]()
assert (result if case['function'] == 'find_api_key' else env.get('GEMINI_API_KEY')) == 'fixture-native-key', loaded
assert loaded == [case['expected']], loaded
`;
  for (const [file, functionName] of [['media_optimizer.py', 'load_env_files'], ['document_converter.py', 'find_api_key']]) {
    const sourcePath = path.join(ROOT, 'src/claude/skills/ai-multimodal/scripts', file);
    const original = fs.readFileSync(sourcePath, 'utf8');
    for (const native of ['claude', 'codex']) {
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-native-env-'));
      try {
        const expected = path.join(temp, `.${native}`, '.env');
        fs.mkdirSync(path.dirname(expected), { recursive: true });
        fs.writeFileSync(expected, 'fixture-native-key');
        const script = path.join(temp, native === 'claude' ? '.claude/skills' : '.agents/skills', 'ai-multimodal/scripts', file);
        const result = spawnSync('python3', ['-c', python], { encoding: 'utf8', input: JSON.stringify({
          source: native === 'claude' ? original : normalizeCodexBody(original, sourcePath),
          function: functionName, script, expected
        }) });
        assert.equal(result.status, 0, `${native}/${file}: ${result.stderr}`);
      } finally { fs.rmSync(temp, { recursive: true, force: true }); }
    }
  }
});
