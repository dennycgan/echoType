// User-facing validation copy for the annotation editor.

export const STEP3_NO_ANNOTATION_MESSAGE =
  'You chose to add annotations but have not added any yet. If you do not need annotations, go back and choose "No".';

export const MSG_ANCHOR_START_WHITESPACE =
  'The start anchor cannot be a space or line break. Pick again.';
export const MSG_ANCHOR_END_WHITESPACE =
  'The end anchor cannot be a space or line break. Pick again.';
export const MSG_ORDER_INVALID = 'Invalid anchor order. Pick again.';
export const MSG_NOTE_EMPTY = 'Annotation text cannot be empty.';
export const MSG_SERIAL_BLOCK = 'Finish or cancel the current annotation first.';
export const MSG_ESC_DISCARD = 'Discard the current annotation text?';
export const MSG_ABANDON_PICK = 'You have an unfinished annotation. Discard it?';
export const MSG_DISCARD_ALL_CHANGES = 'Discard all changes?';

export function formatNotePreview(noteText: string, fallbackIndex: number): string {
  const t = noteText.trim();
  if (!t) return `annotation #${fallbackIndex}`;
  return t.length > 20 ? `${t.slice(0, 20)}…` : t;
}

export function formatOverlapMessage(noteText: string, fallbackIndex: number): string {
  return `Overlaps existing annotation "${formatNotePreview(noteText, fallbackIndex)}". Pick different anchors.`;
}
