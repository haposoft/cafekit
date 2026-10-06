'use strict';

const DYNAMIC_READ_PATH = '<dynamic-read-path>';
const MAX_DEPTH = 8;

const SIMPLE_READERS = new Set([
  'cat', 'less', 'more', 'head', 'tail', 'nl', 'strings', 'tac', 'bat',
  'od', 'hexdump', 'xxd', 'base64', 'wc', 'cut', 'sort', 'uniq', 'tr',
  'fold', 'fmt', 'diff', 'cmp', 'comm', 'file', 'stat', 'du', 'md5',
  'md5sum', 'shasum', 'sha1sum', 'sha256sum', 'open',
]);
const GREP_READERS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag']);
const AWK_READERS = new Set(['awk', 'gawk', 'mawk']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish']);
const INLINE_RUNTIMES = new Set(['python', 'python3', 'node', 'perl', 'ruby', 'php']);
const WRAPPERS = new Set(['command', 'builtin', 'exec', 'env', 'nice', 'nohup', 'sudo', 'doas', 'timeout']);
const WRAPPER_OPTION_VALUE = new Set([
  '-n', '--lines', '-c', '--bytes', '-m', '--max-count', '-A', '-B', '-C',
  '--after-context', '--before-context', '--context', '-d', '--delimiter',
  '-f', '--fields', '-k', '--key', '-t', '--field-separator', '-e',
  '--regexp', '-I', '--include', '--exclude', '--exclude-dir', '-s',
  '--signal', '--kill-after', '-u', '--user', '-g', '--group', '-C',
  '--chdir', '-p', '--priority', '--adjustment',
]);
const SIMPLE_OPTION_VALUES = new Map([
  ['head', new Set(['-n', '--lines', '-c', '--bytes'])],
  ['tail', new Set(['-n', '--lines', '-c', '--bytes', '-s', '--sleep-interval'])],
  ['cut', new Set(['-b', '--bytes', '-c', '--characters', '-d', '--delimiter', '-f', '--fields'])],
  ['sort', new Set(['-k', '--key', '-t', '--field-separator', '-S', '--buffer-size', '-T', '--temporary-directory'])],
  ['tr', new Set()],
  ['fold', new Set(['-w', '--width'])],
]);
const GREP_OPTION_VALUE = new Set(['-e', '--regexp', '-f', '--file', '-m', '--max-count', '-A', '-B', '-C', '--after-context', '--before-context', '--context']);
const SED_OPTION_VALUE = new Set(['-e', '--expression', '-f', '--file']);
const AWK_OPTION_VALUE = new Set(['-f', '--file', '-v', '--assign', '-F', '--field-separator']);
const XARGS_OPTION_VALUE = new Set(['-a', '--arg-file', '-d', '--delimiter', '-E', '--eof', '-I', '--replace', '-L', '--max-lines', '-n', '--max-args', '-P', '--max-procs', '-s', '--max-chars']);

function expansionAt(source, index) {
  const next = source[index + 1];
  return Boolean(next && (next === '{' || next === '('
    || '*@#$?!-0123456789'.includes(next) || /[A-Za-z_]/.test(next)));
}

function matchingParen(source, start) {
  let depth = 1;
  let quote = null;
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const ch = source[index];
    if (escaped) { escaped = false; continue; }
    if (quote === "'") { if (ch === "'") quote = null; continue; }
    if (quote === '"') {
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') quote = null;
      continue;
    }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '(') depth += 1;
    if (ch === ')' && --depth === 0) return index;
  }
  return -1;
}

function matchingBacktick(source, start) {
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const ch = source[index];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '\x60') return index;
  }
  return -1;
}

function decodeAnsiQuote(source, start) {
  let value = '';
  for (let index = start + 2; index < source.length; index += 1) {
    const ch = source[index];
    if (ch === "'") return { value, end: index };
    if (ch !== '\\') { value += ch; continue; }
    const next = source[index + 1];
    if (!next) return null;
    if (next === 'x') {
      const match = source.slice(index + 2).match(/^[0-9a-fA-F]{1,2}/);
      if (match) { value += String.fromCodePoint(parseInt(match[0], 16)); index += 1 + match[0].length; continue; }
    }
    if (next === 'u' || next === 'U') {
      const width = next === 'u' ? 4 : 8;
      const digits = source.slice(index + 2, index + 2 + width);
      if (new RegExp(`^[0-9a-fA-F]{${width}}$`).test(digits)) {
        value += String.fromCodePoint(parseInt(digits, 16));
        index += 1 + width;
        continue;
      }
    }
    const octal = source.slice(index + 1).match(/^[0-7]{1,3}/);
    if (octal) { value += String.fromCodePoint(parseInt(octal[0], 8)); index += octal[0].length; continue; }
    const escapes = { a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"' };
    value += Object.prototype.hasOwnProperty.call(escapes, next) ? escapes[next] : next;
    index += 1;
  }
  return null;
}

function scanShell(command) {
  const source = String(command).replace(/\\\r?\n/g, '');
  const segments = [];
  const nested = [];
  let words = [];
  let word = { text: '', activeExpansion: false, started: false };
  let quote = null;
  let escaped = false;
  let malformed = false;
  const append = (value) => { word.text += value; word.started = true; };
  const flushWord = () => {
    if (word.started || word.text) words.push(word);
    word = { text: '', activeExpansion: false, started: false };
  };
  const flushSegment = () => { flushWord(); if (words.length) segments.push(words); words = []; };

  for (let index = 0; index < source.length; index += 1) {
    const ch = source[index];
    if (quote === "'") { if (ch === "'") quote = null; else append(ch); continue; }
    if (escaped) { append(ch); escaped = false; continue; }
    if (ch === '\\') { escaped = true; word.started = true; continue; }
    if (quote === '"') {
      if (ch === '"') { quote = null; continue; }
      if (ch === '$' && expansionAt(source, index)) {
        word.activeExpansion = true;
        append('$');
        if (source[index + 1] === '(') {
          const end = matchingParen(source, index + 1);
          if (end < 0) { malformed = true; continue; }
          nested.push(source.slice(index + 2, end));
          append('()');
          index = end;
        }
        continue;
      }
      if (ch === '\x60') {
        word.activeExpansion = true;
        const end = matchingBacktick(source, index);
        if (end < 0) { malformed = true; continue; }
        nested.push(source.slice(index + 1, end));
        append('\x60\x60');
        index = end;
        continue;
      }
      append(ch);
      continue;
    }
    if (ch === '$' && source[index + 1] === "'") {
      const decoded = decodeAnsiQuote(source, index);
      if (!decoded) { malformed = true; append(ch); continue; }
      append(decoded.value);
      index = decoded.end;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; word.started = true; continue; }
    if (ch === '$' && expansionAt(source, index)) {
      word.activeExpansion = true;
      append('$');
      if (source[index + 1] === '(') {
        const end = matchingParen(source, index + 1);
        if (end < 0) { malformed = true; continue; }
        nested.push(source.slice(index + 2, end));
        append('()');
        index = end;
      }
      continue;
    }
    if (ch === '\x60') {
      word.activeExpansion = true;
      const end = matchingBacktick(source, index);
      if (end < 0) { malformed = true; continue; }
      nested.push(source.slice(index + 1, end));
      append('\x60\x60');
      index = end;
      continue;
    }
    if ((ch === '<' || ch === '>') && source[index + 1] === '(') {
      word.activeExpansion = true;
      const end = matchingParen(source, index + 1);
      if (end < 0) { malformed = true; continue; }
      nested.push(source.slice(index + 2, end));
      append(`${ch}()`);
      index = end;
      continue;
    }
    if ((ch === '~' && !word.text) || '*?{['.includes(ch)) { word.activeExpansion = true; append(ch); continue; }
    if (';|&\n()'.includes(ch)) { flushSegment(); continue; }
    if (ch === '<') { flushWord(); words.push({ text: '<', activeExpansion: false, started: true }); continue; }
    if (ch === '>') { flushWord(); continue; }
    if (' \t\r'.includes(ch)) { flushWord(); continue; }
    append(ch);
  }
  if (quote || escaped) malformed = true;
  flushSegment();
  return { segments, nested, malformed };
}

function commandName(word) {
  return String(word?.text || '').replace(/^[([{]+|[)},;]+$/g, '').split(/[\\/]/).pop().toLowerCase();
}

function assignment(word) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(String(word?.text || ''));
}

function skipOption(words, index, valueOptions = WRAPPER_OPTION_VALUE) {
  const value = words[index]?.text || '';
  if (value === '--') return index + 1;
  if (!value.startsWith('-') || value === '-') return index;
  if (value.includes('=') || /^-[A-Za-z]\S+/.test(value)) return index + 1;
  return valueOptions.has(value) ? index + 2 : index + 1;
}

function unwrap(words) {
  let index = 0;
  while (index < words.length && assignment(words[index])) index += 1;
  for (let depth = 0; depth < 12 && index < words.length; depth += 1) {
    const name = commandName(words[index]);
    if (!WRAPPERS.has(name)) return { index, name };
    index += 1;
    if (name === 'command' && ['-v', '-V'].includes(words[index]?.text)) return { index: -1, name: '' };
    if (name === 'timeout') {
      while (index < words.length && words[index].text.startsWith('-')) index = skipOption(words, index);
      index += 1;
    } else if (name === 'env') {
      while (index < words.length) {
        if (assignment(words[index])) { index += 1; continue; }
        if (!words[index].text.startsWith('-') || words[index].text === '-') break;
        index = skipOption(words, index);
      }
    } else {
      while (index < words.length && words[index].text.startsWith('-')) index = skipOption(words, index);
    }
    while (index < words.length && assignment(words[index])) index += 1;
  }
  return index < words.length ? { index, name: commandName(words[index]) } : { index: -1, name: '' };
}

function addOperand(result, word) {
  if (!word) return;
  if (word.activeExpansion) result.dynamic = true;
  else if (word.text && word.text !== '-') result.paths.add(word.text);
}

function genericOperands(words, start, result, {
  skipFirst = 0,
  pathOptions = new Set(),
  valueOptions = new Set(),
} = {}) {
  let positional = 0;
  for (let index = start; index < words.length;) {
    const word = words[index];
    if (word.text === '--') { index += 1; while (index < words.length) addOperand(result, words[index++]); break; }
    if (word.text.startsWith('-') && word.text !== '-') {
      const option = word.text.split('=')[0];
      if (pathOptions.has(option)) {
        if (word.text.includes('=')) addOperand(result, { text: word.text.slice(word.text.indexOf('=') + 1), activeExpansion: word.activeExpansion });
        else addOperand(result, words[index + 1]);
      }
      index = skipOption(words, index, valueOptions);
      continue;
    }
    if (positional++ >= skipFirst) addOperand(result, word);
    index += 1;
  }
}

function merge(target, source) {
  source.paths.forEach((value) => target.paths.add(value));
  target.dynamic ||= source.dynamic;
  target.malformed ||= source.malformed;
}

function analyzeWords(words, result, depth) {
  for (let index = 0; index + 1 < words.length; index += 1) {
    if (words[index].text === '<') addOperand(result, words[index + 1]);
  }
  const command = unwrap(words);
  if (command.index < 0) return;
  const start = command.index + 1;
  const name = command.name;
  if (SIMPLE_READERS.has(name)) {
    genericOperands(words, start, result, { valueOptions: SIMPLE_OPTION_VALUES.get(name) || new Set() });
    return;
  }
  if (GREP_READERS.has(name)) {
    const patternOption = words.slice(start).some((word) => ['-e', '--regexp', '-f', '--file'].includes(word.text.split('=')[0]));
    genericOperands(words, start, result, {
      skipFirst: patternOption ? 0 : 1,
      pathOptions: new Set(['-f', '--file']),
      valueOptions: GREP_OPTION_VALUE,
    });
    return;
  }
  if (name === 'sed') {
    const scriptOption = words.slice(start).some((word) => ['-e', '--expression', '-f', '--file'].includes(word.text.split('=')[0]));
    genericOperands(words, start, result, {
      skipFirst: scriptOption ? 0 : 1,
      pathOptions: new Set(['-f', '--file']),
      valueOptions: SED_OPTION_VALUE,
    });
    return;
  }
  if (AWK_READERS.has(name)) {
    const programFile = words.slice(start).some((word) => ['-f', '--file'].includes(word.text.split('=')[0]));
    genericOperands(words, start, result, {
      skipFirst: programFile ? 0 : 1,
      pathOptions: new Set(['-f', '--file']),
      valueOptions: AWK_OPTION_VALUE,
    });
    return;
  }
  if (name === 'source' || name === '.') { genericOperands(words, start, result); return; }
  if (SHELLS.has(name)) {
    for (let index = start; index + 1 < words.length; index += 1) {
      if (words[index].text === '-c' || words[index].text === '--command') {
        merge(result, analyzeCommand(words[index + 1].text, depth + 1));
        return;
      }
    }
    genericOperands(words, start, result);
    return;
  }
  if (name === 'eval') {
    merge(result, analyzeCommand(words.slice(start).map((word) => word.text).join(' '), depth + 1));
    return;
  }
  if (name === 'find') {
    for (let index = start; index < words.length; index += 1) {
      if (words[index].text !== '-exec' && words[index].text !== '-execdir') continue;
      const nested = [];
      for (index += 1; index < words.length && ![';', '+'].includes(words[index].text); index += 1) nested.push(words[index]);
      analyzeWords(nested, result, depth + 1);
    }
    return;
  }
  if (name === 'xargs') {
    let nestedStart = start;
    for (let index = start; index < words.length;) {
      const option = words[index].text.split('=')[0];
      if (option === '-a' || option === '--arg-file') {
        if (words[index].text.includes('=')) addOperand(result, { text: words[index].text.slice(words[index].text.indexOf('=') + 1), activeExpansion: words[index].activeExpansion });
        else addOperand(result, words[index + 1]);
      }
      if (!words[index].text.startsWith('-')) { nestedStart = index; break; }
      index = skipOption(words, index, XARGS_OPTION_VALUE);
      nestedStart = index;
    }
    if (nestedStart < words.length) analyzeWords(words.slice(nestedStart), result, depth + 1);
    return;
  }
  if (INLINE_RUNTIMES.has(name)) {
    for (let index = start; index + 1 < words.length; index += 1) {
      if (!['-c', '-e', '--eval'].includes(words[index].text)) continue;
      const code = words[index + 1].text;
      const reads = /\b(?:open|readFile(?:Sync)?|read_text|read_bytes|File\.read|IO\.read|file_get_contents)\s*\(/.test(code);
      if (!reads) return;
      for (const match of code.matchAll(/(['"])([^'"\r\n]+)\1/g)) result.paths.add(match[2]);
      if (/\b(?:process\.env|process\.argv|os\.environ|sys\.argv|getenv|ENV\s*\[|ARGV\b)/.test(code)) result.dynamic = true;
      return;
    }
    return;
  }
  if (name === 'openssl') genericOperands(words, start, result, { pathOptions: new Set(['-in', '-key', '-cert', '-config']) });
}

function analyzeCommand(command, depth = 0) {
  const result = { paths: new Set(), dynamic: false, malformed: false };
  if (depth > MAX_DEPTH) { result.dynamic = true; return result; }
  const parsed = scanShell(command);
  result.malformed = parsed.malformed;
  for (const words of parsed.segments) analyzeWords(words, result, depth);
  for (const nested of parsed.nested) merge(result, analyzeCommand(nested, depth + 1));
  if (result.malformed && parsed.segments.some((words) => {
    const commandInfo = unwrap(words);
    return SIMPLE_READERS.has(commandInfo.name) || GREP_READERS.has(commandInfo.name)
      || AWK_READERS.has(commandInfo.name) || SHELLS.has(commandInfo.name)
      || INLINE_RUNTIMES.has(commandInfo.name) || ['sed', 'source', '.', 'eval', 'xargs'].includes(commandInfo.name);
  })) result.dynamic = true;
  return result;
}

function commandAccess(command) {
  const result = analyzeCommand(command);
  return { paths: [...result.paths], dynamic: result.dynamic, malformed: result.malformed };
}

module.exports = { DYNAMIC_READ_PATH, commandAccess };
