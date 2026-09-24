const fs = require("fs");
const path = require("path");

// Cấu hình mặc định, ghi đè bằng config/local.json nếu file đó tồn tại trên máy.
const base = require("./default.json");
const localPath = path.join(__dirname, "local.json");
const local = fs.existsSync(localPath) ? JSON.parse(fs.readFileSync(localPath, "utf8")) : {};

module.exports = { ...base, ...local };
