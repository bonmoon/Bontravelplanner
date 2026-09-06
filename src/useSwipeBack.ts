import { useRef, type TouchEvent } from "react";

export function isBackSwipe(dx: number, dy: number, elapsed: number): boolean {
  return dx >= 96 && Math.abs(dy) < 60 && dx > Math.abs(dy) * 1.8 && elapsed < 800;
}

export function useSwipeBack(enabled: boolean, onBack: () => void) {
  const start = useRef<{ x: number; y: number; at: number } | null>(null);
  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      start.current = null;
      if (!enabled || window.innerWidth > 860 || event.touches.length !== 1 || !event.currentTarget.contains(event.target as Node)) return;
      const target = event.target as Element;
      if (target.closest("button,a,input,textarea,select,summary,[role=dialog],[contenteditable=true],.place-media,.placed-sticker,.journal-images")) return;
      const point = event.touches[0];
      // Leave the system's very-left-edge back gesture alone.
      if (point.clientX < 24) return;
      start.current = { x: point.clientX, y: point.clientY, at: Date.now() };
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const origin = start.current; start.current = null;
      if (!origin || !enabled || event.touches.length || event.changedTouches.length !== 1) return;
      const point = event.changedTouches[0];
      if (isBackSwipe(point.clientX-origin.x, point.clientY-origin.y, Date.now()-origin.at)) onBack();
    },
    onTouchCancel() { start.current = null; },
  };
}
