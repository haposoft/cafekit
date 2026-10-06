'use strict';

// omp discovers .claude/skills and .agents/skills on its own, so CafeKit ships it no
// skill payload. What omp lacks is the enforcement chain, so an omp install has to
// provision the hooks and the extension directory that carries it. These tests pin the
// install path only; gate behaviour belongs to the tasks that author the fork and bridge.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const { PLATFORMS } = require(path.join(PACKAGE_ROOT, 'bin/lib/context'));

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-omp-runtime-'));
  try {
    const init = spawnSync('git', ['-C', root, 'init', '-q'], { encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function install(root, platform, extra = []) {
  return spawnSync(process.execPath, [INSTALLER, '--platform', platform, '--yes', ...extra],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } });
}

test('omp is a registered platform that ships no skill payload of its own', () => {
  const omp = PLATFORMS.omp;
  assert.ok(omp, 'omp must exist in the platform registry');
  assert.equal(omp.folder, '.omp');
  assert.equal(omp.capabilities.skills, false, 'omp reads .claude/skills itself; copying would duplicate');
  assert.equal(omp.capabilities.agents, false);
});

test('an omp install creates hooks, an extensions directory, and platform metadata', () => {
  inTempProject((root) => {
    const result = install(root, 'omp');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const hooks = fs.readdirSync(path.join(root, '.omp', 'hooks')).filter((f) => f.endsWith('.cjs'));
    assert.ok(hooks.length > 0, 'the gate scripts must be installed');
    for (const required of ['spec-gate.cjs', 'privacy-block.cjs', 'rules.cjs']) {
      assert.ok(hooks.includes(required), `missing ${required}`);
    }

    assert.equal(fs.existsSync(path.join(root, '.omp', 'extensions')), true,
      'omp auto-loads this directory; a half-provisioned install must be visibly empty, not absent');

    const metadata = JSON.parse(fs.readFileSync(path.join(root, '.omp', 'cafekit.json'), 'utf8'));
    assert.equal(metadata.platform, 'omp');
    assert.ok(metadata.version, 'the install must record a version');
  });
});

test('a non-omp install creates no .omp directory', () => {
  inTempProject((root) => {
    const result = install(root, 'claude');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.existsSync(path.join(root, '.omp')), false);
  });
});

test('an omp install ignores its own auto-executed extension directory', () => {
  inTempProject((root) => {
    assert.equal(install(root, 'omp').status, 0);
    const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    // A committed .omp/extensions/ would run arbitrary code on clone, before any gate
    // can act, so the ignore rule is part of the install rather than user hygiene.
    assert.match(ignore, /^\.omp\/$/m, '.omp/ must be ignored like .claude/ and .codex/');
  });
});

test('reinstalling omp is idempotent and preserves a user-added extension', () => {
  inTempProject((root) => {
    assert.equal(install(root, 'omp').status, 0);
    const mine = path.join(root, '.omp', 'extensions', 'my-own.mjs');
    fs.writeFileSync(mine, 'export default function () {}\n');

    assert.equal(install(root, 'omp').status, 0);
    assert.equal(fs.existsSync(mine), true, 'a reinstall erased an extension the user added');
  });
});

test('an omp install ships the scripts the Stop gate needs', () => {
  inTempProject((root) => {
    fs.mkdirSync(path.join(root, 'specs'), { recursive: true });
    const result = install(root, 'omp');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    // Every Stop-time gate requires ../scripts/*.cjs. Without these files the
    // installed gate answers "Completion gate unavailable" and the bridge turns that
    // into a block on every session_stop — the defect this case exists to pin.
    for (const script of ['workflow-policy.cjs', 'spec-receipt.cjs', 'spec-resolver.cjs', 'provenance.cjs']) {
      assert.equal(fs.existsSync(path.join(root, '.omp', 'scripts', script)), true, `missing .omp/scripts/${script}`);
    }

    const gate = spawnSync(process.execPath, [path.join(root, '.omp', 'hooks', 'spec-gate.cjs')], {
      cwd: root,
      input: JSON.stringify({ session_id: 'gate-probe', cwd: root, hook_event_name: 'Stop', stop_hook_active: false }),
      encoding: 'utf8',
    });
    assert.equal(gate.status, 0, gate.stderr);
    assert.doesNotMatch(gate.stdout, /Completion gate unavailable/, 'the installed Stop gate must load its scripts');
  });
});

test('an omp-only install injects rules', () => {
  inTempProject((root) => {
    const result = install(root, 'omp');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.existsSync(path.join(root, '.claude')), false, 'this case is about a project with no .claude at all');

    // The hooks read their configuration from the folder they live in, so omp needs its
    // own runtime.json: no statusline (omp has none), usage off (that hook reads Claude
    // Code's credential file), coding level 1 like Codex.
    const runtime = JSON.parse(fs.readFileSync(path.join(root, '.omp', 'runtime.json'), 'utf8'));
    assert.equal(runtime.codingLevel, 1);
    assert.equal(runtime.usage.enabled, false);
    assert.deepEqual(Object.keys(runtime).filter((k) => k.startsWith('statusline')), []);
    assert.equal(runtime.$schema, './runtime.schema.json');
    assert.equal(fs.existsSync(path.join(root, '.omp', 'runtime.schema.json')), true, 'the schema installs beside the file that references it');

    // The Claude set arrives whole, the overlay on top, and nothing from the test tree.
    const hooks = fs.readdirSync(path.join(root, '.omp', 'hooks'));
    assert.equal(hooks.includes('__tests__'), false, 'the source tree holds tests that must never install');
    for (const required of ['rules.cjs', 'spec-gate.cjs', 'session.cjs', 'lib/runtime-dir.cjs', 'lib/hook-payload.cjs']) {
      assert.equal(fs.existsSync(path.join(root, '.omp', 'hooks', required)), true, `missing .omp/hooks/${required}`);
    }
    const privacy = fs.readFileSync(path.join(root, '.omp', 'hooks', 'privacy-block.cjs'), 'utf8');
    assert.ok(privacy.includes("permissionDecision: 'deny'") && !privacy.includes("permissionDecision: 'ask'"),
      'the installed privacy hook must be the omp overlay, not the Claude file');

    const rules = spawnSync(process.execPath, [path.join(root, '.omp', 'hooks', 'rules.cjs')], {
      cwd: root,
      input: JSON.stringify({ session_id: `omp-rules-${Date.now()}`, cwd: root, prompt: 'hello' }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: '', PROJECT_ROOT: '' },
    });
    assert.equal(rules.status, 0, rules.stderr);
    assert.match(rules.stdout, /## Rules/, 'without .omp/runtime.json the hook exits silently and omp never sees the rules');
  });
});
