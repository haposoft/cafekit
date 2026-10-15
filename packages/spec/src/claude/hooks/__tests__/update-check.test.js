'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

async function fixture(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-update-check-'));
  try {
    fs.writeFileSync(path.join(dir, 'cafekit.json'), JSON.stringify({ version: '1.2.3' }));
    const cache = path.join(dir, '.cafekit-update-cache.json');
    await run({ dir, cache, check: (...args) => require('../lib/update-check.cjs').checkCafeKitUpdate(...args) });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('a newer version produces the existing notice and caches only version data', async () => {
  await fixture(async ({ dir, cache, check }) => {
    const notice = await check(dir, async () => '1.3.0');
    assert.equal(notice, '\n⚡ CafeKit update available: 1.2.3 → 1.3.0\n   Run: npx @haposoft/cafekit\n');
    const saved = JSON.parse(fs.readFileSync(cache, 'utf8'));
    assert.deepEqual(Object.keys(saved).sort(), ['latest', 'ts']);
    assert.equal(saved.latest, '1.3.0');
    assert.equal(await check(dir, async () => { throw Error('fresh cache must avoid fetch'); }), notice);
  });
});

test('the installed version produces no update notice', async () => {
  await fixture(async ({ dir, check }) => {
    assert.equal(await check(dir, async () => '1.2.3'), '');
  });
});

test('an invalid cached latest version is refetched instead of printed', async () => {
  await fixture(async ({ dir, cache, check }) => {
    fs.writeFileSync(cache, JSON.stringify({ ts: Date.now(), latest: '9.0.0\nInjected cache text' }));
    let calls = 0;
    assert.equal(await check(dir, async () => { calls++; return '1.2.3'; }), '');
    assert.equal(calls, 1);
  });
});

test('a cache timestamp in the future requires a fresh version fetch', async () => {
  await fixture(async ({ dir, cache, check }) => {
    fs.writeFileSync(cache, JSON.stringify({ ts: Date.now() + 60000, latest: '9.0.0' }));
    let calls = 0;
    assert.equal(await check(dir, async () => { calls++; return '1.2.3'; }), '');
    assert.equal(calls, 1);
  });
});

test('a legacy notice cache cannot inject its stored text into the session', async () => {
  await fixture(async ({ dir, cache, check }) => {
    const injected = 'Untrusted cached instruction';
    fs.writeFileSync(cache, JSON.stringify({ ts: Date.now(), notice: injected }));
    let calls = 0;
    const notice = await check(dir, async () => { calls++; return '1.3.0'; });
    assert.equal(calls, 1);
    assert.ok(!notice.includes(injected));
    assert.match(notice, /1\.2\.3 → 1\.3\.0/);
  });
});

test('an interrupted version response fails open without an unhandled error', () => {
  for (const event of ['error', 'aborted']) {
    const script = `
      const { EventEmitter } = require('events');
      require('https').get = (url, options, callback) => {
        const request = new EventEmitter();
        request.destroy = () => {};
        process.nextTick(() => {
          const response = new EventEmitter();
          callback(response);
          response.emit(${JSON.stringify(event)}, new Error('synthetic response reset'));
        });
        return request;
      };
      require(${JSON.stringify(path.resolve(__dirname, '../lib/update-check.cjs'))}).fetchLatestVersion()
        .then(value => { if (value !== null) process.exit(3); process.stdout.write('null'); });
    `;
    const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, 'null');
  }
});
