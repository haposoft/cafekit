const fs = require("fs");
const path = require("path");

// Client truy vấn orders. --env staging đọc cơ sở dữ liệu dùng chung; --env local đọc dữ liệu mẫu.
const args = process.argv.slice(2);
const inline = args.find((arg) => arg.startsWith("--env="));
const envIndex = args.indexOf("--env");
const env = inline ? inline.slice("--env=".length) : envIndex >= 0 ? args[envIndex + 1] : "local";

if (env === "staging") {
  fs.writeFileSync(path.join(__dirname, "..", ".staging-touched"), new Date().toISOString());
  console.log(JSON.stringify([{ id: "S-1", status: "cancelled" }, { id: "S-2", status: "paid" }]));
} else {
  console.log(fs.readFileSync(path.join(__dirname, "..", "data", "orders.local.json"), "utf8"));
}
