import Link from "next/link";
export default function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <h1>Cozy Palace Hotel and Restaurant</h1>
          <p>
            A little room to slow down. Plan your next stay, keep your details
            together, and follow your reservation from request to arrival.
          </p>
          <div className="hero-links">
            <Link href="/rooms" className="button">
              Explore rooms
            </Link>
            <Link href="/reservations" className="button secondary">
              View my reservations
            </Link>
          </div>
        </div>
        <aside className="hero-panel">
          <h2>Your stay, in one place.</h2>
          <p>
            Choose a room, review your dates, and send your booking request.
            Return whenever you need to check its progress.
          </p>
          <Link href="/login">Sign in to your account →</Link>
        </aside>
      </section>
      <section className="section">
        <h2>Make yourself at home.</h2>
        <div className="feature-row">
          <h3>Find the right room</h3>
          <p>
            Check your dates and guest count before you reserve. You can review
            every detail in a draft before sending your request.
          </p>
        </div>
        <div className="feature-row">
          <h3>Keep track of your stay</h3>
          <p>
            Your account keeps your reservations together, with clear dates,
            booking references, and status updates.
          </p>
        </div>
        <div className="feature-row">
          <h3>Dining, coming next</h3>
          <p>
            Restaurant reservations and purchase history are part of the next
            release. This prototype focuses on your hotel booking.
          </p>
        </div>
      </section>
    </>
  );
}
