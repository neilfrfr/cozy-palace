import Link from "next/link";
export function SetupNotice() {
  return (
    <div className="notice" role="status">
      <strong>Booking is not connected yet.</strong>
      <p>
        You can explore this prototype, but reservations cannot be saved until
        booking opens.
      </p>
      <Link className="text-link" href="/setup">
        Prototype setup information
      </Link>
    </div>
  );
}
