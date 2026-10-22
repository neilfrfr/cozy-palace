"use client";
import { useActionState } from "react";
import { staffAction } from "@/app/admin/staff/actions";
export type StaffMember = {
  id: string;
  employee_code: string;
  email: string;
  full_name: string;
  job_title: string;
  state: "pending" | "active";
  version: number;
};
const jobTitles = [
  "Hotel Receptionist",
  "Hotel Reservation Agent",
  "Hotel Bell Attendant",
  "Hotel Room Attendant",
  "Hotel Maintenance Technician",
  "Restaurant Waiter",
  "Restaurant Bartender",
  "Restaurant Chef",
  "Room Service Attendant",
];
export function StaffEditor({ member }: { member?: StaffMember }) {
  const [state, submit, pending] = useActionState(staffAction, {
    message: "",
    success: false,
  });
  return (
    <form action={submit} className="form-panel staff-editor">
      {member && (
        <>
          <input type="hidden" name="id" value={member.id} />
          <input type="hidden" name="version" value={member.version} />
        </>
      )}
      {member && (
        <div className="staff-code">
          <strong>{member.employee_code}</strong>
          <span className={"status " + member.state}>{member.state}</span>
        </div>
      )}
      <div className="form-grid">
        <label>
          Full name
          <input
            name="fullName"
            defaultValue={member?.full_name}
            maxLength={100}
            required
          />
        </label>
        <label>
          Job title
          <select name="jobTitle" defaultValue={member?.job_title ?? ""} required>
            {!member && <option value="" disabled>Select a job title</option>}
            {member && !jobTitles.includes(member.job_title) && (
              <option value={member.job_title}>{member.job_title}</option>
            )}
            {jobTitles.map((title) => <option key={title} value={title}>{title}</option>)}
          </select>
        </label>
        {member ? (
          <p className="full">
            {member.email} ·{" "}
            <strong>
              {member.state === "pending"
                ? "Awaiting verified signup"
                : "Active staff"}
            </strong>
          </p>
        ) : (
          <label className="full">
            Employee email
            <input name="email" type="email" maxLength={254} required />
          </label>
        )}
      </div>
      {state.message && (
        <p
          className={"notice " + (state.success ? "" : "error")}
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      <div className="actions">
        <button
          className="primary"
          name="operation"
          value={member ? "update" : "create"}
          disabled={pending}
        >
          {pending
            ? "Saving…"
            : member
              ? "Save staff details"
              : "Add staff member"}
        </button>
      </div>
      {member && (
        <div className="staff-removal">
          <label>
            <input type="checkbox" name="confirmDeletion" /> Confirm removal and
            revoke employee access
          </label>
          <button
            className="secondary"
            name="operation"
            value="delete"
            formNoValidate
            disabled={pending}
          >
            Remove staff member
          </button>
        </div>
      )}
    </form>
  );
}
