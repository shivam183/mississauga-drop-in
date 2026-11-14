import type { Metadata } from "next";
import Link from "next/link";
import { ALL_CENTRES, CENTRES_BY_TYPE } from "@/lib/centres";
import styles from "./centres.module.css";

export const metadata: Metadata = { title: "Community centres" };

const enrolIds = new Set(CENTRES_BY_TYPE.enrol.map((c) => c.id));
const dropInIds = new Set(CENTRES_BY_TYPE.dropin.map((c) => c.id));

export default function CentresPage() {
  return (
    <>
      <h1 className="page-title">Community centres</h1>
      <p className="muted intro">Pick a centre to see everything on there, soonest first.</p>
      <ul className={styles.list}>
        {ALL_CENTRES.map((centre) => (
          <li key={centre.id}>
            <Link href={`/centres/${centre.id}`} className={styles.item}>
              <span className={styles.name}>{centre.name}</span>
              <span className={styles.types}>
                {[dropInIds.has(centre.id) && "Drop-in", enrolIds.has(centre.id) && "Enrol online"]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
