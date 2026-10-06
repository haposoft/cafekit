#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  getHookContext,
  logCrash,
  readPayload
} = require('./lib/hook-context.cjs');
const {
  archive,
  readData,
  refreshGit,
  stateDir,
  withStateLock,
  writeData
} = require('./lib/state-store.cjs');

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function summary(value, limit = 600) {
  if (value === null || value === undefined) return '';
  let text = '';
  if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'object') {
    const preferred = value.message ?? value.output ?? value.result ?? value.content;
    text = typeof preferred === 'string' ? preferred : JSON.stringify(value);
  } else {
    text = String(value);
  }
  const clean = text.replace(/\0/g, '').trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

function normalizeTodos(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: String(item?.id ?? item?.task_id ?? item?.taskId ?? index),
    content: summary(item?.step ?? item?.content ?? item?.subject ?? item?.title, 240),
    status: String(item?.status || 'pending')
  })).filter((item) => item.content);
}

function updateTaskState(data, input, response) {
  const completeList = input.plan ?? input.todos ?? input.tasks
    ?? response?.plan ?? response?.todos ?? response?.tasks;
  if (Array.isArray(completeList)) {
    data.todos = normalizeTodos(completeList);
    return;
  }

  const id = input.task_id ?? input.taskId ?? input.id;
  const content = summary(input.step ?? input.content ?? input.subject ?? input.title, 240);
  const status = input.status;
  if (!id && !content) return;
  const todos = Array.isArray(data.todos) ? data.todos : [];
  const index = todos.findIndex((todo) => (
    (id !== undefined && String(todo.id) === String(id))
    || (content && todo.content === content)
  ));
  const next = {
    id: String(id ?? content),
    content: content || todos[index]?.content || `Task ${id}`,
    status: String(status || todos[index]?.status || 'pending')
  };
  if (index >= 0) todos[index] = next;
  else todos.push(next);
  data.todos = todos;
}

function isTrackedTool(toolName) {
  const name = String(toolName || '').toLowerCase();
  return name === 'agent'
    || name === 'spawn_agent'
    || name === 'update_plan'
    || name.includes('task')
    || name.includes('todo');
}

function loadPrevious(projectRoot, sessionId) {
  try {
    const dir = stateDir(projectRoot, sessionId);
    if (!dir) return '';
    const file = path.join(dir, 'latest.md');
    if (!fs.existsSync(file)) return '';
    const text = fs.readFileSync(file, 'utf8');
    const generated = text.match(/<!-- Generated: (.+?) -->/)?.[1];
    if (!generated || Date.now() - Date.parse(generated) > EXPIRY_MS) return '';
    return text;
  } catch {
    return '';
  }
}

try {
  const payload = readPayload();
  if (!payload) process.exit(0);
  const { projectRoot } = getHookContext(payload);
  const event = payload.hook_event_name || '';
  const sessionId = payload.session_id;

  if (event === 'SessionStart') {
    const previous = loadPrevious(projectRoot, sessionId);
    if (previous) {
      process.stdout.write(
        `=== Prior Execution Context ===\n${previous.trim()}\n=== End of Prior Context ===\n`
      );
    }
    process.exit(0);
  }

  if (event === 'PostToolUse') {
    const toolName = payload.tool_name || '';
    if (!isTrackedTool(toolName)) process.exit(0);
    withStateLock(projectRoot, sessionId, (dir) => {
      const data = readData(dir);
      const input = payload.tool_input || {};
      const response = payload.tool_response;
      updateTaskState(data, input, response);
      data.lastToolEvent = `${toolName}: ${summary(response) || summary(input)}`.slice(0, 700);
      refreshGit(data, projectRoot);
      writeData(dir, data);
    });
    process.exit(0);
  }

  if (event === 'SubagentStop') {
    withStateLock(projectRoot, sessionId, (dir) => {
      const data = readData(dir);
      const id = String(payload.agent_id || 'unknown');
      data.agentResults = (data.agentResults || [])
        .filter((agent) => String(agent.id) !== id);
      data.agentResults.push({
        id,
        type: String(payload.agent_type || 'unknown'),
        message: summary(payload.last_assistant_message)
      });
      refreshGit(data, projectRoot);
      writeData(dir, data);
    });
    process.stdout.write('{}\n');
    process.exit(0);
  }

  if (event === 'Stop') {
    withStateLock(projectRoot, sessionId, (dir) => {
      const data = readData(dir);
      data.lastAssistant = summary(payload.last_assistant_message);
      refreshGit(data, projectRoot);
      writeData(dir, data);
      archive(dir);
    });
    process.stdout.write('{}\n');
  }
} catch (error) {
  logCrash('state', error);
}
