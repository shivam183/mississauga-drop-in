"use client";

import { useState } from "react";
import { useHydrated } from "./FilterForm";
import styles from "./SessionCard.module.css";

/**
 * Shares a session through the phone's share sheet, or copies it where the
 * browser can't share: the text, then the link on its own line. Needs
 * JavaScript, so it shows only once the page is hydrated.
 */
export function ShareButton({
  title,
  text,
  href,
}: {
  title: string;
  /** One detail per line, e.g. "Adult Pickleball\nMon Nov 16, 7:45 – 9:45 AM\nMeadowvale Community Centre" */
  text: string;
  /** Our list filtered to this session, relative to the site. */
  href: string;
}) {
  const live = useHydrated();
  const [copied, setCopied] = useState(false);
  if (!live) return null;

  async function share() {
    const message = `${text}\n${new URL(href, window.location.href).href}`;
    if (navigator.share) {
      // The link goes in the text, not `url`: apps join a separate url onto the
      // text in their own way, often on the same line. Rejects when the person
      // closes the sheet; nothing to do then.
      await navigator.share({ title, text: message }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access (e.g. an insecure page); there's no other fallback.
    }
  }

  return (
    <button type="button" className={styles.share} aria-label={`Share ${title}`} onClick={share}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M7 11H5v10h14V11h-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span role="status" className={copied ? styles.copied : "visually-hidden"}>
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
