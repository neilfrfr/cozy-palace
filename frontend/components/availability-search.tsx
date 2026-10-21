import { StayDates } from "@/components/stay-dates";
import { businessDate } from "@/lib/operations/schema";
export function AvailabilitySearch({
  configured,
  defaults = {},
  variant,
  bookedNights = [],
}: {
  configured: boolean;
  defaults?: { checkIn?: string; checkOut?: string; guests?: string };
  /** "bar" renders the dark booking bar that overlaps a hero photo. */
  variant?: "bar";
  /** Nights with no room left, greyed out in the calendars. */
  bookedNights?: string[];
}) {
  return (
    <form
      className={variant === "bar" ? "search booking-bar" : "search"}
      action="/rooms"
    >
      <StayDates
        bookedNights={bookedNights}
        min={businessDate()}
        defaultCheckIn={defaults.checkIn}
        defaultCheckOut={defaults.checkOut}
      />
      <label>
        Guests
        <input
          type="number"
          name="guests"
          min="1"
          max="20"
          defaultValue={defaults.guests || "2"}
          required
        />
      </label>
      <button className="primary" type="submit" disabled={!configured}>
        Check availability
      </button>
    </form>
  );
}
