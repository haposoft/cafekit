// Dấu riêng của MỘT lần chạy Verification Plan: `start` sinh một nonce mới, in RUN-A-<nonce>; `end` in RUN-B-<cùng nonce>;
// `fail` in FAIL-<cùng nonce>. Mỗi dấu cũng được ghi thêm vào .eval/ran.log (thư mục bị loại khỏi git, không làm đổi Head).
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, ".eval");
fs.mkdirSync(dir, { recursive: true });
const current = path.join(dir, "current");
const step = process.argv[2];
let nonce;
if (step === "start") { nonce = crypto.randomUUID(); fs.writeFileSync(current, nonce); }
else nonce = fs.readFileSync(current, "utf8").trim();
const mark = `${step === "start" ? "RUN-A" : step === "end" ? "RUN-B" : "FAIL"}-${nonce}`;
fs.appendFileSync(path.join(dir, "ran.log"), `${mark}\n`);
console.log(mark);
