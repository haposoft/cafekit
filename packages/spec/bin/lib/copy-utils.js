'use strict';

const fs = require('fs');
const path = require('path');

const TEXT_REWRITE_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.json', '.cjs', '.js', '.mjs', '.ts', '.py', '.sh', '.toml', '.yml', '.yaml'
]);

function isTextAsset(filePath) {
  return TEXT_REWRITE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

// Generated artifacts never ship as runtime payload: the coverage db, the
// Python bytecode cache directory, and bytecode files. Skipping them here keeps
// both copyRecursive and copyManagedTree
// built on copyRecursive) from ever copying build residue.
function isGeneratedArtifact(name) {
  const base = String(name || '');
  return (
    base === '.coverage'
    || base === '__pycache__'
    || base.endsWith('.pyc')
    || base.endsWith('.pyo')
  );
}

function normalizeSourcePaths(content, options = {}) {
  const runtimeRoot = String(options.runtimeRoot || '.claude');
  const skillsRoot = String(options.skillsRoot || `${runtimeRoot}/skills`);
  const runtimeRootWindows = runtimeRoot.replace(/\//g, '\\');
  const skillsRootWindows = skillsRoot.replace(/\//g, '\\');

  return String(content)
    .replace(/packages\/spec\/src\/claude\/skills(?=\/|$)/g, skillsRoot)
    .replace(/packages\\spec\\src\\claude\\skills(?=\\|$)/g, skillsRootWindows)
    .replace(/packages\/spec\/src\/claude(?=\/|$)/g, runtimeRoot)
    .replace(/packages\\spec\\src\\claude(?=\\|$)/g, runtimeRootWindows);
}

function copyRecursive(src, dest, options = {}) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  const shouldOverwriteManagedFiles = Boolean(options.upgrade);

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      if (isGeneratedArtifact(childItemName)) return;
      const destItemName = childItemName === 'gitignore' ? '.gitignore' : childItemName;
      copyRecursive(path.join(src, childItemName), path.join(dest, destItemName), options);
    });
  } else {
    if (isGeneratedArtifact(path.basename(src))) return;
    if (fs.existsSync(dest) && !shouldOverwriteManagedFiles) {
      return;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });

    if (typeof options.transform === 'function' && isTextAsset(src)) {
      const original = fs.readFileSync(src, 'utf8');
      fs.writeFileSync(dest, options.transform(original, src), 'utf8');
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

module.exports = {
  TEXT_REWRITE_EXTENSIONS,
  isTextAsset,
  isGeneratedArtifact,
  normalizeSourcePaths,
  copyRecursive,
  readJsonFile
};
