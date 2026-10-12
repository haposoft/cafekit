'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const BLOCKED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.next', '.nuxt', '.output',
  '__pycache__', '.venv', 'venv', 'vendor', 'target',
  '.git', 'coverage', '.nyc_output'
]);
const BROAD_GLOBS = [/^\*\*\/\*$/, /^\*\*\.\w+$/, /^\*\*\/\*\.\w+$/];
const PATH_KEYS = /^(?:file_?paths?|paths?|search_?paths?|notebook_path|(?:source|target|destination)_?paths?|dirs?|director(?:y|ies)|folders?|cwd|root|locations?|uris?)$/i;
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'apply_patch']);
const READERS = new Set(['cat', 'head', 'tail', 'nl', 'less', 'more', 'bat', 'ls', 'tree', 'find', 'rg', 'grep', 'sed', 'awk', 'wc', 'du', 'file', 'stat']);
const clean = (value) => String(value || '').trim();
const nameOf = (value) => String(value || '').replace(/\\/g, '/').split('/').pop();
function real(value) { try { return fs.realpathSync(value); } catch { return value; } }
function relativeInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) ? relative : null;
}
function blockedSegment(value, { cwd, projectRoot }) {
  let candidate = clean(value).replace(/\\/g, '/');
  if (candidate === '~' || candidate.startsWith('~/')) candidate = os.homedir() + candidate.slice(1);
  if (path.isAbsolute(candidate)) {
    // Prefer project root over a nested session cwd. Compare lexical and canonical
    // roots so /var and /private/var (or a symlink install) have the same boundary.
    for (const base of [projectRoot, cwd].filter(Boolean)) {
      const root = path.resolve(base);
      const relative = relativeInside(root, candidate) ?? relativeInside(real(root), candidate);
      if (relative !== null) { candidate = relative; break; }
    }
  } else candidate = path.normalize(candidate);
  return candidate.split('/').find((segment) => BLOCKED_DIRS.has(segment));
}
function collectStructured(value, key, toolName, paths, globs) {
  if (typeof value === 'string') {
    if (PATH_KEYS.test(key)) paths.push(value);
    if ((toolName === 'Glob' && key === 'pattern') || /^(?:glob|globs)$/i.test(key)) globs.push(value);
  } else if (Array.isArray(value)) {
    for (const child of value) collectStructured(child, key, toolName, paths, globs);
  } else if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) collectStructured(child, childKey, toolName, paths, globs);
  }
}

// A small shell lexer, not an executor: quoted prose is data, while substitutions
// contribute their own command groups. Heredoc bodies are data, never commands.
function commandGroups(command) {
  function scan(start, closing = '') {
    const groups = []; let group = []; let token = ''; let quote = ''; let index = start;
    const heredocs = [];
    const flush = () => { if (token) group.push(token); token = ''; };
    const boundary = () => { flush(); if (group.length) groups.push(group); group = []; };
    for (; index < command.length; index += 1) {
      const char = command[index];
      if (!quote && closing && char === closing) { boundary(); return { groups, index }; }
      if (char === '\\' && quote !== "'") {
        if (command[index + 1] !== '\n') token += command[index + 1] || '';
        index += 1; continue;
      }
      if (quote === "'") { if (char === "'") quote = ''; else token += char; continue; }
      if (char === '$' && command[index + 1] === '(') {
        const sub = scan(index + 2, ')'); groups.push(...sub.groups);
        token += '__substitution__'; index = sub.index; continue;
      }
      if (char === '`') {
        const sub = scan(index + 1, '`'); groups.push(...sub.groups);
        token += '__substitution__'; index = sub.index; continue;
      }
      if (quote) { if (char === quote) quote = ''; else token += char; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '(') {
        boundary(); const sub = scan(index + 1, ')');
        groups.push(...sub.groups); index = sub.index; continue;
      }
      if (command.startsWith('<<', index) && !command.startsWith('<<<', index)) {
        const match = command.slice(index).match(/^<<(-?)[ \t]*((?:'[^']*'|"[^"]*"|\\[^\n]|[^\s;|&<>'"\\])+)/);
        if (match) {
          const delimiter = match[2].replace(/'([^']*)'|"([^"]*)"|\\(.)/g, (_, single, double, escaped) => single ?? double ?? escaped);
          flush(); heredocs.push({ delimiter, tabs: !!match[1] });
          index += match[0].length - 1; continue;
        }
      }
      if (char === '\n') {
        boundary();
        for (const here of heredocs.splice(0)) {
          while (index < command.length) {
            const end = command.indexOf('\n', index + 1);
            const stop = end < 0 ? command.length : end;
            const line = command.slice(index + 1, stop);
            index = stop;
            if ((here.tabs ? line.replace(/^\t+/, '') : line) === here.delimiter) break;
          }
        }
      } else if (';&|'.includes(char)) {
        boundary();
        if (command[index + 1] === char) index += 1;
      } else if (/\s/.test(char)) flush();
      else token += char;
    }
    boundary(); return { groups, index };
  }
  return scan(0).groups;
}

const WRAPPER_OPTIONS = {
  sudo: ['-u', '-g', '-h', '-p', '-C', '-T', '-R', '-D', '--user', '--group', '--host', '--prompt', '--chdir', '--chroot'],
  env: ['-u', '--unset', '-C', '--chdir', '-S', '--split-string'],
  time: ['-f', '--format', '-o', '--output'], command: [],
  nice: ['-n', '--adjustment'], nohup: [],
  xargs: ['-I', '-i', '-n', '-L', '-P', '-s', '-d', '-E', '-a', '--replace', '--max-args', '--max-lines', '--max-procs', '--arg-file', '--delimiter', '--eof'],
  npm: ['-p', '--package', '-c', '--call', '--prefix', '--workspace', '-w'],
  npx: ['-p', '--package', '-c', '--call', '--cache'],
  pnpm: ['--dir', '-C', '--filter'], pnpx: ['-p', '--package'],
  yarn: ['--cwd'], bunx: ['-p', '--package'],
};
function unwrap(group) {
  let index = 0;
  while (index < group.length) {
    while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(group[index] || '')) index += 1;
    const name = nameOf(group[index]);
    if (!Object.hasOwn(WRAPPER_OPTIONS, name)) return group.slice(index);
    index += 1;
    // npm/pnpm/yarn only wrap a reader in exec mode; run/build remain opaque.
    let exec = !['npm', 'pnpm', 'yarn'].includes(name);
    while (index < group.length) {
      const token = group[index];
      if (token === 'exec' && !exec) { exec = true; index += 1; continue; }
      if (token === '--') { index += 1; break; }
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) { index += 1; continue; }
      const commandOption = name === 'env' ? /^(?:-S|--split-string)(?:=|$)/ : ['npm', 'npx'].includes(name) ? /^(?:-c|--call)(?:=|$)/ : null;
      if (commandOption?.test(token)) {
        const equals = token.indexOf('=');
        return { command: equals < 0 ? group[index + 1] || '' : token.slice(equals + 1),
          rest: name === 'env' ? group.slice(index + (equals < 0 ? 2 : 1)) : [] };
      }
      if (!token.startsWith('-')) break;
      index += WRAPPER_OPTIONS[name].includes(token) ? 2 : 1;
    }
    if (!exec) return [];
  }
  return [];
}
function positional(tokens, options) {
  const values = []; let afterDash = false;
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!afterDash && token === '--') { afterDash = true; continue; }
    if (!afterDash && options.has(token)) { index += 1; continue; }
    if (afterDash || !token.startsWith('-') || token === '-') values.push(token);
  }
  return values;
}
function commandPaths(group, globs) {
  const tokens = unwrap(group);
  if (tokens.command !== undefined) {
    const groups = commandGroups(tokens.command);
    if (groups.length) groups[groups.length - 1].push(...tokens.rest);
    return groups.flatMap((nested) => commandPaths(nested, globs));
  }
  const name = nameOf(tokens[0]);
  if (!READERS.has(name)) return []; // Executables and non-reader arguments are never paths.
  if (name === 'find') {
    let index = 1;
    while (['-H', '-L', '-P'].includes(tokens[index]) || /^-O\d+$/.test(tokens[index] || '')) index += 1;
    if (tokens[index] === '-D') index += 2;
    if (tokens[index] === '--') index += 1;
    const roots = [];
    for (; index < tokens.length && !/^(?:-|!|\(|\))/.test(tokens[index]); index += 1) roots.push(tokens[index]);
    return roots; // Expressions such as -path ... -prune are not read roots.
  }
  if (['rg', 'grep'].includes(name)) {
    for (let index = 1; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (['-g', '--glob', '--iglob'].includes(token)) globs.push(tokens[index + 1] || '');
      else if (/^--i?glob=/.test(token)) globs.push(token.slice(token.indexOf('=') + 1));
    }
    const options = new Set(['-e', '--regexp', '-f', '--file', '-g', '--glob', '--iglob', '-t', '--type', '-T', '--type-not', '--exclude', '--exclude-dir', '--include', '-m', '--max-count', '-A', '-B', '-C', '--after-context', '--before-context', '--context', '--encoding', '--color']);
    const values = positional(tokens, options);
    const explicit = tokens.some((token) => /^(?:-[ef]|--(?:regexp|file)(?:=|$))/.test(token)) || tokens.includes('--files');
    return explicit ? values : values.slice(1);
  }
  if (['sed', 'awk'].includes(name)) {
    const options = new Set(['-e', '--expression', '-f', '--file', '-F', '-v']);
    const values = positional(tokens, options);
    return tokens.some((token) => /^(?:-[ef]|--(?:expression|file)(?:=|$))/.test(token)) ? values : values.slice(1);
  }
  // A flag's meaning belongs to its reader: cat -n and wc -c are booleans,
  // whereas head -n consumes a number. Never swallow the following read path.
  const options = {
    head: ['-n', '--lines', '-c', '--bytes'], tail: ['-n', '--lines', '-c', '--bytes', '--pid', '-s', '--sleep-interval'],
    nl: ['-b', '-d', '-f', '-h', '-i', '-l', '-n', '-s', '-v', '-w'],
    tree: ['-I', '-P', '-L', '-o', '--filelimit', '--sort'],
    ls: ['-I', '--ignore', '--hide', '--format', '--sort', '--time', '--block-size', '--quoting-style', '-w', '--width'],
    du: ['-d', '--max-depth', '--exclude', '-X', '--exclude-from', '-B', '--block-size'],
    stat: ['-c', '--format', '--printf'], file: ['-m', '--magic-file', '-f', '--files-from', '-F', '--separator'],
    bat: ['--color', '--style', '--language', '--paging', '--theme', '--line-range', '-r', '--tabs'],
    less: ['-x', '--tabs', '-j', '-p', '-P', '-z'],
  };
  return positional(tokens, new Set(options[name] || []));
}
function inspectInput(toolName, toolInput, context = {}) {
  if (WRITE_TOOLS.has(toolName)) return {};
  const paths = []; const globs = [];
  collectStructured(toolInput, '', toolName, paths, globs);
  for (const key of ['command', 'cmd']) {
    if (typeof toolInput?.[key] === 'string') {
      for (const group of commandGroups(toolInput[key])) paths.push(...commandPaths(group, globs));
    }
  }
  const included = globs.filter((glob) => !glob.startsWith('!'));
  paths.push(...included);
  return {
    broadGlob: included.find((glob) => BROAD_GLOBS.some((rule) => rule.test(clean(glob)))),
    blockedPath: paths.map((requested) => ({ requested, blocked: blockedSegment(requested, context) })).find((result) => result.blocked),
  };
}

module.exports = { BLOCKED_DIRS, inspectInput };
