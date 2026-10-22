#!/usr/bin/env node
/**
 * Native Docs Validator
 * Rapid standalone markdown integrity verification (Clean-room rewrite layer).
 */

const fs = require('fs');
const path = require('path');
// const { spawnSync } = require('child_process');

function findMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(findMarkdownFiles(full));
    } else if (full.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function checkBrokenLinks(docsDir) {
  const files = findMarkdownFiles(docsDir);
  const issues = [];
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    // Regex mapping string patterns [text](./relative/link.md)
    const links = content.match(/\[[^\]]+\]\(\.\/[^)]+\)/g) || [];
    links.forEach(link => {
      const href = link.match(/\(\.\/([^)]+)\)/)[1].split('#')[0]; // Isolate anchor tags
      const targetPath = path.resolve(path.dirname(file), href);
      if (!fs.existsSync(targetPath)) {
        issues.push({ file, brokenLink: href });
      }
    });
  });
  return issues;
}

function main() {
  const docsArg = process.argv[2] || 'docs';
  const docsDir = path.resolve(process.cwd(), docsArg);
  console.log(`[Docs Validator] Auditing bounds directory: ${docsDir}`);
  
  if (!fs.existsSync(docsDir)) {
    console.log('Terminal: Core docs/ directory bounds block not found. Ceasing validation sequence.');
    process.exit(0);
  }

  const linkIssues = checkBrokenLinks(docsDir);
  if (linkIssues.length > 0) {
    console.error(`\n❌ FAIL: ${linkIssues.length} broken relative link(s) found:`);
    linkIssues.forEach(issue => {
      console.error(`- ${path.relative(process.cwd(), issue.file)} -> ./${issue.brokenLink} (target missing)`);
    });
    process.exit(1);
  }

  console.log('✅ PASS: no broken relative links detected.');
}

main();
