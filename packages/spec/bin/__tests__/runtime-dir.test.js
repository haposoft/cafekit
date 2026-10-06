'use strict';

// The gate hooks derive their runtime directory from their own location instead of a
// literal `.claude`. Each case copies the helper into a directory shaped like a real
// layout and requires it from there, so the derivation is exercised against the path the
// module actually sees — not a mocked one.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const HELPER = path.join(PACKAGE_ROOT, 'src/claude/hooks/lib/runtime-dir.cjs');
const { spawnSync } = require('node:child_process');

/** Place the helper at <root>/<layout>/hooks/lib/ and return what it derives. */
function deriveAt(root, layout) {
  const lib = path.join(root, layout, 'hooks', 'lib');
  fs.mkdirSync(lib, { recursive: true });
  const target = path.join(lib, 'runtime-dir.cjs');
  fs.copyFileSync(HELPER, target);
  // Each copy is a distinct module path, so require caches never collide.
  return require(target);
}

function withTemp(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-runtime-dir-'));
  try { return run(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('installed layouts derive their own folder', () => {
  withTemp((root) => {
    for (const folder of ['.claude', '.codex', '.omp']) {
      const m = deriveAt(root, path.join('project-' + folder.slice(1), folder));
      assert.equal(m.runtimeDirName(), folder);
      assert.equal(m.runtimeDir('/p'), path.join('/p', folder));
      assert.equal(m.runtimePath('/p', 'runtime.json'), path.join('/p', folder, 'runtime.json'));
    }
  });
});

test('the source tree maps platform to dotted name', () => {
  withTemp((root) => {
    for (const platform of ['claude', 'omp', 'codex']) {
      const m = deriveAt(root, path.join('packages', 'spec', 'src', platform));
      assert.equal(m.runtimeDirName(), `.${platform}`, `source tree for ${platform}`);
    }
  });
});

test('a dotted folder wins over the source marker', () => {
  withTemp((root) => {
    // An install whose absolute path happens to contain /packages/spec/src/ must still
    // report its real folder, not a doubled-dot name derived from the marker.
    const m = deriveAt(root, path.join('packages', 'spec', 'src', 'fixture', '.codex'));
    assert.equal(m.runtimeDirName(), '.codex');
  });
});

test('an unknown layout falls back to .claude', () => {
  withTemp((root) => {
    const m = deriveAt(root, path.join('somewhere', 'else'));
    assert.equal(m.runtimeDirName(), '.claude', 'the pre-helper behaviour is the fallback');
  });
});

test('the helper in the real source tree derives .claude', () => {
  const m = require(HELPER);
  assert.equal(m.runtimeDirName(), '.claude');
});

/** Copy the whole hook tree and the scripts it requires under <root>/<folder>/. */
function installTreeAs(root, folder) {
  const rt = path.join(root, folder);
  fs.cpSync(path.join(PACKAGE_ROOT, 'src/claude/hooks'), path.join(rt, 'hooks'), {
    recursive: true, filter: (src) => !src.includes(`${path.sep}__tests__`),
  });
  fs.cpSync(path.join(PACKAGE_ROOT, 'src/claude/scripts'), path.join(rt, 'scripts'), { recursive: true });
  return rt;
}

/** Provenance derives Base/Head with git, so the fixture must be a repository (one empty commit). */
function gitInit(root) {
  for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'], ['config', 'user.name', 'CafeKit Test'], ['commit', '--allow-empty', '-qm', 'fixture']]) {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args[0]} failed: ${result.stderr}`);
  }
}

function runHook(rt, name, payload) {
  const r = spawnSync(process.execPath, [path.join(rt, 'hooks', name)], {
    cwd: path.dirname(rt), input: JSON.stringify(payload), encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: '', PROJECT_ROOT: '' },
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

test('a hook tree copied under .omp reads .omp/runtime.json', () => {
  withTemp((root) => {
    const rt = installTreeAs(root, '.omp');
    gitInit(root);
    fs.mkdirSync(path.join(root, 'specs'), { recursive: true });
    fs.writeFileSync(path.join(root, '.env'), 'TOKEN=redacted\n');
    assert.equal(fs.existsSync(path.join(root, '.claude')), false, 'the fixture must hold no .claude path at all');

    // rules.cjs: docs path from the sentinel config
    fs.writeFileSync(path.join(rt, 'runtime.json'), JSON.stringify({ paths: { docs: 'SENTINEL-DOCS', plans: 'plans' } }));
    const rules = runHook(rt, 'rules.cjs', { session_id: `s-${Date.now()}`, cwd: root });
    assert.match(rules.out, /SENTINEL-DOCS/, 'rules.cjs must read .omp/runtime.json');

    // inspect-block.cjs: disabled through the sentinel allows a broad search
    fs.writeFileSync(path.join(rt, 'runtime.json'), JSON.stringify({ inspect: { enabled: false } }));
    const inspect = runHook(rt, 'inspect-block.cjs', { tool_name: 'Bash', tool_input: { command: 'grep -rn TODO .' }, cwd: root });
    assert.equal(inspect.code, 0, 'inspect.enabled:false in .omp/runtime.json must allow');

    // privacy-block.cjs: kill switch through the sentinel allows a .env read
    fs.writeFileSync(path.join(rt, 'runtime.json'), JSON.stringify({ privacyBlock: false }));
    const privacy = runHook(rt, 'privacy-block.cjs', { tool_name: 'Read', tool_input: { file_path: path.join(root, '.env') }, cwd: root });
    assert.doesNotMatch(privacy.out, /permissionDecision/, 'privacyBlock:false in .omp/runtime.json must allow');

    // spec-gate.cjs exits silently unless a packet resolves, and only then reads the
    // completion_gate flag. Resolving a done task derives provenance through git, so the
    // fixture is a repository (gitInit above) and holds one done task to look at.
    const feature = path.join(root, 'specs', 'demo'); fs.mkdirSync(feature, { recursive: true });
    fs.writeFileSync(path.join(feature, 'plan.md'), '# Demo plan\n');
    fs.writeFileSync(path.join(feature, 'task-01-demo.md'), [
      '# Task 01: demo', '', 'Status: done', '', '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '',
    ].join('\n'));
    // the completion_gate flag is read from the sentinel and answered as a block
    fs.writeFileSync(path.join(rt, 'runtime.json'), JSON.stringify({ spec: { completion_gate: false } }));
    const gate = runHook(rt, 'spec-gate.cjs', { session_id: 's', cwd: root, hook_event_name: 'Stop', stop_hook_active: false });
    assert.match(gate.out, /worker-writable flag/, 'spec-gate.cjs must read .omp/runtime.json');
  });
});

test('advice names the directory the hook lives in', () => {
  withTemp((root) => {
    for (const [folder, skills] of [['.omp', '.agents/skills'], ['.claude', '.claude/skills']]) {
      const project = path.join(root, `p${folder}`); fs.mkdirSync(project, { recursive: true });
      const rt = installTreeAs(project, folder);
      fs.mkdirSync(path.join(project, 'specs', 'demo'), { recursive: true });
      fs.writeFileSync(path.join(rt, 'runtime.json'), '{}');
      // inspect-block: header hint names the runtime file (static check on the installed copy)
      const src = fs.readFileSync(path.join(rt, 'hooks', 'inspect-block.cjs'), 'utf8');
      assert.match(src, /<runtime>\/runtime\.json/, 'the disable hint no longer hardcodes a platform');
      // agent.cjs: skills advice follows the platform registry, not the runtime dir
      const agentSrc = fs.readFileSync(path.join(rt, 'hooks', 'agent.cjs'), 'utf8');
      assert.match(agentSrc, /'\.agents\/skills'/, 'non-Claude platforms read .agents/skills');
      void skills;
    }
  });
});
