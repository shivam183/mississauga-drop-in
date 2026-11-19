import type { SessionType } from "@/models/session";
import styles from "./TypeBadge.module.css";

/** A session's type, or "program" for a registered program on /registered. */
export type BadgeType = SessionType | "program";

export const TYPE_LABEL: Record<BadgeType, string> = {
  dropin: "Drop-in",
  enroll: "Enroll online",
  program: "Registered",
};

export function TypeBadge({ type }: { type: BadgeType }) {
  return <span className={`${styles.badge} ${styles[type]}`}>{TYPE_LABEL[type]}</span>;
}
