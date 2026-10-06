function activeUsers(users) {
  return users.filter((u) => u.active);
}

module.exports = { activeUsers };
