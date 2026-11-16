"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type ReactNode } from "react";

/**
 * The URL most recently asked for, until the page catches up. Two quick
 * toggles build on each other instead of on a URL that hasn't changed yet.
 */
let pending: string | null = null;

const here = () => `${location.pathname}${location.search}`;

/**
 * Collapsing a day shortens the page until the refill arrives, and a page
 * shorter than the window makes the browser jump to the top. Hold the height
 * from the tap until the new page renders (or 5 s pass).
 */
let release: ReturnType<typeof setTimeout> | undefined;
function holdHeight() {
  const root = document.documentElement;
  root.style.minHeight = `${root.scrollHeight}px`;
  clearTimeout(release);
  release = setTimeout(releaseHeight, 5000);
}
function releaseHeight() {
  clearTimeout(release);
  document.documentElement.style.minHeight = "";
}

/**
 * `href` with `date` added to or removed from its `collapsed` list, or null if
 * it's already that way.
 */
export function withCollapsed(href: string, date: string, collapse: boolean): string | null {
  const url = new URL(href, "http://x");
  const days = new Set((url.searchParams.get("collapsed") ?? "").split(",").filter(Boolean));
  if (days.has(date) === collapse) return null;
  if (collapse) days.add(date);
  else days.delete(date);
  if (days.size) url.searchParams.set("collapsed", [...days].sort().join(","));
  else url.searchParams.delete("collapsed");
  return `${url.pathname}${url.search}`;
}

/**
 * One day's results in a native <details>, so its heading collapses the day
 * even without JavaScript. With JavaScript, a toggle also updates the URL, and
 * the server refills the page: collapsed days don't count toward it.
 */
export function DayDetails({
  date,
  collapsed,
  className,
  summary,
  summaryClassName,
  children,
}: {
  date: string;
  collapsed: boolean;
  className: string;
  summary: ReactNode;
  summaryClassName: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  /** Set on the tap, before the browser collapses the day: was its heading stuck at the top? */
  const wasStuck = useRef(false);

  useEffect(() => {
    if (pending === here()) pending = null;
    releaseHeight();
  }, [collapsed]);

  return (
    <details
      className={className}
      open={!collapsed}
      onToggle={(event) => {
        const details = event.currentTarget;
        const collapse = !details.open;
        // React setting `open` from a new render also fires toggle; then the URL already agrees.
        const href = withCollapsed(pending ?? here(), date, collapse);
        if (!href) return;
        // Collapsing from a stuck heading: keep that heading at the top, not wherever the scroll lands.
        if (collapse && wasStuck.current) details.scrollIntoView({ block: "start" });
        wasStuck.current = false;
        pending = href;
        startTransition(() => router.replace(href, { scroll: false }));
      }}
    >
      <summary
        className={summaryClassName}
        // Runs before the browser toggles (Enter and Space click too), while the page is still full height.
        onClick={(event) => {
          const details = event.currentTarget.parentElement as HTMLDetailsElement;
          if (!details.open) return;
          wasStuck.current = details.getBoundingClientRect().top < 0;
          holdHeight();
        }}
      >
        {summary}
      </summary>
      {children}
    </details>
  );
}
