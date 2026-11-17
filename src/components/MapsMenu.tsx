"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./ActivityDetails.module.css";
import { ExternalLink } from "./ExternalLink";

export interface MapApp {
  id: "google" | "apple" | "waze";
  label: string;
  href: string;
}

/** This browser's last pick, listed first. Only a convenience: storage may be blocked. */
const LAST_KEY = "maps-app";

/** About the card's height (title and three rows), to choose below or above the button. */
const CARD_HEIGHT = 240;
const EDGE = 16;

/**
 * Puts the card under the button (above it when there's no room below),
 * right-aligned with it, with its pointer at the button's centre.
 * shortcut: fixed position from the button, not CSS anchor positioning (not yet in every browser); switch when it is.
 */
function anchor(card: HTMLElement, button: DOMRect) {
  const width = document.documentElement.clientWidth; // without a scrollbar, unlike innerWidth
  const right = Math.max(EDGE, width - button.right);
  const below = innerHeight - button.bottom >= CARD_HEIGHT || button.top < CARD_HEIGHT;
  card.dataset.side = below ? "below" : "above";
  card.style.right = `${right}px`;
  card.style.top = below ? `${button.bottom + 10}px` : "auto";
  card.style.bottom = below ? "auto" : `${innerHeight - button.top + 10}px`;
  card.style.setProperty(
    "--pointer-right",
    `${width - right - (button.left + button.width / 2)}px`,
  );
}

/**
 * Directions: a small "Directions in…" dropdown with each maps app. A native
 * popover, so tapping outside or Esc closes it, and it works without JavaScript
 * (centred then, as the browser places it).
 */
export function MapsMenu({
  apps,
  label,
  children,
}: {
  apps: MapApp[];
  /** The button's accessible name, e.g. "Directions to Malton Community Centre". */
  label: string;
  /** The button's icon. */
  children: ReactNode;
}) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [last, setLast] = useState<string | null>(null);
  const listed = [...apps].sort((a, b) => Number(b.id === last) - Number(a.id === last));

  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        className={styles.iconLink}
        aria-label={label}
        title="Directions"
        onClick={(event) => {
          try {
            setLast(localStorage.getItem(LAST_KEY));
          } catch {}
          const card = menu.current;
          if (!card || card.matches(":popover-open")) return; // this click closes it
          anchor(card, event.currentTarget.getBoundingClientRect());
          // Scrolling would leave it floating away from the button.
          addEventListener("scroll", () => card.hidePopover(), { capture: true, once: true });
        }}
      >
        {children}
      </button>
      <div id={id} ref={menu} popover="auto" className={styles.mapsMenu}>
        <p className={styles.mapsTitle}>Directions in</p>
        <ul className={styles.mapsList}>
          {listed.map((app) => (
            <li key={app.id}>
              <ExternalLink
                href={app.href}
                className={styles.mapsApp}
                onClick={() => {
                  try {
                    localStorage.setItem(LAST_KEY, app.id);
                  } catch {}
                  menu.current?.hidePopover();
                }}
              >
                {app.label}
                {app.id === last && <span className={styles.mapsLast}>Last used</span>}
              </ExternalLink>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
