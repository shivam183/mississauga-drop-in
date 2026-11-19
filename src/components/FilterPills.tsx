import Link from "next/link";
import styles from "./Search.module.css";

export interface FilterPill {
  label: string;
  /** The same page without this filter. */
  href: string;
}

/**
 * The filters in use, as pills above the results; tapping one removes it. On
 * phones the filters are in a closed sheet, so this is where you see them.
 * Used by the drop-in lists.
 */
export function FilterPills({ pills }: { pills: FilterPill[] }) {
  if (pills.length === 0) return null;
  return (
    <ul className={styles.activeFilters} aria-label="Filters in use">
      {pills.map(({ label, href }) => (
        <li key={href}>
          <Link
            className={styles.filterPill}
            href={href}
            scroll={false}
            aria-label={`Remove ${label}`}
          >
            {label}
            <span aria-hidden="true">✕</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
