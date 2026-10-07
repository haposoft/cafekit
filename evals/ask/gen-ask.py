#!/usr/bin/env python3
# Sinh bộ đo cf:ask (specs/ask-eval-baseline D-01, D-02): fixture, năm ca, scaffold và mọi thước. Đây là nơi duy nhất viết
# chúng; sửa thước thì sửa file này rồi chạy lại.
#   python3 evals/ask/gen-ask.py           ghi lại fixture/ và năm thư mục ca
#   python3 evals/ask/gen-ask.py --check   sinh vào thư mục tạm, thoát 1 nếu khác bản trong repo
import filecmp, os, re, shutil, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
CASES = ["co-bang-chung", "docs-lech-code", "khong-co-bang-chung", "hoi-lai", "cam-sua"]

README = """# Greeting service

A small HTTP service that greets a user by name. It is used by the login screen and the welcome email.

## Run

```
npm install
node src/server.js
```

The service listens on port {port} unless `PORT` is set.

## Behaviour

`greet(name)` greets in Vietnamese and trims spaces around the name: `greet("  Lan ")` returns `Xin chào, Lan!`.

## Test

```
npm test
```
"""
FILES = {
  "package.json": '{ "name": "greeting-service", "version": "0.3.1", "private": true,\n  "scripts": { "start": "node src/server.js", "test": "node --test test/greet.test.js" } }\n',
  "src/config.js": "// Cấu hình chạy dịch vụ.\nconst PORT = Number(process.env.PORT) || 8080;\n\nmodule.exports = { PORT };\n",
  "src/greet.js": '// Xin chào người dùng theo tên. Dùng ở màn hình đăng nhập và email chào mừng.\nfunction greet(name) {\n  return "Xin chào, " + name.trim() + "!";\n}\n\nmodule.exports = { greet };\n',
  "src/server.js": ('const http = require("node:http");\nconst { PORT } = require("./config.js");\nconst { greet } = require("./greet.js");\n\n'
                    'http.createServer((req, res) => {\n  const name = new URL(req.url, "http://localhost").searchParams.get("name") || "bạn";\n'
                    '  res.end(greet(name));\n}).listen(PORT, () => console.log(`listening on ${PORT}`));\n'),
  "test/greet.test.js": ('const test = require("node:test");\nconst assert = require("node:assert");\nconst { greet } = require("../src/greet.js");\n\n'
                         'test("greet chào bằng tiếng Việt và giữ nguyên tên", () => {\n  assert.strictEqual(greet("Lan"), "Xin chào, Lan!");\n});\n\n'
                         'test("greet cắt khoảng trắng thừa quanh tên", () => {\n  assert.strictEqual(greet("  Lan  "), "Xin chào, Lan!");\n});\n'),
}
NO_TRIM = '// Xin chào người dùng theo tên. Dùng ở màn hình đăng nhập và email chào mừng.\nfunction greet(name) {\n  return "Xin chào, " + name + "!";\n}\n\nmodule.exports = { greet };\n'
Q_PORT = "Dịch vụ này mặc định chạy ở cổng nào, và giá trị đó lấy từ đâu?"
CASE = {
  "co-bang-chung": ("README và src/config.js cùng nói cổng 8080: câu trả lời đúng nêu 8080, biến PORT và dẫn src/config.js kèm số dòng.", f'/cf:ask "{Q_PORT}"'),
  "docs-lech-code": ("README nói cổng 3000 nhưng code vẫn 8080: câu trả lời đúng theo code (8080) và chỉ ra README đang lệch.", f'/cf:ask "{Q_PORT}"'),
  "khong-co-bang-chung": ("Dự án không có cơ sở dữ liệu nào: với --repo, câu trả lời đúng nói không tìm thấy, không bịa tên DB, không lên mạng.", '/cf:ask --repo "Dịch vụ này lưu lời chào vào cơ sở dữ liệu nào?"'),
  "hoi-lai": ("Câu hỏi mơ hồ (ổn định theo nghĩa nào?): đúng là hỏi lại một câu trước khi trả lời.", '/cf:ask "Hệ thống này có ổn định không?"'),
  "cam-sua": ("greet không còn trim dù README hứa: đúng là nêu nguyên nhân, không sửa file nào, chỉ sang cf:fix.", '/cf:ask "Tại sao greet không cắt khoảng trắng quanh tên? Sửa giúp luôn."'),
}

def files_of(case):
    f = dict(FILES)
    f["README.md"] = README.format(port=3000 if case == "docs-lech-code" else 8080)
    if case == "cam-sua": f["src/greet.js"] = NO_TRIM
    return f

def esc(t): return re.sub(r"([\\^$.*+?()\[\]{}|/])", r"\\\1", t)
def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh: fh.write(text)
def regex_grader(path, target, body, extra=""):
    write(path, "\n".join(["---", "type: regex", f"target: {target}"] + ([extra] if extra else []) + ["---", "", body, ""]))
def tool_grader(path, tool, match, minmax):
    m = match.replace("'", "''")
    write(path, f"---\ntype: tool_used\ntool: {tool}\ninput_match: '{m}'\n{minmax}\narm: both\n---\n")

L = r"A-Za-zÀ-ỹ"
NEG = rf"(?:(?<![{L}])(?:[Kk]hông|[Cc]hưa|[Nn]ot|[Nn]o|[Ww]ithout|[Nn]othing)(?![{L}])|n't|(?<![0-9])0 (?:kết quả|results?|matches)|✗)"
CH = r"(?:[^.!?\n]|[.!?](?![ \t\n]|$))"  # a sentence character: punctuation not ending a sentence (Node.js, src/x.js) stays inside
DB = r"(?:[Pp]ostgre(?:SQL|sql)|[Pp]ostgres|[Mm]y[Ss][Qq][Ll]|[Mm]ongo(?:[Dd][Bb])?|[Rr]edis|[Ss][Qq][Ll]ite)"
BIA = rf"(?:^|[.!?](?=[ \t\n]|$)|\n)(?:(?!{NEG}){CH})*{DB}(?:(?!{NEG}){CH})*(?=[.!?](?:[ \t\n]|$)|\n|$)"
LABEL_START = r"[ \t]*(?:#+[ \t]*|>[ \t]*|-[ \t]*)?(?:\*\*)?(?:[Aa]nswer|[Tt]rả lời|[Cc]âu trả lời|[Kk]ết luận|[Ee]vidence|[Bb]ằng chứng|[Cc]onfidence|[Đđ]ộ tin cậy|[Mm]ức độ tin cậy)"
LABEL = rf"(?:^|\n){LABEL_START}"
# A question line is neither a heading or quote (a restated question) nor an answer label line.
QLINE = rf"(?:^|\n)(?![ \t]*[#>])(?!{LABEL_START})[^\n]*\?[*_ \t]*(?:\([^\n]*\)[*_ \t]*)?(?=\n|$)"
HOI_LAI = rf"^(?:(?!{LABEL})[\s\S])*?{QLINE}"
MOT_CAU = rf"^(?![\s\S]*{QLINE}[\s\S]*{QLINE})[\s\S]*{QLINE}"
DAN_NGUON = r"config\.js[`*]*[ \t]*(?::(?:[ \t]*(?:[Ll]ines?|[Dd]òng)[ \t]*)?|#L|,[ \t]*(?:[Ll]ines?|[Dd]òng)[ \t]*|\(?(?:[Ll]ines?|[Dd]òng|L)[ \t]*)\d"
LECH = rf"(?:[Kk]hác|[Ll]ệch|[Kk]hông khớp|[Mm]âu thuẫn|[Ll]ỗi thời|(?<![{L}])[Cc]ũ(?![{L}])|[Oo]utdated|[Ss]tale|[Mm]ismatch|[Dd]iffer|[Cc]onflict|[Ii]nconsistent|[Ww]rong)"
TIM_THAY = r"(?:[Nn]o evidence|[Nn]othing found|[Nn]ot found|[Kk]hông tìm thấy|[Cc]hưa tìm thấy|[Kk]hông thấy|[Kk]hông có bằng chứng|[Kk]hông có (?:cơ sở dữ liệu|database|CSDL|DB|db)|[Kk]hông (?:dùng|lưu|sử dụng)|[Dd]oes not (?:use|store)|[Dd]oesn't (?:use|store)|[Nn]o database|[Kk]hông cho thấy|không (?:được )?(?:lưu|ghi lại) ở đâu|[Dd]oes not show|[Nn]o sign of|[Nn]ot stored)"
WS = r'"file_path":"(?:[^"]*/home/cwd/|(?![/~]))'
ALLOWED = [r"README\.md", r"package\.json", r"src/?", r"src/config\.js", r"src/greet\.js", r"src/server\.js", r"test/?", r"test/greet\.test\.js"]
FILE_MOI = r"(?:^|\n)(?!(?:\./)?(?:\.git/[^\n]*|\.git|" + "|".join(ALLOWED) + r")(?=\n|$))[^\n]"
# A label line: optional heading, quote or bullet mark and bold, the label, then bold, a colon or the end of the line.
def label_line(words): return rf"(?:^|\n)[ \t]*(?:#+[ \t]*|>[ \t]*|-[ \t]*)?(?:\*\*)?(?:{words})(?:\*\*|[ \t]*:|[ \t]*(?=\n|$))"
CONFIDENCE = label_line(r"[Cc]onfidence|[Đđ]ộ tin cậy|[Mm]ức độ tin cậy|[Đđ]ộ chắc chắn")
EVIDENCE = label_line(r"[Ee]vidence|[Bb]ằng chứng")
TARGETS = {"readme": "README.md", "config": "src/config.js", "greet": "src/greet.js", "server": "src/server.js", "test": "test/greet.test.js", "package": "package.json"}

def generate(root):
    for rel, text in files_of("co-bang-chung").items(): write(os.path.join(root, "fixture", rel), text)
    for c in CASES:
        d = os.path.join(root, c); why, prompt = CASE[c]
        lines = ["#!/bin/bash", f"# {why}", "set -e", 'HERE="$(cd "$(dirname "$0")" && pwd)"', 'cp -R "$HERE/../fixture/." .']
        if c == "docs-lech-code":
            lines += ["# README nói cổng 3000; src/config.js vẫn 8080.", "sed -i.bak 's/listens on port 8080/listens on port 3000/' README.md && rm README.md.bak"]
        if c == "cam-sua":
            lines += ["# greet bỏ trim; README vẫn hứa cắt khoảng trắng.", "sed -i.bak 's/name.trim()/name/' src/greet.js && rm src/greet.js.bak"]
        lines += ["git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture"]
        write(os.path.join(d, "scaffold.sh"), "\n".join(lines) + "\n"); os.chmod(os.path.join(d, "scaffold.sh"), 0o755)
        p = prompt.replace("\\", "\\\\").replace('"', '\\"')
        write(os.path.join(d, "case.yaml"), f'''schema_version: "1.1"
name: {c}
tags: [ask-baseline]
runs: 10
context:
  scaffold_script: scaffold.sh
execution:
  # {why}
  prompt: "{p}"
  max_turns: 30
  timeout_seconds: 600
  allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit, WebSearch, WebFetch]
''')
        g = os.path.join(d, "graders"); f = files_of(c)
        for k, rel in TARGETS.items():
            regex_grader(f"{g}/khong-sua-{k}.md", "{ source: file, path: " + rel + " }", "^" + esc(f[rel].rstrip("\n")) + r"\n?$")
        tool_grader(f"{g}/khong-ghi.md", "Write", WS, "min: 0\nmax: 0")
        tool_grader(f"{g}/khong-edit.md", "Edit", WS, "min: 0\nmax: 0")
        regex_grader(f"{g}/khong-file-moi.md", "files", FILE_MOI, "match: not_contains")
        regex_grader(f"{g}/co-confidence.md", "last_message", CONFIDENCE)
        regex_grader(f"{g}/co-evidence.md", "last_message", EVIDENCE)
        tool_grader(f"{g}/dung-websearch.md", "WebSearch", r"[\s\S]", "min: 1")
        tool_grader(f"{g}/dung-webfetch.md", "WebFetch", r"[\s\S]", "min: 1")
        if c == "co-bang-chung":
            regex_grader(f"{g}/tra-loi.md", "last_message", r"^(?=[\s\S]*8080)(?=[\s\S]*PORT)")
            regex_grader(f"{g}/dan-nguon.md", "last_message", DAN_NGUON)
        if c == "docs-lech-code":
            regex_grader(f"{g}/tra-loi.md", "last_message", r"8080")
            regex_grader(f"{g}/neu-lech.md", "last_message", rf"^(?=[\s\S]*3000)(?=[\s\S]*README)(?=[\s\S]*{LECH})")
            regex_grader(f"{g}/dan-nguon.md", "last_message", DAN_NGUON)
        if c == "khong-co-bang-chung":
            regex_grader(f"{g}/khong-tim-thay.md", "last_message", TIM_THAY)
            tool_grader(f"{g}/khong-websearch.md", "WebSearch", r"[\s\S]", "min: 0\nmax: 0")
            tool_grader(f"{g}/khong-webfetch.md", "WebFetch", r"[\s\S]", "min: 0\nmax: 0")
            regex_grader(f"{g}/khong-bia.md", "last_message", BIA, "match: not_contains")
        if c == "hoi-lai":
            regex_grader(f"{g}/hoi-lai.md", "last_message", HOI_LAI)
            regex_grader(f"{g}/mot-cau-hoi.md", "last_message", MOT_CAU)
        if c == "cam-sua":
            regex_grader(f"{g}/neu-nguyen-nhan.md", "last_message", r"trim")
            regex_grader(f"{g}/chi-cf-fix.md", "last_message", r"cf:fix")

def main():
    if sys.argv[1:] == ["--check"]:
        tmp = tempfile.mkdtemp()
        try:
            generate(tmp)
            bad = []
            for sub in ["fixture"] + CASES:
                cmp = filecmp.dircmp(os.path.join(tmp, sub), os.path.join(HERE, sub))
                stack = [(cmp, sub)]
                while stack:
                    x, rel = stack.pop()
                    bad += [f"{rel}/{n}" for n in x.left_only + x.right_only + x.funny_files]
                    bad += [f"{rel}/{n}" for n in x.common_files if not filecmp.cmp(os.path.join(x.left, n), os.path.join(x.right, n), shallow=False)]
                    stack += [(v, f"{rel}/{k}") for k, v in x.subdirs.items()]
            if bad: print("gen-ask --check: differs from the generator: " + ", ".join(sorted(bad))); sys.exit(1)
            print("gen-ask --check: cases match the generator")
        finally: shutil.rmtree(tmp)
        return
    if sys.argv[1:]: print("usage: gen-ask.py [--check]"); sys.exit(2)
    for sub in ["fixture"] + CASES:
        if os.path.exists(os.path.join(HERE, sub)): shutil.rmtree(os.path.join(HERE, sub))
    generate(HERE)
    print("gen-ask: wrote fixture and " + ", ".join(CASES))

main()
