import { useRef, type TouchEvent } from "react";

export function isBackSwipe(dx: number, dy: number, elapsed: number): boolean {
  return dx >= 64 && Math.abs(dy) < 60 && dx > Math.abs(dy) * 1.8 && elapsed < 1600;
}

export function useSwipeBack(enabled: boolean, onBack: () => void) {
  const start = useRef<{ x: number; y: number; at: number } | null>(null);
  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      start.current = null;
      if (!enabled || window.innerWidth > 1100 || event.touches.length !== 1 || !event.currentTarget.contains(event.target as Node)) return;
      const target = event.target as Element;
      if (target.closest("button,a,input,textarea,select,summary,[role=dialog],[contenteditable=true],.photo-order,.placed-sticker")) return;
      const point = event.touches[0];
      // The standalone app has no native page history: include the left edge and static photos.
      start.current = { x: point.clientX, y: point.clientY, at: Date.now() };
    },
    onTouchMove(event: TouchEvent<HTMLElement>) {
      const origin = start.current;
      if (!origin || event.touches.length !== 1) { start.current = null; return; }
      const point = event.touches[0];
      const dx = point.clientX - origin.x, dy = point.clientY - origin.y;
      if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)) { start.current = null; return; }
      if (dx > 12 && dx > Math.abs(dy) * 1.8) event.currentTarget.style.setProperty("--back-progress", `${Math.min(dx, 100)}px`);
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      event.currentTarget.style.removeProperty("--back-progress");
      const origin = start.current; start.current = null;
      if (!origin || !enabled || event.touches.length || event.changedTouches.length !== 1) return;
      const point = event.changedTouches[0];
      if (isBackSwipe(point.clientX-origin.x, point.clientY-origin.y, Date.now()-origin.at)) onBack();
    },
    onTouchCancel(event: TouchEvent<HTMLElement>) { start.current = null; event.currentTarget.style.removeProperty("--back-progress"); },
  };
}
