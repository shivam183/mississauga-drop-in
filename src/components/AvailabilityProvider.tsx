"use client";

/**
 * Loads spots left for the "enroll online" cards that are on screen. Cards
 * register with `useAvailability`; visible ones are batched into
 * /api/availability requests of up to 20 ids.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { SessionStatus } from "@/models/availability";

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 120;

export type AvailabilityEntry =
  | { phase: "idle" | "loading" }
  | { phase: "ready"; status: SessionStatus }
  | { phase: "error"; message: string };

interface AvailabilityContextValue {
  entries: Record<number, AvailabilityEntry>;
  observe(id: number, element: Element): () => void;
  refresh(id: number): Promise<void>;
  refreshing: Record<number, string | undefined>;
}

const AvailabilityContext = createContext<AvailabilityContextValue | null>(null);

interface ApiResponse {
  statuses?: Record<string, SessionStatus>;
  unknownIds?: number[];
  failedIds?: number[];
  error?: string;
}

async function fetchAvailability(ids: number[], fresh = false): Promise<ApiResponse> {
  const query = `ids=${ids.join(",")}${fresh ? "&fresh=1" : ""}`;
  const response = await fetch(`/api/availability?${query}`, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as ApiResponse;
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

export function AvailabilityProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<number, AvailabilityEntry>>({});
  const [refreshing, setRefreshing] = useState<Record<number, string | undefined>>({});
  const requested = useRef(new Set<number>());
  const queue = useRef(new Set<number>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const elements = useRef(new Map<Element, number>());
  const observer = useRef<IntersectionObserver | null>(null);

  const apply = useCallback((ids: number[], body: ApiResponse | Error) => {
    setEntries((previous) => {
      const next = { ...previous };
      for (const id of ids) {
        const status = body instanceof Error ? undefined : body.statuses?.[id];
        if (status) next[id] = { phase: "ready", status };
        else if (body instanceof Error) next[id] = { phase: "error", message: body.message };
        else if (body.unknownIds?.includes(id))
          next[id] = { phase: "error", message: "No longer listed" };
        else next[id] = { phase: "error", message: "Couldn't check spots" };
      }
      return next;
    });
  }, []);

  const flush = useCallback(() => {
    timer.current = undefined;
    const ids = [...queue.current];
    queue.current.clear();
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      fetchAvailability(batch).then(
        (body) => apply(batch, body),
        (cause: unknown) => apply(batch, cause instanceof Error ? cause : new Error(String(cause))),
      );
    }
  }, [apply]);

  const request = useCallback(
    (id: number) => {
      if (requested.current.has(id)) return;
      requested.current.add(id);
      queue.current.add(id);
      setEntries((previous) => ({ ...previous, [id]: { phase: "loading" } }));
      timer.current ??= setTimeout(flush, BATCH_DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (!record.isIntersecting) continue;
          const id = elements.current.get(record.target);
          if (id !== undefined) request(id);
          observer.current?.unobserve(record.target);
        }
      },
      { rootMargin: "200px 0px" },
    );
    for (const element of elements.current.keys()) observer.current.observe(element);
    return () => {
      observer.current?.disconnect();
      observer.current = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [request]);

  const observe = useCallback((id: number, element: Element) => {
    elements.current.set(element, id);
    observer.current?.observe(element);
    return () => {
      elements.current.delete(element);
      observer.current?.unobserve(element);
    };
  }, []);

  const refresh = useCallback(
    async (id: number) => {
      setRefreshing((previous) => ({ ...previous, [id]: "" }));
      try {
        const body = await fetchAvailability([id], true);
        apply([id], body);
        setRefreshing((previous) => ({ ...previous, [id]: undefined }));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Couldn't refresh";
        setRefreshing((previous) => ({ ...previous, [id]: message }));
      }
    },
    [apply],
  );

  const value = useMemo(
    () => ({ entries, observe, refresh, refreshing }),
    [entries, observe, refresh, refreshing],
  );
  return <AvailabilityContext.Provider value={value}>{children}</AvailabilityContext.Provider>;
}

/** Availability for one session; starts loading when `ref` scrolls near the screen. */
export function useAvailability(id: number, ref: RefObject<Element | null>) {
  const context = useContext(AvailabilityContext);
  if (!context) throw new Error("useAvailability must be used inside <AvailabilityProvider>");
  const { observe, entries, refresh, refreshing } = context;

  useEffect(() => {
    if (!ref.current) return;
    return observe(id, ref.current);
  }, [id, observe, ref]);

  return {
    entry: entries[id] ?? ({ phase: "idle" } as AvailabilityEntry),
    refresh: () => refresh(id),
    /** undefined: not refreshing; "": in progress; text: the refresh failed. */
    refreshState: refreshing[id],
  };
}
