"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const MESSAGES = [
  "Finding this useful?",
  "Saved you a trip?",
  "Free, no ads.",
  "Got a spot?",
  "Built by a local.",
];

// Picked once per page load in the browser; the server renders it empty so hydration matches.
const pick = Math.floor(Math.random() * MESSAGES.length);
const subscribe = () => () => {};

/** The bubble under the coffee icon, with a different message each page load. */
export function CoffeeNudge() {
  const message = useSyncExternalStore(
    subscribe,
    () => MESSAGES[pick],
    () => null,
  );
  // Fades out at the first scroll, so it never sits over the list (or a stuck day heading).
  const [scrolled, setScrolled] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const hide = () => setScrolled(true);
    // Once it has faded out by itself, a scroll mustn't replay the fade.
    const done = () => removeEventListener("scroll", hide);
    addEventListener("scroll", hide, { once: true, passive: true });
    el.addEventListener("animationend", done, { once: true });
    return () => {
      removeEventListener("scroll", hide);
      el.removeEventListener("animationend", done);
    };
  }, []);
  return (
    <span
      ref={ref}
      className={scrolled ? "coffee-nudge coffee-nudge-gone" : "coffee-nudge"}
      aria-hidden="true"
    >
      {message && (
        <>
          {message} {/* Phones show only the cup, so the bubble says what it's for. */}
          <span className="coffee-nudge-cta">Buy me a coffee </span>☕
        </>
      )}
    </span>
  );
}
