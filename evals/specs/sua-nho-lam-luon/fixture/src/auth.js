const bcrypt = require('bcrypt');
const users = require('./users-store');
async function login(req, res) {
  const { email, password } = req.body || {};
  const user = await users.findByEmail(email);
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ error: 'invalid_credentials' });
  req.session.userId = user.id;
  res.json({ ok: true });
}
function logout(req, res) { req.session = null; res.json({ ok: true }); }
function requireUser(req, res, next) { if (!req.session?.userId) return res.status(401).end(); next(); }
module.exports = { login, logout, requireUser };
