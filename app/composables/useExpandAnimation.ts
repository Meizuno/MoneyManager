// Height+opacity transition handlers for inline collapsable sections.
// Ported from ai-chat's ProseChart so the category drill-down expands in
// place (instead of a popover). Use on a <Transition>:
//   <Transition @enter="onEnter" @after-enter="onAfterEnter" @leave="onLeave">
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
