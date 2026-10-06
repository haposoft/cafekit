const ADMIN_ROLE = "admin";

function activeUsers(users) {
  return users.filter((u) => u.active);
}

function activeAdmins(users) {
  return users.filter((u) => u.active = true && u.role === ADMIN_ROLE);
}

module.exports = { activeUsers, activeAdmins };
