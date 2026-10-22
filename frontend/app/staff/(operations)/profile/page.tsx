import Link from "next/link";
export default function StaffProfile() {
  return (
    <section className="profile-placeholder">
      <p className="eyebrow">STAFF WORKSPACE</p>
      <h1>My Profile</h1>
      <p className="intro">
        Staff profile management is not available yet. Ask an administrator to
        update your employee details.
      </p>
      <Link className="button secondary" href="/staff">Back to Work Overview</Link>
    </section>
  );
}
