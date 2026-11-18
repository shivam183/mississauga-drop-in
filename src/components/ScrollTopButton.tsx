"use client";

import { useSyncExternalStore } from "react";
import styles from "./Search.module.css";

// About the search box and chips: past them, you're into the list.
const SHOW_AFTER_PX = 400;

function subscribe(onChange: () => void) {
  addEventListener("scroll", onChange, { passive: true });
  return () => removeEventListener("scroll", onChange);
}

/** Back to the top of the list; shows once you've scrolled into it. */
export function ScrollTopButton() {
  const shown = useSyncExternalStore(
    subscribe,
    () => scrollY > SHOW_AFTER_PX,
    () => false,
  );
  return (
    <button
      type="button"
      className={styles.scrollTop}
      data-shown={shown}
      aria-label="Back to top"
      title="Back to top"
      onClick={() => {
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        scrollTo({ top: 0, behavior: reduce ? "instant" : "smooth" });
        // The button hides at the top, so keyboard focus moves to the page instead of being lost.
        document.getElementById("main")?.focus({ preventScroll: true });
      }}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 19V5M5 12l7-7 7 7"
        />
      </svg>
    </button>
  );
}
