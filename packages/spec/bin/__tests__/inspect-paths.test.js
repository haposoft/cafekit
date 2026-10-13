'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const SOURCE = path.resolve(__dirname, '../../src');

// Invoke installed-layout hooks with stdin JSON: denial must be real, not a crash.
function fixture(host, run, variant = '') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-inspect-'));
  const root = path.join(temp, 'build/app');
  const link = path.join(temp, 'project-link');
  const hooks = path.join(root, `.${host}/hooks`);
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.symlinkSync(root, link, 'dir');
    fs.cpSync(path.join(SOURCE, `${host}/hooks`), hooks, { recursive: true });
    if (host === 'codex') {
      for (const name of ['runtime-path-safety', 'privacy-command-analysis', 'privacy-paths', 'secret-keywords', 'inspect-paths']) {
        const source = path.join(SOURCE, `claude/hooks/lib/${name}.cjs`);
        // Before the shared lib exists, exercise the original native implementation.
        if (fs.existsSync(source)) fs.copyFileSync(source, path.join(hooks, `lib/${name}.cjs`));
      }
    }
    const cwd = variant === 'nested' ? path.join(root, 'packages/x') : root;
    fs.mkdirSync(cwd, { recursive: true });
    const projectRoot = variant === 'symlink' ? link : root;
    run({ root, temp, cwd, hook(tool_name, tool_input, payload = {}) {
      const log = path.join(hooks, '.logs/hook-log.jsonl');
      const before = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
      const result = spawnSync(process.execPath, [path.join(hooks, 'inspect-block.cjs')], {
        cwd, encoding: 'utf8', input: JSON.stringify({ cwd, tool_name, tool_input, ...payload }),
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
      });
      const after = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
      assert.doesNotMatch(after.slice(before.length), /"status":"crash"/, result.stderr);
      return result;
    } });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

const cases = [];
function add(name, tool, input, deny = false, variant = '', payload = {}) {
  cases.push({ name, tool, input, deny, variant, payload });
}
function shell(command, deny = false) { add(command, 'Bash', { command }, deny); }
add('Read node_modules', 'Read', { file_path: 'node_modules/x/index.js' }, true);
add('Read absolute dist', 'Read', ({ root }) => ({ file_path: `${root}/dist/a.js` }), true);
add('Glob broad', 'Glob', { pattern: '**/*' }, true);
add('Glob dist', 'Glob', { pattern: '*.js', path: 'dist' }, true);
add('Grep path', 'Grep', { pattern: 'foo', path: 'node_modules' }, true);
add('Grep glob', 'Grep', { pattern: 'foo', glob: 'dist/**' }, true);
for (const command of [
  'cat dist/index.js', 'nl -ba dist/a.js', 'sed -n 1,5p build/x',
  'grep -rn foo node_modules', 'rg foo dist', 'find ./dist', 'ls node_modules',
  'npm exec cat ./dist/index.js', 'npx cat dist/a.js', 'npm exec -- cat dist/a',
  'FOO=1 cat dist/a', 'env FOO=1 cat dist/a', 'sudo -u root cat dist/a',
  'vite build --outDir ./dist $(cat dist/index.js)', 'echo `cat dist/a`', 'echo "$(cat dist/a)"',
]) shell(command, true);
add('Bash tilde path', 'Bash', ({ root }) => ({ command: `cat ~/${path.relative(os.homedir(), root)}/dist/a` }), true);
add('missing tool name', undefined, { path: './dist/index.js' }, true);
add('exec_command reader', 'exec_command', { cmd: 'cat dist/index.js' }, true);
for (const tool of ['Edit', 'Write', 'MultiEdit']) {
  add(`${tool} write`, tool, ({ root }) => ({ file_path: `${root}/scripts/build/release.js` }));
}
add('NotebookEdit write', 'NotebookEdit', { notebook_path: 'dist/a.ipynb' });
add('patch package main', 'apply_patch', { command: '*** Begin Patch\n*** Update File: package.json\n+"main": "./dist/index.js"\n*** End Patch' });
add('patch Add File', 'apply_patch', { command: '*** Begin Patch\n*** Add File: src/build/config.ts\n+x\n*** End Patch' });
for (const pattern of ['target', 'node_modules']) add(`Grep regex ${pattern}`, 'Grep', { pattern });
for (const command of [
  '.agents/skills/.venv/bin/python3 scripts/search.py q', '.claude/skills/.venv/bin/python3 scripts/x.py',
  'python3 -m venv .venv', 'source .venv/bin/activate && pytest',
  'node_modules/.bin/eslint src', 'npx eslint dist/', 'python3 scripts/x.py build/out',
  'tsc --outDir ./build', 'vite build --outDir ./dist', 'npm run build -- --outDir ./dist',
  'cargo build --target-dir ./target', 'cd build && cmake ..', 'tree -I node_modules',
  'grep -rn foo . --exclude-dir node_modules', "rg --glob '!**/node_modules/**' foo",
  'find . -path ./node_modules -prune -o -print', 'echo concat vendor', "echo '$(cat dist/a)'",
  "git commit -F - <<'EOF'\nls node_modules cleanup\nEOF",
]) shell(command);
add('Grep excluded glob', 'Grep', { pattern: 'foo', glob: '!dist/**' });
for (const variant of ['', 'nested', 'symlink']) {
  add(`project above blocked segment ${variant || 'root'}`, 'Read', ({ root }) => ({ file_path: `${fs.realpathSync(root)}/src/a.js` }), false, variant);
}
add('Read ordinary', 'Read', { file_path: 'src/a.js' });
shell('cat src/a.js');

// Wrapper options, nested substitutions, and structured paths.
for (const command of [
  'time -p env -u FOO BAR=1 command -- cat dist/a', 'nice -n 5 nohup cat dist/a',
  'xargs -I {} cat dist/a', 'pnpm exec -- cat dist/a', 'pnpx --yes cat dist/a',
  'yarn exec -- cat dist/a', 'bunx --bun cat dist/a', 'npx -p cat -- cat dist/a',
  'echo "$(echo $(cat dist/a))"', 'echo ok; cat dist/a', 'echo ok\ncat dist/a',
  'echo ok | cat dist/a', 'rg -e foo dist/a', 'awk \'{print $1}\' dist/a',
  'less dist/a', 'more dist/a', 'bat dist/a', 'wc dist/a', 'du dist', 'file dist/a', 'stat dist/a',
  'cat -n dist/a', 'wc -c dist/a', 'du -s dist', 'ls -L dist',
  'echo $( (cat dist/a) )', 'env -S "cat dist/a"', 'env --split-string="cat" dist/a',
  'npm exec -c "cat dist/a"', 'npx --call="cat dist/a"',
  'cat src/a <<\\EOF\nprose\nEOF\ncat dist/a', "cat src/a <<E'OF'\nprose\nEOF\ncat dist/a",
]) shell(command, true);
for (const command of [
  'grep --include node_modules foo src', 'rg -e node_modules src',
  'rg --exclude-dir=node_modules foo src', 'tree -P dist',
  'echo "cat dist/a"', "echo '`cat dist/a`'", 'cat src/a.js <<EOF\ncat dist/a\nEOF',
]) shell(command);
add('nested paths', 'mcp__files__read', { operations: [{ paths: ['dist/a'] }] }, true);
add('notebook path reader', 'Read', { notebook_path: 'dist/a.ipynb' }, true);
add('unknown command reader', 'mcp__shell', { command: 'cat dist/a' }, true);
add('missing name command reader', undefined, { command: 'cat dist/a' }, true);
add('write skips command too', 'Write', { file_path: 'dist/a', command: 'cat dist/a' });

// Output redirections are writes; search option values are not patterns.
for (const command of [
  "cat > dist/index.html <<'EOF'\n<html></html>\nEOF",
  'ls src > build/files.txt', 'wc -l src/a.ts > coverage/summary.txt',
  'grep x src 2> build/err', 'ls src >> build/x', 'ls src 2>&1', 'ls src>build/x',
  'rg --max-depth 2 target src', 'rg -j 4 build src', 'rg -M 200 dist src',
  'rg --sort path target src', 'grep -rn -d skip build src',
]) shell(command);
for (const command of ['cat < dist/a', 'cat <dist/a']) shell(command, true);

add('Grep glob:"**/*.ts", path:"src"', 'Grep', { pattern: 'x', glob: '**/*.ts', path: 'src' });
add('Glob pattern:"**/*.ts", path:"src"', 'Glob', { pattern: '**/*.ts', path: 'src' });
shell("rg -g '**/*.ts' x src");
add('Glob broad without path', 'Glob', { pattern: '**/*' }, true);
add('Grep glob:"**/*.ts", path:"."', 'Grep', { pattern: 'x', glob: '**/*.ts', path: '.' }, true);
add('Glob broad absolute project root', 'Glob', ({ root }) => ({ pattern: '**/*.ts', path: root }), true);
add('Glob broad path:".."', 'Glob', { pattern: '**/*', path: '..' }, true);
add('Glob broad filesystem root', 'Glob', { pattern: '**/*', path: '/' }, true);
add('Glob broad home', 'Glob', { pattern: '**/*', path: '~' }, true);
add('Glob broad normalized project root', 'Glob', { pattern: '**/*', path: 'src/..' }, true);
add('Glob broad blocked directory', 'Glob', { pattern: '**/*.ts', path: 'node_modules' }, true);
shell("rg --glob '**/*' symbol .", true);
shell("rg --glob '**/*' symbol; cat src/file.ts", true);
shell("cd ..; rg --glob '**/*' symbol src", true);
shell("env -C .. rg --glob '**/*' symbol src", true);
for (const command of [
  "rg -E utf8 -g '**/*' x", "rg --ignore-file .gitignore -g '**/*' x",
  "rg --engine pcre2 -g '**/*' x", "rg --type-add 'web:*.html' -g '**/*' x",
  "echo . | xargs rg -g '**/*' x src", "env -C.. rg -g '**/*' x src",
  "builtin cd .. && rg -g '**/*' x src",
]) shell(command, true);
add('Bash broad glob with non-string session cwd', 'Bash', { command: "rg -g '**/*' x src" }, true, '', { cwd: 1 });
add('Bash broad glob with non-string input cwd', 'Bash', { command: "rg -g '**/*' x src", cwd: 1 }, true);
for (const key of ['cwd', 'workdir']) {
  add(`Bash broad glob with ${key}:".."`, 'Bash', { command: "rg -g '**/*' x src", [key]: '..' }, true);
}
for (const flag of [
  '--json', '-S', '--smart-case', '-N', '--no-heading', '--heading', '--column', '--vimgrep',
  '--follow', '--no-ignore', '--no-ignore-dot', '--no-ignore-exclude', '--no-ignore-files',
  '--no-ignore-global', '--no-ignore-parent', '--no-ignore-vcs', '--no-ignore-messages',
  '--no-ignore-file-case-insensitive', '--count-matches', '-b', '--trim',
  '-C3', '-A2', '-m5', '-tts',
]) shell(`rg -g '**/*.ts' ${flag} x src`);
for (const command of [
  "eval 'cd ..'; rg -g '**/*' x src", "source setup.sh; rg -g '**/*' x src",
  ". setup.sh; rg -g '**/*' x src", "env -iC.. rg -g '**/*' x src",
]) shell(command, true);

for (const host of ['claude', 'codex']) {
  for (const entry of cases) {
    if (host === 'codex' && entry.payload.cwd === 1) continue;
    test(`inspect-paths ${host}: ${entry.name}`, () => fixture(host, (context) => {
      const input = typeof entry.input === 'function' ? entry.input(context) : entry.input;
      const result = context.hook(entry.tool, input, entry.payload);
      assert.equal(result.status, entry.deny ? 2 : 0, result.stderr || result.stdout);
      if (entry.deny) {
        if (host === 'claude') assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
        assert.match(result.stderr, /SCOPE LIMIT EXCEEDED/);
      } else assert.equal(result.stdout, '');
    }, entry.variant));
  }
}

test('inspect-paths lib blocks broad glob with non-string context.cwd', () => {
  const { inspectInput } = require('../../src/claude/hooks/lib/inspect-paths.cjs');
  const result = inspectInput('Bash', { command: "rg -g '**/*' x src" }, {
    cwd: 1, projectRoot: process.cwd(),
  });
  assert.equal(result.broadGlob, '**/*');
});
