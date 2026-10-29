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
import { addDays } from "@/lib/reservations/availability";
import { bookTableAction, bookedTablesAction } from "@/app/actions/dining";
import { bookTableAsGuestAction } from "@/app/actions/guest-bookings";
import { Turnstile } from "@/components/turnstile";
import { PhoneField } from "@/components/phone-field";
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
  visitor = false,
  instead,
}: {
  tables: DiningTable[];
  /** Manila business date, from the server. */
  today: string;
  /** Staff booking on behalf of a guest: asks for their name and contact. */
  walkIn?: boolean;
  /** A visitor without an account: asks for their contact details and a CAPTCHA. */
  visitor?: boolean;
  /** Shown in place of the booking button, e.g. a sign-in link. */
  instead?: ReactNode;
}) {
  const [now] = useState(() => Date.now());
  // Guests book ahead; staff may seat a walk-in into a seating under way.
  const slotsOn = (day: string) =>
    diningSlots.filter((t) => {
      const start = Date.parse(slotStart(day, t));
      return walkIn ? start + SEATING_MS > now : start > now;
    });
  const [date, setDate] = useState(() =>
    slotsOn(today).length ? today : addDays(today, 1),
  );
  const [chosenTime, setChosenTime] = useState("");
  const [guests, setGuests] = useState(2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState<{ ok: boolean; text: ReactNode }>();
  const [pending, startTransition] = useTransition();
  const requestKey = useRef<string | null>(null);
  const [captcha, setCaptcha] = useState(""),
    [captchaRound, setCaptchaRound] = useState(0);
  const contact = walkIn || visitor;

  const lastDay = addDays(today, BOOKING_WINDOW_DAYS);
  const slots = slotsOn(date);
  const time = slots.includes(chosenTime) ? chosenTime : (slots[0] ?? "");
  const placed = tables.filter((t) => LAYOUT[t.table_number]);
  const fits = (t: DiningTable) =>
    t.operational_state === "available" &&
    t.capacity >= guests &&
    !booked.has(t.id);
  const selected = placed.find((t) => t.id === selectedId && fits(t));

  useEffect(() => {
    if (!time || date < today || date > lastDay) return;
    let live = true;
    bookedTablesAction({ date, time }).then(
      (ids) => live && setBooked(new Set(ids)),
    );
    return () => {
      live = false;
    };
  }, [date, time, today, lastDay, refresh]);

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
      ...(contact && {
        guestFullName: String(f.get("guestFullName") ?? ""),
        guestPhone: String(f.get("guestPhone") ?? ""),
        guestEmail: String(f.get("guestEmail") ?? ""),
      }),
    };
    setMessage(undefined);
    startTransition(async () => {
      const result = visitor
        ? await bookTableAsGuestAction(input, captcha)
        : await bookTableAction(input);
      if (visitor) {
        // The CAPTCHA token is single-use; show a fresh check for the next booking.
        setCaptcha("");
        setCaptchaRound((n) => n + 1);
      }
      if (!result.ok) {
        setMessage({ ok: false, text: diningError(result.code) });
        if (result.code === "AVAILABILITY_CONFLICT") setRefresh((n) => n + 1);
        return;
      }
      requestKey.current = null;
      setSelectedId(null);
      setRefresh((n) => n + 1);
      if (contact) form.reset();
      setMessage({
        ok: true,
        text: walkIn ? (
          `Table ${selected.table_number} booked for ${input.guestFullName} at ${time}. Reference ${result.data.reference}.`
        ) : visitor ? (
          `Table ${selected.table_number} requested for ${date} at ${time} (reference ${result.data.reference}). We have emailed the details to ${input.guestEmail}. It's held for you until our staff confirm it. To change or cancel, contact us and quote the reference.`
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
      <div className="table-picker-fields">
        <DatePicker
          name="date"
          label="Date"
          value={date}
          onChange={setDate}
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
              <option value="">No times left on this day</option>
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
      </div>
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
      {contact && (
        <div className="table-picker-fields contact">
          <label>
            {visitor ? "Full name" : "Guest name"}
            <input name="guestFullName" required maxLength={100} />
          </label>
          <PhoneField
            label={visitor ? "Mobile number" : "Phone (optional)"}
            required={visitor}
          />
          <label>
            {visitor ? "Email" : "Email (optional)"}
            <input
              name="guestEmail"
              type="email"
              maxLength={254}
              required={visitor}
            />
          </label>
        </div>
      )}
      {visitor && (
        <p className="subtle">
          No account needed. We email your booking details to you.{" "}
          <Link href="/login?next=/dining">Sign in</Link> instead to see your
          bookings in your account.
        </p>
      )}
      {visitor && (
        <Turnstile
          key={captchaRound}
          action="book_table"
          onToken={setCaptcha}
        />
      )}
      {message && (
        <div
          className={message.ok ? "notice" : "notice error"}
          role={message.ok ? "status" : "alert"}
        >
          {message.text}
        </div>
      )}
      {instead ?? (
        <button
          className="button"
          disabled={!selected || pending || (visitor && !captcha)}
        >
          {pending
            ? "Booking…"
            : walkIn
              ? "Book walk-in"
              : "Request this table"}
        </button>
      )}
    </form>
  );
}
