"use client";
import { useMemo, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { addDays, latestCheckOut } from "@/lib/reservations/availability";

/**
 * Check-in and check-out calendars for one stay. Nights listed in
 * `bookedNights` are greyed out, and check-out can't run past the next booked
 * night after check-in.
 */
export function StayDates({
  bookedNights,
  min,
  defaultCheckIn = "",
  defaultCheckOut = "",
  className,
}: {
  bookedNights: string[];
  /** Earliest check-in (YYYY-MM-DD). */
  min: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  className?: string;
}) {
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const nights = useMemo(() => new Set(bookedNights), [bookedNights]);
  const validCheckIn = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) ? checkIn : "";
  const lastOut = validCheckIn ? latestCheckOut(validCheckIn, nights) : undefined;

  const checkInProblem = (date: string) => {
    if (date < min) return "in the past";
    if (nights.has(date)) return "already booked";
    return "";
  };
  const checkOutProblem = (date: string) => {
    if (validCheckIn) {
      if (date <= validCheckIn) return "must be after check-in";
      if (lastOut && date > lastOut) return "stay would include a booked night";
      return "";
    }
    if (date <= min) return "in the past";
    // Leaving on this date means staying the night before it.
    if (nights.has(addDays(date, -1))) return "already booked";
    return "";
  };

  return (
    <>
      <DatePicker
        name="checkIn"
        label="Check-in"
        value={checkIn}
        required
        className={className}
        initialMonth={min}
        unavailable={checkInProblem}
        onChange={(date) => {
          setCheckIn(date);
          if (checkOut && /^\d{4}-\d{2}-\d{2}$/.test(date) && checkOut <= date)
            setCheckOut("");
        }}
      />
      <DatePicker
        name="checkOut"
        label="Check-out"
        value={checkOut}
        required
        className={className}
        initialMonth={validCheckIn ? addDays(validCheckIn, 1) : addDays(min, 1)}
        unavailable={checkOutProblem}
        onChange={setCheckOut}
      />
    </>
  );
}
