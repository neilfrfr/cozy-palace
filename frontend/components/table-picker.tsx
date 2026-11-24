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
import { useRouter } from "next/navigation";
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
  slotLabel,
  slotStart,
} from "@/lib/dining";
import { planSpot } from "@/lib/floor-plan";


export function TablePicker({
  tables,
  today,
  walkIn = false,
  visitor = false,
  instead,
  draftFlow = false,
  deferAvailability = false,
  availabilityBar = false,
  initialDate,
  initialTime = "",
  initialGuests,
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
  /** Label the customer request action as a saved reservation draft. */
  draftFlow?: boolean;
  /** Show only the slot search until the guest checks availability. */
  deferAvailability?: boolean;
  /** Keep the slot controls in the booking bar on the table-selection page. */
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
  const [guests, setGuests] = useState<number | "">(initialGuests ?? 2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [refresh, setRefresh] = useState(0);
  const showPlan = !deferAvailability;
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: ReactNode }>();
  const [pending, startTransition] = useTransition();
  const requestKey = useRef<string | null>(null);
  const [captcha, setCaptcha] = useState(""),
    [captchaRound, setCaptchaRound] = useState(0);
  const contact = walkIn || visitor;

  const lastDay = addDays(today, BOOKING_WINDOW_DAYS);
  const slots = slotsOn(date);
  const time = slots.includes(chosenTime)
    ? chosenTime
    : deferAvailability || availabilityBar
      ? ""
      : (slots[0] ?? "");
  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  const placed = tables.filter((t) => planSpot(t.table_number));
  const others = tables.filter((t) => !planSpot(t.table_number));
  const areaOf = (t: DiningTable) => planSpot(t.table_number)?.area ?? "Other table";
  const fits = (t: DiningTable) =>
    t.operational_state === "available" &&
    typeof guests === "number" &&
    t.capacity >= guests &&
    !booked.has(t.id);
  const selected = tables.find((t) => t.id === selectedId && fits(t));

  useEffect(() => {
    if ((deferAvailability && !showPlan) || !time || date < today || date > lastDay) return;
    let live = true;
    bookedTablesAction({ date, time }).then(
      (ids) => live && setBooked(new Set(ids)),
    );
    return () => {
      live = false;
    };
  }, [date, time, today, lastDay, refresh, deferAvailability, showPlan]);

  function pin(t: DiningTable, at?: { left: string; top: string }) {
    const open = fits(t) && !!time;
    const state =
      t.id === selected?.id ? "selected" : open ? "open" : "closed";
    return (
      <button
        key={t.id}
        type="button"
        className={"table-pin " + state + (at ? "" : " table-pin-other")}
        style={at}
        disabled={!open}
        aria-pressed={t.id === selected?.id}
        aria-label={`Table ${t.table_number}, ${areaOf(t)}, up to ${t.capacity} guests${open ? "" : booked.has(t.id) ? ", booked" : ", not available"}`}
        onClick={() => setSelectedId(t.id)}
      >
        {t.table_number}
        {!at && <small>{t.capacity} seats</small>}
      </button>
    );
  }

  function checkAvailability() {
    if (!dateIsValid || date < today || date > lastDay || !time || typeof guests !== "number") return;
    setChecking(true);
    const query = new URLSearchParams({ date, time, guests: String(guests) });
    router.push(`/dining/availability?${query.toString()}`);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || typeof guests !== "number") return;
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
          `Table ${selected.table_number} booked for ${input.guestFullName} at ${slotLabel(time)}. Reference ${result.data.reference}.`
        ) : visitor ? (
          `Table ${selected.table_number} requested for ${date} at ${slotLabel(time)} (reference ${result.data.reference}). We have emailed the details to ${input.guestEmail}. It's held for you until our staff confirm it. To change or cancel, contact us and quote the reference.`
        ) : (
          <>
            Table {selected.table_number} requested for {date} at {slotLabel(time)}{" "}
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
          unavailable={(d) => {
            if (d < today) return "This date has passed.";
            if (d > lastDay) return `Tables can be booked up to ${BOOKING_WINDOW_DAYS} days ahead.`;
            const dateSlots = slotsOn(d);
            if (chosenTime && !dateSlots.includes(chosenTime)) return "That time is unavailable on this date.";
            if (!dateSlots.length) return "No times remain on this date.";
            return "";
          }}
        />
        <label>
          Time
          <select
            name="time"
            value={time}
            onChange={(e) => setChosenTime(e.target.value)}
            className={!time ? "unselected" : undefined}
          >
            <option value="">Select time</option>
            {diningSlots.map((t) => (
              <option key={t} value={t} disabled={!!date && !slots.includes(t)}>{slotLabel(t)}</option>
            ))}
          </select>
        </label>
        <label>
          Party size
          <input
            type="number"
            min="1"
            max="7"
            step="1"
            required
            value={guests}
            className={guests === "" ? "unselected" : undefined}
            onChange={(e) => {
              const raw = e.currentTarget.value;
              if (!raw) {
                setGuests("");
                return;
              }
              const next = Number(raw);
              if (Number.isFinite(next))
                setGuests(Math.max(1, Math.min(7, Math.trunc(next))));
            }}
          />
        </label>
        {deferAvailability && !showPlan && (
          <button className="primary" type="button" onClick={checkAvailability} disabled={checking || !dateIsValid || !time || typeof guests !== "number" || date < today || date > lastDay}>
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
          const spot = planSpot(t.table_number)!;
          return pin(t, { left: spot.x + "%", top: spot.y + "%" });
        })}
      </div>
      {others.length > 0 && (
        <div className="table-picker-others">
          <p>Other tables (not shown on the floor plan)</p>
          <div>{others.map((t) => pin(t))}</div>
        </div>
      )}
      <ul className="table-picker-legend" aria-hidden="true">
        <li className="open">Available</li>
        <li className="selected">Selected</li>
        <li className="closed">Booked, unavailable or too small</li>
      </ul>
      <p className="table-picker-summary" aria-live="polite">
        {selected
          ? `Table ${selected.table_number} · ${areaOf(selected)} · up to ${selected.capacity} guests · ${date} at ${slotLabel(time)}`
          : !tables.length
            ? "No tables are listed yet."
            : others.length
              ? "Choose a table on the floor plan or below it."
              : "Choose a table on the floor plan."}
      </p>
      {contact && (
        <div className="table-picker-fields contact">
          <label>
            {visitor ? "Full name" : "Guest name"}
            <input name="guestFullName" required maxLength={100} />
          </label>
          <PhoneField label={visitor ? "Mobile number" : "Phone"} required />
          <label>
            Email
            <input name="guestEmail" type="email" maxLength={254} required />
          </label>
        </div>
      )}
      {visitor && (
        <p className="subtle">
          No account needed. We email your booking details to you.{" "}
          <Link href="/login?next=/dining">Sign in</Link> instead to see your
          bookings in your account. Read our{" "}
          <Link href="/privacy">Privacy Notice</Link>.
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
      {instead ?? (draftFlow ? (
        <div className="actions table-picker-actions">
          <button className="primary gold" disabled={!selected || pending || (visitor && !captcha)}>
            {pending ? "Saving…" : "Save reservation draft"}
          </button>
          <Link className="button secondary" href={visitor ? "/find-reservation" : "/reservations"}>
            Back to reservations
          </Link>
        </div>
      ) : (
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
      ))}
      </>}
    </form>
  );
}
