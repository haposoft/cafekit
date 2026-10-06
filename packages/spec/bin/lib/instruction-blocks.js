'use strict';

const CORE_BLOCK_START = '<!-- CAFEKIT CORE START -->';
const CORE_BLOCK_END = '<!-- CAFEKIT CORE END -->';

function managedRange(content, startMarker = CORE_BLOCK_START, endMarker = CORE_BLOCK_END) {
  const existing = String(content || '');
  const start = existing.indexOf(startMarker);
  const end = existing.indexOf(endMarker);
  if (start < 0 && end < 0) return null;
  const duplicateStart = existing.indexOf(startMarker, start + startMarker.length);
  const duplicateEnd = existing.indexOf(endMarker, end + endMarker.length);
  if (start < 0 || end <= start || duplicateStart >= 0 || duplicateEnd >= 0) return false;
  return {
    start,
    end: end + endMarker.length,
    bodyStart: start + startMarker.length,
    bodyEnd: end
  };
}

function migrateExactLegacyBlock(existingContent, startMarker, endMarker, replacementContent) {
  const existing = String(existingContent || '');
  const range = managedRange(existing, startMarker, endMarker);
  if (!range) return existing;
  const body = existing.slice(range.bodyStart, range.bodyEnd).trim();
  if (body !== String(replacementContent).trim()) return existing;
  const block = `${CORE_BLOCK_START}\n${String(replacementContent).trim()}\n${CORE_BLOCK_END}`;
  return `${existing.slice(0, range.start)}${block}${existing.slice(range.end)}`;
}

function upsertManagedCoreBlock(existingContent, coreContent) {
  const existing = String(existingContent || '');
  const block = `${CORE_BLOCK_START}\n${String(coreContent).trim()}\n${CORE_BLOCK_END}`;
  const range = managedRange(existing);
  if (range === false) return existing;
  if (range) {
    return `${existing.slice(0, range.start)}${block}${existing.slice(range.end)}`;
  }
  if (!existing) return `${block}\n`;
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${separator}${block}\n`;
}

function transformManagedCoreContent(content, transform) {
  const existing = String(content || '');
  const range = managedRange(existing);
  if (!range || typeof transform !== 'function') return existing;
  const body = existing.slice(range.bodyStart, range.bodyEnd);
  return `${existing.slice(0, range.bodyStart)}${transform(body)}${existing.slice(range.bodyEnd)}`;
}

// Mirrors the section regex used by post-install configureAddressing so an
// extracted section round-trips exactly back into the managed body.
const ADDRESSING_SECTION_RE = /##[^\n]*Context Overflow Indicator[^\n]*[\s\S]*?(?=\n##|\n*$)/;

/** Extract the exact Addressing section (heading through next `##`) from a body, or null. */
function extractAddressingSection(body) {
  const match = String(body || '').match(ADDRESSING_SECTION_RE);
  return match ? match[0].replace(/\n+$/, '') : null;
}

/**
 * When a reinstall template drops the Addressing section, carry the exact one
 * from the existing CafeKit-managed block so the saved address survives for
 * setupAddressing. Only reads the managed block body — never user-owned
 * sections outside the block, never the shared CORE block.
 */
function preserveAddressingSection(newBody, existingManagedBody) {
  if (extractAddressingSection(newBody) !== null) return newBody;
  const section = extractAddressingSection(existingManagedBody);
  if (section === null) return newBody;
  return `${String(newBody).trimEnd()}\n\n${section}`;
}

module.exports = {
  CORE_BLOCK_START,
  CORE_BLOCK_END,
  managedRange,
  migrateExactLegacyBlock,
  upsertManagedCoreBlock,
  transformManagedCoreContent,
  extractAddressingSection,
  preserveAddressingSection
};
