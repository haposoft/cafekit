'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { hookStateDir } = require('./hook-context.cjs');

function reservationFile(projectRoot, sessionId) {
  const key = crypto.createHash('sha256')
    .update(String(sessionId || 'unknown'))
    .digest('hex')
    .slice(0, 16);
  return path.join(hookStateDir(projectRoot), `rules-${key}.json`);
}

/** Reserve one injection slot per session. Returns null on reservation errors. */
function reserveSession(projectRoot, sessionId) {
  if (!sessionId) return null;
  try {
    const file = reservationFile(projectRoot, sessionId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ sessionId: String(sessionId) }), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600
    });
    return true;
  } catch (error) {
    return error.code === 'EEXIST' ? false : null;
  }
}

function clearSessionReservation(projectRoot, sessionId) {
  if (!sessionId) return;
  try { fs.rmSync(reservationFile(projectRoot, sessionId), { force: true }); } catch { /* fail-open */ }
}

module.exports = { reserveSession, clearSessionReservation };
