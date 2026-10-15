'use strict';

const fs = require('fs');
const path = require('path');
const VERSION = /^\d+\.\d+\.\d+$/;
const CACHE_TTL = 12 * 60 * 60 * 1000;

function fetchLatestVersion() {
  try {
    const https = require('https');
    return new Promise((resolve) => {
      const req = https.get(
        'https://registry.npmjs.org/@haposoft/cafekit/latest',
        { timeout: 3000, headers: { Accept: 'application/json' } },
        (res) => {
          let body = '';
          res.on('error', () => resolve(null));
          res.on('aborted', () => resolve(null));
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            try { resolve(JSON.parse(body).version || null); } catch { resolve(null); }
          });
        }
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  } catch { return Promise.resolve(null); }
}

function isNewer(a, b) {
  const n = (v) => String(v).split('.').map((x) => parseInt(x, 10) || 0);
  const [aN, bN] = [n(a), n(b)];
  for (let i = 0; i < 3; i++) {
    if (bN[i] > aN[i]) return true;
    if (bN[i] < aN[i]) return false;
  }
  return false;
}

function getInstalledVersion(runtimeDirectory) {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(runtimeDirectory, 'cafekit.json'), 'utf8'));
    return typeof meta.version === 'string' ? meta.version : null;
  } catch { return null; }
}

function noticeFor(installed, latest) {
  return isNewer(installed, latest)
    ? `\n⚡ CafeKit update available: ${installed} → ${latest}\n   Run: npx @haposoft/cafekit\n`
    : '';
}

async function checkCafeKitUpdate(runtimeDirectory, fetchVersion = fetchLatestVersion) {
  const installed = getInstalledVersion(runtimeDirectory);
  if (!installed) return '';
  const cachePath = path.join(runtimeDirectory, '.cafekit-update-cache.json');
  const now = Date.now();
  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (typeof cache.ts === 'number' && Number.isFinite(cache.ts) && cache.ts <= now
      && now - cache.ts < CACHE_TTL && typeof cache.latest === 'string' && VERSION.test(cache.latest)) {
      return noticeFor(installed, cache.latest);
    }
  } catch {
    // Missing, corrupt or legacy cache requires a fresh version fetch.
  }
  let latest;
  try { latest = await fetchVersion(); } catch { return ''; }
  if (typeof latest !== 'string' || !VERSION.test(latest)) return '';
  try {
    fs.writeFileSync(cachePath, JSON.stringify({ ts: Date.now(), latest }), 'utf8');
  } catch { /* cache persistence is optional */ }
  return noticeFor(installed, latest);
}

module.exports = { fetchLatestVersion, isNewer, getInstalledVersion, checkCafeKitUpdate };
