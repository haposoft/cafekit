'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { planManifestFiles } = require('../lib/migrate-plan');
const { planMergedFiles, renderMergedPlan } = require('../lib/migrate-merged');
const { managedHandlerScript } = require('../phases/codex-hooks');

const INSTALLER = path.join(__dirname, '../install.js');
const SETTINGS_TEMPLATE = require('../../src/claude/settings/settings.json');
const TEMPLATE_COMMANDS = new Set(Object.values(SETTINGS_TEMPLATE.hooks).flat().flatMap((group) => group.hooks.map((handler) => handler.command)));
const USER_LINT = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/user-lint.cjs"';

let work;
let pristine;
let fixture;
let codexOnly;

function copyRepo(from, name) {
  const target = path.join(work, name, 'repo');
  fs.cpSync(from, target, { recursive: true, verbatimSymlinks: true });
  return target;
}

function install(repo, platforms) {
  fs.mkdirSync(repo, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: repo });
  // The installer writes into its cwd, so it must run inside the temp repository.
  const run = spawnSync(process.execPath, [INSTALLER, '--platform', platforms, '--with-document-skills', '-y'], {
    cwd: repo,
    env: { ...process.env, HOME: path.join(work, 'home'), CI: '1' },
    encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
}

function applyPlan(repo, manifest, merged) {
  for (const entry of manifest.entries.filter((item) => item.action === 'remove')) fs.rmSync(path.join(repo, entry.path));
  for (const file of merged.files) {
    if (file.action === 'write') fs.writeFileSync(path.join(repo, file.path), file.after);
    if (file.action === 'remove') fs.rmSync(path.join(repo, file.path));
  }
}

function plan(repo) {
  const manifest = planManifestFiles(repo);
  return { manifest, merged: planMergedFiles(repo, manifest) };
}

const fileOf = (merged, rel) => merged.files.find((file) => file.path === rel);
const handlers = (config) => Object.values(config.hooks || {}).flat().flatMap((group) => group.hooks);

before(() => {
  work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ck-migrate-merged-')));
  fs.mkdirSync(path.join(work, 'home'));
  pristine = path.join(work, 'pristine', 'repo');
  install(pristine, 'claude,codex');
  codexOnly = path.join(work, 'codex-only', 'repo');
  install(codexOnly, 'codex');

  fixture = copyRepo(pristine, 'fixture');
  const settingsFile = path.join(fixture, '.claude/settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  settings.hooks.PreToolUse.push({ matcher: 'Edit', hooks: [{ type: 'command', command: USER_LINT }] });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  fs.writeFileSync(path.join(fixture, '.claude/hooks/user-lint.cjs'), 'process.exit(0);\n');

  const hooksFile = path.join(fixture, '.codex/hooks.json');
  const hooks = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
  hooks.hooks.Stop.push({ hooks: [{ type: 'command', command: `node '${path.join(fixture, '.codex/hooks/my.cjs')}'` }] });
  fs.writeFileSync(hooksFile, JSON.stringify(hooks, null, 2));
  fs.writeFileSync(path.join(fixture, '.codex/hooks/my.cjs'), 'process.exit(0);\n');

  const agentsFile = path.join(fixture, 'AGENTS.md');
  fs.writeFileSync(agentsFile, `# Team rules before\n\n${fs.readFileSync(agentsFile, 'utf8')}\n## Team notes after\n`);
  const gitignoreFile = path.join(fixture, '.gitignore');
  fs.writeFileSync(gitignoreFile, fs.readFileSync(gitignoreFile, 'utf8').replace('.agents/\n', '.agents/\nmy-local-secrets.txt\n'));
  fs.writeFileSync(path.join(fixture, '.claude/.env'), 'TOKEN=[redacted]\n');
});

after(() => fs.rmSync(work, { recursive: true, force: true }));

test('claude-user-hook-kept: a user hook script and its registration survive', () => {
  const { manifest, merged } = plan(fixture);
  const settings = JSON.parse(fileOf(merged, '.claude/settings.json').after);
  assert.ok(handlers(settings).some((handler) => handler.command === USER_LINT));
  assert.ok(manifest.untracked.includes('.claude/hooks/user-lint.cjs'));
});

test('cafekit-handlers-dropped: no CafeKit handler and no empty container remain', () => {
  const { merged } = plan(fixture);
  const settingsFile = fileOf(merged, '.claude/settings.json');
  assert.equal(settingsFile.action, 'write');
  const settings = JSON.parse(settingsFile.after);
  assert.deepEqual(handlers(settings).map((handler) => handler.command), [USER_LINT]);
  assert.ok(!handlers(settings).some((handler) => TEMPLATE_COMMANDS.has(handler.command)));
  for (const config of [settings, JSON.parse(fileOf(merged, '.codex/hooks.json').after)]) {
    for (const [event, groups] of Object.entries(config.hooks || {})) {
      assert.ok(groups.length > 0, `${event} left empty`);
      for (const group of groups) assert.ok(group.hooks.length > 0, `${event} group left empty`);
    }
    assert.ok(!handlers(config).some((handler) => managedHandlerScript(handler)));
  }
  // Without user hooks nothing is left for Codex, so its hooks.json goes.
  assert.equal(fileOf(plan(pristine).merged, '.codex/hooks.json').action, 'remove');
});

test('dangling-handler-reported: a kept handler that still runs a removed hook is reported', () => {
  const repo = copyRepo(fixture, 'dangling');
  const settingsFile = path.join(repo, '.claude/settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  const strict = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/privacy-block.cjs" --strict';
  settings.hooks.Stop.push({ hooks: [{ type: 'command', command: strict }] });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  const { merged } = plan(repo);
  assert.ok(handlers(JSON.parse(fileOf(merged, '.claude/settings.json').after)).some((handler) => handler.command === strict));
  assert.ok(merged.reports.some((report) => report.includes('privacy-block.cjs') && report.includes('still runs')));
});

test('statusline-rule: the status line goes only with status.cjs', () => {
  const { merged } = plan(fixture);
  assert.equal(JSON.parse(fileOf(merged, '.claude/settings.json').after).statusLine, undefined);
  assert.ok(merged.reports.some((report) => report.includes('/cf:setup-statusline')));

  const edited = copyRepo(fixture, 'status-edited');
  fs.appendFileSync(path.join(edited, '.claude/status.cjs'), '\n// my tweak\n');
  const kept = plan(edited).merged;
  assert.deepEqual(JSON.parse(fileOf(kept, '.claude/settings.json').after).statusLine, SETTINGS_TEMPLATE.statusLine);
  assert.ok(!kept.reports.some((report) => report.includes('/cf:setup-statusline')));
});

test('outputstyle-unchanged: the selected output style stays as written', () => {
  const { merged } = plan(fixture);
  const settingsFile = fileOf(merged, '.claude/settings.json');
  assert.equal(JSON.parse(settingsFile.after).outputStyle, JSON.parse(settingsFile.before).outputStyle);
});

test('codex-standdown-reported: a user handler under .codex/hooks survives and is reported', () => {
  const { merged } = plan(fixture);
  const hooksFile = fileOf(merged, '.codex/hooks.json');
  const commands = handlers(JSON.parse(hooksFile.after)).map((handler) => handler.command);
  const user = `node '${path.join(fixture, '.codex/hooks/my.cjs')}'`;
  assert.deepEqual(commands, [user]);
  assert.deepEqual(hooksFile.standDown, [user]);
  assert.ok(merged.reports.some((report) => report.includes('keeps standing down') && report.includes('my.cjs')));
  assert.deepEqual(fileOf(plan(pristine).merged, '.codex/hooks.json').standDown, []);

  // Like the runtime check, a handler script that links out of .codex/hooks does not count.
  const linked = copyRepo(fixture, 'linked-handler');
  const outside = path.join(work, 'linked-handler', 'my.cjs');
  fs.renameSync(path.join(linked, '.codex/hooks/my.cjs'), outside);
  fs.symlinkSync(outside, path.join(linked, '.codex/hooks/my.cjs'));
  const linkedHooks = JSON.parse(fs.readFileSync(path.join(linked, '.codex/hooks.json'), 'utf8'));
  for (const group of linkedHooks.hooks.Stop) for (const handler of group.hooks) handler.command = handler.command.replace(fixture, linked);
  fs.writeFileSync(path.join(linked, '.codex/hooks.json'), JSON.stringify(linkedHooks));
  assert.deepEqual(fileOf(plan(linked).merged, '.codex/hooks.json').standDown, []);
});

test('agents-import-kept: AGENTS.md keeps the user text and CLAUDE.md keeps importing it', () => {
  const { merged } = plan(fixture);
  const agents = fileOf(merged, 'AGENTS.md');
  assert.equal(agents.action, 'write');
  assert.match(agents.after, /^# Team rules before/);
  assert.match(agents.after, /## Team notes after\n$/);
  assert.doesNotMatch(agents.after, /CAFEKIT/);
  assert.ok(merged.reports.some((report) => report.includes('response-language')));
  const claude = fileOf(merged, 'CLAUDE.md');
  assert.equal(claude.action, 'write');
  assert.match(claude.after, /^@AGENTS\.md$/m);
  assert.doesNotMatch(claude.after, /CAFEKIT/);
  // Removing a block keeps the user's indentation and the file's own line endings.
  const crlf = copyRepo(fixture, 'crlf');
  const crlfFile = path.join(crlf, 'AGENTS.md');
  fs.writeFileSync(crlfFile, `${fs.readFileSync(path.join(pristine, 'AGENTS.md'), 'utf8')}\n    indented code\n`.replace(/\n/g, '\r\n'));
  const crlfAfter = fileOf(plan(crlf).merged, 'AGENTS.md').after;
  assert.equal(crlfAfter, '    indented code\r\n');

  // With no user text anywhere both files go.
  assert.equal(fileOf(plan(pristine).merged, 'AGENTS.md').action, 'remove');
  assert.equal(fileOf(plan(pristine).merged, 'CLAUDE.md').action, 'remove');
});

test('env-stays-ignored: after the planned removals .claude/.env is still ignored', () => {
  const repo = copyRepo(fixture, 'applied');
  // Only the root `.claude/` line covers this file; the nested .claude/.gitignore does not.
  fs.writeFileSync(path.join(repo, '.claude/team-notes.txt'), 'notes\n');
  const { manifest, merged } = plan(repo);
  applyPlan(repo, manifest, merged);
  // The developer's own global ignore file must not decide the result.
  const env = { ...process.env, HOME: path.join(work, 'home'), XDG_CONFIG_HOME: path.join(work, 'home'), GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const ignored = (at, rel) => spawnSync('git', ['check-ignore', '-q', rel], { cwd: at, env }).status === 0;
  assert.ok(ignored(repo, '.claude/.env'));
  assert.ok(ignored(repo, '.claude/team-notes.txt'));
  assert.ok(ignored(repo, 'my-local-secrets.txt'));

  // A folder migrate leaves alone keeps its line: here no Claude install exists at all.
  const onlyCodex = copyRepo(codexOnly, 'codex-only-applied');
  fs.mkdirSync(path.join(onlyCodex, '.claude'));
  fs.writeFileSync(path.join(onlyCodex, '.claude/.env'), 'TOKEN=[redacted]\n');
  const codexPlan = plan(onlyCodex);
  assert.equal(codexPlan.manifest.platforms.claude.status, 'absent');
  applyPlan(onlyCodex, codexPlan.manifest, codexPlan.merged);
  assert.ok(ignored(onlyCodex, '.claude/.env'));

  // ...and here the Claude install is refused, so its whole folder stays.
  const refused = copyRepo(fixture, 'claude-refused');
  fs.writeFileSync(path.join(refused, '.claude/cafekit-manifest.json'), '{ "files": ');
  fs.writeFileSync(path.join(refused, '.claude/team-notes.txt'), 'notes\n');
  const refusedPlan = plan(refused);
  assert.equal(refusedPlan.manifest.platforms.claude.status, 'refused');
  assert.ok(!fileOf(refusedPlan.merged, '.gitignore').removedLines.includes('.claude/'));
  applyPlan(refused, refusedPlan.manifest, refusedPlan.merged);
  assert.ok(ignored(refused, '.claude/team-notes.txt'));
});

test('gitignore-user-line-kept: a user line right after the CafeKit block stays', () => {
  const { merged } = plan(fixture);
  const gitignore = fileOf(merged, '.gitignore');
  const lines = gitignore.after.split('\n');
  assert.ok(lines.includes('my-local-secrets.txt'));
  for (const kept of ['.cafekit-backup/', '.cafekit.lock', 'specs/_shared/', '.omp/', 'plans/*', '.claude/']) assert.ok(lines.includes(kept), kept);

  // Once nothing stays under .agents/, only its line leaves the block.
  const repo = copyRepo(fixture, 'agents-gone');
  const manifest = planManifestFiles(repo);
  for (const entry of manifest.entries) {
    if (entry.path.startsWith('.agents/')) Object.assign(entry, { action: 'remove', reason: null });
  }
  const gone = fileOf(planMergedFiles(repo, manifest), '.gitignore');
  assert.deepEqual(gone.removedLines, ['.agents/']);
  assert.ok(gone.after.split('\n').includes('my-local-secrets.txt'));
});

test('omp-refused: a repository with an omp install is refused', () => {
  const repo = copyRepo(fixture, 'omp');
  fs.mkdirSync(path.join(repo, '.omp'));
  fs.writeFileSync(path.join(repo, '.omp/cafekit-manifest.json'), '{"files":{}}');
  const { merged } = plan(repo);
  assert.match(merged.refused, /^omp/);
  assert.match(renderMergedPlan(merged), /Refused — omp/);
  assert.ok(merged.reports.some((report) => report.includes('Grok')));
});

test('markers-unparsed: duplicated or unbalanced markers leave the file untouched', () => {
  const repo = copyRepo(fixture, 'markers');
  const agentsFile = path.join(repo, 'AGENTS.md');
  fs.appendFileSync(agentsFile, '\n<!-- CAFEKIT CORE START -->\n');
  const claudeFile = path.join(repo, 'CLAUDE.md');
  fs.writeFileSync(claudeFile, fs.readFileSync(claudeFile, 'utf8').replace('<!-- CAFEKIT CLAUDE END -->', ''));
  const { merged } = plan(repo);
  for (const rel of ['AGENTS.md', 'CLAUDE.md']) {
    const file = fileOf(merged, rel);
    assert.equal(file.action, 'unparsed', rel);
    assert.equal(file.after, file.before, rel);
  }

  const broken = copyRepo(fixture, 'broken-json');
  fs.writeFileSync(path.join(broken, '.claude/settings.json'), '{ "hooks": ');
  const result = plan(broken);
  assert.equal(fileOf(result.merged, '.claude/settings.json').action, 'unparsed');
  // An unparsable settings file may register any hook script or the status line, so none of them goes.
  assert.ok(result.manifest.entries.filter((entry) => entry.path.startsWith('.claude/hooks/')).every((entry) => entry.action !== 'remove'));
  assert.equal(result.manifest.entries.find((entry) => entry.path === '.claude/status.cjs').action, 'keep');
});
