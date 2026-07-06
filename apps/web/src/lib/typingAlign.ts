/** Per-target-index display status for the typing page (direction R). */
export type TargetCharStatus =
  | 'untyped'
  | 'correct'
  | 'wrong'
  | 'correct-newline'
  | 'wrong-enter'
  | 'skipped-newline'
  | 'skipped-ignorable'
  | 'cursor';

export type AlignMode = 'strict' | 'forgiving';

export interface SyncResult {
  targetCursor: number;
  typedConsumed: number;
  complete: boolean;
}

/** Whitespace and Unicode punctuation — forgiving grading only; cursor still visits each index. */
export function isIgnorableChar(ch: string): boolean {
  if (ch.length !== 1) return false;
  if (ch === '\n' || ch === '\r' || ch === '\t' || ch === ' ') return true;
  return /\p{Z}/u.test(ch) || /\p{P}/u.test(ch);
}

/** Letters and numbers — must match in forgiving mode (Latin case-insensitive). */
export function isCoreChar(ch: string): boolean {
  if (ch.length !== 1) return false;
  return /\p{L}/u.test(ch) || /\p{N}/u.test(ch);
}

export function forgivingCharsMatch(typedCh: string, targetCh: string): boolean {
  if (isCoreChar(typedCh) && isCoreChar(targetCh)) {
    if (/\p{Script=Latin}/u.test(typedCh) && /\p{Script=Latin}/u.test(targetCh)) {
      return typedCh.toLocaleLowerCase('en') === targetCh.toLocaleLowerCase('en');
    }
    return typedCh === targetCh;
  }
  return typedCh === targetCh;
}

/** Forgiving grading at one aligned index (cursor walk matches strict). */
export function forgivingPositionMatches(typedCh: string, targetCh: string): boolean {
  if (isIgnorableChar(targetCh)) return true;
  return forgivingCharsMatch(typedCh, targetCh);
}

function syncTypedToTargetStrict(typed: string, target: string): SyncResult {
  let u = 0;
  let t = 0;

  while (u < typed.length) {
    if (t < target.length && target[t] === '\n' && typed[u] !== '\n') {
      t++;
      continue;
    }
    if (t >= target.length) {
      u++;
      continue;
    }
    u++;
    t++;
  }

  while (t < target.length && target[t] === '\n') {
    t++;
  }

  return {
    targetCursor: t,
    typedConsumed: u,
    complete: t === target.length && u === typed.length,
  };
}

/**
 * Align typed keystrokes to target. Forgiving mode uses the same index walk as strict
 * (ADR-0007 newline skip); only error/status grading differs.
 */
export function syncTypedToTarget(
  typed: string,
  target: string,
  _mode: AlignMode = 'strict',
): SyncResult {
  return syncTypedToTargetStrict(typed, target);
}

export function isPassComplete(
  typed: string,
  target: string,
  mode: AlignMode = 'strict',
): boolean {
  return target.length > 0 && syncTypedToTarget(typed, target, mode).complete;
}

function countAlignedErrorsStrict(typed: string, target: string): number {
  let u = 0;
  let t = 0;
  let errors = 0;

  while (u < typed.length) {
    if (t < target.length && target[t] === '\n' && typed[u] !== '\n') {
      t++;
      continue;
    }
    if (t >= target.length) {
      errors++;
      u++;
      continue;
    }
    if (typed[u] !== target[t]) errors++;
    u++;
    t++;
  }

  return errors;
}

function countAlignedErrorsForgiving(typed: string, target: string): number {
  let u = 0;
  let t = 0;
  let errors = 0;

  while (u < typed.length) {
    if (t < target.length && target[t] === '\n' && typed[u] !== '\n') {
      t++;
      continue;
    }
    if (t >= target.length) {
      if (!isIgnorableChar(typed.charAt(u))) errors++;
      u++;
      continue;
    }

    const typedCh = typed.charAt(u);
    const targetCh = target.charAt(t);

    if (typedCh === '\n' && targetCh === '\n') {
      /* ok */
    } else if (typedCh === '\n') {
      errors++;
    } else if (!forgivingPositionMatches(typedCh, targetCh)) {
      errors++;
    }
    u++;
    t++;
  }

  return errors;
}

export function countAlignedErrors(
  typed: string,
  target: string,
  mode: AlignMode = 'strict',
): number {
  return mode === 'forgiving'
    ? countAlignedErrorsForgiving(typed, target)
    : countAlignedErrorsStrict(typed, target);
}

/** Longest prefix of `value` that syncs cleanly against target (no overflow past target). */
export function clampTyped(value: string, target: string, mode: AlignMode = 'strict'): string {
  for (let len = value.length; len >= 0; len--) {
    const slice = value.slice(0, len);
    const { targetCursor, typedConsumed } = syncTypedToTarget(slice, target, mode);
    if (typedConsumed === len && targetCursor <= target.length) return slice;
  }
  return '';
}

function buildTargetStatusesStrict(typed: string, target: string): TargetCharStatus[] {
  const statuses: TargetCharStatus[] = Array.from({ length: target.length }, () => 'untyped');
  let u = 0;
  let t = 0;

  while (u < typed.length) {
    if (t < target.length && target[t] === '\n' && typed[u] !== '\n') {
      statuses[t] = 'skipped-newline';
      t++;
      continue;
    }
    if (t >= target.length) break;

    if (typed[u] === '\n' && target[t] === '\n') {
      statuses[t] = 'correct-newline';
    } else if (typed[u] === '\n') {
      statuses[t] = 'wrong-enter';
    } else if (typed[u] === target[t]) {
      statuses[t] = 'correct';
    } else {
      statuses[t] = 'wrong';
    }
    u++;
    t++;
  }

  while (t < target.length && target[t] === '\n') {
    statuses[t] = 'skipped-newline';
    t++;
  }

  if (t < target.length) {
    statuses[t] = 'cursor';
  }

  return statuses;
}

function buildTargetStatusesForgiving(typed: string, target: string): TargetCharStatus[] {
  const statuses: TargetCharStatus[] = Array.from({ length: target.length }, () => 'untyped');
  let u = 0;
  let t = 0;

  while (u < typed.length) {
    if (t < target.length && target[t] === '\n' && typed[u] !== '\n') {
      statuses[t] = 'skipped-newline';
      t++;
      continue;
    }
    if (t >= target.length) break;

    const typedCh = typed.charAt(u);
    const targetCh = target.charAt(t);

    if (typedCh === '\n' && targetCh === '\n') {
      statuses[t] = 'correct-newline';
    } else if (typedCh === '\n') {
      statuses[t] = 'wrong-enter';
    } else if (forgivingPositionMatches(typedCh, targetCh)) {
      statuses[t] = 'correct';
    } else {
      statuses[t] = 'wrong';
    }
    u++;
    t++;
  }

  while (t < target.length && target[t] === '\n') {
    statuses[t] = 'skipped-newline';
    t++;
  }

  if (t < target.length) {
    statuses[t] = 'cursor';
  }

  return statuses;
}

export function buildTargetStatuses(
  typed: string,
  target: string,
  mode: AlignMode = 'strict',
): TargetCharStatus[] {
  return mode === 'forgiving'
    ? buildTargetStatusesForgiving(typed, target)
    : buildTargetStatusesStrict(typed, target);
}

/** Progress fraction from sync cursor (0..1). */
export function alignedProgress(
  typed: string,
  target: string,
  mode: AlignMode = 'strict',
): number {
  if (target.length === 0) return 0;
  const { targetCursor } = syncTypedToTarget(typed, target, mode);
  return targetCursor / target.length;
}
