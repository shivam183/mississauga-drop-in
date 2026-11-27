import type { ReactNode } from "react";

const CALENDAR_ICON =
  "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 13v6M9 16h6";

/**
 * "Add to calendar": a plain link to an .ics route, so it works without
 * JavaScript; phones offer to add the event, computers download it, and the
 * page (or popup) stays where it is.
 */
export function CalendarLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  /** A visible label after the icon ("Calendar"); the name stays "Add to calendar". */
  children?: ReactNode;
}) {
  return (
    <a href={href} className={className} aria-label="Add to calendar" title="Add to calendar">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path
          d={CALENDAR_ICON}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </a>
  );
}
