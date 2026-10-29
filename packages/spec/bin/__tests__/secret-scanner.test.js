'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const HELPER = path.join(__dirname, '../../src/claude/scripts/scan-staged-secrets.cjs');

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

function withRepo(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-secret-scan-'));
  try {
    git(root, ['init', '-q']);
    git(root, ['config', 'user.email', 'test@example.invalid']);
    git(root, ['config', 'user.name', 'CafeKit Test']);
    fs.writeFileSync(path.join(root, 'config.ts'), 'export const mode = "safe";\n');
    git(root, ['add', '.']);
    git(root, ['commit', '-qm', 'fixture']);
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('staged secret scanner maps added source lines and redacts values', () => {
  withRepo((root) => {
    const value = ['sk-live-', '0123456789abcdef0123456789'].join('');
    fs.writeFileSync(
      path.join(root, 'config.ts'),
      `export const mode = "safe";\nexport const OPENAI_API_KEY = "${value}";\n`,
    );
    git(root, ['add', 'config.ts']);

    const result = spawnSync(process.execPath, [HELPER], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Blocked: possible secret `OPENAI_API_KEY` at config\.ts:2\. Value not shown\./);
    assert.doesNotMatch(result.stdout, new RegExp(value));
    assert.doesNotMatch(result.stderr, new RegExp(value));
  });
});

test('staged secret scanner reads files whose names git quotes', () => {
  withRepo((root) => {
    const value = ['sk-live-', '0123456789abcdef0123456789'].join('');
    // git C-quotes a path holding non-ASCII bytes, a double quote, or a tab,
    // and ends the header with a tab when the path holds a space.
    const names = ['cấu-hình.env', 'quote"name.ts', 'tab\tname.ts', 'é x.env', 'a b.env'];
    for (const name of names) {
      fs.writeFileSync(path.join(root, name), `OPENAI_API_KEY="${value}"\n`);
    }
    git(root, ['add', '--', ...names]);

    const result = spawnSync(process.execPath, [HELPER], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    for (const name of names) {
      assert.ok(
        result.stdout.includes(`Blocked: possible secret \`OPENAI_API_KEY\` at ${name}:1. Value not shown.`),
        `${JSON.stringify(name)} missing from:\n${result.stdout}`,
      );
    }
    assert.doesNotMatch(result.stdout, new RegExp(value));
  });
});

test('staged secret scanner ignores diff prefix settings in git config', () => {
  for (const setting of ['diff.noprefix', 'diff.mnemonicPrefix']) {
    withRepo((root) => {
      git(root, ['config', setting, 'true']);
      const value = ['sk-live-', '0123456789abcdef0123456789'].join('');
      fs.writeFileSync(path.join(root, 'config.ts'), `export const OPENAI_API_KEY = "${value}";\n`);
      git(root, ['add', 'config.ts']);

      const result = spawnSync(process.execPath, [HELPER], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 1, `${setting}: ${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /Blocked: possible secret `OPENAI_API_KEY` at config\.ts:1\. Value not shown\./);
    });
  }
});

test('staged secret scanner treats an added line that looks like a diff header as content', () => {
  withRepo((root) => {
    const value = ['sk-live-', '0123456789abcdef0123456789'].join('');
    // The added line `++ b/other.ts` appears in the diff as `+++ b/other.ts`.
    fs.writeFileSync(path.join(root, 'notes.md'), `++ b/other.ts\nOPENAI_API_KEY="${value}"\n`);
    git(root, ['add', 'notes.md']);

    const result = spawnSync(process.execPath, [HELPER], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Blocked: possible secret `OPENAI_API_KEY` at notes\.md:2\. Value not shown\./);
  });
});

test('staged secret scanner ignores external diff and textconv settings', () => {
  const settings = [
    (root) => git(root, ['config', 'diff.external', 'true']),
    (root) => {
      fs.writeFileSync(path.join(root, '.gitattributes'), '*.ts diff=hide\n');
      git(root, ['config', 'diff.hide.textconv', 'true']);
    },
  ];
  for (const configure of settings) {
    withRepo((root) => {
      configure(root);
      const value = ['sk-live-', '0123456789abcdef0123456789'].join('');
      fs.writeFileSync(path.join(root, 'config.ts'), `export const OPENAI_API_KEY = "${value}";\n`);
      git(root, ['add', 'config.ts']);

      const result = spawnSync(process.execPath, [HELPER], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 1, `${configure}: ${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /`OPENAI_API_KEY` at config\.ts:1\./);
    });
  }
});

test('staged secret scanner handles JSON/YAML names and safe-name exclusions', () => {
  withRepo((root) => {
    const longValue = ['0123456789abcdef', '0123456789abcdef'].join('');
    fs.writeFileSync(
      path.join(root, 'config.yml'),
      [
        'tokenizer: enabled',
        'password_hint_label: "Password"',
        'api_key_file: "./fixtures/key.txt"',
        `apiKey: "${longValue}"`,
        `AWS_SECRET_ACCESS_KEY: "${longValue}"`,
        'example_token: "changeme"',
        '',
      ].join('\n'),
    );
    git(root, ['add', 'config.yml']);

    const result = spawnSync(process.execPath, [HELPER], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /`apiKey` at config\.yml:4/);
    assert.match(result.stdout, /`AWS_SECRET_ACCESS_KEY` at config\.yml:5/);
    assert.doesNotMatch(result.stdout, /tokenizer|password_hint_label|api_key_file|example_token/);
  });
});

test('staged secret scanner maps multiline YAML/JSON values to key lines', () => {
  withRepo((root) => {
    const value = ['sk-live-', 'abcdef0123456789abcdef0123456789'].join('');
    fs.writeFileSync(
      path.join(root, 'multiline.yml'),
      [
        'OPENAI_API_KEY:',
        `  "${value}"`,
        'PRIVATE_KEY: |',
        '  -----BEGIN PRIVATE KEY-----',
        '  redacted-material',
        '  -----END PRIVATE KEY-----',
        'public_url: https://example.invalid/docs',
        'password = getPassword()',
        'TOKEN: process.env.TOKEN',
        '',
      ].join('\n'),
    );
    git(root, ['add', 'multiline.yml']);

    const result = spawnSync(process.execPath, [HELPER], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /`OPENAI_API_KEY` at multiline\.yml:1/);
    assert.match(result.stdout, /`PRIVATE_KEY` at multiline\.yml:3/);
    assert.doesNotMatch(result.stdout, /public_url|password|TOKEN/);
    assert.doesNotMatch(result.stdout, new RegExp(value));
    assert.doesNotMatch(result.stdout, /redacted-material/);
    assert.doesNotMatch(result.stderr, new RegExp(value));
  });
});


test('staged secret scanner detects short passwords, PEM, credential URLs, and basic auth', () => {
  withRepo((root) => {
    fs.writeFileSync(
      path.join(root, 'secrets.env'),
      [
        'password="s3cr3t!"',
        'PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\\nredacted\\n-----END RSA PRIVATE KEY-----"',
        'DATABASE_URL="postgres://app:short-pass@db.example.invalid/app"',
        'Authorization="Basic dXNlcjpwYXNz"',
        'tokenizer="not-a-secret"',
        'password_hint="Password"',
        'api_key_file="./fixtures/key.txt"',
        'TOKEN="${TOKEN_FROM_ENV}"',
        'url="https://example.invalid/docs"',
        '',
      ].join('\n'),
    );
    git(root, ['add', 'secrets.env']);

    const result = spawnSync(process.execPath, [HELPER], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    for (const name of ['password', 'PRIVATE_KEY', 'DATABASE_URL', 'Authorization']) {
      assert.match(result.stdout, new RegExp('`' + name + '` at secrets\\.env:'));
    }
    for (const name of ['tokenizer', 'password_hint', 'api_key_file', 'TOKEN', 'url']) {
      assert.doesNotMatch(result.stdout, new RegExp('`' + name + '`'));
    }
    assert.doesNotMatch(result.stdout, /s3cr3t|short-pass|dXNlcjpwYXNz|redacted/);
    assert.doesNotMatch(result.stderr, /s3cr3t|short-pass|dXNlcjpwYXNz|redacted/);
  });
});

test('staged secret scanner ignores deleted and context lines', () => {
  withRepo((root) => {
    const oldValue = ['sk-old-', '0123456789abcdef0123456789'].join('');
    fs.writeFileSync(
      path.join(root, 'config.ts'),
      `export const OLD_TOKEN = "${oldValue}";\nexport const mode = "safe";\n`,
    );
    git(root, ['add', 'config.ts']);
    git(root, ['commit', '-qm', 'old secret fixture']);
    fs.writeFileSync(
      path.join(root, 'config.ts'),
      'export const mode = "safe";\nexport const replacement = true;\n',
    );
    git(root, ['add', 'config.ts']);

    const result = spawnSync(process.execPath, [HELPER], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /No staged secrets found/);
  });
});
