import { createPull } from "~/utils/pull";

// Pull to refresh on a phone (utils/pull.ts), on the window's own scroll:
// the listeners only act from the very top of the page, so scrolling up is
// untouched. The layout draws `distance` under its header.
export function usePullToRefresh() {
  const distance = ref(0);
  const pulling = ref(false);
  const pull = createPull({
    scrollY: () => window.scrollY,
    // Not while a dialog is open: the quick-add sheet is swiped down to
    // close, and a reload would throw away what was typed into it.
    canPull: () => !document.querySelector('[role="dialog"]'),
    onTrigger: () => window.location.reload(),
    onDistance: (value, active) => {
      distance.value = value;
      pulling.value = active;
    },
  });
  const ready = computed(() => distance.value >= pull.threshold);

  const onStart = (e: TouchEvent) => pull.start(e.touches[0]?.clientY ?? 0);
  // Not passive: a pull holds the page still rather than letting it bounce.
  const onMove = (e: TouchEvent) => {
    if (pull.move(e.touches[0]?.clientY ?? 0)) e.preventDefault();
  };
  const onEnd = () => pull.end();

  onMounted(() => {
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
  });
  onBeforeUnmount(() => {
    window.removeEventListener("touchstart", onStart);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onEnd);
    window.removeEventListener("touchcancel", onEnd);
  });

  return { distance, pulling, ready };
}
