import type { SessionType } from "@/models/session";
import styles from "./TypeBadge.module.css";

export const TYPE_LABEL: Record<SessionType, string> = {
  dropin: "Drop-in",
  enroll: "Enroll online",
};

export function TypeBadge({ type }: { type: SessionType }) {
  return <span className={`${styles.badge} ${styles[type]}`}>{TYPE_LABEL[type]}</span>;
}
