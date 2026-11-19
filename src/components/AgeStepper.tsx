"use client";

import { useRef } from "react";
import { useApplyFilters } from "./FilterForm";
import styles from "./Search.module.css";

/** How long the − / + buttons wait for another tap before searching. */
const STEP_DELAY_MS = 500;

/** Clicks closer together than this are one tap delivered twice, not two taps. */
const DUPLICATE_TAP_MS = 60;

/**
 * The /registered Age filter: − [ age ] +, 1 to 99. Typing works too (the form
 * applies it once typing pauses). Empty means all ages: − from 1, or typing 0,
 * goes back to it. Without JavaScript the buttons do nothing and the field is a
 * plain number input.
 */
export function AgeStepper({ id, defaultValue }: { id: string; defaultValue: number | null }) {
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastStep = useRef(-Infinity);
  const apply = useApplyFilters();

  function step(by: 1 | -1, at: number) {
    const field = input.current;
    if (!field) return;
    // One tap, one step: simulated touch (e.g. Firefox's responsive mode) can deliver a
    // tap's click twice, milliseconds apart. No one taps that fast, so skip the second.
    if (at - lastStep.current < DUPLICATE_TAP_MS) return;
    lastStep.current = at;
    const now = field.value === "" ? null : Number(field.value);
    // From empty, + starts at 1; − from 1 goes back to all ages.
    const next = now === null ? (by > 0 ? 1 : null) : now + by;
    field.value = next === null || next < 1 ? "" : String(Math.min(next, 99));
    clearTimeout(timer.current);
    timer.current = setTimeout(apply, STEP_DELAY_MS);
  }

  return (
    <div className={styles.stepper}>
      <button
        type="button"
        onClick={(event) => step(-1, event.timeStamp)}
        aria-label="Younger"
        aria-controls={id}
      >
        −
      </button>
      <input
        ref={input}
        id={id}
        name="age"
        type="number"
        inputMode="numeric"
        min={1}
        max={99}
        placeholder="All ages"
        defaultValue={defaultValue ?? ""}
        // Typing "12" waits for the second digit instead of searching for 1 first.
        data-debounce=""
        // 0 isn't an age: clear it before the form applies (its handler runs after this one).
        onChange={(event) => {
          if (event.currentTarget.value !== "" && Number(event.currentTarget.value) < 1) {
            event.currentTarget.value = "";
          }
        }}
      />
      <button
        type="button"
        onClick={(event) => step(1, event.timeStamp)}
        aria-label="Older"
        aria-controls={id}
      >
        +
      </button>
    </div>
  );
}
