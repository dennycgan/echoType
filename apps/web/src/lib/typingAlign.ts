/** Per-target-index display status for the typing page (direction R). */
export type TargetCharStatus =
  | 'untyped'
  | 'correct'
  | 'wrong'
  | 'correct-newline'
  | 'wrong-enter'
  | 'skipped-newline'
  | 'cursor';

export interface SyncResult {
  targetCursor: number;
  typedConsumed: number;
  complete: boolean;
}

/** Align typed keystrokes to target, auto-skipping target `\n` when user did not type one. */
export function syncTypedToTarget(typed: string, target: string): SyncResult {
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

export function isPassComplete(typed: string, target: string): boolean {
  return target.length > 0 && syncTypedToTarget(typed, target).complete;
}

export function countAlignedErrors(typed: string, target: string): number {
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

/** Longest prefix of `value` that syncs cleanly against target (no overflow past target). */
export function clampTyped(value: string, target: string): string {
  for (let len = value.length; len >= 0; len--) {
    const slice = value.slice(0, len);
    const { targetCursor, typedConsumed } = syncTypedToTarget(slice, target);
    if (typedConsumed === len && targetCursor <= target.length) return slice;
  }
  return '';
}

export function buildTargetStatuses(typed: string, target: string): TargetCharStatus[] {
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

/** Progress fraction from sync cursor (0..1). */
export function alignedProgress(typed: string, target: string): number {
  if (target.length === 0) return 0;
  const { targetCursor } = syncTypedToTarget(typed, target);
  return targetCursor / target.length;
}
