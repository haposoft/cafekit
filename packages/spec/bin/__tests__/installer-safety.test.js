'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const backup = require('../lib/backup');
const {
  commandFailureReason,
  resolvePackageCommand
} = require('../lib/skill-deps');
const { copyClaudeMdFile, copyClaudeAgentsMdFile, removeObsoleteAgents } = require('../phases/claude-runtime');
const { ensureGitignore } = require('../phases/root-config');
const { configureAddressing, patchRuntimeLocale } = require('../phases/post-install');
const { upsertManagedCoreBlock } = require('../lib/instruction-blocks');
const { upsertManagedCodexBlock, normalizeCodexBody } = require('../lib/codex-install');
const { copyRecursive } = require('../lib/copy-utils');
const { createTracker, sha256 } = require('../lib/manifest');
const { copyManagedTree } = require('../lib/managed-writer');

const START = '<!-- CAFEKIT CLAUDE START -->';
const END = '<!-- CAFEKIT CLAUDE END -->';
const CORE_START = '<!-- CAFEKIT CORE START -->';
const CORE_END = '<!-- CAFEKIT CORE END -->';
const TEMPLATE = fs.readFileSync(path.join(__dirname, '../../src/claude/CLAUDE.md'), 'utf8');
const SHARED_TEMPLATE = fs.readFileSync(path.join(__dirname, '../../src/common/AGENTS.md'), 'utf8');
const INSTALLER = path.join(__dirname, '../install.js');
const CODEX_START = '<!-- CAFEKIT CODEX START -->';
const CODEX_END = '<!-- CAFEKIT CODEX END -->';

function managedBody(content, start, end) {
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing managed block: ${start}`);
  return content.slice(startIndex + start.length, endIndex);
}

function runCombinedInstaller(root, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [INSTALLER, '--platform', 'claude,codex', '--yes', ...extraArgs],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } }
  );
}

test('skill dependency package commands use cmd.exe for Windows npm launchers', () => {
  const windows = resolvePackageCommand(
    'npm',
    ['install', '--no-audit', '--no-fund'],
    'win32',
    { ComSpec: 'C:\\Windows\\System32\\cmd.exe' }
  );
  assert.deepEqual(windows, {
    command: 'C:\\Windows\\System32\\cmd.exe',
    args: ['/d', '/s', '/c', 'npm.cmd', 'install', '--no-audit', '--no-fund']
  });

  const posix = resolvePackageCommand('npx', ['playwright', '--version'], 'linux', {});
  assert.deepEqual(posix, {
    command: 'npx',
    args: ['playwright', '--version']
  });
});

test('skill dependency failures surface the useful npm or spawn error code', () => {
  assert.equal(
    commandFailureReason({
      stderr: "npm error Request failed\nnpm error code ENOTCACHED\nnpm error Log unavailable\n",
      stdout: '',
      status: 1
    }),
    'npm error code ENOTCACHED'
  );
  assert.equal(
    commandFailureReason({
      stderr: 'spawn npm.cmd EINVAL',
      stdout: '',
      status: null,
      errorCode: 'EINVAL'
    }),
    'spawn npm.cmd EINVAL'
  );
});

function inTempProject(run) {
  const originalCwd = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-installer-safety-'));
  process.chdir(root);
  try {
    return run(root);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function runCodexInstaller(root) {
  return spawnSync(process.execPath, [INSTALLER, '--platform', 'codex', '--yes'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' }
  });
}

function rootFileGit(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function commitRootFile(root, file) {
  rootFileGit(root, ['init', '-q']);
  const content = file === 'AGENTS.md' ? upsertManagedCoreBlock('', SHARED_TEMPLATE) : TEMPLATE;
  fs.writeFileSync(path.join(root, file), `${content}\n## Project notes\nKeep these project notes.\n`);
  rootFileGit(root, ['add', '--', file]);
  rootFileGit(root, ['-c', 'user.name=CafeKit Fixture', '-c', 'user.email=cafekit-fixture@example.invalid',
    'commit', '--no-gpg-sign', '-qm', 'root file fixture']);
}

function runRootFileInstaller(root, platform, args = [], env = {}) {
  return spawnSync(process.execPath,
    [INSTALLER, '--platform', platform, '--yes', '--without-document-skills', ...args],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin', ...env } });
}

for (const [file, platform, args] of [
  ['AGENTS.md', 'claude', []], ['CLAUDE.md', 'claude', []],
  ['AGENTS.md', 'codex', []], ['AGENTS.md', 'omp', []],
  ['AGENTS.md', 'claude', ['--dry-run']],
]) {
  test(`missing tracked ${file} stops ${platform} installation${args.length ? ' in dry-run' : ''} before writes`, () => {
    inTempProject(root => {
      commitRootFile(root, file);
      fs.unlinkSync(path.join(root, file));
      const before = fs.readdirSync(root).filter(name => name !== '.cafekit.lock');
      const result = runRootFileInstaller(root, platform, args);
      const output = `${result.stdout}\n${result.stderr}`;
      assert.notEqual(result.status, 0, output);
      assert.ok(output.includes(`git checkout -- ${file}`), output);
      assert.ok(output.includes(`git rm ${file}`), output);
      assert.deepEqual(fs.readdirSync(root).filter(name => name !== '.cafekit.lock'), before);
      for (const name of ['AGENTS.md', 'CLAUDE.md', '.claude', '.codex', '.agents', '.omp', '.cafekit-backup']) {
        assert.equal(fs.existsSync(path.join(root, name)), false, name);
      }
    });
  });
}

for (const assumeUnchanged of [false, true]) {
  test(`missing skip-worktree AGENTS.md permits installation${assumeUnchanged ? ' with assume-unchanged' : ''}`, () => {
    inTempProject(root => {
      commitRootFile(root, 'AGENTS.md');
      rootFileGit(root, ['update-index', '--skip-worktree', '--', 'AGENTS.md']);
      if (assumeUnchanged) rootFileGit(root, ['update-index', '--assume-unchanged', '--', 'AGENTS.md']);
      assert.match(rootFileGit(root, ['ls-files', '-v', '--', 'AGENTS.md']), assumeUnchanged ? /^s / : /^S /);
      fs.unlinkSync(path.join(root, 'AGENTS.md'));
      const result = runRootFileInstaller(root, 'claude');
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
    });
  });
}

test('a tracked dangling CLAUDE.md symlink is present for the root preflight', () => {
  inTempProject(root => {
    rootFileGit(root, ['init', '-q']);
    fs.mkdirSync(path.join(root, 'notes'));
    fs.symlinkSync('notes/claude.md', path.join(root, 'CLAUDE.md'));
    rootFileGit(root, ['add', '--', 'CLAUDE.md']);
    rootFileGit(root, ['-c', 'user.name=CafeKit Fixture', '-c', 'user.email=cafekit-fixture@example.invalid',
      'commit', '--no-gpg-sign', '-qm', 'root symlink fixture']);
    const result = runRootFileInstaller(root, 'claude');
    const output = `${result.stdout}\n${result.stderr}`;
    assert.notEqual(result.status, 0, output);
    assert.doesNotMatch(output, /tracked by git but missing/);
    assert.match(output, /Refusing to follow symlinked managed path/);
    assert.equal(fs.readlinkSync(path.join(root, 'CLAUDE.md')), 'notes/claude.md');
    assert.equal(fs.existsSync(path.join(root, 'notes/claude.md')), false);
    assert.deepEqual(fs.readdirSync(path.join(root, 'notes')), []);
  });
});

test('uncertain git ownership warns and permits a fresh root file', () => {
  inTempProject(root => {
    commitRootFile(root, 'AGENTS.md');
    fs.unlinkSync(path.join(root, 'AGENTS.md'));
    const result = runRootFileInstaller(root, 'claude', [], {
      GIT_TEST_ASSUME_DIFFERENT_OWNER: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /Could not confirm git state for AGENTS\.md; installing a fresh copy\./);
    assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
  });
});

test('Codex installation leaves a missing tracked CLAUDE.md alone', () => {
  inTempProject(root => {
    commitRootFile(root, 'CLAUDE.md');
    fs.unlinkSync(path.join(root, 'CLAUDE.md'));
    const result = runRootFileInstaller(root, 'codex');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), false);
  });
});

test('a root file removed from the git index can be freshly installed', () => {
  inTempProject(root => {
    commitRootFile(root, 'AGENTS.md');
    rootFileGit(root, ['rm', '--', 'AGENTS.md']);
    const result = runRootFileInstaller(root, 'claude');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Could not confirm git state/);
  });
});

test('a project outside git installs root files without a git-state warning', () => {
  inTempProject(root => {
    const result = runRootFileInstaller(root, 'claude');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Could not confirm git state/);
  });
});

test('an existing tracked root file retains notes after its managed marker', () => {
  inTempProject(root => {
    commitRootFile(root, 'AGENTS.md');
    const result = runRootFileInstaller(root, 'claude');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), /CAFEKIT CORE END -->[\s\S]*Keep these project notes\./);
  });
});

for (const host of ['claude', 'codex']) {
  for (const state of ['pristine file', 'modified file', 'untracked file', 'external symlink', 'dangling symlink', 'pristine directory', 'directory with an extra file', 'directory with a modified file', 'directory with a symlink']) {
    test(`${host} obsolete cleanup safely handles a ${state}`, () => {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-obsolete-outside-'));
      try {
        inTempProject(root => {
          const run = () => spawnSync(process.execPath, [INSTALLER, '--platform', host, '--yes', '--force-overwrite'], {
            cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' }
          });
          const first = run();
          assert.equal(first.status, 0, first.stderr);
          const folder = `.${host}`;
          const manifestPath = path.join(root, folder, 'cafekit-manifest.json');
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const directory = state.includes('directory');
          const relative = directory
            ? (host === 'codex' ? '.agents/skills/generate-graph' : '.claude/skills/generate-graph')
            : `${folder}/hooks/usage.cjs`;
          const target = path.join(root, relative);
          const keyFor = relative => host === 'codex' ? relative : relative.slice('.claude/'.length);
          const records = {};
          const record = (relative, bytes) => {
            const key = keyFor(relative);
            records[key] = { sha256: sha256(bytes) };
            manifest.files[key] = records[key];
          };
          const external = path.join(outside, 'target.txt');
          if (state !== 'dangling symlink') fs.writeFileSync(external, 'outside bytes\n');
          fs.mkdirSync(path.dirname(target), { recursive: true });
          if (directory) {
            fs.mkdirSync(path.join(target, 'nested'), { recursive: true });
            fs.writeFileSync(path.join(target, 'tracked.txt'), state.includes('modified') ? 'changed\n' : 'installed\n');
            fs.writeFileSync(path.join(target, 'nested/second.txt'), 'second\n');
            record(`${relative}/tracked.txt`, 'installed\n');
            record(`${relative}/nested/second.txt`, 'second\n');
            if (state.includes('extra')) fs.writeFileSync(path.join(target, 'foreign.txt'), 'user bytes\n');
            if (state.includes('symlink')) {
              fs.symlinkSync(external, path.join(target, 'linked.txt'));
              record(`${relative}/linked.txt`, 'outside bytes\n');
            }
          } else if (state.includes('symlink')) {
            fs.symlinkSync(external, target);
            record(relative, 'outside bytes\n');
          } else {
            fs.writeFileSync(target, state === 'modified file' ? 'changed\n' : 'installed\n');
            if (state !== 'untracked file') record(relative, 'installed\n');
          }
          fs.writeFileSync(manifestPath, JSON.stringify(manifest));
          const again = run();
          assert.equal(again.status, 0, `${again.stdout}\n${again.stderr}`);
          const preserved = !state.startsWith('pristine');
          assert.equal(fs.existsSync(target) || state === 'dangling symlink' && fs.lstatSync(target).isSymbolicLink(), preserved);
          const after = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          for (const [key, value] of Object.entries(records)) {
            if (preserved) assert.deepEqual(after.files[key], value, key);
            else assert.equal(after.files[key], undefined, key);
          }
          if (state.includes('symlink')) {
            const link = directory ? path.join(target, 'linked.txt') : target;
            assert.ok(fs.lstatSync(link).isSymbolicLink());
            assert.equal(fs.readlinkSync(link), external);
          }
          if (state !== 'dangling symlink') assert.equal(fs.readFileSync(external, 'utf8'), 'outside bytes\n');
          else assert.equal(fs.existsSync(external), false);
          const warnings = `${again.stdout}\n${again.stderr}`.split('\n').filter(line => /Preserved \d+ obsolete runtime/.test(line));
          assert.equal(warnings.length, preserved ? 1 : 0);
          if (preserved) {
            assert.match(warnings[0], /Preserved 1 obsolete runtime/);
            assert.match(warnings[0], /manually/i);
          }
        });
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });
  }
}

test('combined install emits one aggregate warning for preserved obsolete runtime items', () => {
  inTempProject(root => {
    assert.equal(runCombinedInstaller(root).status, 0);
    for (const host of ['claude', 'codex']) {
      fs.writeFileSync(path.join(root, `.${host}/hooks/usage.cjs`), 'user bytes\n');
    }
    const again = runCombinedInstaller(root);
    assert.equal(again.status, 0, again.stderr);
    const warnings = `${again.stdout}\n${again.stderr}`.split('\n').filter(line => /Preserved \d+ obsolete runtime/.test(line));
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Preserved 2 obsolete runtime/);
    assert.match(warnings[0], /manually/i);
    for (const host of ['claude', 'codex']) assert.equal(fs.readFileSync(path.join(root, `.${host}/hooks/usage.cjs`), 'utf8'), 'user bytes\n');
  });
});

test('combined install removes pristine obsolete files after each host tracker is available', () => {
  inTempProject(root => {
    assert.equal(runCombinedInstaller(root).status, 0);
    for (const host of ['claude', 'codex']) {
      const target = path.join(root, `.${host}/hooks/usage.cjs`);
      fs.writeFileSync(target, 'installed bytes\n');
      const manifestPath = path.join(root, `.${host}/cafekit-manifest.json`);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const key = host === 'codex' ? '.codex/hooks/usage.cjs' : 'hooks/usage.cjs';
      manifest.files[key] = { sha256: sha256('installed bytes\n') };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    }
    const again = runCombinedInstaller(root);
    assert.equal(again.status, 0, again.stderr);
    for (const host of ['claude', 'codex']) {
      assert.equal(fs.existsSync(path.join(root, `.${host}/hooks/usage.cjs`)), false, host);
      const manifest = JSON.parse(fs.readFileSync(path.join(root, `.${host}/cafekit-manifest.json`), 'utf8'));
      assert.equal(manifest.files[host === 'codex' ? '.codex/hooks/usage.cjs' : 'hooks/usage.cjs'], undefined, host);
    }
    assert.doesNotMatch(again.stdout + again.stderr, /Preserved \d+ obsolete runtime/);
  });
});

test('identical Codex reinstall does not report hook helpers or rules updated', () => {
  inTempProject(root => {
    const first = runCodexInstaller(root);
    assert.equal(first.status, 0, first.stderr);
    const second = runCodexInstaller(root);
    assert.equal(second.status, 0, second.stderr);
    const labels = ['Codex native hooks', 'Codex privacy command analyzer', 'Codex privacy path analyzer',
      'Codex secret keyword matcher', 'Codex runtime path safety', 'Codex inspection path analyzer',
      'Codex spec touch helpers', 'Codex update check', 'Codex native rule overrides', 'rules/ directory'];
    const updates = `${second.stdout}\n${second.stderr}`.split('\n')
      .filter(line => line.includes('↻') && labels.some(label => line.includes(label)));
    assert.deepEqual(updates, []);
  });
});

test('installed Codex hook libraries match canonical bytes and contain no source shims', () => {
  inTempProject(root => {
    const result = runCodexInstaller(root);
    assert.equal(result.status, 0, result.stderr);
    const sourceRoot = path.join(__dirname, '../../src');
    const libs = path.join(sourceRoot, 'codex/hooks/lib');
    const shim = /^(?:['"]use strict['"];?\s*)?module\.exports\s*=\s*require\(['"]\.\.\/\.\.\/\.\.\/claude\/hooks\/lib\/([^'"]+)['"]\);?\s*$/;
    for (const name of fs.readdirSync(libs)) {
      const source = fs.readFileSync(path.join(libs, name), 'utf8');
      const match = source.match(shim);
      if (match) assert.equal(match[1], name);
      const expected = path.join(sourceRoot, match ? 'claude/hooks/lib' : 'codex/hooks/lib', name);
      const installed = fs.readFileSync(path.join(root, '.codex/hooks/lib', name));
      assert.doesNotMatch(installed.toString(), shim, name);
      assert.deepEqual(installed, fs.readFileSync(expected), name);
    }
  });
});

test('installed Claude runtime omits retired usage configuration', () => {
  inTempProject(root => {
    const result = runCombinedInstaller(root);
    assert.equal(result.status, 0, result.stderr);
    const runtime = JSON.parse(fs.readFileSync(path.join(root, '.claude/runtime.json'), 'utf8'));
    assert.equal(Object.hasOwn(runtime, 'usage'), false);
  });
});

test('multimodal setup scripts keep local resolution without the missing resolver', () => {
  for (const name of ['check_setup.py', 'gemini_batch_process.py']) {
    const content = fs.readFileSync(path.join(__dirname, '../../src/claude/skills/ai-multimodal/scripts', name), 'utf8');
    assert.doesNotMatch(content, /resolve_env|CENTRALIZED_RESOLVER_AVAILABLE/, name);
    assert.ok(content.includes("os.getenv('GEMINI_API_KEY')"), name);
  }
});

test('legacy managed root gitignore migrates A13 plan patterns and preserves user content', () => {
  inTempProject((root) => {
    fs.writeFileSync('.gitignore', [
      '# User preface',
      'keep-before.txt',
      '',
      '# CafeKit / Ecosystem',
      '',
      '# legacy managed note',
      'specs/_shared/',
      'plans/',
      '!plans/templates/*',
      '.cafekit-backup/',
      '.cafekit.lock',
      '.claude/',
      '.legacy-runtime/',
      '.codex/',
      '.agents/',
      '',
      '# User-owned section',
      'custom-ignore/',
      'keep-after.txt',
      ''
    ].join('\n'), 'utf8');

    const context = {
      dryRun: false,
      ui: { detail() {} },
      results: { copied: 0, updated: 0, skipped: 0 }
    };
    ensureGitignore(context);

    const migrated = fs.readFileSync('.gitignore', 'utf8');
    const lines = migrated.split('\n');
    const headerIndex = lines.indexOf('# CafeKit / Ecosystem');
    const userSectionIndex = lines.indexOf('# User-owned section');
    assert.deepEqual(lines.slice(headerIndex + 1, userSectionIndex - 1), [
      '',
      '# legacy managed note',
      'specs/_shared/',
      'plans/*',
      '!plans/*.md',
      '!plans/templates/',
      '!plans/templates/**',
      '.cafekit-backup/',
      '.cafekit.lock',
      '.claude/',
      '.legacy-runtime/',
      '.codex/',
      '.agents/'
    ]);
    assert.match(migrated, /# User preface\nkeep-before\.txt/);
    assert.match(migrated, /# User-owned section\ncustom-ignore\/\nkeep-after\.txt/);
    assert.doesNotMatch(migrated, /^plans\/$/m);
    assert.doesNotMatch(migrated, /^!plans\/templates\/\*$/m);

    const firstPass = Buffer.from(migrated);
    assert.equal(context.results.updated, 1);
    ensureGitignore(context);
    assert.deepEqual(fs.readFileSync('.gitignore'), firstPass);
    assert.equal(context.results.updated, 1);
    assert.equal(context.results.skipped, 1);

    fs.mkdirSync(path.join(root, 'plans/reports'), { recursive: true });
    fs.writeFileSync(path.join(root, 'plans/example.md'), 'top-level markdown\n');
    fs.writeFileSync(path.join(root, 'plans/reports/example.md'), 'nested markdown\n');
    fs.writeFileSync(path.join(root, 'plans/example.html'), 'html artifact\n');
    const init = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    const status = spawnSync(
      'git',
      ['status', '--short', '--ignored', '--untracked-files=all'],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /^\?\? plans\/example\.md$/m);
    assert.match(status.stdout, /^!! plans\/reports\/example\.md$/m);
    assert.match(status.stdout, /^!! plans\/example\.html$/m);
    assert.doesNotMatch(status.stdout, /^!! plans\/example\.md$/m);
  });
});

test('malformed managed marker topology fails transactionally and preserves exact bytes', () => {
  const markers = {
    claude: ['<!-- CAFEKIT CORE START -->', '<!-- CAFEKIT CORE END -->'],
    codex: ['<!-- CAFEKIT CODEX START -->', '<!-- CAFEKIT CODEX END -->']
  };
  const topologies = (start, end) => [
    `user\n${end}\n`,
    `user\n${start}\n`,
    `${start}\na\n${start}\nb\n${end}\n`,
    `${start}\na\n${end}\nb\n${end}\n`,
    `${end}\nuser\n${start}\n`
  ];

  for (const [platform, [start, end]] of Object.entries(markers)) {
    for (const content of topologies(start, end)) {
      inTempProject((root) => {
        fs.writeFileSync('AGENTS.md', content, 'utf8');
        const before = fs.readFileSync('AGENTS.md');
        const result = spawnSync(
          process.execPath,
          [INSTALLER, '--platform', platform, '--yes', '--force-overwrite'],
          { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } }
        );
        assert.notEqual(result.status, 0, `${platform}\n${result.stdout}\n${result.stderr}`);
        assert.deepEqual(fs.readFileSync('AGENTS.md'), before);
        assert.match(`${result.stdout}\n${result.stderr}`, /malformed .*marker topology/i);
        assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /unchanged|success/i);
      });
    }
  }
});

test('combined install keeps CORE neutral and records native shared-root trade-off', () => {
  inTempProject((root) => {
    const result = runCombinedInstaller(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const agents = fs.readFileSync('AGENTS.md', 'utf8');
    const claude = fs.readFileSync('CLAUDE.md', 'utf8');
    const core = managedBody(agents, CORE_START, CORE_END);
    const codex = managedBody(agents, CODEX_START, CODEX_END);
    const claudeBlock = managedBody(claude, START, END);

    for (const [content, marker] of [
      [agents, CORE_START],
      [claude, START],
      [agents, CODEX_START]
    ]) assert.equal((content.match(new RegExp(marker, 'g')) || []).length, 1);

    assert.doesNotMatch(core, /Claude|Codex|\.claude|\.codex|\/cf:|\$cf-/i);
    assert.doesNotMatch(claudeBlock, /Codex|\.codex|\$cf-/i);
    assert.match(codex, /native project instruction surface is root `AGENTS\.md`/);
    assert.match(agents, /shared-root trade-off is intentional/);
    // H5 remediation: ownership/ignore contract must be explicit — not just marker presence
    assert.match(core, /runtime-neutral/i);
    assert.match(core, /fail-safe/i);
    assert.match(core, /Ignore managed blocks not owned by your runtime/i);
    assert.match(codex, /owned by Codex/i);
    assert.match(codex, /If you are Claude Code or any other runtime, ignore this entire Codex block/i);
    assert.doesNotMatch(codex, /If you are Codex CLI or any other runtime, ignore this entire Codex block/i);
    assert.match(codex, /fail-safe/i);
    // CORE must not contain runtime-specific directives that would leak
    assert.doesNotMatch(core, /\$cf-|cf:/i);
    // No cross-runtime directive leakage: Claude block must not contain foreign runtime directives
    assert.doesNotMatch(claudeBlock, /<!-- CAFEKIT CODEX /);
    assert.doesNotMatch(codex, /<!-- CAFEKIT CORE /);

    const userAgents = '\n## User-owned combined note\nKeep this exact.\n';
    const userClaude = '\n## User-owned Claude note\nKeep this exact.\n';
    fs.appendFileSync('AGENTS.md', userAgents);
    fs.appendFileSync('CLAUDE.md', userClaude);
    const rerun = runCombinedInstaller(root, ['--force-overwrite']);
    assert.equal(rerun.status, 0, `${rerun.stdout}\\n${rerun.stderr}`);
    const afterAgents = fs.readFileSync('AGENTS.md', 'utf8');
    const afterClaude = fs.readFileSync('CLAUDE.md', 'utf8');
    assert.match(afterAgents, /User-owned combined note\nKeep this exact\./);
    assert.match(afterClaude, /User-owned Claude note\nKeep this exact\./);
    assert.equal((afterAgents.match(new RegExp(CORE_START, 'g')) || []).length, 1);
    assert.equal((afterAgents.match(new RegExp(CODEX_START, 'g')) || []).length, 1);
    assert.equal((afterClaude.match(new RegExp(START, 'g')) || []).length, 1);
    assert.equal(afterAgents.slice(-userAgents.length), userAgents);
    assert.equal(afterClaude.slice(-userClaude.length), userClaude);
    // Ownership contract must survive rerun
    const afterCore = managedBody(afterAgents, CORE_START, CORE_END);
    const afterCodex = managedBody(afterAgents, CODEX_START, CODEX_END);
    assert.match(afterCore, /runtime-neutral/i);
    assert.match(afterCodex, /If you are Claude Code or any other runtime, ignore this entire Codex block/i);
    assert.doesNotMatch(afterCodex, /If you are Codex CLI or any other runtime, ignore this entire Codex block/i);
  });
});

test('combined locale stays in CORE and addressing stays in each native managed block', () => {
  inTempProject((root) => {
    const result = spawnSync(
      process.execPath,
      [INSTALLER, '--platform', 'claude,codex', '--yes', '--lang', 'vi'],
      { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } }
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const agents = fs.readFileSync('AGENTS.md', 'utf8');
    const claude = fs.readFileSync('CLAUDE.md', 'utf8');
    const core = managedBody(agents, CORE_START, CORE_END);
    assert.equal((core.match(/## Language Consistency <!-- cafekit:lang -->/g) || []).length, 1);
    assert.equal((claude.match(/## Language Consistency <!-- cafekit:lang -->/g) || []).length, 0);

    configureAddressing({
      platforms: ['claude', 'codex'],
      ui: { success() {}, warn() {} },
      t: () => 'updated'
    }, 'anh');

    const addressedAgents = fs.readFileSync('AGENTS.md', 'utf8');
    const addressedClaude = fs.readFileSync('CLAUDE.md', 'utf8');
    assert.equal((addressedAgents.match(/## Addressing \(Context Overflow Indicator\)/g) || []).length, 1);
    assert.equal((addressedClaude.match(/## Addressing \(Context Overflow Indicator\)/g) || []).length, 1);
    assert.equal((managedBody(addressedAgents, CORE_START, CORE_END).match(/## Addressing \(Context Overflow Indicator\)/g) || []).length, 0);
    assert.match(managedBody(addressedAgents, CODEX_START, CODEX_END), /Codex CLI always addresses the user as "anh"/);
    assert.match(managedBody(addressedClaude, START, END), /Claude Code always addresses the user as "anh"/);
  });
});
test('combined malformed runtime marker rolls back exact root bytes', () => {
  inTempProject((root) => {
    const before = `user bytes\n${CODEX_START}\nunterminated\n`;
    fs.writeFileSync('AGENTS.md', before, 'utf8');
    const result = runCombinedInstaller(root, ['--force-overwrite']);
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.readFileSync('AGENTS.md', 'utf8'), before);
    assert.match(`${result.stdout}\n${result.stderr}`, /malformed .*marker topology/i);
    assert.match(`${result.stdout}\n${result.stderr}`, /Installation failed|Changes rolled back/);
  });
});

test('malformed CLAUDE.md marker topology preserves exact bytes and reports an error', () => {
  inTempProject(() => {
    const content = `${START}\nuser managed content without end\n`;
    fs.writeFileSync('CLAUDE.md', content, 'utf8');
    const ctx = installContext([]);
    copyClaudeMdFile(ctx, 'claude');
    assert.equal(fs.readFileSync('CLAUDE.md', 'utf8'), content);
    assert.equal(ctx.results.errors, 1);
  });
});

test('fresh no-lang install leaves locale unset and rules hook silent', () => {
  inTempProject((root) => {
    const result = spawnSync(
      process.execPath,
      [INSTALLER, '--platform', 'claude', '--yes'],
      { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } }
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const runtime = JSON.parse(fs.readFileSync('.claude/runtime.json', 'utf8'));
    assert.equal(runtime.locale.responseLanguage, null);
    const hook = spawnSync(
      process.execPath,
      [path.join(root, '.claude/hooks/rules.cjs')],
      { cwd: root, input: JSON.stringify({ cwd: root, session_id: 'fresh-no-lang' }), encoding: 'utf8' }
    );
    assert.equal(hook.status, 0, hook.stderr);
    assert.doesNotMatch(hook.stdout, /Language Consistency|Always respond in|Respond in/);
  });
});

test('obsolete agent pruning is ownership-aware across Claude and Codex', () => {
  const cases = {
    claude: ['agents/god-developer.md', '.claude'],
    codex: ['agents/god_developer.toml', '.codex']
  };
  for (const [platformKey, [relative, folder]] of Object.entries(cases)) {
    for (const state of ['pristine', 'modified', 'untracked']) {
      inTempProject(() => {
        const target = path.join(folder, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'old agent\n', 'utf8');
        const tracker = platformKey === 'codex'
          ? createTracker(folder, 'test', { recordRoot: '.', allowedRoots: ['.codex', '.agents'] })
          : createTracker(folder, 'test');
        const key = tracker.keyFor(target);
        const ownership = state === 'untracked'
          ? { files: {} }
          : { files: { [key]: { sha256: sha256(state === 'pristine' ? 'old agent\n' : 'different\n') } } };
        const warnings = [];
        const ctx = {
          dryRun: false,
          manifest: { obsolete: { agents: { [platformKey]: [relative] } } },
          ownership: { [folder]: ownership },
          trackers: { [platformKey]: tracker },
          ui: { detail() {}, warn(message) { warnings.push(message); } },
          results: { updated: 0, preserved: 0, preservedFiles: [] }
        };
        removeObsoleteAgents(ctx, platformKey);
        if (state === 'pristine') {
          assert.equal(fs.existsSync(target), false);
          assert.equal(tracker._pruned.has(key), true);
          assert.equal(warnings.length, 0);
        } else {
          assert.equal(fs.existsSync(target), true);
          assert.equal(warnings.length, 1);
          assert.equal(ctx.results.preserved, 1);
          assert.equal(tracker._pruned.has(key), false);
        }
      });
    }
  }
});

function installContext(pruned) {
  return {
    dryRun: false,
    options: { forceOverwrite: true },
    ownership: { '.claude': { files: {} } },
    trackers: {
      claude: {
        recorded: () => null,
        record: () => assert.fail('root CLAUDE.md must not be recorded'),
        prune: (target) => pruned.push(target)
      }
    },
    ui: { detail() {}, warn() {}, success() {} },
    results: {
      copied: 0,
      updated: 0,
      unchanged: 0,
      preserved: 0,
      missingDependencies: 0,
      errors: 0,
      preservedFiles: []
    }
  };
}

test('managed CLAUDE block replacement preserves user bytes under force overwrite', () => {
  inTempProject(() => {
    const before = '# User preface\n\n';
    const after = '\n\n## User tail\nKeep this exactly.\n';
    fs.writeFileSync('CLAUDE.md', `${before}${START}\nold managed text\n${END}${after}`);

    const pruned = [];
    copyClaudeMdFile(installContext(pruned), 'claude');

    const content = fs.readFileSync('CLAUDE.md', 'utf8');
    assert.ok(content.startsWith(before));
    assert.ok(content.endsWith(after));
    assert.ok(content.includes(TEMPLATE.trimEnd()));
    assert.equal(content.match(new RegExp(START, 'g')).length, 1);
    assert.deepEqual(pruned, ['../CLAUDE.md']);
  });
});

test('legacy pristine CLAUDE template migrates to one managed block', () => {
  inTempProject(() => {
    fs.writeFileSync('CLAUDE.md', TEMPLATE);
    const pruned = [];

    copyClaudeMdFile(installContext(pruned), 'claude');

    const content = fs.readFileSync('CLAUDE.md', 'utf8');
    assert.equal(content, `${START}\n${TEMPLATE.trimEnd()}\n${END}\n`);
    assert.equal(content.match(new RegExp(START, 'g')).length, 1);
    assert.deepEqual(pruned, ['../CLAUDE.md']);
  });
});

test('legacy shared AGENTS block migrates to one core marker', () => {
  inTempProject(() => {
    const shared = fs.readFileSync(path.join(__dirname, '../../src/common/AGENTS.md'), 'utf8');
    fs.writeFileSync(
      'AGENTS.md',
      `# User instructions\n\n<!-- CAFEKIT CLAUDE AGENTS START -->\n${shared.trimEnd()}\n<!-- CAFEKIT CLAUDE AGENTS END -->\n`
    );

    copyClaudeAgentsMdFile(installContext([]), 'claude');

    const content = fs.readFileSync('AGENTS.md', 'utf8');
    assert.equal((content.match(/<!-- CAFEKIT CORE START -->/g) || []).length, 1);
    assert.equal((content.match(/<!-- CAFEKIT CLAUDE AGENTS START -->/g) || []).length, 0);
    assert.ok(content.startsWith('# User instructions'));
  });
});
test('addressing changes remain inside the managed CLAUDE block', () => {
  inTempProject(() => {
    const userSection = '## Addressing (Context Overflow Indicator)\n\nUser-owned wording.';
    const managedSection = '## Addressing (Context Overflow Indicator)\n\nOld managed wording.';
    fs.writeFileSync(
      'CLAUDE.md',
      `${userSection}\n\n${START}\n${managedSection}\n${END}\n`
    );
    const ctx = {
      platforms: ['claude'],
      ui: { success() {}, warn() {} },
      t: () => 'updated'
    };

    configureAddressing(ctx, 'anh');

    const content = fs.readFileSync('CLAUDE.md', 'utf8');
    assert.ok(content.startsWith(`${userSection}\n\n${START}`));
    assert.ok(content.includes('Claude Code always addresses the user as "anh"'));
  });
});

test('addressing appends when template has no section without entering shared CORE', () => {
  inTempProject(() => {
    const templateWithoutAddressing = TEMPLATE
      .replace(/\n## Addressing \(Context Overflow Indicator\)[\s\S]*$/m, '')
      .trimEnd();
    fs.writeFileSync('CLAUDE.md', `${START}\n${templateWithoutAddressing}\n${END}\n`);
    fs.writeFileSync('AGENTS.md', upsertManagedCoreBlock('', SHARED_TEMPLATE));
    const ctx = {
      platforms: ['claude'],
      ui: { success() {}, warn() {} },
      t: () => 'updated'
    };

    configureAddressing(ctx, 'bro');

    const claude = fs.readFileSync('CLAUDE.md', 'utf8');
    const agents = fs.readFileSync('AGENTS.md', 'utf8');
    const core = agents.slice(agents.indexOf(CORE_START), agents.indexOf(CORE_END));
    assert.match(claude, /## Addressing \(Context Overflow Indicator\)/);
    assert.match(claude, /Claude Code always addresses the user as "bro"/);
    assert.doesNotMatch(core, /## Addressing \(Context Overflow Indicator\)/);
    assert.doesNotMatch(core, /always addresses the user as "bro"/);
  });
});



test('locale patch does not claim ownership of a preserved user runtime', () => {
  inTempProject(() => {
    fs.mkdirSync('.codex', { recursive: true });
    fs.writeFileSync(
      '.codex/runtime.json',
      `${JSON.stringify({ custom: true, locale: { responseLanguage: 'English' } })}\n`
    );
    const ctx = {
      platforms: ['codex'],
      locale: 'Tiếng Việt',
      lang: 'vi',
      trackers: {
        codex: {
          keyFor: () => '.codex/runtime.json',
          recorded: () => null,
          record: () => assert.fail('preserved runtime must not become installer-owned')
        }
      }
    };

    patchRuntimeLocale(ctx);

    const runtime = JSON.parse(fs.readFileSync('.codex/runtime.json', 'utf8'));
    assert.equal(runtime.custom, true);
    assert.equal(runtime.locale.responseLanguage, 'Tiếng Việt');
  });
});

test('backup restores existing targets and removes targets absent before the run', () => {
  inTempProject(() => {
    fs.mkdirSync('.claude/nested', { recursive: true });
    fs.writeFileSync('.claude/nested/runtime.txt', 'before\n');
    fs.writeFileSync('CLAUDE.md', 'user instructions\n');

    const backupDir = backup.snapshot(
      ['.claude', 'CLAUDE.md', '.gitignore'],
      '20260729-test'
    );
    const metadata = JSON.parse(
      fs.readFileSync(path.join(backupDir, 'snapshot.json'), 'utf8')
    );
    assert.deepEqual(metadata.targets, [
      { target: '.claude', existed: true },
      { target: 'CLAUDE.md', existed: true },
      { target: '.gitignore', existed: false }
    ]);

    fs.writeFileSync('.claude/nested/runtime.txt', 'after\n');
    fs.writeFileSync('CLAUDE.md', 'overwritten\n');
    fs.writeFileSync('.gitignore', 'generated\n');
    backup.restore(backupDir);

    assert.equal(fs.readFileSync('.claude/nested/runtime.txt', 'utf8'), 'before\n');
    assert.equal(fs.readFileSync('CLAUDE.md', 'utf8'), 'user instructions\n');
    assert.equal(fs.existsSync('.gitignore'), false);
    assert.equal(fs.existsSync(path.join(backupDir, 'snapshot.json')), true);
  });
});

test('backup preserves nested dependency symlinks without following them', () => {
  inTempProject(() => {
    fs.mkdirSync('.agents/skills/demo/.venv/bin', { recursive: true });
    fs.mkdirSync('toolchain', { recursive: true });
    fs.writeFileSync('toolchain/python3', 'project-owned target\n');
    const linkPath = '.agents/skills/demo/.venv/bin/python3';
    const linkTarget = '../../../../../toolchain/python3';
    fs.symlinkSync(linkTarget, linkPath);

    const backupDir = backup.snapshot(['.agents'], '20260729-nested-symlink');
    const backupLink = path.join(backupDir, 'data', linkPath);
    assert.equal(fs.lstatSync(backupLink).isSymbolicLink(), true);
    assert.equal(fs.readlinkSync(backupLink), linkTarget);

    fs.rmSync('.agents', { recursive: true, force: true });
    backup.restore(backupDir);

    assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
    assert.equal(fs.readlinkSync(linkPath), linkTarget);
    assert.equal(fs.readFileSync(linkPath, 'utf8'), 'project-owned target\n');
  });
});

test('backup rejects traversal targets before snapshot or restore deletion', () => {
  inTempProject(() => {
    assert.throws(
      () => backup.snapshot(['../outside'], '20260729-test'),
      /Unsafe backup target/
    );
  });
});

test('managed targets and snapshots reject project symlink traversal', () => {
  inTempProject((root) => {
    fs.mkdirSync('external', { recursive: true });
    fs.symlinkSync(
      path.join(root, 'external'),
      '.agents',
      process.platform === 'win32' ? 'junction' : 'dir'
    );

    const { createTracker } = require('../lib/manifest');
    const tracker = createTracker('.codex', 'test', {
      recordRoot: '.',
      allowedRoots: ['.codex', '.agents']
    });
    assert.throws(
      () => tracker.keyFor('.agents/skills/specs/SKILL.md'),
      /Refusing to follow symlinked managed path/
    );
    assert.throws(
      () => backup.snapshot(['.agents'], '20260729-symlink-test'),
      /Refusing to follow symlinked managed path/
    );
  });
});

test('managed tree copy rejects source and destination symlink traversal before writes', () => {
  inTempProject((root) => {
    const source = path.join(root, 'source');
    const outsideSource = path.join(root, 'outside-source.txt');
    const destination = path.join('.codex', 'payload');
    fs.mkdirSync(source);
    fs.writeFileSync(outsideSource, 'outside');
    fs.symlinkSync(outsideSource, path.join(source, 'linked.txt'));
    const ctx = {
      dryRun: false,
      options: { forceOverwrite: false },
      ownership: {},
      results: { preservedFiles: [] },
    };
    const copy = () => copyManagedTree({
      src: source,
      dest: destination,
      platformFolder: '.codex',
      ctx,
      tracker: null,
    });
    assert.throws(copy, /source tree cannot contain symlinks/i);
    assert.equal(fs.existsSync(destination), false);

    fs.rmSync(path.join(source, 'linked.txt'));
    fs.writeFileSync(path.join(source, 'safe.txt'), 'safe');
    const outsideDestination = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-managed-outside-'));
    try {
      fs.symlinkSync(outsideDestination, path.join(root, '.codex'));
      assert.throws(copy, /Refusing to follow symlinked managed path/);
      assert.deepEqual(fs.readdirSync(outsideDestination), []);
    } finally {
      fs.rmSync(path.join(root, '.codex'), { force: true });
      fs.rmSync(outsideDestination, { recursive: true, force: true });
    }
  });
});

test('managed Claude Addressing survives force refresh when template drops it', () => {
  inTempProject(() => {
    const before = '# User preface\n\n';
    const after = '\n\n## User tail\nKeep this exactly.\n';
    const configuredAddressing = '## Addressing (Context Overflow Indicator)\n\nThe AI always addresses the user as "anh" throughout the conversation.';
    fs.writeFileSync(
      'CLAUDE.md',
      `${before}${START}\nManaged line.\n\n${configuredAddressing}\n${END}${after}`
    );

    const pruned = [];
    copyClaudeMdFile(installContext(pruned), 'claude');

    const content = fs.readFileSync('CLAUDE.md', 'utf8');
    assert.ok(content.startsWith(before));
    assert.ok(content.endsWith(after));
    assert.ok(content.includes(TEMPLATE.trimEnd()));
    assert.equal((content.match(/## Addressing \(Context Overflow Indicator\)/g) || []).length, 1);
    assert.ok(content.includes('The AI always addresses the user as "anh"'));
    assert.equal(content.match(new RegExp(START, 'g')).length, 1);
    assert.deepEqual(pruned, ['../CLAUDE.md']);
  });
});

test('managed Codex block Addressing survives upsert with the current template', () => {
  inTempProject(() => {
    const codexTemplate = fs.readFileSync(path.join(__dirname, '../../src/codex/AGENTS.md'), 'utf8');
    const userTop = '# User codex notes\n\n';
    const userBottom = '\n\n## User section\nKeep me.\n';
    const configuredAddressing = '## Addressing (Context Overflow Indicator)\n\nThe AI always addresses the user as "bro" throughout the conversation.';
    const existing =
      `${userTop}<!-- CAFEKIT CODEX START -->\nCodex runtime line.\n\n${configuredAddressing}\n<!-- CAFEKIT CODEX END -->${userBottom}`;

    const next = upsertManagedCodexBlock(existing, codexTemplate);

    assert.ok(next.startsWith(userTop));
    assert.ok(next.endsWith(userBottom));
    assert.ok(next.includes(codexTemplate.trim()));
    assert.equal((next.match(/## Addressing \(Context Overflow Indicator\)/g) || []).length, 1);
    assert.ok(next.includes('The AI always addresses the user as "bro"'));
    assert.equal((next.match(/<!-- CAFEKIT CODEX START -->/g) || []).length, 1);
  });
});


test('copyRecursive skips generated artifacts while copying normal files', () => {
  inTempProject(() => {
    fs.mkdirSync('src/__pycache__', { recursive: true });
    fs.mkdirSync('src/extra', { recursive: true });
    fs.writeFileSync('src/normal.txt', 'normal\n');
    fs.writeFileSync('src/.coverage', 'coverage database\n');
    fs.writeFileSync('src/module.pyc', 'bytecode\n');
    fs.writeFileSync('src/__pycache__/module.pyc', 'cached bytecode\n');
    fs.writeFileSync('src/extra/bundle.pyo', 'pyo bytecode\n');

    copyRecursive('src', 'dest');

    assert.equal(fs.readFileSync('dest/normal.txt', 'utf8'), 'normal\n');
    assert.equal(fs.existsSync('dest/.coverage'), false);
    assert.equal(fs.existsSync('dest/__pycache__'), false);
    assert.equal(fs.existsSync('dest/module.pyc'), false);
    assert.equal(fs.existsSync('dest/extra/bundle.pyo'), false);
  });
});
