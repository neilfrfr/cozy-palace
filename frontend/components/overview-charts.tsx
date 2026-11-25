"use client";
import Link from "next/link";
import { useState } from "react";
import type {
  DayBookings,
  MonthTotal,
  RoomsTonight,
} from "@/lib/operations/overview";

const peso = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");
const shortPeso = (n: number) =>
  n >= 1000
    ? "₱" + Math.round(n / 1000).toLocaleString("en-PH") + "k"
    : peso(n);
const monthName = (m: string, style: "short" | "long" = "short") =>
  new Intl.DateTimeFormat("en-PH", { month: style, timeZone: "UTC" }).format(
    new Date(m + "-01T00:00:00Z"),
  );
const dayLabel = (d: string, style: "weekday" | "date") =>
  new Intl.DateTimeFormat(
    "en-PH",
    style === "weekday"
      ? { weekday: "short", timeZone: "UTC" }
      : { day: "numeric", month: "short", timeZone: "UTC" },
  ).format(new Date(d + "T00:00:00Z"));

const roomParts = [
  {
    key: "occupied",
    name: "Guests in",
    href: (today: string) =>
      `/staff/reservations?status=checked_in&date=${today}&staying=1`,
  },
  {
    key: "reserved",
    name: "Booked, not in yet",
    href: (today: string) =>
      `/staff/reservations?status=confirmed&date=${today}`,
  },
  { key: "available", name: "Free", href: () => "/admin/rooms" },
  { key: "closed", name: "Closed", href: () => "/admin/rooms" },
] as const;

/** Tonight's rooms as one bar; pointing at a legend row picks out its part of the bar. */
export function RoomsBar({
  rooms,
  today,
}: {
  rooms: RoomsTonight;
  today: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total =
    rooms.occupied + rooms.reserved + rooms.available + rooms.closed;
  return (
    <div className="overview-rooms" onMouseLeave={() => setActive(null)}>
      <div
        className="overview-rooms-bar"
        role="img"
        aria-label={roomParts
          .map((p) => `${rooms[p.key]} ${p.name.toLowerCase()}`)
          .join(", ")}
      >
        {roomParts.map((p) =>
          rooms[p.key] ? (
            <span
              key={p.key}
              className={`part-${p.key}`}
              data-dim={active && active !== p.key ? "" : undefined}
              style={{ flexGrow: rooms[p.key] }}
            />
          ) : null,
        )}
        {!total && <span className="part-empty" />}
      </div>
      <ul className="overview-legend">
        {roomParts.map((p) => (
          <li key={p.key}>
            <Link
              href={p.href(today)}
              onMouseEnter={() => setActive(p.key)}
              onFocus={() => setActive(p.key)}
              onBlur={() => setActive(null)}
            >
              <i className={`part-${p.key}`} aria-hidden="true" />
              <span>{p.name}</span>
              <strong>{rooms[p.key]}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Collected per month; point at or tab to a month to read it. */
export function RevenueTrend({ months }: { months: MonthTotal[] }) {
  const [picked, setPicked] = useState(months.length - 1);
  const max = Math.max(1, ...months.map((m) => m.amount));
  // Round the top of the scale up to a tidy figure so the gridlines read cleanly.
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  const W = 600,
    H = 220,
    left = 8,
    right = 8,
    topPad = 16,
    base = 190;
  const x = (i: number) =>
    left + (i * (W - left - right)) / Math.max(1, months.length - 1);
  const y = (v: number) => base - (v / top) * (base - topPad);
  const line = months.map((m, i) => `${x(i)},${y(m.amount)}`).join(" ");
  const now = months[picked];
  const latest = picked === months.length - 1;
  return (
    <div className="overview-trend">
      <p className="overview-readout" aria-live="polite">
        <span>
          {monthName(now.month, "long")}
          {latest ? " so far" : ""}
        </span>
        <strong>{peso(now.amount)}</strong>
      </p>
      <div className="overview-trend-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[0, 0.5, 1].map((f) => (
            <line
              key={f}
              x1={0}
              x2={W}
              y1={y(top * f)}
              y2={y(top * f)}
              className={f ? "grid" : "grid base"}
            />
          ))}
          <polygon
            points={`${x(0)},${base} ${line} ${x(months.length - 1)},${base}`}
            className="area"
          />
          <polyline points={line} className="line" />
          <line
            x1={x(picked)}
            x2={x(picked)}
            y1={topPad}
            y2={base}
            className="cursor"
          />
        </svg>
        <span
          className="overview-scale"
          style={{ top: `${(y(top) / H) * 100}%` }}
        >
          {shortPeso(top)}
        </span>
        <span
          className="overview-scale"
          style={{ top: `${(y(top / 2) / H) * 100}%` }}
        >
          {shortPeso(top / 2)}
        </span>
        {months.map((m, i) => (
          <button
            key={m.month}
            type="button"
            className="overview-point"
            aria-pressed={i === picked}
            aria-label={`${monthName(m.month, "long")}: ${peso(m.amount)}`}
            style={{
              left: `${(x(i) / W) * 100}%`,
              top: `${(y(m.amount) / H) * 100}%`,
            }}
            onMouseEnter={() => setPicked(i)}
            onFocus={() => setPicked(i)}
            onClick={() => setPicked(i)}
          />
        ))}
      </div>
      <div className="overview-axis" aria-hidden="true">
        {months.map((m, i) => (
          <span key={m.month} data-on={i === picked ? "" : undefined}>
            {monthName(m.month)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** New room and table bookings per day, over the last week or month. */
export function BookingBars({ days }: { days: DayBookings[] }) {
  const [span, setSpan] = useState<7 | 30>(7);
  const [picked, setPicked] = useState<number | null>(null);
  const shown = days.slice(-span);
  const max = Math.max(1, ...shown.map((d) => Math.max(d.rooms, d.tables)));
  const sum = (k: "rooms" | "tables") => shown.reduce((n, d) => n + d[k], 0);
  const day = picked === null ? null : shown[picked];
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  return (
    <div className="overview-bookings" onMouseLeave={() => setPicked(null)}>
      <div className="overview-bookings-head">
        <p className="overview-readout" aria-live="polite">
          <span>
            {day
              ? dayLabel(day.date, "date")
              : span === 7
                ? "Last 7 days"
                : "Last 30 days"}
          </span>
          <strong>
            {plural(day ? day.rooms : sum("rooms"), "room")} ·{" "}
            {plural(day ? day.tables : sum("tables"), "table")}
          </strong>
        </p>
        <div className="overview-switch" role="group" aria-label="Period">
          {([7, 30] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={span === n}
              onClick={() => {
                setSpan(n);
                setPicked(null);
              }}
            >
              {n} days
            </button>
          ))}
        </div>
      </div>
      <div className="overview-bars" data-span={span}>
        {shown.map((d, i) => (
          <button
            key={d.date}
            type="button"
            className="overview-bar"
            aria-pressed={picked === i}
            aria-label={`${dayLabel(d.date, "date")}: ${plural(d.rooms, "room")}, ${plural(d.tables, "table")}`}
            onMouseEnter={() => setPicked(i)}
            onFocus={() => setPicked(i)}
            onClick={() => setPicked(i)}
          >
            <i
              className="rooms"
              style={{ height: `${(d.rooms / max) * 100}%` }}
            />
            <i
              className="tables"
              style={{ height: `${(d.tables / max) * 100}%` }}
            />
          </button>
        ))}
      </div>
      <div className="overview-axis" aria-hidden="true">
        {shown.map((d, i) => (
          <span key={d.date} data-on={picked === i ? "" : undefined}>
            {span === 7
              ? i === shown.length - 1
                ? "Today"
                : dayLabel(d.date, "weekday")
              : i % 5 === 4 || i === shown.length - 1
                ? dayLabel(d.date, "date")
                : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
