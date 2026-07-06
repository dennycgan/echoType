import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Vertical gaps between typing regions: workspace `gap-2` (8px) between passage and
 * input, plus page `gap-3` (12px) between workspace and stats panel. Slightly rounded
 * up so the capped passage does not push stats past the viewport on subpixel layouts.
 * Not a substitute for statsPanel height — that is measured separately.
 */
const TYPING_INTER_REGION_GAP_PX = 24;

const PASSAGE_MIN_MAX_HEIGHT_PX = 120;

function computePassageMaxHeight(
  passageEl: HTMLElement,
  inputPanelEl: HTMLElement,
  statsPanelEl: HTMLElement,
): number {
  const passageTop = passageEl.getBoundingClientRect().top;
  const inputH = inputPanelEl.offsetHeight;
  const statsH = statsPanelEl.offsetHeight;
  const maxH =
    window.innerHeight -
    passageTop -
    inputH -
    statsH -
    TYPING_INTER_REGION_GAP_PX;
  return Math.max(PASSAGE_MIN_MAX_HEIGHT_PX, Math.floor(maxH));
}

/**
 * Viewport-anchored cap for the passage scroll box: content-sized up to the limit,
 * then overflow-y-auto. Reserves measured stats-panel height so long passages scroll
 * inside the box while stats/buttons stay in the viewport without page scroll.
 */
export function usePassageMaxHeight(
  passageRef: RefObject<HTMLElement | null>,
  inputPanelRef: RefObject<HTMLElement | null>,
  statsPanelRef: RefObject<HTMLElement | null>,
  layoutRootRef: RefObject<HTMLElement | null>,
): number | undefined {
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const passage = passageRef.current;
    const inputPanel = inputPanelRef.current;
    const statsPanel = statsPanelRef.current;
    if (!passage || !inputPanel || !statsPanel) return;

    const update = () => {
      setMaxHeight(computePassageMaxHeight(passage, inputPanel, statsPanel));
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(inputPanel);
    ro.observe(statsPanel);
    const layoutRoot = layoutRootRef.current;
    if (layoutRoot) ro.observe(layoutRoot);

    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [passageRef, inputPanelRef, statsPanelRef, layoutRootRef]);

  return maxHeight;
}
