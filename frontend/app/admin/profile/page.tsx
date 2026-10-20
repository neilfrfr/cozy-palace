import Link from "next/link";
export default function AdminProfile() {
  return (
    <section className="profile-placeholder">
      <p className="eyebrow">ADMINISTRATION</p>
      <h1>My Profile</h1>
      <p className="intro">
        Administrator profile management is not available yet. Account details
        can be reviewed from Your Account.
      </p>
      <div className="actions">
        <Link className="button secondary" href="/account">Your Account</Link>
        <Link className="button" href="/admin">Management Overview</Link>
      </div>
    </section>
  );
}
