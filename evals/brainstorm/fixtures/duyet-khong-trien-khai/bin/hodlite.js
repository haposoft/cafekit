#!/usr/bin/env node
// hodlite — mở bảng điều khiển cục bộ.
const http = require("http");

const [command] = process.argv.slice(2);
if (command === "ui") {
  const port = Number(process.env.HODLITE_PORT || 4317);
  http.createServer((req, res) => res.end("hodlite ui\n")).listen(port, () => {
    console.log(`hodlite ui: http://localhost:${port}`);
  });
} else {
  console.error("usage: hodlite ui");
  process.exit(1);
}
