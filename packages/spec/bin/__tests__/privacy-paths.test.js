'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, after } = require('node:test');
const SOURCE = path.resolve(__dirname, '../../src');
const roots = [];

function fixture(host) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-privacy-paths-'));
  roots.push(root);
  if (host === 'codex') {
    assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
    const install = spawnSync(process.execPath, [path.resolve(__dirname, '../install.js'), '--platform', 'codex', '-y'], {
      cwd: root, encoding: 'utf8',
    });
    assert.equal(install.status, 0, install.stderr);
  } else {
    fs.cpSync(path.join(SOURCE, 'claude/hooks'), path.join(root, '.claude/hooks'), { recursive: true });
  }
  return { root, hooks: path.join(root, `.${host}/hooks`) };
}

function invoke(f, tool_name, tool_input, spawnOptions = {}) {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  const result = spawnSync(process.execPath, [path.join(f.hooks, 'privacy-block.cjs')], {
    cwd: f.cwd || f.root, encoding: 'utf8', env,
    input: JSON.stringify({ tool_name, tool_input, cwd: f.cwd || f.root, session_id: 'privacy-paths-probe' }),
    ...spawnOptions,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '', 'hook must not emit a stack trace');
  return result.stdout.trim() ? JSON.parse(result.stdout).hookSpecificOutput : null;
}

after(() => {
  for (const root of roots) {
    const locked = path.join(root, 'locked');
    if (fs.existsSync(locked)) fs.chmodSync(locked, 0o700);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const cases = [
  ['Read sensitive', 'Read', { file_path: '.env' }, true],
  ['Grep sensitive glob', 'Grep', { pattern: 'x', glob: '.env*' }, true],
  ['NotebookEdit sensitive notebook_path', 'NotebookEdit', { notebook_path: '.env' }, true],
  ['MCP path', 'mcp__fs__read_file', { path: '.env' }, true],
  ['MCP nested file_path', 'mcp__x__y', { args: { file_path: 'certs/a.pem' } }, true],
  ['MCP file uri', 'mcp__fs__read', root => ({ uri: `file://${root}/.env` }), true],
  ['MCP source destination', 'mcp__fs__move_file', { source: '.env', destination: 'x' }, true],
  ['MCP relative_path', 'mcp__s__read', { relative_path: '.env' }, true],
  ['Bash sensitive operand', 'Bash', { command: 'cat .env' }, true],
  ['Bash env-file option', 'Bash', { command: 'docker compose --env-file .env up' }, true],
  ['shell argv bash -lc', 'shell', { command: ['bash', '-lc', 'cat .env'] }, true],
  ['patch Update File', 'apply_patch', { command: '*** Begin Patch\n*** Update File: .env\n*** End Patch' }, true],
  ['patch Move to', 'apply_patch', { command: '*** Begin Patch\n*** Update File: a.txt\n*** Move to: .env\n*** End Patch' }, true],
  ['Read ordinary file', 'Read', { file_path: 'app.ts' }, false],
  ['Read exempt .env.example', 'Read', { file_path: '.env.example' }, false],
  ['Grep ordinary glob', 'Grep', { pattern: 'API_KEY', glob: '*.ts' }, false],
  ['Bash ls', 'Bash', { command: 'ls' }, false],
];

for (const host of ['claude', 'codex']) {
  const f = fixture(host);
  for (const [name, tool, input, sensitive] of cases) {
    test(`privacy-paths ${host}: ${name}`, () => {
      const output = invoke(f, tool, typeof input === 'function' ? input(f.root) : input);
      if (!sensitive) return assert.equal(output, null);
      assert.equal(output?.permissionDecision, host === 'claude' ? 'ask' : 'deny');
      if (host === 'codex') assert.match(output.permissionDecisionReason, /APPROVE CAFEKIT PRIVACY /);
    });
  }
}

test('privacy-paths codex: missing shared lib denies even Bash ls', () => {
  const f = fixture('codex');
  fs.rmSync(path.join(f.hooks, 'lib/privacy-paths.cjs'), { force: true });
  const output = invoke(f, 'Bash', { command: 'ls' });
  assert.equal(output?.permissionDecision, 'deny');
  assert.match(output.permissionDecisionReason, /could not be evaluated safely/);
});

test('privacy-paths: unavailable glob matcher keeps sensitive children', () => {
  const f = fixture('claude');
  fs.writeFileSync(path.join(f.root, 'credentials.json'), '');
  const { sensitivePaths } = require(path.join(SOURCE, 'claude/hooks/lib/privacy-paths.cjs'));
  const original = path.matchesGlob;
  try {
    path.matchesGlob = undefined;
    let paths;
    assert.doesNotThrow(() => { paths = sensitivePaths('Grep', { glob: '*.ts' }, f.root); });
    assert.ok(paths.includes(path.join(f.root, 'credentials.json')));
  } finally {
    path.matchesGlob = original;
  }
});

const runtimeWrites = [
  ['Write runtime', 'Write', { file_path: '.claude/runtime.json' }],
  ['Edit runtime', 'Edit', { file_path: '.codex/runtime.json' }],
  ['NotebookEdit runtime', 'NotebookEdit', { notebook_path: '.omp/runtime.json' }],
  ['patch approval directory', 'apply_patch', { command: '*** Begin Patch\n*** Add File: .codex/hooks/.privacy/g.json\n*** End Patch' }],
  ['MCP runtime', 'mcp__fs__write_file', { path: '.claude/runtime.json' }],
  ['MultiEdit runtime', 'MultiEdit', { edits: [{ file_path: '.claude/runtime.json' }] }],
  ['Write backslash runtime', 'Write', { file_path: '.CLAUDE\\RUNTIME.JSON' }],
  ['symlink directory Write', 'Write', { file_path: 'c/runtime.json' }],
  ['symlink directory shell', 'Bash', { command: "echo '{}' > c/runtime.json" }],
  ['dangling approval symlink', 'Write', { file_path: 'links/lnk2' }],
  ['dangling runtime symlink', 'Write', { file_path: 'links/lnk-runtime' }],
  ['chained approval symlink', 'Bash', { command: 'echo x > links/t1' }],
  ['chained runtime symlink', 'Bash', { command: 'echo x > links/r1' }],
  ['looping write symlink', 'Bash', { command: 'echo x > links/loop1' }],
  ...[
    'cp -r evil/.claude .', 'mv evil/.codex .', 'cp -r evil/.omp .', 'mv evil/.privacy .',
  ].map(command => [`runtime directory source ${command}`, 'Bash', { command }]),
  ['clobber redirect', 'Bash', { command: 'echo x >| .claude/runtime.json' }],
  ['quoted heredoc header tail', 'Bash', { command: "cat <<'EOF' > .claude/runtime.json\n{}\nEOF" }],
  ...[
    'cd "$PWD/.claude" && echo \'{}\' > runtime.json',
    'cd $(pwd)/.claude && cp /tmp/r runtime.json',
  ].map(command => [`dynamic directory ${command}`, 'Bash', { command }]),
  ...[
    'cp /tmp/r.json .claude/runtime.json > /dev/null',
    'cp /tmp/r.json .claude/runtime.json 2>&1',
    'mv r .codex/runtime.json 2>/dev/null',
    'install r .omp/runtime.json > /dev/null',
    'ln r .claude/runtime.json 2>&1',
    'cp /tmp/r.json .claude/runtime.json < /dev/null',
    'cp /tmp/r.json .claude/runtime.json <<< x',
    'cp a .claude/runtime.json 0</dev/null',
    'cp a .claude/runtime.json 0< /dev/null',
    'cp a .claude/runtime.json 3</dev/null',
  ].map(command => [`redirect operands ${command}`, 'Bash', { command }]),
  ...[
    "echo '{}' > .claude/runtime.json", "echo '{}' > .CLAUDE/RUNTIME.JSON",
    'echo x >> .claude/./runtime.json', 'tee .codex//runtime.json',
    'sed -i s/a/b/ .omp/runtime.json', 'cp r.json .claude/',
    'mv r.json .codex/runtime.json', 'cp t .codex/hooks/./.privacy/',
    'cd .claude && cp /tmp/r.json runtime.json', 'echo x > sub/.claude/runtime.json',
    'install r.json .omp/', 'ln r.json .codex/runtime.json',
    'pushd .codex && echo x > runtime.json',
    "sed -ni 's/a/b/p' .claude/runtime.json", 'cp -t.claude r.json',
    'cd .claude && echo "$(echo x > runtime.json)"',
  ].map(command => [command, 'Bash', { command }]),
];
const runtimeAllowed = [
  ['Read runtime', 'Read', { file_path: '.claude/runtime.json' }],
  ['cat .codex/runtime.json', 'Bash', { command: 'cat .codex/runtime.json' }],
  ['jq .paths .claude/runtime.json', 'Bash', { command: 'jq .paths .claude/runtime.json' }],
  ['Write ordinary runtime', 'Write', { file_path: 'docs/runtime.json' }],
  ['Write resolved ordinary runtime', 'Write', { file_path: '.claude/../docs/runtime.json' }],
];

for (const host of ['claude', 'codex']) {
  const f = fixture(host);
  fs.mkdirSync(path.join(f.root, '.claude'), { recursive: true });
  fs.symlinkSync('.claude', path.join(f.root, 'c'), 'dir');
  fs.mkdirSync(path.join(f.root, 'links'));
  fs.symlinkSync('../.codex/hooks/.privacy/g.json', path.join(f.root, 'links/lnk2'));
  fs.symlinkSync('../.claude/runtime.json', path.join(f.root, 'links/lnk-runtime'));
  fs.symlinkSync('t2', path.join(f.root, 'links/t1'));
  fs.symlinkSync('../.codex/hooks/.privacy/g.json', path.join(f.root, 'links/t2'));
  fs.symlinkSync('r2', path.join(f.root, 'links/r1'));
  fs.symlinkSync('../.claude/runtime.json', path.join(f.root, 'links/r2'));
  fs.symlinkSync('loop2', path.join(f.root, 'links/loop1'));
  fs.symlinkSync('loop1', path.join(f.root, 'links/loop2'));
  for (const name of ['.claude', '.codex', '.omp', '.privacy']) {
    const directory = path.join(f.root, 'evil', name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'runtime.json'), '{}');
  }
  for (const [name, tool, input] of runtimeWrites) {
    test(`privacy-paths ${host}: runtime writes ${name}`, () => {
      const output = invoke(f, tool, input);
      assert.equal(output?.permissionDecision, host === 'claude' ? 'ask' : 'deny');
      assert.doesNotMatch(output.permissionDecisionReason, /could not be evaluated safely/);
      if (host === 'codex') assert.match(output.permissionDecisionReason, /APPROVE CAFEKIT PRIVACY /);
    });
  }
  for (const [name, tool, input] of runtimeAllowed) {
    test(`privacy-paths ${host}: runtime allows ${name}`, () => assert.equal(invoke(f, tool, input), null));
  }
}

test('privacy-paths claude: subdirectory switch cannot disable root privacy', () => {
  const f = fixture('claude');
  const cwd = path.join(f.root, 'sub');
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.claude/runtime.json'), JSON.stringify({ privacyBlock: false }));
  fs.writeFileSync(path.join(f.root, '.env'), '');
  assert.equal(invoke({ ...f, cwd }, 'Read', { file_path: '../.env' })?.permissionDecision, 'ask');
});

test('privacy-paths claude: root switch still allows a manual opt-out', () => {
  const f = fixture('claude');
  fs.writeFileSync(path.join(f.root, '.claude/runtime.json'), JSON.stringify({ privacyBlock: false }));
  fs.writeFileSync(path.join(f.root, '.env'), '');
  assert.equal(invoke(f, 'Read', { file_path: '.env' }), null);
});

const recursiveSensitive = [
  'grep -r API_KEY .', 'grep -rn API_KEY .', 'grep -Rin key .', 'grep -rl KEY .',
  'grep --recursive KEY .', 'grep -d recurse KEY .', 'grep -R KEY', 'grep -r KEY src .',
  "bash -c 'grep -rn KEY .'", 'echo . | xargs grep -r KEY',
  'rg KEY .', 'rg --hidden KEY .', 'rg -u -u KEY .',
  "rg --hidden -g '!*.ts' KEY .", "grep -r --include='*' KEY .",
  'grep -r --include .env KEY .', "grep -r --include='.e*' KEY .",
  'grep -R KEY linked', 'ag KEY .', 'rg -uu KEY .', 'rg -. KEY .',
  'grep --dereference-recursive KEY .', 'grep --directories=recurse KEY .',
  "find src -exec grep -rn KEY . \\;",
  "rg --iglob 'CREDENTIALS.JSON' KEY .", "rg --glob-case-insensitive -g 'CREDENTIALS.JSON' KEY .",
  "rg -g '*.ts' --iglob 'CREDENTIALS.JSON' KEY .", "rg -uug '*' KEY hidden",
];
const recursiveAllowed = [
  'grep -r KEY src', 'grep -r --include=*.ts KEY .', "rg -g '*.ts' KEY .",
  'grep -r KEY app.ts', 'grep -r KEY nope/', 'grep KEY .', 'grep -r KEY examples',
  'rg --files src', 'grep -reKEY src',
];
const recursiveGrep = [
  { pattern: 'KEY' }, { pattern: 'KEY', path: '.' },
  { pattern: 'KEY', glob: '*' }, { pattern: 'KEY', glob: '.*' },
  { pattern: 'KEY', glob: '*.{env,json}' },
];

for (const host of ['claude', 'codex']) {
  const f = fixture(host);
  for (const name of ['.env', 'credentials.json', '.env.example', 'app.ts']) {
    fs.writeFileSync(path.join(f.root, name), '');
  }
  for (const dir of ['src', 'linked', 'examples', 'locked', 'hidden', 'a']) fs.mkdirSync(path.join(f.root, dir));
  fs.symlinkSync('../.env', path.join(f.root, 'linked/notes.txt'));
  fs.writeFileSync(path.join(f.root, 'examples/.env.example'), '');
  fs.writeFileSync(path.join(f.root, 'hidden/.env'), '');
  fs.writeFileSync(path.join(f.root, 'a/.env'), '');
  fs.writeFileSync(path.join(f.root, 'aws-production-service-account-credentials-backup-2026.json'), '');
  const wildcardDirectory = path.join(f.root, 'wildcard-count');
  fs.mkdirSync(wildcardDirectory);
  fs.writeFileSync(path.join(wildcardDirectory, `credentials${'a'.repeat(200)}b.json`), '');
  fs.writeFileSync(path.join(f.root, 'locked/credentials.json'), '');
  const locked = path.join(f.root, 'locked');
  fs.chmodSync(locked, 0);
  const probe = (name, tool, input, sensitive, options = {}) => test(`privacy-paths ${host}: recursive ${name}`, options, () => {
    const output = invoke(f, tool, input, options.timeout
      ? { timeout: options.timeout - 1000, killSignal: 'SIGKILL' } : {});
    if (!sensitive) return assert.equal(output, null);
    assert.equal(output?.permissionDecision, host === 'claude' ? 'ask' : 'deny');
    if (host === 'codex') assert.match(output.permissionDecisionReason, /APPROVE CAFEKIT PRIVACY /);
  });
  for (const command of recursiveSensitive) probe(command, 'Bash', { command }, true);
  for (const input of recursiveGrep) probe(`Grep ${JSON.stringify(input)}`, 'Grep', input, true);
  for (const command of ["rg -g '/credentials.json' KEY", "rg -g '/*.json' KEY", "rg --hidden -g '/.e*' KEY"]) {
    probe(`anchored ${command}`, 'Bash', { command }, true);
  }
  probe('anchored Grep glob', 'Grep', { pattern: 'KEY', glob: '/*.json' }, true);
  probe('bounded glob shell range', 'Bash', { command: "rg -g '{1..100000}' -g '*' KEY ." }, true, { timeout: 10000 });
  probe('bounded glob Grep range', 'Grep', { glob: '{1..100000}' }, true, { timeout: 10000 });
  probe('bounded glob Grep length', 'Grep', { glob: 'x'.repeat(257) }, true, { timeout: 10000 });
  probe('bounded combinations shell', 'Bash', {
    command: `rg -g '${'{a,b}'.repeat(20)}' -g '*' KEY .`,
  }, true, { timeout: 10000 });
  probe('bounded combinations nested Grep', 'Grep', {
    glob: '{a,{b,{c,{d,e}}}}'.repeat(12),
  }, true, { timeout: 10000 });
  probe('bounded combinations narrow Grep', 'Grep', {
    path: '.', glob: '*.{ts,tsx}',
  }, false, { timeout: 10000 });
  probe('narrow grammar escaped braces shell', 'Bash', {
    command: `rg -g '${'\\{a,b\\}'.repeat(20)}' -g '*' KEY .`,
  }, true, { timeout: 10000 });
  probe('narrow grammar repeated wildcards Grep', 'Grep', {
    path: '.', globs: [`${'*?'.repeat(20)}z`, '*'],
  }, true, { timeout: 10000 });
  probe('narrow grammar extglob Grep', 'Grep', {
    glob: '+(a|*)'.repeat(10),
  }, true, { timeout: 10000 });
  probe('total wildcard count in brace Grep', 'Grep', {
    path: 'wildcard-count', globs: ['{*a*a*a*a*az,q}', '*'],
  }, true, { timeout: 10000 });
  for (const command of ['rg --unrestricted --unrestricted KEY a', 'rg -.n KEY a', 'ag -u KEY a', 'ag --unrestricted KEY a']) {
    probe(`hidden flags ${command}`, 'Bash', { command }, true);
  }
  for (const input of [{ path: 1 }, { glob: ['*'] }, { globs: 5 }]) {
    test(`privacy-paths ${host}: malformed Grep ${JSON.stringify(input)}`, () => {
      const { sensitivePaths } = require(path.join(SOURCE, 'claude/hooks/lib/privacy-paths.cjs'));
      let paths;
      assert.doesNotThrow(() => { paths = sensitivePaths('Grep', input, f.root); });
      assert.ok(paths.includes(path.join(f.root, 'credentials.json')));
      const output = invoke(f, 'Grep', input);
      assert.equal(output?.permissionDecision, host === 'claude' ? 'ask' : 'deny');
      assert.doesNotMatch(output.permissionDecisionReason, /could not be evaluated safely/);
      if (host === 'codex') assert.match(output.permissionDecisionReason, /APPROVE CAFEKIT PRIVACY /);
    });
  }
  for (const command of recursiveAllowed) probe(command, 'Bash', { command }, false);
  probe('Grep narrow glob', 'Grep', { pattern: 'KEY', path: '.', glob: '*.ts' }, false);
  probe('Grep narrow recursive glob', 'Grep', { pattern: 'KEY', path: '.', glob: '**/*.ts' }, false);
  probe('grep -r KEY locked/', 'Bash', { command: 'grep -r KEY locked/' }, false, {
    skip: typeof process.getuid === 'function' && process.getuid() === 0,
  });
}
