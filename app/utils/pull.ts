// Pull to refresh, as Forma has it: drag down from the very top of the page,
// let go past the threshold, and the page reloads — every figure fetched
// afresh. The gesture itself, apart from the touch events, so it can be
// tested without a finger.

export interface PullOptions {
  /** How far (after damping) the page must be pulled. */
  threshold?: number;
  /** How far the indicator may open. */
  max?: number;
  /** False skips the gesture: an open sheet is swiped down to close it. */
  canPull?: () => boolean;
  /** Where the page is scrolled to; only from the very top is it a pull. */
  scrollY: () => number;
  /** Released past the threshold. */
  onTrigger: () => void;
  /** The indicator's height as it changes. */
  onDistance: (distance: number, pulling: boolean) => void;
}

export function createPull(options: PullOptions) {
  const threshold = options.threshold ?? 70;
  const max = options.max ?? 120;
  let startY: number | null = null;
  let distance = 0;

  function set(value: number) {
    distance = value;
    options.onDistance(distance, startY !== null);
  }

  function reset() {
    startY = null;
    set(0);
  }

  return {
    threshold,
    start(y: number) {
      if (options.scrollY() > 0) return;
      if (options.canPull && !options.canPull()) return;
      startY = y;
      set(0);
    },
    /** Whether the page's own scrolling should be held back for this move. */
    move(y: number): boolean {
      if (startY === null) return false;
      // The page scrolled out from under the gesture (an elastic bounce).
      if (options.scrollY() > 0) {
        reset();
        return false;
      }
      // Damped, and capped, so it reads as a pull and not a drag.
      set(Math.min(Math.max(y - startY, 0) * 0.5, max));
      return distance > 0;
    },
    end() {
      if (startY !== null && distance >= threshold) options.onTrigger();
      else reset();
    },
  };
}
