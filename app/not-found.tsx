import Link from "next/link";
export default function NotFound() {
  return (
    <>
      <h1>We couldn’t find that page.</h1>
      <p className="intro">Check the link, or return to your reservations.</p>
      <Link href="/reservations" className="button">
        My reservations
      </Link>
    </>
  );
}
