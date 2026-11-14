import type { AnchorHTMLAttributes } from "react";

/**
 * A link to another site (the City's, GitHub). It opens in a new tab so the
 * results stay where they were, and says so to screen readers.
 */
export function ExternalLink({
  children,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel"> & { href: string }) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}
