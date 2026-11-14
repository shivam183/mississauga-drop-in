import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThrottle } from "@/lib/activenet/throttle";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());

/** A task that records when it started and finishes when `release()` is called. */
function deferredTask(starts: number[]) {
  let release!: () => void;
  const done = new Promise<void>((r) => (release = r));
  return {
    task: async () => {
      starts.push(Date.now());
      await done;
      return "ok";
    },
    release: () => release(),
  };
}

describe("createThrottle", () => {
  it("spaces request starts at least minIntervalMs apart", async () => {
    const throttle = createThrottle({ minIntervalMs: 500, maxConcurrent: 10 });
    const starts: number[] = [];
    const runs = Array.from({ length: 4 }, () =>
      throttle.run(async () => {
        starts.push(Date.now());
      }),
    );
    await vi.runAllTimersAsync();
    await Promise.all(runs);
    expect(starts).toEqual([0, 500, 1000, 1500]);
  });

  it("never has more than maxConcurrent tasks in flight", async () => {
    const throttle = createThrottle({ minIntervalMs: 0, maxConcurrent: 2 });
    const starts: number[] = [];
    const tasks = Array.from({ length: 3 }, () => deferredTask(starts));
    const runs = tasks.map((t) => throttle.run(t.task));

    await vi.advanceTimersByTimeAsync(1000);
    expect(starts).toHaveLength(2);

    tasks[0].release();
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(3);

    tasks[1].release();
    tasks[2].release();
    await expect(Promise.all(runs)).resolves.toEqual(["ok", "ok", "ok"]);
  });

  it("passes errors through and keeps going", async () => {
    const throttle = createThrottle({ minIntervalMs: 0, maxConcurrent: 1 });
    const failing = throttle.run(async () => {
      throw new Error("boom");
    });
    const syncThrow = throttle.run(() => {
      throw new Error("sync boom");
    });
    const next = throttle.run(async () => "next");
    await expect(failing).rejects.toThrow("boom");
    await expect(syncThrow).rejects.toThrow("sync boom");
    await expect(next).resolves.toBe("next");
  });

  it("rejects invalid options", () => {
    expect(() => createThrottle({ maxConcurrent: 0 })).toThrow(RangeError);
    expect(() => createThrottle({ minIntervalMs: -1 })).toThrow(RangeError);
  });
});
