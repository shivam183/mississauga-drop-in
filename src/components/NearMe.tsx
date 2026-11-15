"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { hrefWith, NEARBY_KM, type SearchState } from "@/lib/params";
import { useHydrated } from "./FilterForm";
import { LinkPending } from "./LinkPending";
import styles from "./Search.module.css";

/**
 * "Near me" chip: asks for the person's location (only when tapped) and shows
 * sessions at centres within NEARBY_KM, still in time order. When on, it's a
 * link that turns it off. Needs JavaScript, so it's hidden until hydrated.
 */
export function NearMe({ path, state }: { path: string; state: SearchState }) {
  const live = useHydrated();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.near) {
    return (
      <Link
        href={hrefWith(path, state, { near: null })}
        className={styles.chip}
        aria-current="page"
      >
        <span aria-hidden="true">📍&nbsp;</span>Near me · {NEARBY_KM} km
        <LinkPending />
      </Link>
    );
  }
  if (!live || !("geolocation" in navigator)) return null;

  function locate() {
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const href = hrefWith(path, state, {
          near: { lat: coords.latitude, lng: coords.longitude },
        });
        startTransition(() => router.push(href, { scroll: false }));
      },
      (failure) => {
        setLocating(false);
        setError(
          failure.code === failure.PERMISSION_DENIED ? "Location is off" : "Couldn’t find you",
        );
      },
      // A rough, recent fix is plenty for "within 5 km", and much faster.
      { enableHighAccuracy: false, maximumAge: 10 * 60_000, timeout: 15_000 },
    );
  }

  return (
    <button type="button" className={styles.chip} onClick={locate} disabled={locating || pending}>
      <span aria-hidden="true">📍&nbsp;</span>
      {locating || pending ? "Finding you…" : (error ?? "Near me")}
    </button>
  );
}
