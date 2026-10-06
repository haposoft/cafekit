'use strict';

// Behavioral tests for privacy-block.cjs. The hook is run as a real subprocess:
// a PreToolUse payload is piped to stdin and native permission output asserted.

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOK = path.join(__dirname, '..', 'privacy-block.cjs');

/** Run the hook with a tool payload; return process output. */
function runHook(payload, cwd) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ ...payload, cwd: cwd || payload.cwd }),
    encoding: 'utf8',
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ck-privacy-'));
}

function permissionDecision(stdout) {
  if (!stdout.trim()) return null;
  return JSON.parse(stdout).hookSpecificOutput?.permissionDecision || null;
}

test('asks natively for a direct Read of .env', () => {
  const dir = tmpDir();
  try {
    const env = path.join(dir, '.env');
    fs.writeFileSync(env, 'SECRET=1');
    const { code, stdout } = runHook({ tool_name: 'Read', tool_input: { file_path: env } }, dir);
    assert.strictEqual(code, 0);
    assert.strictEqual(permissionDecision(stdout), 'ask');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('asks for a symlink whose target is .env (regression: symlink bypass)', () => {
  const dir = tmpDir();
  try {
    const env = path.join(dir, '.env');
    fs.writeFileSync(env, 'SECRET=1');
    const link = path.join(dir, 'notes.txt'); // harmless-looking name
    fs.symlinkSync(env, link);
    const { code, stdout } = runHook({ tool_name: 'Read', tool_input: { file_path: link } }, dir);
    assert.strictEqual(code, 0);
    assert.strictEqual(permissionDecision(stdout), 'ask');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('allows a normal non-sensitive file (exit 0)', () => {
  const dir = tmpDir();
  try {
    const f = path.join(dir, 'README.md');
    fs.writeFileSync(f, '# hi');
    const { code } = runHook({ tool_name: 'Read', tool_input: { file_path: f } }, dir);
    assert.strictEqual(code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('allows a symlink to an exempt .env.example (exemption still wins)', () => {
  const dir = tmpDir();
  try {
    const example = path.join(dir, '.env.example');
    fs.writeFileSync(example, 'SECRET=');
    const link = path.join(dir, 'sample.txt');
    fs.symlinkSync(example, link);
    const { code } = runHook({ tool_name: 'Read', tool_input: { file_path: link } }, dir);
    assert.strictEqual(code, 0, 'symlink to an exempt file must stay allowed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an exempt-looking symlink to .env still asks based on its target', () => {
  const dir = tmpDir();
  try {
    const env = path.join(dir, '.env');
    fs.writeFileSync(env, 'SECRET=1');
    const link = path.join(dir, '.env.example');
    fs.symlinkSync(env, link);
    const { stdout } = runHook({ tool_name: 'Read', tool_input: { file_path: link } }, dir);
    assert.strictEqual(permissionDecision(stdout), 'ask');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A secret named in a read operand the analyzer can resolve, however it is
// spelled: quoted, concatenated, line-continued, ANSI-C escaped, or reached
// through a nested shell or inline runtime.
for (const command of [
  'cat ".env"',
  'cat .env',
  'cat .env*',
  'sed -n 1p .env',
  "bash -c 'sed -n 1p .env'",
  "python3 -c \"open('.env').read()\"",
  "node -e \"fs.readFileSync('.env')\"",
  "bash -c 'cat .e''nv'",
  'cat .e\\\nnv',
  "cat $'\\x2e\\x65\\x6e\\x76'",
]) {
  test(`asks natively for Bash sensitive reference: ${command}`, () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(path.join(dir, '.env'), 'SECRET=1');
      const { code, stdout } = runHook({ tool_name: 'Bash', tool_input: { command } }, dir);
      assert.strictEqual(code, 0);
      assert.strictEqual(permissionDecision(stdout), 'ask');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

// --- Shapes the command analyzer cannot return ---
// It drops any word carrying an expansion, and it only walks readers it
// recognises. A sensitive name still has to be caught when it arrives with a
// glob or `~`, or when an unknown tool is handed it through a file-shaped
// option.
for (const command of [
  'cat ~/.ssh/id_rsa',
  'cat ~/.aws/credentials',
  'cat certs/*.pem',
  'ssh -i ~/.ssh/id_ed25519 host',
  'docker compose --env-file .env up',
  'curl --config ~/.netrc https://example.com',
  'kubectl --kubeconfig ~/.kube/kubeconfig get pods',
  'openssl rsa -in server.key',
  'cat secrets.yaml',
]) {
  test(`asks for sensitive name via expansion or file-shaped option: ${command}`, () => {
    const dir = tmpDir();
    try {
      const { code, stdout } = runHook({ tool_name: 'Bash', tool_input: { command } }, dir);
      assert.strictEqual(code, 0);
      assert.strictEqual(permissionDecision(stdout), 'ask', `should ask for ${command}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

// --- Naming a secret is not reading one (fix: 740798c) ---
// The analyzer returns the operands of readers it recognises. A command that
// only spells a secret's name -- an echo, a grep pattern, a pathspec -- reads
// nothing, and asking there is the noise that trains people to click through
// the prompt that matters.
for (const command of [
  'echo .env',
  'echo "update .env"',
  'echo .envoy',
  'echo not.env',
  "printf '%s\\n' .env",
  'git log -- .env',
  'git status sessions.md',
  'grep .env README.md',
  "sed -n '/.env/p' README.md",
]) {
  test(`allows naming a secret without reading it: ${command}`, () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(path.join(dir, 'README.md'), 'hi');
      const { stdout } = runHook({ tool_name: 'Bash', tool_input: { command } }, dir);
      assert.strictEqual(permissionDecision(stdout), null, `should allow ${command}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

// --- Accepted gap: pure indirection ---
// The target of `$FILE` is unknowable without running the shell. Treating every
// unresolved expansion as sensitive asked on `cat ~/.zshrc`, `wc -l *.cjs` and
// `du -sh */` too, so these are allowed by design. `less "$HOME/.env"` is the
// edge of that decision: a literal secret joined to a variable goes through.
for (const command of [
  'cat $FILE',
  'cat "$FILE"',
  'cat ${FILE}',
  'cat $1',
  'cat $(echo .env)',
  'cat `echo .env`',
  'head $SECRET',
  'tail ${MY_FILE}',
  'less "$HOME/.env"',
  'cat README.md $EXTRA',
  'echo ok; cat README.md $FILE',
  'cat README.md | head $FILE',
  "bash -c 'cat $FILE'",
  'echo $(cat $FILE)',
  'env -u UNUSED cat "$FILE"',
  'timeout 1 cat "$FILE"',
  'nice -n 10 cat "$FILE"',
  "eval 'cat \"$FILE\"'",
  "find . -exec sh -c 'cat \"$FILE\"' \\;",
  'source "$FILE"',
  'xargs -a "$LIST" cat',
  'python3 -c \'open(os.environ["FILE"]).read()\'',
  'node -e \'fs.readFileSync(process.env.FILE)\'',
  'cat < "$FILE"',
  'cat -n "$FILE"',
]) {
  test(`allows pure indirection with no sensitive literal: ${command}`, () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(path.join(dir, '.env'), 'SECRET=1');
      const { code, stdout } = runHook({ tool_name: 'Bash', tool_input: { command } }, dir);
      assert.strictEqual(code, 0);
      assert.strictEqual(permissionDecision(stdout), null, `should allow ${command}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

// --- An inert heredoc body is prose, not shell (fix: e867051) ---
test('allows a quoted-delimiter heredoc whose body quotes a read command', () => {
  const dir = tmpDir();
  try {
    const command = "gh pr create --body \"$(cat <<'BODY'\nRun `cat .env` to inspect config\nBODY\n)\"";
    const { stdout } = runHook({ tool_name: 'Bash', tool_input: { command } }, dir);
    assert.strictEqual(permissionDecision(stdout), null, 'quoted delimiter expands nothing');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('still asks for an unquoted-delimiter heredoc that does expand a read', () => {
  const dir = tmpDir();
  try {
    const command = 'bash -c "cat <<BODY\n$(cat .env)\nBODY"';
    const { stdout } = runHook({ tool_name: 'Bash', tool_input: { command } }, dir);
    assert.strictEqual(permissionDecision(stdout), 'ask', 'unquoted delimiter expands');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

for (const command of [
  'echo $VAR',
  'echo "$HOME"',
  'git status',
  'git status $VAR',
  'cat README.md',
  'cat .env.example',
  'cat .env.sample',
  'cat .env.template',
  'cat .env.test',
  "cat '$FILE'",
  "cat '$HOME/README.md'",
  "cat README.md '$EXTRA'",
  "cat README.md '*'",
  "cat README.md '~'",
  "cat README.md '{README.md,LICENSE}'",
  "echo '$(cat $FILE)'",
  'cat ~/.zshrc',
  'wc -l README.md',
  'cat *.md',
  'du -sh */',
  'python3 -c "print(os.environ[\'HOME\'])"',
  'head -n "$COUNT" README.md',
]) {
  test(`allows harmless dynamic / safe static with extra var: ${command}`, () => {
    const dir = tmpDir();
    try {
      // Create safe files so hook has cwd context, but path check is lexical
      fs.writeFileSync(path.join(dir, 'README.md'), 'hi');
      fs.writeFileSync(path.join(dir, '.env.example'), 'EXAMPLE=1');
      const { stdout } = runHook({ tool_name: 'Bash', tool_input: { command } }, dir);
      assert.strictEqual(permissionDecision(stdout), null, `should allow ${command}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('an assignment naming a secret does not ask, with or without a later read', () => {
  const dir = tmpDir();
  try {
    const assigned = runHook({ tool_name: 'Bash', tool_input: { command: 'FILE=.env; cat README.md' } }, dir);
    assert.strictEqual(permissionDecision(assigned.stdout), null);
    // Pure indirection: the hook cannot resolve $FILE without running the shell.
    const read = runHook({ tool_name: 'Bash', tool_input: { command: 'FILE=.env; cat "$FILE"' } }, dir);
    assert.strictEqual(permissionDecision(read.stdout), null);
    // Spelling the target out again does ask.
    const literal = runHook({ tool_name: 'Bash', tool_input: { command: 'FILE=.env; cat .env' } }, dir);
    assert.strictEqual(permissionDecision(literal.stdout), 'ask');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('asks for dangling symlink aimed at protected target (regression: broken-link fail-open)', () => {
  const dir = tmpDir();
  try {
    const env = path.join(dir, '.env');
    fs.writeFileSync(env, 'SECRET=1');
    const link = path.join(dir, 'innocent.txt');
    fs.symlinkSync(env, link);
    fs.unlinkSync(env); // now dangling
    const { stdout } = runHook({ tool_name: 'Read', tool_input: { file_path: link } }, dir);
    assert.strictEqual(permissionDecision(stdout), 'ask', 'dangling link to .env must ask');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('allows dangling symlink to benign file and to allowed example', () => {
  const dir = tmpDir();
  try {
    const benign = path.join(dir, 'benign.txt');
    fs.writeFileSync(benign, 'hi');
    const link = path.join(dir, 'dangling.txt');
    fs.symlinkSync(benign, link);
    fs.unlinkSync(benign);
    const { stdout: s1 } = runHook({ tool_name: 'Read', tool_input: { file_path: link } }, dir);
    assert.strictEqual(permissionDecision(s1), null, 'dangling benign should allow');

    const example = path.join(dir, '.env.example');
    fs.writeFileSync(example, 'EXAMPLE=1');
    const link2 = path.join(dir, 'link-example.txt');
    fs.symlinkSync(example, link2);
    fs.unlinkSync(example);
    const { stdout: s2 } = runHook({ tool_name: 'Read', tool_input: { file_path: link2 } }, dir);
    assert.strictEqual(permissionDecision(s2), null, 'dangling link to .env.example should allow');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('still allows real link to allowed example (regression: real link to .env.example)', () => {
  const dir = tmpDir();
  try {
    const example = path.join(dir, '.env.example');
    fs.writeFileSync(example, 'EXAMPLE=1');
    const link = path.join(dir, 'real-example-link.txt');
    fs.symlinkSync(example, link);
    const { stdout } = runHook({ tool_name: 'Read', tool_input: { file_path: link } }, dir);
    assert.strictEqual(permissionDecision(stdout), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('fails closed on malformed/looping symlink (hop limit)', () => {
  const dir = tmpDir();
  try {
    const a = path.join(dir, 'a');
    const b = path.join(dir, 'b');
    fs.symlinkSync(b, a);
    fs.symlinkSync(a, b);
    const { stdout } = runHook({ tool_name: 'Read', tool_input: { file_path: a } }, dir);
    // Loop should fail closed to ask (treated as sensitive to be safe) or at least not allow silently
    // Our implementation returns ask for looping link
    assert.strictEqual(permissionDecision(stdout), 'ask');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
