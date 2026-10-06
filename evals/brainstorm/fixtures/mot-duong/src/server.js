import http from "node:http";

// Một tiến trình Node phục vụ API và chạy job nền.
const server = http.createServer((req, res) => res.end("ok\n"));
server.listen(3000);
