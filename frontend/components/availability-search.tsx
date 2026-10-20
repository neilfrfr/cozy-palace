export function AvailabilitySearch({
  configured,
  defaults = {},
  variant,
}: {
  configured: boolean;
  defaults?: { checkIn?: string; checkOut?: string; guests?: string };
  /** "bar" renders the dark booking bar that overlaps a hero photo. */
  variant?: "bar";
}) {
  return (
    <form
      className={variant === "bar" ? "search booking-bar" : "search"}
      action="/rooms"
    >
      <label>
        Check-in
        <input
          type="date"
          name="checkIn"
          required
          defaultValue={defaults.checkIn}
        />
      </label>
      <label>
        Check-out
        <input
          type="date"
          name="checkOut"
          required
          defaultValue={defaults.checkOut}
        />
      </label>
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
