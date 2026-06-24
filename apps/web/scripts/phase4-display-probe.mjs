// Phase 4 display helpers smoke (local only; NOT wired into CI).
// Run from repo root:
//   cd apps/api && pnpm exec tsx ../../apps/web/scripts/phase4-display-probe.mjs

import {
  formatCardDuration,
  formatCardStatsLine,
  formatLoopCount,
} from '@echotype/shared';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

assert(formatCardDuration(0) === '0m', '0m');
assert(formatCardDuration(45) === '0m', 'sub-minute floors to 0m');
assert(formatCardDuration(60) === '1m', '1m');
assert(formatCardDuration(2700) === '45m', '45m');
assert(formatCardDuration(3600) === '1h', '1h');
assert(formatCardDuration(8100) === '2h 15m', '2h 15m');

assert(formatLoopCount(0) === '0 loops', 'loops plural');
assert(formatLoopCount(1) === '1 loop', 'loop singular');
assert(formatCardStatsLine(8100, 12) === '2h 15m · 12 loops', 'stats line');

console.log('==== Phase 4 display probe PASS ====');
