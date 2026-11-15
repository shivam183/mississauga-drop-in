import { describe, expect, it, vi } from "vitest";
import { createStore } from "@/components/AvailabilityProvider";

describe("availability store", () => {
  it("notifies only the listeners of the session that changed", () => {
    const store = createStore();
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe(1, first);
    store.subscribe(2, second);

    store.setEntry(1, { phase: "loading" });
    store.setRefreshState(1, "");
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).not.toHaveBeenCalled();
  });

  it("keeps the same entry object until it changes, so cards don't re-render", () => {
    const store = createStore();
    expect(store.entry(1)).toBe(store.entry(1)); // idle
    store.setEntry(1, { phase: "loading" });
    expect(store.entry(1)).toBe(store.entry(1));
    expect(store.entry(1)).toEqual({ phase: "loading" });
  });

  it("tracks refresh state and stops notifying after unsubscribe", () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(1, listener);
    store.setRefreshState(1, "Too many refreshes");
    expect(store.refreshState(1)).toBe("Too many refreshes");
    store.setRefreshState(1, undefined);
    expect(store.refreshState(1)).toBeUndefined();
    unsubscribe();
    store.setEntry(1, { phase: "loading" });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
