'use strict';

/**
 * Which CafeKit skills and agents the Claude and Codex plugins ship.
 *
 * Lives under bin/ because the npm package ships bin and src but not scripts:
 * the plugin build and the `migrate` command must agree on the same lists.
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '../../src/claude');

// These need a Python venv, npm install or a browser binary, which a plugin has
// no install step for; they stay on the npx path for now.
const EXCLUDED_SKILLS = ['chrome-devtools', 'ui-ux', 'ui-ux-pro-max'];
const EXCLUDED_AGENTS = ['ui-ux-designer'];

function pluginSkills() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SOURCE, 'migration-manifest.json'), 'utf8'));
  return manifest.skills.required.filter((name) => !EXCLUDED_SKILLS.includes(name));
}

function pluginAgents() {
  return fs.readdirSync(path.join(SOURCE, 'agents'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -3))
    .filter((name) => !EXCLUDED_AGENTS.includes(name))
    .sort();
}

module.exports = { EXCLUDED_SKILLS, EXCLUDED_AGENTS, pluginSkills, pluginAgents };
