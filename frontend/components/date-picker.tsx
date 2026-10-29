"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays } from "@/lib/reservations/availability";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const asDate = (iso: string) => new Date(iso + "T00:00:00Z");
const isRealDate = (v: string) =>
  ISO.test(v) && asDate(v).toISOString().slice(0, 10) === v;
const firstOfMonth = (iso: string) => iso.slice(0, 8) + "01";
const shiftMonth = (iso: string, by: number) => {
  const d = asDate(firstOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 10);
};

export type DatePickerProps = {
  name: string;
  label: string;
  /** Controlled value; leave out and use defaultValue for an uncontrolled field. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Why a date can't be picked, or "" when it can. */
  unavailable?: (date: string) => string;
  /** Month to show when nothing is selected yet. */
  initialMonth?: string;
  required?: boolean;
  readOnly?: boolean;
  className?: string;
};

/**
 * Text date field (YYYY-MM-DD) with a month calendar. Dates the caller marks
 * unavailable are greyed out and can't be picked or typed.
 */
export function DatePicker({
  name,
  label,
  value: controlled,
  defaultValue = "",
  onChange: notify,
  unavailable = () => "",
  initialMonth,
  required,
  readOnly = false,
  className,
}: DatePickerProps) {
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const onChange = (next: string) => {
    if (controlled === undefined) setOwn(next);
    notify?.(next);
  };
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    firstOfMonth(isRealDate(value) ? value : (initialMonth ?? today())),
  );
  const [active, setActive] = useState(() =>
    isRealDate(value) ? value : (initialMonth ?? today()),
  );
  const [focusGrid, setFocusGrid] = useState(false);

  const problem = !value
    ? ""
    : !isRealDate(value)
      ? "Enter a date as YYYY-MM-DD."
      : unavailable(value);
  useEffect(() => {
    input.current?.setCustomValidity(problem);
  }, [problem]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (open && focusGrid)
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${active}"]`)
        ?.focus();
  }, [open, focusGrid, active]);

  function show(withFocus: boolean) {
    const start = isRealDate(value) ? value : (initialMonth ?? today());
    setActive(start);
    setMonth(firstOfMonth(start));
    setFocusGrid(withFocus);
    setOpen(true);
  }
  function pick(date: string) {
    onChange(date);
    setOpen(false);
    setFocusGrid(false);
    input.current?.focus();
  }
  function move(to: string) {
    setActive(to);
    if (firstOfMonth(to) !== month) setMonth(firstOfMonth(to));
  }
  function onGridKey(event: KeyboardEvent) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in steps) {
      event.preventDefault();
      move(addDays(active, steps[event.key]));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      move(shiftMonth(active, event.key === "PageUp" ? -1 : 1));
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      input.current?.focus();
    }
  }

  const start = addDays(month, -asDate(month).getUTCDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const now = today();
  const describedBy = problem ? `${id}-problem` : undefined;

  return (
    <div className={"date-field" + (className ? " " + className : "")} ref={wrapper}>
      <label htmlFor={id}>{label}</label>
      <div className="date-input">
        <input
          ref={input}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="YYYY-MM-DD"
          pattern="\d{4}-\d{2}-\d{2}"
          maxLength={10}
          required={required}
          readOnly={readOnly}
          value={value}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${id}-calendar` : undefined}
          aria-invalid={problem ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value.trim())}
          onClick={() => !open && show(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || (event.altKey && event.key === "ArrowDown")) {
              event.preventDefault();
              show(true);
            } else if (event.key === "Escape") setOpen(false);
          }}
        />
        <CalendarDays className="date-input-icon" aria-hidden="true" size={18} />
      </div>
      {problem && (
        <p className="field-hint error" id={describedBy}>
          {problem}
        </p>
      )}
      {open && (
        <div
          className="calendar"
          id={`${id}-calendar`}
          role="dialog"
          aria-label={`Choose ${label}`}
        >
          <div className="calendar-head">
            <button
              type="button"
              className="calendar-nav"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <p aria-live="polite">{monthLabel.format(asDate(month))}</p>
            <button
              type="button"
              className="calendar-nav"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="calendar-grid" role="grid" ref={grid} onKeyDown={onGridKey}>
            <div role="row" className="calendar-row">
              {WEEKDAYS.map((d) => (
                <span role="columnheader" key={d} className="calendar-weekday">
                  {d}
                </span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, w) => (
              <div role="row" className="calendar-row" key={w}>
                {days.slice(w * 7, w * 7 + 7).map((date) => {
                  const reason = unavailable(date);
                  const outside = firstOfMonth(date) !== month;
                  return (
                    <span role="gridcell" key={date}>
                      <button
                        type="button"
                        data-date={date}
                        className={
                          "calendar-day" +
                          (outside ? " outside" : "") +
                          (date === value ? " selected" : "") +
                          (date === now ? " today" : "")
                        }
                        tabIndex={date === active ? 0 : -1}
                        aria-disabled={reason ? true : undefined}
                        aria-pressed={date === value}
                        aria-label={dayLabel.format(asDate(date)) + (reason ? `, ${reason}` : "")}
                        title={reason || undefined}
                        onClick={() => !reason && pick(date)}
                        onFocus={() => setActive(date)}
                      >
                        {Number(date.slice(8))}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="calendar-legend">
            <span className="calendar-swatch" aria-hidden="true" /> Greyed-out
            dates can&apos;t be selected.
          </p>
        </div>
      )}
    </div>
  );
}

/** Today in Asia/Manila, the hotel's time zone. */
function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}
