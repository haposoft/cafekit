'use strict';

// Legacy spec.json packets: the resolver uses this to tell a packet that claims
// closeout from one still in progress.

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isDurableCloseout(spec) {
  if (!plain(spec)) return false;
  if (spec.schema_version === '2.1') return spec.status === 'done';
  const phase = spec.current_phase || spec.phase;
  return ['done', 'completed', 'complete'].includes(spec.status)
    || ['closeout', 'completion', 'completed', 'complete'].includes(phase);
}

module.exports = { isDurableCloseout };
