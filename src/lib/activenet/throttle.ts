/**
 * Limits how hard we hit the City's servers: request starts are spaced at
 * least `minIntervalMs` apart, and at most `maxConcurrent` run at once.
 */
export interface Throttle {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export interface ThrottleOptions {
  /** Minimum gap between two request starts. Default 500 ms (2 per second). */
  minIntervalMs?: number;
  /** Maximum requests in flight. Default 4. */
  maxConcurrent?: number;
}

export function createThrottle({
  minIntervalMs = 500,
  maxConcurrent = 4,
}: ThrottleOptions = {}): Throttle {
  if (!(minIntervalMs >= 0)) throw new RangeError("minIntervalMs must be >= 0");
  if (!(maxConcurrent >= 1)) throw new RangeError("maxConcurrent must be >= 1");

  const queue: Array<() => void> = [];
  let active = 0;
  let nextStartAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function pump(): void {
    while (active < maxConcurrent && queue.length > 0) {
      const wait = nextStartAt - Date.now();
      if (wait > 0) {
        if (!timer) {
          timer = setTimeout(() => {
            timer = undefined;
            pump();
          }, wait);
        }
        return;
      }
      nextStartAt = Date.now() + minIntervalMs;
      active++;
      queue.shift()!();
    }
  }

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        queue.push(() => {
          let result: Promise<T>;
          try {
            result = Promise.resolve(task());
          } catch (error) {
            result = Promise.reject(error);
          }
          result.then(resolve, reject).finally(() => {
            active--;
            pump();
          });
        });
        pump();
      });
    },
  };
}
