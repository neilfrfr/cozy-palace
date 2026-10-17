"use client";
import { useActionState } from "react";
import { profileAction } from "@/app/account/actions";
export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string;
}) {
  const [state, submit, pending] = useActionState(profileAction, {
    message: "",
    success: false,
  });
  return (
    <form action={submit} className="form-panel">
      <div className="form-grid">
        <label className="full">
          Full name
          <input
            name="fullName"
            defaultValue={fullName}
            maxLength={100}
            autoComplete="name"
            required
          />
        </label>
        <label className="full">
          Phone number (optional)
          <input
            name="phone"
            type="tel"
            defaultValue={phone}
            maxLength={30}
            autoComplete="tel"
          />
        </label>
      </div>
      {state.message && (
        <p
          className={"notice " + (state.success ? "" : "error")}
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      <button className="primary" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
