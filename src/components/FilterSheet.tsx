"use client";

import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import styles from "./Search.module.css";

/** How far the sheet must be pulled down before letting go closes it. */
const SWIPE_TO_CLOSE_PX = 80;

/**
 * On phones the filter form sits in a bottom sheet behind a "Filters"
 * button; from 900px wide it's always shown as a sidebar (see the CSS).
 */
export function FilterSheet({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const selectOpen = useRef(false);
  const swallowTap = useRef(false);

  const close = () => {
    setOpen(false);
    setDrag(null);
    button.current?.focus();
  };

  // Swipe down on the handle/title to close. `drag` is how far it's been pulled.
  const [drag, setDrag] = useState<number | null>(null);
  const dragStart = useRef(0);
  const grab = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (!open) return; // the desktop sidebar is never "open", so it can't be dragged
      dragStart.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag(0);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      if (drag !== null) setDrag(Math.max(0, event.clientY - dragStart.current));
    },
    onPointerUp() {
      if (drag !== null && drag > SWIPE_TO_CLOSE_PX) close();
      else setDrag(null);
    },
    onPointerCancel() {
      setDrag(null);
    },
  };

  useEffect(() => {
    if (!open) return;
    // Focus the sheet, not its first field: focusing the centre box would pop
    // up the phone's keyboard. Keyboards and screen readers still start inside.
    sheet.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.filtersButton}
        aria-label={activeCount > 0 ? `Filters (${activeCount} on)` : "Filters"}
        title="Filters"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M4 6h16M7 12h10M10 18h4"
          />
        </svg>
        {activeCount > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className={styles.backdrop}
          aria-hidden="true"
          // A tap outside while a dropdown is open only closes that dropdown.
          onPointerDown={() => {
            swallowTap.current =
              selectOpen.current ||
              !!sheet.current?.querySelector('[role="combobox"][aria-expanded="true"]');
          }}
          onClick={() => {
            if (swallowTap.current) swallowTap.current = false;
            else close();
          }}
        />
      )}
      <div
        ref={sheet}
        id={id}
        className={styles.sheet}
        data-open={open}
        // Track whether a native <select> list is showing (opened by mouse or touch).
        onMouseDownCapture={(event) => {
          if ((event.target as HTMLElement).tagName === "SELECT") selectOpen.current = true;
        }}
        onChangeCapture={() => (selectOpen.current = false)}
        onBlurCapture={() => (selectOpen.current = false)}
        data-dragging={drag !== null && drag > 0}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        role="region"
        aria-label="Filters"
        tabIndex={-1}
      >
        <div className={styles.grab} {...grab}>
          <div className={styles.handle} aria-hidden="true" />
          <h2 className={styles.sheetTitle}>Filters</h2>
        </div>
        <button
          type="button"
          className={`${styles.srClose} visually-hidden-focusable`}
          onClick={close}
        >
          Close filters
        </button>
        {children}
      </div>
    </>
  );
}
