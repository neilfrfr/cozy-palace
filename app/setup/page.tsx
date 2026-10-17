import Link from "next/link";
export default function Setup() {
  return (
    <>
      <h1>Booking will be available soon.</h1>
      <p className="intro">
        This prototype is ready to connect to an isolated development
        environment. It does not accept or save bookings yet.
      </p>
      <div className="form-panel">
        <h2>For the project team</h2>
        <ol>
          <li>Create or select a dedicated Supabase development project.</li>
          <li>Apply the versioned migrations and fictional inventory seed.</li>
          <li>
            Set the two public Supabase environment variables from{" "}
            <code>.env.example</code>.
          </li>
          <li>
            Create customer test accounts and assign staff roles through a
            trusted database session.
          </li>
          <li>
            Run the database, authentication, browser and concurrency checks in
            the README.
          </li>
        </ol>
        <p className="subtle">
          Do not connect Preview deployments to a production database.
        </p>
      </div>
      <div className="actions">
        <Link href="/rooms" className="button secondary">
          Back to rooms
        </Link>
      </div>
    </>
  );
}
