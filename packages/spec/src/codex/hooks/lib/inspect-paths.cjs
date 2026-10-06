'use strict';

const BLOCKED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.next', '.nuxt', '.output',
  '__pycache__', '.venv', 'venv', 'vendor', 'target',
  '.git', 'coverage', '.nyc_output'
]);
const BROAD_GLOBS = [/^\*\*\/\*$/, /^\*\*\.\w+$/, /^\*\*\/\*\.\w+$/];
const PATH_KEYS = new RegExp(
  '^(?:file_?paths?|paths?|search_?paths?|'
  + '(?:source|target|destination)_?paths?|dirs?|director(?:y|ies)|'
  + 'folders?|cwd|root|locations?|uris?)$',
  'i'
);
const GLOB_KEYS = /(?:^|_)(?:glob|globs|pattern|patterns)$/i;
function clean(value) {
  return String(value || '').trim().replace(/^['"`]+|['"`,:]+$/g, '');
}
function blockedSegment(value) {
  return clean(value)
    .replace(/\\/g, '/')
    .split('/')
    .find((segment) => BLOCKED_DIRS.has(segment));
}
function isBroadGlob(value) {
  const candidate = clean(value);
  return BROAD_GLOBS.some((rule) => rule.test(candidate));
}
function collectStructured(value, key, paths, globs) {
  if (typeof value === 'string') {
    if (PATH_KEYS.test(key)) paths.push(value);
    if (GLOB_KEYS.test(key)) globs.push(value);
    return;
  }
  if (Array.isArray(value)) {
    if (PATH_KEYS.test(key)) paths.push(...value.filter((item) => typeof item === 'string'));
    if (GLOB_KEYS.test(key)) globs.push(...value.filter((item) => typeof item === 'string'));
    for (const item of value) collectStructured(item, '', paths, globs);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [childKey, child] of Object.entries(value)) {
    collectStructured(child, childKey, paths, globs);
  }
}
function shellTokens(command) {
  const tokens = [];
  let token = '';
  let quote = '';
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      if (char === quote) quote = '';
      else if (char === '\\' && quote === '"' && index + 1 < command.length) {
        token += command[index += 1];
      } else token += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '\n') {
      if (token) tokens.push(token);
      token = '';
      tokens.push('|');
    } else if (/\s/.test(char)) {
      if (token) tokens.push(token);
      token = '';
    } else if (';&|'.includes(char)) {
      if (token) tokens.push(token);
      token = '';
      const pair = command.slice(index, index + 2);
      if (pair === '&&' || pair === '||') index += 1;
      tokens.push('|');
    } else {
      token += char;
    }
  }
  if (token) tokens.push(token);
  return tokens;
}
function commandGroups(command) {
  const groups = [[]];
  for (const token of shellTokens(command)) {
    if (token === '|') groups.push([]);
    else groups[groups.length - 1].push(clean(token));
  }
  return groups.filter((group) => group.length);
}

function positional(tokens, optionsWithValue = new Set()) {
  const out = [];
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (optionsWithValue.has(token)) index += 1;
    else if (!token.startsWith('-') || token === '-') out.push(token);
  }
  return out;
}

function readerOptionPaths(name, tokens) {
  if (!['rg', 'grep', 'sed'].includes(name)) return [];
  const paths = [];
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '-f' || token === '--file') {
      if (tokens[index + 1]) paths.push(tokens[index + 1]);
      index += 1;
    } else if (token.startsWith('--file=')) {
      paths.push(token.slice('--file='.length));
    }
  }
  return paths;
}

function findRoots(tokens) {
  const roots = [];
  let index = 1;
  while (['-H', '-L', '-P'].includes(tokens[index]) || /^-O\d+$/.test(tokens[index] || '')) {
    index += 1;
  }
  if (tokens[index] === '-D') index += 2;
  if (tokens[index] === '--') index += 1;
  for (; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith('-') || ['!', '(', ')'].includes(token)) break;
    roots.push(token);
  }
  return roots;
}

function commandPaths(group, globs) {
  const commandIndex = group.findIndex((token) => (
    token && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)
  ));
  if (commandIndex < 0) return [];
  const tokens = group.slice(commandIndex);
  while (['sudo', 'env', 'time', 'command'].includes(tokens[0])) tokens.shift();
  if (!tokens.length) return [];
  const name = tokens[0].replace(/\\/g, '/').split('/').pop();
  const optionPaths = readerOptionPaths(name, tokens);

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '-g' || token === '--glob' || token === '--iglob') {
      if (tokens[index + 1]) globs.push(tokens[index + 1]);
    } else if (/^--(?:i?glob)=/.test(token)) {
      globs.push(token.slice(token.indexOf('=') + 1));
    }
  }

  if (name === 'rg' || name === 'grep') {
    const values = positional(tokens, new Set([
      '-e', '--regexp', '-f', '--file', '-g', '--glob', '--iglob',
      '-t', '--type', '-T', '--type-not'
    ]));
    const explicitPattern = tokens.some((token) => token === '-e' || token === '--regexp');
    const fileMode = tokens.includes('--files');
    return [...optionPaths, ...(explicitPattern || fileMode ? values : values.slice(1))];
  }
  if (name === 'sed') {
    const values = positional(tokens, new Set(['-e', '--expression', '-f', '--file']));
    const explicitScript = tokens.some((token) => (
      ['-e', '--expression', '-f', '--file'].includes(token)
    ));
    return [...optionPaths, ...(explicitScript ? values : values.slice(1))];
  }
  if (name === 'find') return findRoots(tokens);
  if (['cat', 'head', 'tail', 'ls', 'wc', 'du', 'tree', 'file', 'stat', 'cd', 'pushd', 'source', '.'].includes(name)) {
    return positional(tokens, new Set(['-n', '--lines', '-c', '--bytes']));
  }
  return tokens.filter((token) => (
    /^(?:\.{0,2}[\\/]|~[\\/])/.test(token)
    || (token.includes('/') && blockedSegment(token))
  ));
}

function inspectInput(input) {
  const paths = [];
  const globs = [];
  collectStructured(input, '', paths, globs);
  const command = typeof input?.command === 'string'
    ? input.command
    : typeof input?.cmd === 'string' ? input.cmd : '';
  for (const group of commandGroups(command)) {
    paths.push(...commandPaths(group, globs));
  }
  return {
    broadGlob: globs.find(isBroadGlob),
    blockedPath: paths.map((requested) => ({
      requested,
      blocked: blockedSegment(requested)
    })).find((result) => result.blocked)
  };
}

module.exports = {
  BLOCKED_DIRS,
  inspectInput
};
