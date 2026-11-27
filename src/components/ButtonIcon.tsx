// Small outlined icons before a button's label. Not a client module, so server components can use them too.

// An alarm clock: "Remind me".
export const ALARM_ICON =
  "M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM12 9v4l2 2M5 3 2 6M22 6l-3-3M6.4 18.7 4 21M17.6 18.7 20 21";

// A person with a tick: "Enroll now"; with a plus: "Join waitlist".
export const ENROLL_ICON =
  "M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16 11l2 2 4-4";
export const JOIN_ICON =
  "M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19 8v6M22 11h-6";

// A globe: the City's website, when "View on ActiveMississauga" is a button.
export const WEB_ICON =
  "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18";

export function ButtonIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
