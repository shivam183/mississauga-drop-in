"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Area = "dropin" | "programs";

/** Drop-in | Registered in the header: single visits, or programs you register for. */
export function AreaTabs() {
  const pathname = usePathname();
  const fromPath: Area = pathname.startsWith("/registered") ? "programs" : "dropin";
  // The pill slides at the tap, not when the new page arrives; the URL takes over once it does.
  const [picked, setPicked] = useState<{ area: Area; from: string } | null>(null);
  const current = picked && picked.from === pathname ? picked.area : fromPath;
  return <Tabs current={current} onPick={(area) => setPicked({ area, from: pathname })} />;
}

/** The toggle itself; `null` (no pill) while the path streams in. */
export function Tabs({ current, onPick }: { current: Area | null; onPick?: (area: Area) => void }) {
  const tab = (area: Area, href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === area ? "page" : undefined}
      onClick={(event) => {
        // A new tab or window doesn't change this page.
        if (!(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) onPick?.(area);
      }}
    >
      {label}
    </Link>
  );
  return (
    <nav className="area-tabs" aria-label="Area" data-current={current ?? undefined}>
      {tab("dropin", "/", "Drop-in")}
      {tab("programs", "/registered", "Registered")}
    </nav>
  );
}
