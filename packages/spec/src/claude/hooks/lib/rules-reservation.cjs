'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { hookStateDir } = require('./hook-state-dir.cjs');

function reservationFile(sessionId) {
  if (!sessionId) return null;
  const key = crypto.createHash('sha256').update(String(sessionId)).digest('hex');
  return path.join(hookStateDir(), `rules-${key}.json`);
}

/** Reserve one injection slot per session. Returns null on reservation errors. */
function reserveSession(sessionId) {
  try {
    const file = reservationFile(sessionId);
    if (!file) return null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ sessionId: String(sessionId) }), {
      encoding: 'utf8', flag: 'wx', mode: 0o600,
    });
    return true;
  } catch (error) {
    return error.code === 'EEXIST' ? false : null;
  }
}

function clearSessionReservation(sessionId) {
  try {
    const file = reservationFile(sessionId);
    if (file) fs.rmSync(file, { force: true });
  } catch { /* fail-open */ }
}

module.exports = { reserveSession, clearSessionReservation };
