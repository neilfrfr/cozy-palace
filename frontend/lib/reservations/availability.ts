/** A stay that blocks a room: nights from check-in up to (not including) check-out. */
export type BookedRange = { roomId: string; checkIn: string; checkOut: string };

const DAY = 86_400_000;
const toTime = (date: string) => Date.parse(date + "T00:00:00Z");
const toDate = (time: number) => new Date(time).toISOString().slice(0, 10);

export function addDays(date: string, days: number) {
  return toDate(toTime(date) + days * DAY);
}

/** Every night (YYYY-MM-DD) taken by the ranges for one room. */
export function bookedNights(ranges: BookedRange[], roomId: string) {
  const nights = new Set<string>();
  for (const r of ranges) {
    if (r.roomId !== roomId) continue;
    for (let t = toTime(r.checkIn); t < toTime(r.checkOut); t += DAY)
      nights.add(toDate(t));
  }
  return nights;
}

/** Nights on which every listed room is taken, so no stay can include them. */
export function fullyBookedNights(ranges: BookedRange[], roomIds: string[]) {
  if (!roomIds.length) return new Set<string>();
  const perRoom = roomIds.map((id) => bookedNights(ranges, id));
  return new Set([...perRoom[0]].filter((n) => perRoom.every((s) => s.has(n))));
}

/**
 * The latest check-out for a stay starting on checkIn: the morning of the
 * first taken night after it, or undefined when nothing blocks the stay.
 */
export function latestCheckOut(checkIn: string, nights: Set<string>) {
  const after = [...nights].filter((n) => n > checkIn).sort();
  return after[0];
}
