"use client";

import { useRef, useState, type PointerEvent } from "react";

/** How far a bottom sheet must be pulled down before letting go closes it. */
const SWIPE_TO_CLOSE_PX = 80;

/**
 * Pull-down-to-close for a bottom sheet's handle. Spread `grab` on the handle;
 * `drag` is how far it's pulled (null when not dragging), for a translateY.
 */
export function useSwipeToClose(
  onClose: () => void,
  {
    enabled = true,
    /** Keep the sheet where it was let go, for one that leaves the page anyway (no bounce back). */
    stayOnClose = false,
  }: { enabled?: boolean; stayOnClose?: boolean } = {},
) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef(0);
  const grab = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!enabled) return;
      start.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag(0);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (drag !== null) setDrag(Math.max(0, event.clientY - start.current));
    },
    onPointerUp() {
      const closing = drag !== null && drag > SWIPE_TO_CLOSE_PX;
      if (closing) onClose();
      if (!closing || !stayOnClose) setDrag(null);
    },
    onPointerCancel() {
      setDrag(null);
    },
  };
  return { drag, grab };
}
