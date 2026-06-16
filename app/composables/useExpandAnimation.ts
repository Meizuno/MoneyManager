// Height+opacity expand/collapse for <Transition> JS hooks — used by the
// overview chart's per-category transaction drill-downs.
export function useExpandAnimation() {
  function onEnter(el: Element) {
    const e = el as HTMLElement;
    e.style.height = "0";
    e.style.opacity = "0";
    e.style.overflow = "hidden";
    requestAnimationFrame(() => {
      e.style.transition = "height 0.2s ease, opacity 0.2s ease";
      e.style.height = e.scrollHeight + "px";
      e.style.opacity = "1";
    });
  }

  function onAfterEnter(el: Element) {
    const e = el as HTMLElement;
    e.style.height = "";
    e.style.overflow = "";
    e.style.transition = "";
    e.style.opacity = "";
  }

  function onLeave(el: Element) {
    const e = el as HTMLElement;
    e.style.height = e.scrollHeight + "px";
    e.style.overflow = "hidden";
    requestAnimationFrame(() => {
      e.style.transition = "height 0.15s ease, opacity 0.15s ease";
      e.style.height = "0";
      e.style.opacity = "0";
    });
  }

  return { onEnter, onAfterEnter, onLeave };
}
