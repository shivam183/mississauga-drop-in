"use client";

/**
 * Loads spots left for the "enroll online" cards that are on screen. Cards
 * register with `useAvailability`; visible ones are batched into
 * /api/availability requests of up to 20 ids. Entries live in a small store
 * that each card subscribes to by id, so an update re-renders only the cards
 * it changes, not every card on the page.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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

const IDLE: AvailabilityEntry = { phase: "idle" };

/** Entries and refresh states by session id, with listeners per id. */
export function createStore() {
  const entries = new Map<number, AvailabilityEntry>();
  /** "": refresh in progress; text: the refresh failed. */
  const refreshing = new Map<number, string>();
  const listeners = new Map<number, Set<() => void>>();
  const notify = (id: number) => listeners.get(id)?.forEach((listener) => listener());
  return {
    entry: (id: number) => entries.get(id) ?? IDLE,
    refreshState: (id: number) => refreshing.get(id),
    setEntry(id: number, entry: AvailabilityEntry) {
      entries.set(id, entry);
      notify(id);
    },
    setRefreshState(id: number, state: string | undefined) {
      if (state === undefined) refreshing.delete(id);
      else refreshing.set(id, state);
      notify(id);
    },
    subscribe(id: number, listener: () => void) {
      let set = listeners.get(id);
      if (!set) listeners.set(id, (set = new Set()));
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(id);
      };
    },
  };
}

type Store = ReturnType<typeof createStore>;

interface AvailabilityContextValue {
  store: Store;
  observe(id: number, element: Element): () => void;
  refresh(id: number): Promise<void>;
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
  const [store] = useState(createStore);
  const requested = useRef(new Set<number>());
  const queue = useRef(new Set<number>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const elements = useRef(new Map<Element, number>());
  const observer = useRef<IntersectionObserver | null>(null);

  const apply = useCallback(
    (ids: number[], body: ApiResponse | Error) => {
      for (const id of ids) {
        const status = body instanceof Error ? undefined : body.statuses?.[id];
        store.setEntry(
          id,
          status
            ? { phase: "ready", status }
            : {
                phase: "error",
                message:
                  body instanceof Error
                    ? body.message
                    : body.unknownIds?.includes(id)
                      ? "No longer listed"
                      : "Couldn't check spots",
              },
        );
      }
    },
    [store],
  );

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
      store.setEntry(id, { phase: "loading" });
      timer.current ??= setTimeout(flush, BATCH_DELAY_MS);
    },
    [flush, store],
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
      store.setRefreshState(id, "");
      try {
        const body = await fetchAvailability([id], true);
        apply([id], body);
        store.setRefreshState(id, undefined);
      } catch (cause) {
        store.setRefreshState(id, cause instanceof Error ? cause.message : "Couldn't refresh");
      }
    },
    [apply, store],
  );

  const value = useMemo(() => ({ store, observe, refresh }), [store, observe, refresh]);
  return <AvailabilityContext.Provider value={value}>{children}</AvailabilityContext.Provider>;
}

/** Availability for one session; starts loading when `ref` scrolls near the screen. */
export function useAvailability(id: number, ref: RefObject<Element | null>) {
  const context = useContext(AvailabilityContext);
  if (!context) throw new Error("useAvailability must be used inside <AvailabilityProvider>");
  const { observe, refresh, store } = context;
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(id, listener),
    [store, id],
  );
  const entry = useSyncExternalStore(
    subscribe,
    () => store.entry(id),
    () => IDLE,
  );
  const refreshState = useSyncExternalStore(
    subscribe,
    () => store.refreshState(id),
    () => undefined,
  );

  useEffect(() => {
    if (!ref.current) return;
    return observe(id, ref.current);
  }, [id, observe, ref]);

  return {
    entry,
    refresh: () => refresh(id),
    /** undefined: not refreshing; "": in progress; text: the refresh failed. */
    refreshState,
  };
}
