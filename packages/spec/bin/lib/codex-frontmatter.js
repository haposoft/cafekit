'use strict';

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function foldedScalar(lines, literal) {
  const nonBlank = lines.filter((line) => line.trim());
  const indent = nonBlank.length
    ? Math.min(...nonBlank.map((line) => line.match(/^\s*/)[0].length))
    : 0;
  const normalized = lines.map((line) => line.slice(Math.min(indent, line.length)).trimEnd());
  if (literal) return normalized.join('\n').trim();
  return normalized.join('\n').replace(/\n(?=\S)/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function parseHeader(header) {
  const frontmatter = {};
  const lines = header.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^([a-zA-Z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) continue;
    const [, key, raw = ''] = match;

    if (/^[>|][+-]?$/.test(raw)) {
      const continuation = [];
      while (index + 1 < lines.length && (/^\s/.test(lines[index + 1]) || !lines[index + 1])) {
        continuation.push(lines[++index]);
      }
      frontmatter[key] = foldedScalar(continuation, raw.startsWith('|'));
    } else {
      frontmatter[key] = unquote(raw.trim());
    }
  }

  return frontmatter;
}

function splitFrontmatter(content) {
  const source = String(content);
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: source };
  return {
    frontmatter: parseHeader(match[1]),
    body: source.slice(match[0].length)
  };
}

module.exports = { splitFrontmatter };
