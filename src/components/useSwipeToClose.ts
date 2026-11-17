"use client";

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

/** How far a bottom sheet must be pulled down before letting go closes it. */
const SWIPE_TO_CLOSE_PX = 80;

/**
 * Pull-down-to-close for a bottom sheet's handle. Spread `grab` on the handle;
 * `drag` is how far it's pulled (null when not dragging), for a translateY.
 * With `scrollArea`, a swipe down on scrolling content that's already at its
 * top pulls the sheet too, like a native sheet.
 */
export function useSwipeToClose(
  onClose: () => void,
  {
    enabled = true,
    /** Keep the sheet where it was let go, for one that leaves the page anyway (no bounce back). */
    stayOnClose = false,
    /** The sheet, and which of its descendants scroll (a selector). Touch events: pointer events are cancelled once the browser scrolls. */
    scrollArea,
  }: {
    enabled?: boolean;
    stayOnClose?: boolean;
    scrollArea?: { root: RefObject<HTMLElement | null>; selector: string; when: () => boolean };
  } = {},
) {
  const [drag, setDrag] = useState<number | null>(null);
  // Mirrors `drag` and the latest onClose for the native touch listeners.
  const dragNow = useRef<number | null>(null);
  // Which input is dragging: a touch also fires pointer events, and only one may release.
  const by = useRef<"pointer" | "touch" | null>(null);
  const close = useRef(onClose);
  const when = useRef(scrollArea?.when);
  useEffect(() => {
    close.current = onClose;
    when.current = scrollArea?.when;
  });
  const start = useRef(0);

  const set = (value: number | null) => {
    dragNow.current = value;
    setDrag(value);
  };
  const release = () => {
    by.current = null;
    const closing = dragNow.current !== null && dragNow.current > SWIPE_TO_CLOSE_PX;
    if (closing) close.current();
    if (!closing || !stayOnClose) set(null);
  };

  const grab = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      // Buttons and links in the grab area (Share) stay tappable.
      if (!enabled || (event.target as Element).closest("a, button")) return;
      start.current = event.clientY;
      // On what was touched, not currentTarget: if that's the whole dialog, the
      // click after a tap would land on it and count as a tap on the backdrop.
      (event.target as Element).setPointerCapture(event.pointerId);
      by.current = "pointer";
      set(0);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (by.current === "pointer") set(Math.max(0, event.clientY - start.current));
    },
    onPointerUp() {
      if (by.current === "pointer") release();
    },
    onPointerCancel() {
      if (by.current !== "pointer") return;
      by.current = null;
      set(null);
    },
  };

  const root = scrollArea?.root;
  const selector = scrollArea?.selector;
  useEffect(() => {
    const sheet = root?.current;
    if (!sheet || !selector) return;
    let area: Element | null = null; // set while this touch may pull the sheet
    let from = 0;
    const onStart = (event: TouchEvent) => {
      area = (event.target as Element).closest(selector);
      // Only from the top of the content; scrolled down, the swipe scrolls.
      if (!area || area.scrollTop > 0 || !when.current?.()) area = null;
      from = event.touches[0].clientY;
    };
    const onMove = (event: TouchEvent) => {
      if (!area) return;
      const dy = event.touches[0].clientY - from;
      // Started upward (or the content scrolled): an ordinary scroll for this touch.
      if (by.current !== "touch" && (dy <= 0 || area.scrollTop > 0)) {
        area = null;
        return;
      }
      event.preventDefault(); // the sheet moves, not the content
      by.current = "touch";
      set(Math.max(0, dy));
    };
    const onEnd = () => {
      if (by.current === "touch") release();
      area = null;
    };
    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd);
    sheet.addEventListener("touchcancel", onEnd);
    return () => {
      sheet.removeEventListener("touchstart", onStart);
      sheet.removeEventListener("touchmove", onMove);
      sheet.removeEventListener("touchend", onEnd);
      sheet.removeEventListener("touchcancel", onEnd);
    };
    // release/set only touch refs and stable setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, selector]);

  return { drag, grab };
}
