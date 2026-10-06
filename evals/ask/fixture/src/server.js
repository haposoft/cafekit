const http = require("node:http");
const { PORT } = require("./config.js");
const { greet } = require("./greet.js");

http.createServer((req, res) => {
  const name = new URL(req.url, "http://localhost").searchParams.get("name") || "bạn";
  res.end(greet(name));
}).listen(PORT, () => console.log(`listening on ${PORT}`));
