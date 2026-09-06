import { useEffect, useRef } from "react";

export function isBackSwipe(dx: number, dy: number, elapsed: number): boolean {
  return dx >= 64 && Math.abs(dy) < 60 && dx > Math.abs(dy) * 1.8 && elapsed < 1600;
}

export function useSwipeBack(enabled: boolean, onBack: () => void) {
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number; at: number } | null = null;
    let surface: HTMLElement | null = null;
    const reset = () => { start = null; surface?.style.removeProperty("--back-progress"); };
    function begin(event: TouchEvent) {
      reset();
      if (window.innerWidth > 1100 || event.touches.length !== 1 || document.querySelector('[role="dialog"]')) return;
      const target = event.target as Element;
      if (target.closest("button,a,input,textarea,select,summary,[contenteditable=true],.photo-order,.placed-sticker")) return;
      surface = document.querySelector<HTMLElement>(".city-detail-page");
      const point = event.touches[0];
      // The page has side padding: listen on document so a true edge swipe also works.
      if (!surface || (!surface.contains(target) && point.clientX > 32)) return;
      start = { x: point.clientX, y: point.clientY, at: Date.now() };
    }
    function move(event: TouchEvent) {
      if (!start || event.touches.length !== 1) { reset(); return; }
      const point = event.touches[0], dx = point.clientX - start.x, dy = point.clientY - start.y;
      if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)) { reset(); return; }
      if (dx > 12 && dx > Math.abs(dy) * 1.8) {
        if (event.cancelable) event.preventDefault();
        surface?.style.setProperty("--back-progress", `${Math.min(dx,100)}px`);
      }
    }
    function end(event: TouchEvent) {
      const origin = start; reset();
      if (!origin || event.touches.length || event.changedTouches.length !== 1) return;
      const point = event.changedTouches[0];
      if (isBackSwipe(point.clientX-origin.x, point.clientY-origin.y, Date.now()-origin.at)) back.current();
    }
    document.addEventListener("touchstart", begin, { passive:true });
    document.addEventListener("touchmove", move, { passive:false });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", reset);
    return () => {
      reset();
      document.removeEventListener("touchstart", begin);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", reset);
    };
  }, [enabled]);
  return {};
}
