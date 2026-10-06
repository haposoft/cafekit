#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  getHookContext,
  logCrash,
  readPayload,
  resolveProjectPath
} = require('./lib/hook-context.cjs');

function resolveVenv(projectRoot) {
  const base = path.join(projectRoot, '.agents', 'skills', '.venv');
  return [
    path.join(base, 'bin', 'python3'),
    path.join(base, 'Scripts', 'python.exe')
  ].find((candidate) => fs.existsSync(candidate)) || null;
}

try {
  const payload = readPayload();
  if (!payload) process.exit(0);
  const { projectRoot, runtime, sessionCwd } = getHookContext(payload);
  const respondLang = runtime.locale?.responseLanguage || '';
  const thinkLang = runtime.locale?.thinkingLanguage || (respondLang ? 'en' : '');
  const plansPath = resolveProjectPath(projectRoot, runtime.paths?.plans, 'plans');
  const docsPath = resolveProjectPath(projectRoot, runtime.paths?.docs, 'docs');
  const venv = resolveVenv(projectRoot);
  const lines = [
    `## Subagent: ${payload.agent_type || 'unknown'}`,
    `ID: ${payload.agent_id || 'unknown'} | CWD: ${sessionCwd}`,
    ''
  ];

  if ((thinkLang && thinkLang !== respondLang) || respondLang) {
    lines.push('## Language');
    if (thinkLang && thinkLang !== respondLang) {
      lines.push(`- Thinking: Use ${thinkLang} for reasoning.`);
    }
    if (respondLang) lines.push(`- Response: Respond in ${respondLang}.`);
    lines.push('');
  }

  lines.push(
    '## Rules',
    `- Plans → ${plansPath}/ | Docs → ${docsPath}/`,
    '- YAGNI · KISS · DRY',
    '- Be concise. List unresolved questions at end.'
  );
  if (venv) {
    lines.push(
      `- Python in .agents/skills/: use \`${venv}\``,
      '- Never use global pip install.'
    );
  }

  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStart',
      additionalContext: lines.join('\n')
    }
  })}\n`);
} catch (error) {
  logCrash('agent', error);
}
