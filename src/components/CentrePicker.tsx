"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { Centre } from "@/lib/centres";
import { foldText } from "@/models/filters";
import { useApplyFilters, useHydrated } from "./FilterForm";
import styles from "./Search.module.css";

const ALL = 0;

/** Order-independent key for a set of centre ids. */
const idsKey = (ids: readonly number[]) => [...ids].sort((a, b) => a - b).join(",");

/**
 * Community centre picker: a dropdown you can type into to narrow the list,
 * where you tick one or more centres. Chosen centres show as removable chips.
 * Only listed centres can be chosen. Follows the ARIA combobox pattern with a
 * multi-select listbox. Without JavaScript it's a plain single <select>.
 */
export function CentrePicker({
  id,
  centres,
  selectedIds,
}: {
  id: string;
  centres: readonly Centre[];
  selectedIds: readonly number[];
}) {
  const live = useHydrated();
  if (!live) {
    return (
      <select id={id} name="centre" defaultValue={selectedIds[0] ?? ""}>
        <option value="">All centres</option>
        {centres.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    );
  }
  return <Combobox id={id} centres={centres} selectedIds={selectedIds} />;
}

function Combobox({
  id,
  centres,
  selectedIds,
}: {
  id: string;
  centres: readonly Centre[];
  selectedIds: readonly number[];
}) {
  const apply = useApplyFilters();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const [chosen, setChosen] = useState<number[]>([...selectedIds]);
  const [text, setText] = useState("");

  // Follow the URL when something else changes the centres (e.g. a card's
  // centre link), but not when the URL is just catching up with our own picks.
  const incoming = idsKey(selectedIds);
  const [seen, setSeen] = useState(incoming);
  const [pending, setPending] = useState<string[]>([]);
  if (incoming !== seen) {
    setSeen(incoming);
    const ours = pending.indexOf(incoming);
    if (ours >= 0) {
      setPending(pending.slice(ours + 1));
    } else {
      setChosen([...selectedIds]);
      setPending([]);
    }
  }
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // "All centres" first, then every centre whose name contains all typed words.
  const options = useMemo(() => {
    const words = foldText(text).split(" ").filter(Boolean);
    const matches = centres.filter((c) => words.every((w) => foldText(c.name).includes(w)));
    return words.length ? matches : [{ id: ALL, name: "All centres" }, ...matches];
  }, [centres, text]);

  function commit(next: number[]) {
    setChosen(next);
    // A value the URL already shows never "arrives", so it can't stay pending.
    const key = idsKey(next);
    setPending((p) => (key === seen ? [] : [...p, key]));
    // Written now (not on re-render) because apply() reads the form straight away.
    if (hidden.current) hidden.current.value = next.join(",");
    apply();
  }

  /** Ticks or unticks a centre; "All centres" clears the selection. The list stays open. */
  function toggle(centreId: number) {
    if (centreId === ALL) {
      if (chosen.length) commit([]);
    } else {
      commit(
        chosen.includes(centreId) ? chosen.filter((c) => c !== centreId) : [...chosen, centreId],
      );
    }
    setText("");
    input.current?.focus();
  }

  function close() {
    setOpen(false);
    setText("");
  }

  function show() {
    setOpen(true);
    setActive(0);
  }

  const activeOption = open ? options[active] : undefined;
  const optionId = (centreId: number) => `${listId}-${centreId}`;
  const isSelected = (centreId: number) =>
    centreId === ALL ? chosen.length === 0 : chosen.includes(centreId);
  const placeholder =
    chosen.length === 0
      ? "All centres"
      : `${chosen.length} ${chosen.length === 1 ? "centre" : "centres"} · type to add`;

  return (
    <div
      ref={root}
      className={styles.combo}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <input ref={hidden} type="hidden" name="centre" value={chosen.join(",")} readOnly />
      <div className={styles.comboBox}>
        <input
          ref={input}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOption ? optionId(activeOption.id) : undefined}
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onClick={() => (open ? close() : show())}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) return show();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((i) => (i + step + options.length) % Math.max(options.length, 1));
            } else if (event.key === "Enter") {
              event.preventDefault(); // don't submit the form
              if (open && activeOption) toggle(activeOption.id);
            } else if (event.key === "Escape" && open) {
              event.preventDefault(); // close the list, not the sheet
              close();
            } else if (event.key === "Backspace" && !text && chosen.length) {
              commit(chosen.slice(0, -1));
            }
          }}
        />
        <button
          type="button"
          className={styles.comboToggle}
          tabIndex={-1}
          aria-label="Show centres"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            input.current?.focus();
            if (open) close();
            else show();
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeWidth="2" d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Community centres"
            aria-multiselectable="true"
            className={styles.comboList}
          >
            {options.length === 0 && <li className={styles.comboEmpty}>No centre matches</li>}
            {options.map((option, index) => (
              <li
                key={option.id}
                id={optionId(option.id)}
                role="option"
                aria-selected={isSelected(option.id)}
                data-active={index === active}
                className={styles.comboOption}
                onMouseDown={(event) => event.preventDefault()} // keep focus in the input
                onMouseEnter={() => setActive(index)}
                onClick={() => toggle(option.id)}
              >
                <span className={styles.comboCheck} aria-hidden="true" />
                {option.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {chosen.length > 0 && (
        <ul className={styles.comboChips} aria-label="Chosen centres">
          {chosen.map((centreId) => {
            const name = centres.find((c) => c.id === centreId)?.name ?? `Centre ${centreId}`;
            return (
              <li key={centreId}>
                <button
                  type="button"
                  className={styles.comboChip}
                  aria-label={`Remove ${name}`}
                  onClick={() => commit(chosen.filter((c) => c !== centreId))}
                >
                  {name} <span aria-hidden="true">✕</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
