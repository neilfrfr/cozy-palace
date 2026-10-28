"use client";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import type { DiningTable } from "@/lib/inventory/service";
import { DatePicker } from "@/components/date-picker";
import { phoneCountries, phoneError } from "@/lib/phone";
import { addDays } from "@/lib/reservations/availability";
import { bookTableAction, bookedTablesAction } from "@/app/actions/dining";
import {
  BOOKING_WINDOW_DAYS,
  SEATING_MS,
  diningError,
  diningSlots,
  slotStart,
} from "@/lib/dining";

// Table centres on /design/dining/floor-plan.jpg, as % of width and height.
const LAYOUT: Record<string, { x: number; y: number; area: string }> = {
  T1: { x: 37.2, y: 48, area: "Booth" },
  T2: { x: 37.2, y: 60.5, area: "Booth" },
  T3: { x: 49.3, y: 48, area: "Booth" },
  T4: { x: 49.3, y: 60.5, area: "Booth" },
  T5: { x: 61.2, y: 43.6, area: "Indoor" },
  T6: { x: 61.2, y: 56.4, area: "Indoor" },
  T7: { x: 61.2, y: 69.1, area: "Indoor" },
  T8: { x: 37.6, y: 78.6, area: "Window" },
  T9: { x: 45.5, y: 78.6, area: "Window" },
  T10: { x: 53.8, y: 78.6, area: "Window" },
  P1: { x: 76.4, y: 22.5, area: "Patio" },
  P2: { x: 77, y: 35.3, area: "Patio" },
  P3: { x: 76.7, y: 48.3, area: "Patio" },
  P4: { x: 86.4, y: 68.5, area: "Patio" },
  P5: { x: 86.7, y: 25.2, area: "Patio umbrella" },
  P6: { x: 87.6, y: 48, area: "Patio umbrella" },
};

export function TablePicker({
  tables,
  today,
  walkIn = false,
  instead,
  publicGuest = false,
  draftFlow = false,
  deferAvailability = false,
  availabilityBar = false,
  initialDate,
  initialTime = "",
  initialGuests = 2,
}: {
  tables: DiningTable[];
  /** Manila business date, from the server. */
  today: string;
  /** Staff booking on behalf of a guest: asks for their name and contact. */
  walkIn?: boolean;
  /** Shown in place of the booking button, e.g. a sign-in link. */
  instead?: ReactNode;
  publicGuest?: boolean;
  draftFlow?: boolean;
  /** Keep the floor plan hidden until the guest checks the selected slot. */
  deferAvailability?: boolean;
  /** Use the public Dining booking-bar styling after availability is checked. */
  availabilityBar?: boolean;
  initialDate?: string;
  initialTime?: string;
  initialGuests?: number;
}) {
  const [now] = useState(() => Date.now());
  // Guests book ahead; staff may seat a walk-in into a seating under way.
  const slotsOn = (day: string) =>
    diningSlots.filter((t) => {
      const start = Date.parse(slotStart(day, t));
      return walkIn ? start + SEATING_MS > now : start > now;
    });
  const [date, setDate] = useState(() =>
    initialDate && initialDate >= today && initialDate <= addDays(today, BOOKING_WINDOW_DAYS)
      ? initialDate
      : deferAvailability
        ? ""
        : slotsOn(today).length ? today : addDays(today, 1),
  );
  const [chosenTime, setChosenTime] = useState(initialTime);
  const [guests, setGuests] = useState(initialGuests);
  const [phoneCountry, setPhoneCountry] = useState("+63");
  const [phoneDigits, setPhoneDigits] = useState("");
  const phoneProblem = publicGuest ? phoneError(phoneCountry, phoneDigits) : "";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [refresh, setRefresh] = useState(0);
  const [showPlan, setShowPlan] = useState(!deferAvailability);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: ReactNode }>();
  const [pending, startTransition] = useTransition();
  const requestKey = useRef<string | null>(null);

  const lastDay = addDays(today, BOOKING_WINDOW_DAYS);
  const slots = slotsOn(date);
  const time = slots.includes(chosenTime) ? chosenTime : (slots[0] ?? "");
  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  const placed = tables.filter((t) => LAYOUT[t.table_number]);
  const fits = (t: DiningTable) =>
    t.operational_state === "available" &&
    t.capacity >= guests &&
    !booked.has(t.id);
  const selected = placed.find((t) => t.id === selectedId && fits(t));

  useEffect(() => {
    if (!showPlan || !time || date < today || date > lastDay) return;
    let live = true;
    bookedTablesAction({ date, time }).then(
      (ids) => live && setBooked(new Set(ids)),
    );
    return () => {
      live = false;
    };
  }, [date, time, today, lastDay, refresh, showPlan]);

  function checkAvailability() {
    if (!dateIsValid || date < today || date > lastDay || !time) return;
    setChecking(true);
    const query = new URLSearchParams({ date, time, guests: String(guests) });
    window.location.assign(`/dining/availability?${query.toString()}`);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    requestKey.current ??= crypto.randomUUID();
    const input = {
      tableId: selected.id,
      date,
      time,
      guests,
      idempotencyKey: requestKey.current,
      ...(walkIn && {
        guestFullName: String(f.get("guestFullName") ?? ""),
        guestPhone: String(f.get("guestPhone") ?? ""),
        guestEmail: String(f.get("guestEmail") ?? ""),
      }),
      ...(publicGuest && {
        guestFullName: String(f.get("guestFullName") ?? ""),
        guestPhone: String(f.get("guestPhone") ?? ""),
        guestEmail: String(f.get("guestEmail") ?? ""),
      }),
    };
    setMessage(undefined);
    startTransition(async () => {
      const result = await bookTableAction(input);
      if (!result.ok) {
        setMessage({ ok: false, text: diningError(result.code) });
        if (result.code === "AVAILABILITY_CONFLICT") setRefresh((n) => n + 1);
        return;
      }
      requestKey.current = null;
      setSelectedId(null);
      setRefresh((n) => n + 1);
      if (walkIn || publicGuest) form.reset();
      setMessage({
        ok: true,
        text: publicGuest ? (
          <>Your table request is pending staff confirmation. Keep reference {result.data.reference}. <Link href="/reservations/lookup">Find your booking</Link>.</>
        ) : walkIn ? (
          `Table ${selected.table_number} booked for ${input.guestFullName} at ${time}. Reference ${result.data.reference}.`
        ) : (
          <>
            Table {selected.table_number} requested for {date} at {time}{" "}
            (reference {result.data.reference}). It&apos;s held for you until
            our staff confirm it. Track it in{" "}
            <Link href="/reservations">My Reservations</Link>.
          </>
        ),
      });
    });
  }

  return (
    <form className="table-picker" onSubmit={submit}>
      <div className={
        deferAvailability
          ? "search booking-bar dining-table-search has-submit"
          : availabilityBar
            ? "search booking-bar dining-table-search fields-only"
            : "table-picker-fields"
      }>
        <DatePicker
          name="date"
          label="Date"
          value={date}
          onChange={setDate}
          readOnly={deferAvailability || availabilityBar}
          required
          unavailable={(d) =>
            d < today
              ? "This date has passed."
              : d > lastDay
                ? `Tables can be booked up to ${BOOKING_WINDOW_DAYS} days ahead.`
                : ""
          }
        />
        <label>
          Time
          <select
            name="time"
            value={time}
            onChange={(e) => setChosenTime(e.target.value)}
            disabled={!slots.length}
          >
            {slots.length ? (
              slots.map((t) => <option key={t}>{t}</option>)
            ) : (
              <option value="">{date ? "No times left on this day" : "00:00"}</option>
            )}
          </select>
        </label>
        <label>
          Party size
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </label>
        {deferAvailability && !showPlan && (
          <button className="primary" type="button" onClick={checkAvailability} disabled={checking || !dateIsValid || !time || date < today || date > lastDay}>
          {checking ? "Loading tables…" : "Check Availability"}
          </button>
        )}
      </div>
      {showPlan && <>
      <div className="table-picker-map">
        <Image
          src="/design/dining/floor-plan.jpg"
          alt="Restaurant floor plan with the bar, booth tables, round tables and an outdoor patio"
          width={1024}
          height={683}
          sizes="(max-width: 1100px) 100vw, 1000px"
        />
        {placed.map((t) => {
          const { x, y, area } = LAYOUT[t.table_number];
          const open = fits(t) && !!time;
          const state =
            t.id === selected?.id ? "selected" : open ? "open" : "closed";
          return (
            <button
              key={t.id}
              type="button"
              className={"table-pin " + state}
              style={{ left: x + "%", top: y + "%" }}
              disabled={!open}
              aria-pressed={t.id === selected?.id}
              aria-label={`Table ${t.table_number}, ${area}, up to ${t.capacity} guests${open ? "" : booked.has(t.id) ? ", booked" : ", not available"}`}
              onClick={() => setSelectedId(t.id)}
            >
              {t.table_number}
            </button>
          );
        })}
      </div>
      <ul className="table-picker-legend" aria-hidden="true">
        <li className="open">Available</li>
        <li className="selected">Selected</li>
        <li className="closed">Booked, unavailable or too small</li>
      </ul>
      <p className="table-picker-summary" aria-live="polite">
        {selected
          ? `Table ${selected.table_number} · ${LAYOUT[selected.table_number].area} · up to ${selected.capacity} guests · ${date} at ${time}`
          : placed.length
            ? "Choose a table on the floor plan."
            : "No tables are on the floor plan yet."}
      </p>
      {(walkIn || publicGuest) && (
        <div className="table-picker-fields">
          <label>
            {publicGuest ? "Full name" : "Guest name"}
            <input name="guestFullName" autoComplete="name" required maxLength={100} />
          </label>
          <label>
            Phone{walkIn ? " (optional)" : ""}
            {publicGuest ? <span className="phone-entry">
              <select aria-label="Phone country code" value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value)}>
                {phoneCountries.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
              </select>
              <input type="tel" inputMode="numeric" autoComplete="tel-national" value={phoneDigits} onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, phoneCountries.find((c) => c.code === phoneCountry)?.digits ?? 15))} placeholder="Mobile number" required />
              <input type="hidden" name="guestPhone" value={phoneCountry + phoneDigits} />
              <small className="field-hint">{phoneDigits && phoneProblem ? phoneProblem : phoneCountries.find((c) => c.code === phoneCountry)?.rule}</small>
            </span> : <input name="guestPhone" type="tel" placeholder="+639171234567" maxLength={32} />}
          </label>
          <label>
            Email{walkIn ? " (optional)" : ""}
            <input name="guestEmail" type="email" maxLength={254} required={publicGuest} />
          </label>
        </div>
      )}
      {message && (
        <div
          className={message.ok ? "notice" : "notice error"}
          role={message.ok ? "status" : "alert"}
        >
          {message.text}
        </div>
      )}
      {instead ?? (publicGuest || draftFlow ? (
        <div className="actions table-picker-actions">
          <button className="primary gold" disabled={!selected || pending || !!phoneProblem}>
            {pending ? "Saving…" : "Save reservation draft"}
          </button>
          <Link className="button secondary" href={publicGuest ? "/reservations/lookup" : "/reservations"}>Back to reservations</Link>
        </div>
      ) : (
        <button className="button" disabled={!selected || pending}>
          {pending
            ? "Booking…"
            : walkIn
              ? "Book walk-in"
              : "Request this table"}
        </button>
      ))}
      </>}
    </form>
  );
}
