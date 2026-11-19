"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import styles from "./ActivityDetails.module.css";
import { CloseIcon } from "./CloseIcon";
import { DETAILS_TITLE_ID } from "./detailsIds";
import { TypeBadge, type BadgeType } from "./TypeBadge";

/** What the tapped card already shows, so the popup can draw it straight away. */
export interface DetailsPreview {
  href: string;
  type: BadgeType;
  title: string;
  /** "Today · 6:30 – 8:55 AM" */
  when: string;
  /** "Burnhamthorpe Community Centre · Therapeutic Pool" */
  where: string;
}

// The last card tapped, and whether the stand-in popup is up. Only one tap
// matters at a time, in this tab, so a tiny module store is enough. The card's
// preview and the tap (where focus goes back, whether the stand-in was closed)
// are cleared separately: React runs PreviewShown's effect before the popup's
// own, which still needs the tap.
let lastPreview: DetailsPreview | null = null;
let tap: { opener: HTMLElement; cancelled: boolean } | null = null;
let standIn = false;
const listeners = new Set<() => void>();
const setStandIn = (shown: boolean) => {
  standIn = shown;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Shows the stand-in popup for a card at once; `opener` gets focus back on close. */
function openStandIn(preview: DetailsPreview, opener: HTMLElement | null) {
  lastPreview = preview;
  tap = opener ? { opener, cancelled: false } : null;
  setStandIn(true);
}

// A refresh while the popup is open should come back to the same list with the
// popup over it; a shared link (another tab, another person) gets the full page.
// This tab's sessionStorage tells them apart: it survives a reload, not a new tab.
const OPENED = "details-opened-from";
const REOPEN = "details-reopen";

interface Opened {
  preview: DetailsPreview;
  /** The list it was opened from, with its filters. */
  from: string;
  /** Where that list was scrolled to. */
  y: number;
}

function read(key: string): Opened | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null") as Opened | null;
  } catch {
    return null;
  }
}

function write(key: string, value: Opened | null) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch {
    // Storage blocked (private mode): a refresh just shows the full page.
  }
}

function rememberOpened(opened: Opened) {
  write(OPENED, opened);
}

/** How this page was loaded: "reload" and "back_forward" revisit; "navigate" is a link or the address bar. */
function loadType(): string {
  const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  return entry?.type ?? "navigate";
}

/**
 * On the full /activity page: if this tab opened it as a popup and the page
 * was reloaded (or reached by Back/Forward), go back to that list;
 * ReopenDetails opens the popup over it again. Opening the address any other
 * way, like a shared link, keeps the full page.
 */
export function RestoreList() {
  const router = useRouter();
  useEffect(() => {
    if (loadType() === "navigate") return;
    const opened = read(OPENED);
    if (opened?.preview.href !== window.location.pathname + window.location.search) return;
    write(REOPEN, opened);
    openStandIn(opened.preview, null); // covers the swap
    router.replace(opened.from, { scroll: false });
  }, [router]);
  return null;
}

/** On a list: finishes RestoreList, back where it was with the popup open. */
export function ReopenDetails() {
  const router = useRouter();
  useEffect(() => {
    const opened = read(REOPEN);
    if (!opened) return;
    write(REOPEN, null);
    window.scrollTo(0, opened.y);
    const card = document.querySelector<HTMLElement>(
      `a[href="${CSS.escape(opened.preview.href)}"]`,
    );
    openStandIn(opened.preview, card);
    router.push(opened.preview.href, { scroll: false });
  }, [router]);
  return null;
}

/** The card's title: opens the details popup, at once, with what the card knows. */
export function DetailsLink({
  preview,
  children,
}: {
  preview: DetailsPreview;
  children: ReactNode;
}) {
  return (
    <Link
      href={preview.href}
      // No prefetch: the stand-in popup covers the wait, and every card on
      // screen would otherwise ask our server for its popup.
      prefetch={false}
      scroll={false}
      onClick={(event) => {
        // A new tab or window gets the full page; nothing to show here.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        openStandIn(preview, event.currentTarget);
        rememberOpened({
          preview,
          from: window.location.pathname + window.location.search,
          y: Math.round(window.scrollY),
        });
      }}
    >
      {children}
    </Link>
  );
}

/**
 * Called once the real popup is up: hides the stand-in and says where focus
 * goes back to on close, and whether the stand-in was already closed (so the
 * real popup should close too).
 */
export function takeOver(): { opener: HTMLElement | null; cancelled: boolean } {
  setStandIn(false);
  const taken = { opener: tap?.opener ?? null, cancelled: tap?.cancelled ?? false };
  tap = null;
  return taken;
}

/**
 * Shown the moment a card is tapped, before the server answers: the details
 * popup's frame with the card's name, time and place (see DetailsLoading).
 */
export function StandInDetails() {
  const shown = useSyncExternalStore(
    subscribe,
    () => standIn,
    () => false,
  );
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (shown && dialog && !dialog.open) {
      dialog.showModal();
      dialog.focus();
    }
  }, [shown]);
  if (!shown) return null;
  const close = () => {
    if (tap) tap.cancelled = true;
    setStandIn(false);
    tap?.opener.focus({ preventScroll: true });
  };
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={DETAILS_TITLE_ID}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className={styles.grab} aria-hidden="true">
        <div className={styles.handle} />
      </div>
      <DetailsLoading
        close={
          <button
            type="button"
            className={styles.close}
            onClick={close}
            aria-label="Close"
            title="Close"
          >
            <CloseIcon />
          </button>
        }
      />
    </dialog>
  );
}

/**
 * The popup while its details load: the tapped card's name, time and place,
 * placeholders for the rest. Plain placeholders when it wasn't opened from a
 * card (a shared link, Back then Forward).
 */
export function DetailsLoading({ close }: { close: ReactNode }) {
  // Not from the URL: this part is prebuilt. PreviewShown forgets the tap once
  // the details are up, so a later Back/Forward doesn't show a stale card.
  const preview = lastPreview;
  return (
    <div aria-busy="true" className={styles.loadingRoot}>
      <div className={styles.head}>
        {preview ? <TypeBadge type={preview.type} /> : <span />}
        {close}
      </div>
      <div className={styles.body}>
        {preview ? (
          <>
            <h2 id={DETAILS_TITLE_ID} className={styles.name}>
              {preview.title}
            </h2>
            <div className={`${styles.factsPlaceholder} shimmer`} />
            <section className={styles.session} aria-label="This session">
              <p className={styles.when}>{preview.when}</p>
              <p className={styles.where}>
                <span aria-hidden="true">📍 </span>
                {preview.where}
              </p>
            </section>
          </>
        ) : (
          <p className={styles.loading}>Loading details…</p>
        )}
        <div className={`${styles.skeleton} shimmer`} />
        <div className={`${styles.skeleton} shimmer`} />
      </div>
    </div>
  );
}

/** Rendered with the loaded details: a later Back/Forward shouldn't show this card again. */
export function PreviewShown() {
  useEffect(() => {
    lastPreview = null;
  }, []);
  return null;
}
