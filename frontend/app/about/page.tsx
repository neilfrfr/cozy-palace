import Link from "next/link";
export default function About() {
  return (
    <>
      <p className="eyebrow">COZY PALACE</p>
      <h1>Your stay, in one place.</h1>
      <p className="intro">
        Cozy Palace Hotel and Restaurant brings hotel reservations and
        restaurant information together.
      </p>
      <div className="grid">
        <section className="panel">
          <h2>Plan your stay</h2>
          <p>
            Browse the current room inventory, choose dates and guests, and
            review your reservation before sending a request.
          </p>
          <Link href="/rooms">Explore rooms →</Link>
        </section>
        <section className="panel">
          <h2>Keep your details together</h2>
          <p>
            Sign in to view your own reservations and follow their status from
            request to arrival.
          </p>
          <Link href="/reservations">My reservations →</Link>
        </section>
      </div>
      <p className="notice">
        This is a development prototype with fictional inventory. It is not
        accepting real commercial bookings.
      </p>
    </>
  );
}
