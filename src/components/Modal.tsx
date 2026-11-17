"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./ActivityDetails.module.css";
import { CloseIcon } from "./CloseIcon";
import { takeOver } from "./DetailsPreview";
import { useSwipeToClose } from "./useSwipeToClose";

/**
 * The details popup: a native modal <dialog> (focus moves in and comes back,
 * Esc closes). It's shown by navigating to /activity/{id} from the list, so
 * closing it (✕, Esc, a tap outside, or Back) just goes back.
 */
export function Modal({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  // Phones: pull the handle down to close, like the filter sheet.
  // Also a swipe down on the content when it's scrolled to the top.
  const { drag, grab } = useSwipeToClose(() => router.back(), {
    stayOnClose: true,
    scrollArea: { root: ref, selector: `.${styles.body}`, when: isPhone },
  });

  useEffect(() => {
    const dialog = ref.current;
    // Take over from the stand-in shown at the tap (DetailsPreview). Focus goes
    // back to the card on close: the dialog is already out of the page when this
    // effect is cleaned up, so the browser can't return it itself.
    const taken = takeOver();
    const opener =
      taken.opener ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const { cancelled } = taken;
    if (cancelled) {
      router.back(); // closed before it arrived
      return;
    }
    if (dialog && !dialog.open) {
      dialog.showModal();
      // Focus the dialog, not its first button: the loading state's ✕ is
      // replaced when the details arrive, which would drop focus to the page.
      dialog.focus();
    }
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [router]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      data-dragging={drag !== null && drag > 0}
      style={drag ? { transform: `translateY(${drag}px)` } : undefined}
      {...grab}
      // Pull down from the handle or the whole head row (badge, Share), not just the 4px handle.
      onPointerDown={(event) => {
        if (isPhone() && (event.target as Element).closest(`.${styles.grab}, .${styles.head}`))
          grab.onPointerDown(event);
      }}
      onCancel={(event) => {
        event.preventDefault(); // close by going back, so the URL follows
        router.back();
      }}
      // The content fills the dialog, so only a tap on the backdrop lands here.
      onClick={(event) => {
        if (event.target === event.currentTarget) router.back();
      }}
    >
      {/* Pointer-only; keyboards and screen readers close with Esc or ✕. */}
      <div className={styles.grab} aria-hidden="true">
        <div className={styles.handle} />
      </div>
      {children}
    </dialog>
  );
}

/** Phones only, where the popup is a bottom sheet (same breakpoint as the CSS). */
const isPhone = () => matchMedia("(max-width: 639.98px)").matches;

export function CloseButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={styles.close}
      onClick={() => router.back()}
      aria-label="Close"
      title="Close"
    >
      <CloseIcon />
    </button>
  );
}
