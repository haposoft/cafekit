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

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/y;

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
  // Each nested command is also kept on the word it sits in, so an operand built from $(...) carries its literals.
  const recordNested = command => { nested.push({ command, segment: segments.length }); (word.nested ||= []).push(command); };
  let words = [];
  let word = { text: '', activeExpansion: false, started: false };
  let quote = null;
  let escaped = false;
  let malformed = false;
  const append = (value) => { word.text += value; word.started = true; };
  // `$NAME` is written as `${NAME}` so a quote that ends the name (`.en"$Y"v`) still ends it after the quotes go.
  const appendName = (index) => {
    IDENTIFIER.lastIndex = index + 1;
    const match = IDENTIFIER.exec(source);
    if (!match) return index;
    append(`{${match[0]}}`);
    return index + match[0].length;
  };
  const flushWord = () => {
    if (word.started || word.text) words.push(word);
    word = { text: '', activeExpansion: false, started: false };
  };
  // `link` is how the segment ends: 'pipe' for a single |, anything else for ;, &&, ||, &, newline and parentheses.
  const flushSegment = (link = 'end') => { flushWord(); if (words.length) { words.link = link; segments.push(words); } words = []; };

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
          recordNested(source.slice(index + 2, end));
          append('()');
          index = end;
        } else index = appendName(index);
        continue;
      }
      if (ch === '\x60') {
        word.activeExpansion = true;
        const end = matchingBacktick(source, index);
        if (end < 0) { malformed = true; continue; }
        recordNested(source.slice(index + 1, end));
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
        recordNested(source.slice(index + 2, end));
        append('()');
        index = end;
      } else index = appendName(index);
      continue;
    }
    if (ch === '\x60') {
      word.activeExpansion = true;
      const end = matchingBacktick(source, index);
      if (end < 0) { malformed = true; continue; }
      recordNested(source.slice(index + 1, end));
      append('\x60\x60');
      index = end;
      continue;
    }
    if ((ch === '<' || ch === '>') && source[index + 1] === '(') {
      word.activeExpansion = true;
      const end = matchingParen(source, index + 1);
      if (end < 0) { malformed = true; continue; }
      recordNested(source.slice(index + 2, end));
      append(`${ch}()`);
      index = end;
      continue;
    }
    if ((ch === '~' && !word.text) || '*?{['.includes(ch)) { word.activeExpansion = true; append(ch); continue; }
    if (';|&\n()'.includes(ch)) {
      const pipe = ch === '|' && source[index + 1] !== '|' && source[index - 1] !== '|' && source[index + 1] !== '&';
      flushSegment(pipe ? 'pipe' : 'other');
      continue;
    }
    if (ch === '<') {
      const descriptor = /^[0-9]+$/.test(word.text);
      flushWord();
      if (descriptor) (words.redirectFds ||= []).push(words.length - 1);
      (words.inputRedirects ||= []).push(words.length, words.length + 1);
      words.push({ text: '<', activeExpansion: false, started: true });
      continue;
    }
    if (ch === '>') {
      const descriptor = /^[0-9]+$/.test(word.text);
      flushWord();
      if (descriptor) (words.redirectFds ||= []).push(words.length - 1);
      (words.redirects ||= []).push(words.length);
      if (source[index + 1] === '>') index += 1;
      if (source[index + 1] === '&') index += 1;
      if (source[index + 1] === '|') index += 1;
      continue;
    }
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

// Words that open or continue a compound command; the command they lead into is still the one that runs.
const KEYWORDS = new Set(['if', 'then', 'elif', 'else', 'while', 'until', 'do', '{', '!', 'time', 'coproc', 'function']);

function unwrap(words) {
  let index = 0;
  while (index < words.length && (assignment(words[index]) || KEYWORDS.has(words[index].text))) {
    index += 1;
    if (words[index - 1].text === 'time') while (words[index]?.text.startsWith('-')) index += 1;
    // `function f { cat .env; }`: the word after `function` is the name being defined, not a command.
    if (words[index - 1].text === 'function') index += 1;
  }
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
  if (word.activeExpansion) {
    result.dynamic = true;
    // Kept for the path resolver: the raw text, the directory a tracked `cd` left, and the literal words of every
    // command substitution inside it. The assignments it can see are attached when its segment finishes.
    result.expansions.push({ text: word.text, directory: result.directory === undefined ? '.' : result.directory,
      literals: (word.nested || []).flatMap(literalWords) });
  } else if (word.text && word.text !== '-') result.paths.add(word.text);
}

// The literal words of a command line: no expansion, no option.
function literalWords(command) {
  return scanShell(command).segments.flat().filter((word) => !word.activeExpansion && word.text && !word.text.startsWith('-'))
    .map((word) => word.text);
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
  target.searches.push(...source.searches);
  source.writes.forEach(value => target.writes.add(value));
  source.unknownWrites.forEach(value => target.unknownWrites.add(value));
  target.expansions.push(...source.expansions);
  target.pipeNames.push(...source.pipeNames);
  target.decodedRead ||= source.decodedRead;
  target.dynamic ||= source.dynamic;
  target.malformed ||= source.malformed;
}

// Describe searches separately so the existing read operands stay unchanged.
function searchDescription(words, start, name) {
  const grep = ['grep', 'egrep', 'fgrep'].includes(name);
  const search = { recursive: !grep, hidden: grep, includes: [], excludes: [], roots: [] };
  const values = new Set([...GREP_OPTION_VALUE, '-g', '--glob', '--iglob', '--include', '--exclude',
    '--exclude-dir', '-d', '--directories', '-t', '--type', '-T', '--type-not',
    '--max-depth', '-j', '--threads', '-M', '--max-columns', '--sort', '--sortr',
    '--max-filesize', '--pre', '--path-separator', '--dfa-size-limit', '--regex-size-limit']);
  let pattern = !grep && words.slice(start).some(word => word.text === '--files');
  let unrestricted = 0;
  let options = true;
  const positional = [];
  for (let index = start; index < words.length; index += 1) {
    const word = words[index];
    const text = word.text;
    if (options && text === '--') { options = false; continue; }
    if (options && text.startsWith('-') && text !== '-') {
      let option = text.split('=')[0];
      let value = text.includes('=') ? text.slice(text.indexOf('=') + 1) : null;
      let shortFlags = /^-[^-]/.test(text) ? text.slice(1) : '';
      const attached = text.match(/^-([^-]*?)([gef])(.*)$/);
      if (attached) { shortFlags = attached[1]; option = `-${attached[2]}`; value = attached[3] || null; }
      if (values.has(option) && value === null) value = words[++index]?.text || '';
      if (['-e', '--regexp', '-f', '--file'].includes(option)) pattern = true;
      if (['-g', '--glob', '--include'].includes(option)) search.includes.push(value || '');
      if (['--exclude', '--exclude-dir'].includes(option)) search.excludes.push(value || '');
      if (grep && (['--recursive', '--dereference-recursive'].includes(option)
        || /[rR]/.test(shortFlags)
        || (['-d', '--directories'].includes(option) && value === 'recurse'))) search.recursive = true;
      if (!grep) {
        if (option === '--hidden' || shortFlags.includes('.')) search.hidden = true;
        unrestricted += (shortFlags.match(/u/g) || []).length + (option === '--unrestricted' ? 1 : 0);
      }
      continue;
    }
    positional.push(word);
  }
  if (!pattern) positional.shift();
  search.roots = positional.filter(word => !word.activeExpansion && word.text !== '-').map(word => word.text);
  if (!search.roots.length) search.roots.push('.');
  if (unrestricted >= (name === 'ag' ? 1 : 2)) search.hidden = true;
  // Case-insensitive globs are not evidence that a differently cased child is excluded.
  if (words.slice(start).some(word => ['--glob-case-insensitive', '--iglob'].includes(word.text.split('=')[0]))) search.includes = [];
  return search;
}

function writeTarget(word, result, directory) {
  if (!word?.text || word.activeExpansion || word.text === '-') return;
  if (directory === null && !word.text.startsWith('/')) {
    result.unknownWrites.add(word.text);
    return;
  }
  result.writes.add(word.text.startsWith('/') || directory === '.' ? word.text : `${directory}/${word.text}`);
}

function commandWrites(words, start, name, result, directory) {
  const redirected = new Set([...(words.redirects || []), ...(words.redirectFds || []), ...(words.inputRedirects || [])]);
  if (name === 'tee') {
    for (let index = start; index < words.length; index += 1) {
      if (!redirected.has(index) && !words[index].text.startsWith('-')) writeTarget(words[index], result, directory);
    }
  }
  if (['cp', 'mv', 'install', 'ln'].includes(name)) {
    const operands = [];
    let targetDirectory = false;
    const values = new Set(['-t', '--target-directory', '-S', '--suffix', '-m', '--mode', '-o', '--owner', '-g', '--group']);
    let options = true;
    for (let index = start; index < words.length; index += 1) {
      if (redirected.has(index)) continue;
      const word = words[index];
      if (options && word.text === '--') { options = false; continue; }
      if (options && word.text.startsWith('-')) {
        let option = word.text.split('=')[0];
        let value = word.text.includes('=')
          ? { text: word.text.slice(word.text.indexOf('=') + 1), activeExpansion: word.activeExpansion }
          : values.has(option) ? words[++index] : null;
        if (!word.text.startsWith('--') && !values.has(option)) {
          for (let flag = 1; flag < word.text.length; flag += 1) {
            const candidate = `-${word.text[flag]}`;
            if (!values.has(candidate)) continue;
            option = candidate;
            value = flag + 1 < word.text.length
              ? { text: word.text.slice(flag + 1), activeExpansion: word.activeExpansion } : words[++index];
            break;
          }
        }
        if (['-t', '--target-directory'].includes(option)) {
          targetDirectory = true;
          writeTarget(value, result, directory);
        }
      } else operands.push(word);
    }
    if (!targetDirectory) writeTarget(operands.at(-1), result, directory);
    if (name === 'cp' || name === 'mv') {
      const sources = targetDirectory ? operands : operands.slice(0, -1);
      for (const source of sources) {
        const basename = source.text.replace(/\\/g, '/').replace(/\/+$/, '').split('/').at(-1).toLowerCase();
        if (!['.claude', '.codex', '.omp', '.privacy'].includes(basename)) continue;
        if (source.activeExpansion) result.unknownWrites.add(basename);
        else writeTarget(source, result, directory);
      }
    }
  }
  if (name === 'sed') {
    let inPlace = false;
    let scriptOption = false;
    const operands = [];
    let options = true;
    for (let index = start; index < words.length; index += 1) {
      if (redirected.has(index)) continue;
      const word = words[index];
      if (options && word.text === '--') { options = false; continue; }
      if (options && word.text.startsWith('-')) {
        const option = word.text.split('=')[0];
        if (option === '--in-place') inPlace = true;
        if (['--expression', '--file'].includes(option)) {
          scriptOption = true;
          if (!word.text.includes('=')) index += 1;
        } else if (!word.text.startsWith('--')) {
          for (let flag = 1; flag < word.text.length; flag += 1) {
            if (word.text[flag] === 'i') { inPlace = true; break; }
            if (word.text[flag] === 'e' || word.text[flag] === 'f') {
              scriptOption = true;
              if (flag + 1 === word.text.length) index += 1;
              break;
            }
          }
        }
      } else operands.push(word);
    }
    if (operands[0]?.text === '') operands.shift();
    if (inPlace) for (const word of operands.slice(scriptOption ? 0 : 1)) writeTarget(word, result, directory);
  }
}

function analyzeWords(words, result, depth, directory = '.') {
  result.directory = directory;
  for (const index of words.redirects || []) writeTarget(words[index], result, directory);
  for (let index = 0; index + 1 < words.length; index += 1) {
    if (words[index].text === '<') addOperand(result, words[index + 1]);
  }
  const command = unwrap(words);
  if (command.index < 0) return;
  const start = command.index + 1;
  const name = command.name;
  commandWrites(words, start, name, result, directory);
  if (SIMPLE_READERS.has(name)) {
    genericOperands(words, start, result, { valueOptions: SIMPLE_OPTION_VALUES.get(name) || new Set() });
    return;
  }
  if (GREP_READERS.has(name)) {
    result.searches.push(searchDescription(words, start, name));
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
        merge(result, analyzeCommand(words[index + 1].text, depth + 1, directory));
        return;
      }
    }
    genericOperands(words, start, result);
    return;
  }
  if (name === 'eval') {
    merge(result, analyzeCommand(words.slice(start).map((word) => word.text).join(' '), depth + 1, directory));
    return;
  }
  if (name === 'find') {
    // A name test that selects a secret, handed to a reader through -exec, reads it.
    const names = [];
    for (let index = start; index + 1 < words.length; index += 1) {
      if (['-name', '-iname', '-path', '-ipath', '-wholename', '-iwholename'].includes(words[index].text)) names.push(words[index + 1].text);
    }
    for (let index = start; index < words.length; index += 1) {
      if (words[index].text !== '-exec' && words[index].text !== '-execdir') continue;
      const nested = [];
      for (index += 1; index < words.length && ![';', '+'].includes(words[index].text); index += 1) nested.push(words[index]);
      if (READS.has(unwrap(nested).name)) result.pipeNames.push(...names);
      analyzeWords(nested, result, depth + 1, directory);
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
    if (nestedStart < words.length) analyzeWords(words.slice(nestedStart), result, depth + 1, directory);
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

function analyzeCommand(command, depth = 0, directory = '.') {
  const result = { paths: new Set(), dynamic: false, malformed: false, searches: [], writes: new Set(), unknownWrites: new Set(),
    expansions: [], pipeNames: [], decodedRead: false };
  if (depth > MAX_DEPTH) { result.dynamic = true; return result; }
  const parsed = scanShell(command);
  result.malformed = parsed.malformed;
  let currentDirectory = directory;
  const directories = [];
  const assignments = [];
  const visibleAt = [];
  // Every operand found while analysing a segment -- its own, or one from a nested eval, `bash -c` or $(...) -- sees the
  // assignments of the earlier segments. `f=.env cat $f` does not: the shell expands $f before that prefix applies.
  const scope = (from, segmentIndex) => {
    for (const expansion of result.expansions.slice(from)) {
      expansion.scopes = [{ list: assignments, count: visibleAt[segmentIndex] }, ...(expansion.scopes || [])];
    }
  };
  for (const [segmentIndex, words] of parsed.segments.entries()) {
    directories.push(currentDirectory);
    visibleAt.push(assignments.length);
    recordAssignments(words, assignments);
    const from = result.expansions.length;
    analyzeWords(words, result, depth, currentDirectory);
    scope(from, segmentIndex);
    const info = unwrap(words);
    if (['cd', 'pushd'].includes(info.name)) {
      const target = words.slice(info.index + 1).find(word => word.text && !word.text.startsWith('-'));
      if (!target || target.activeExpansion) currentDirectory = null;
      else if (target.text.startsWith('/')) currentDirectory = target.text;
      else if (currentDirectory !== null) currentDirectory = `${currentDirectory}/${target.text}`;
    }
  }
  analyzePipelines(parsed.segments, result);
  for (const nested of parsed.nested) {
    const nestedDirectory = directories[nested.segment] === undefined ? directory : directories[nested.segment];
    const from = result.expansions.length;
    merge(result, analyzeCommand(nested.command, depth + 1, nestedDirectory));
    if (visibleAt[nested.segment] !== undefined) scope(from, nested.segment);
  }
  if (result.malformed && parsed.segments.some((words) => {
    const commandInfo = unwrap(words);
    return SIMPLE_READERS.has(commandInfo.name) || GREP_READERS.has(commandInfo.name)
      || AWK_READERS.has(commandInfo.name) || SHELLS.has(commandInfo.name)
      || INLINE_RUNTIMES.has(commandInfo.name) || ['sed', 'source', '.', 'eval', 'xargs'].includes(commandInfo.name);
  })) result.dynamic = true;
  return result;
}

const ASSIGNING = new Set(['export', 'declare', 'typeset', 'local', 'readonly']);

// A segment that only assigns (`f=.env`), or an export/declare/local/typeset/readonly. The value keeps its expansions
// (`f="$PWD/.env"`, `G=$F`); the resolver substitutes them in order.
function recordAssignments(words, out) {
  const bare = words.every(assignment);
  const builtin = ASSIGNING.has(commandName(words[0]));
  if (!bare && !builtin) return;
  for (const word of words.slice(bare ? 0 : 1)) {
    if (!assignment(word)) continue;
    const at = word.text.indexOf('=');
    out.push({ name: word.text.slice(0, at), value: word.text.slice(at + 1) });
  }
}

const DECODERS = (words) => {
  const name = commandName(words[unwrap(words).index]);
  const flags = words.map((word) => word.text);
  if (name === 'base64' || name === 'basenc') return flags.some((flag) => ['-d', '-D', '--decode'].includes(flag));
  if (name === 'openssl') return flags.some((flag) => ['base64', 'enc'].includes(flag)) && flags.includes('-d');
  if (name === 'xxd') return flags.includes('-r') || flags.includes('-revert');
  if (name === 'gpg') return flags.some((flag) => ['-d', '--decrypt'].includes(flag));
  return ['uudecode', 'b64decode'].includes(name);
};
const READS = new Set([...SIMPLE_READERS, ...GREP_READERS, ...AWK_READERS, 'sed', 'source', '.']);

// A pipeline whose decoder feeds a shell, eval or xargs runs what it decoded; xargs handing a reader the literal words of
// an earlier stage (`printf .env | xargs cat`, `find . -name .env | xargs cat`) reads those words. One pass: each stage
// is looked at once, and each earlier word is handed over at most once.
function analyzePipelines(segments, result) {
  let decoded = false;
  let first = true;
  let words = [];
  let handed = 0;
  for (const stage of segments) {
    const info = unwrap(stage);
    if (info.index >= 0 && !first) {
      if (decoded && (SHELLS.has(info.name) || ['eval', 'xargs', 'source', '.'].includes(info.name))) result.decodedRead = true;
      if (info.name === 'xargs') {
        let index = info.index + 1;
        while (index < stage.length && stage[index].text.startsWith('-')) index = skipOption(stage, index, XARGS_OPTION_VALUE);
        const reader = unwrap(stage.slice(index)).name;
        if (READS.has(reader) || SHELLS.has(reader)) {
          result.pipeNames.push(...words.slice(handed));
          handed = words.length;
        }
      }
    }
    if (DECODERS(stage)) decoded = true;
    for (const word of stage.slice(info.index + 1)) if (word.text && !word.text.startsWith('-')) words.push(word.text);
    first = stage.link !== 'pipe';
    if (first) { decoded = false; words = []; handed = 0; }
  }
}

function commandAccess(command) {
  const result = analyzeCommand(command);
  return { paths: [...result.paths], dynamic: result.dynamic, malformed: result.malformed, searches: result.searches,
    writes: [...result.writes], unknownWrites: [...result.unknownWrites],
    expansions: result.expansions.map(({ text, directory, literals, scopes }) => ({ text, directory, literals, scopes: scopes || [] })),
    pipeNames: [...new Set(result.pipeNames)], decodedRead: result.decodedRead };
}

module.exports = { DYNAMIC_READ_PATH, commandAccess };
