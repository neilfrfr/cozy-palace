const codes = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VERSION_CONFLICT",
  "INVALID_INPUT",
  "INVALID_TRANSITION",
  "CAPACITY_EXCEEDED",
  "RESOURCE_UNAVAILABLE",
  "IDEMPOTENCY_CONFLICT",
  "POLICY_RESTRICTED",
  "AVAILABILITY_CONFLICT",
];
export function publicError(error: unknown): string {
  if (!error || typeof error !== "object") return "REQUEST_FAILED";
  const e = error as { code?: string; message?: string };
  if (e.code === "23P01") return "AVAILABILITY_CONFLICT";
  return codes.includes(e.message ?? "") ? e.message! : "REQUEST_FAILED";
}
export const errorMessages: Record<string, string> = {
  UNAUTHORIZED: "Please sign in to continue.",
  FORBIDDEN: "You do not have access to this reservation.",
  NOT_FOUND: "This reservation could not be found.",
  VERSION_CONFLICT:
    "This reservation has changed. Refresh before trying again.",
  INVALID_INPUT: "Check the dates and guest count.",
  INVALID_TRANSITION:
    "This action is not available for the current booking status.",
  CAPACITY_EXCEEDED: "Choose a room with enough space for your guests.",
  RESOURCE_UNAVAILABLE: "This room is not available for booking.",
  IDEMPOTENCY_CONFLICT:
    "This request has already been used. Refresh and try again.",
  POLICY_RESTRICTED: "Please contact the staff to make this change.",
  AVAILABILITY_CONFLICT:
    "Someone has booked this room for those dates. Choose another room or date.",
  REQUEST_FAILED: "We could not save your changes. Please try again.",
};
