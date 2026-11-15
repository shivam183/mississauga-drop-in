"use client";

import { useLinkStatus } from "next/link";

/** A small spinner inside a <Link> while its page is loading. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className="link-pending" data-pending={pending} />;
}
