"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <>
      <h1>Something interrupted your request.</h1>
      <p className="intro">
        Your last saved reservation is safe. Try loading this page again.
      </p>
      <button className="primary" onClick={() => reset()}>
        Try again
      </button>
    </>
  );
}
