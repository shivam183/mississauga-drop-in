"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition, type ReactNode } from "react";
import { withCollapsed } from "@/lib/params";

/**
 * The URL most recently asked for, until that navigation finishes. Two quick
 * toggles build on each other instead of on a URL that hasn't changed yet.
 */
let pending: string | null = null;

/**
 * Collapsing a day shortens the page until the refill arrives, and a page
 * shorter than the window makes the browser jump to the top. Hold the height
 * from the tap until the navigation finishes.
 */
const holdHeight = () => {
  const root = document.documentElement;
  root.style.minHeight = `${root.scrollHeight}px`;
};
const releaseHeight = () => {
  document.documentElement.style.minHeight = "";
};

/**
 * One day's results in a native <details>, so its heading collapses the day
 * even without JavaScript. With JavaScript, a toggle also updates the URL, and
 * the server refills the page: collapsed days don't count toward it.
 */
export function DayDetails({
  date,
  collapsed,
  summary,
  summaryClassName,
  children,
}: {
  date: string;
  collapsed: boolean;
  summary: ReactNode;
  summaryClassName: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [navigating, startTransition] = useTransition();

  useEffect(() => {
    if (navigating) return;
    pending = null;
    releaseHeight();
  }, [navigating]);

  return (
    <details
      open={!collapsed}
      onToggle={(event) => {
        const details = event.currentTarget;
        const collapse = !details.open;
        // React setting `open` from a new render also fires toggle; then the URL already agrees.
        const href = withCollapsed(
          pending ?? `${location.pathname}${location.search}`,
          date,
          collapse,
        );
        if (!href) return releaseHeight();
        // Above the window means its heading was stuck: keep that heading at the top.
        if (collapse && details.getBoundingClientRect().top < 0) {
          details.scrollIntoView({ block: "start" });
        }
        pending = href;
        startTransition(() => router.replace(href, { scroll: false }));
      }}
    >
      <summary
        className={summaryClassName}
        // Before the browser collapses the day (Enter and Space click too), while the page is full height.
        onClick={(event) => {
          if ((event.currentTarget.parentElement as HTMLDetailsElement).open) holdHeight();
        }}
      >
        {summary}
      </summary>
      {children}
    </details>
  );
}
