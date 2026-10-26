#!/usr/bin/env node
'use strict';

/**
 * Install the CafeKit agents shipped in the Codex plugin into the user's Codex agents
 * directory ($CODEX_HOME/agents, default ~/.codex/agents). Codex loads no agents from a
 * plugin, so this runs once after the plugin is installed or updated.
 *
 * Every shipped file starts with a marker naming the plugin, its version and the sha256
 * of the body below it. A file counts as CafeKit's own only when its marker hash still
 * matches its body; only those are replaced. Anything else stays byte for byte:
 * a missing marker, an edited body, or a symlink.
 *
 * A file it cannot read is kept and reported, and the other agents still install.
 * Takes no arguments: the target is never chosen by the caller.
 * Exit: 0 done, 1 failure, 2 usage.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const MARKER = /^# CafeKit agent: plugin=(\S+) version=(\S+) sha256=([0-9a-f]{64})\n/;

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

/** 'absent' | 'symlink' | 'foreign' | 'modified' | 'own' */
function ownership(file) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return 'absent';
    throw error;
  }
  if (stat.isSymbolicLink()) return 'symlink';
  if (!stat.isFile()) return 'foreign';
  const text = fs.readFileSync(file, 'utf8');
  const marker = text.match(MARKER);
  if (!marker) return 'foreign';
  return sha256(text.slice(marker[0].length)) === marker[3] ? 'own' : 'modified';
}

// Write beside the target and rename over it, so a reader never sees half a file.
function writeAtomic(file, data, mode) {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temp, data, { mode, flag: 'wx' });
    fs.chmodSync(temp, mode);
    fs.renameSync(temp, file);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
}

// Codex reads agents from its home, so a session started with CODEX_HOME installs there.
// A relative CODEX_HOME is refused rather than guessed, so it never falls back to ~/.codex.
function codexHome() {
  const configured = process.env.CODEX_HOME;
  if (!configured) return path.join(os.homedir(), '.codex');
  if (!path.isAbsolute(configured)) throw new Error(`CODEX_HOME must be an absolute path: ${configured}`);
  return configured;
}

function repositoryRoot() {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', timeout: 5000 });
  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : process.cwd();
}

function main(argv) {
  if (argv.length > 0) {
    process.stderr.write('setup-agents takes no arguments; it installs into $CODEX_HOME/agents (default ~/.codex/agents).\n');
    return 2;
  }
  const sourceDir = path.join(__dirname, '..', 'agents');
  const targetDir = path.join(codexHome(), 'agents');
  const repoAgents = path.join(repositoryRoot(), '.codex', 'agents');
  const files = fs.readdirSync(sourceDir).filter((name) => name.endsWith('.toml')).sort();
  fs.mkdirSync(targetDir, { recursive: true });

  const counts = {};
  for (const name of files) {
    const shipped = fs.readFileSync(path.join(sourceDir, name), 'utf8');
    const target = path.join(targetDir, name);
    let state;
    try {
      state = ownership(target);
    } catch {
      state = 'unreadable';
    }
    let action;
    if (state === 'absent') {
      writeAtomic(target, shipped, 0o644);
      action = 'written';
    } else if (state === 'own') {
      if (fs.readFileSync(target, 'utf8') === shipped) {
        action = 'unchanged';
      } else {
        writeAtomic(target, shipped, fs.statSync(target).mode & 0o777);
        action = 'replaced';
      }
    } else {
      action = { symlink: 'kept (symlink)', foreign: 'kept (not installed by CafeKit)', modified: 'kept (modified)', unreadable: 'kept (unreadable)' }[state];
    }
    counts[action] = (counts[action] || 0) + 1;
    process.stdout.write(`${action}: ${target}\n`);
    if (fs.existsSync(path.join(repoAgents, name))) {
      process.stdout.write(`collision: ${path.join(repoAgents, name)} has the same agent name in this repository\n`);
    }
  }
  const summary = Object.entries(counts).map(([action, count]) => `${count} ${action}`).join(', ');
  process.stdout.write(`CafeKit agents in ${targetDir}: ${summary}\n`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`setup-agents failed: ${error.message}\n`);
  process.exitCode = 1;
}
