"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { reviewCalendarEventInline } from "./calendar-review-actions";
import { useCalendarUpdates } from "./EventSubmissionTable";

function Buttons({ approved, updating }: { approved: boolean; updating: boolean }) {
  const { pending, data } = useFormStatus();
  const publishing = data?.get("decision") === "publish";
  return <>
    <button type="submit" name="decision" value={approved ? "publish" : "approve"} disabled={pending} aria-busy={pending}
      title={approved ? updating ? "Update calendar" : "Publish to calendar" : "Approve event"}
      aria-label={approved ? updating ? "Update calendar" : "Publish to calendar" : "Approve event"}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-blue px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy disabled:opacity-60">
      <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {approved ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18m-10 5 2 2 4-4" /></> : <path d="m5 12 4 4L19 6" />}
      </svg>
      {pending ? publishing ? updating ? "Updating…" : "Publishing…" : "Approving…" : approved ? <span className="sr-only">{updating ? "Update calendar" : "Publish to calendar"}</span> : "Approve"}
    </button>
    {approved && <button type="submit" name="decision" value="approve" disabled={pending} aria-label="Reapprove event" title="Reapprove event"
      className="inline-grid size-8 place-items-center rounded-md border border-line text-blue hover:bg-paper-2 disabled:opacity-60">
      <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5m-4-4a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3" /></svg>
    </button>}
  </>;
}

export default function CalendarEventActions({ eventId, approved, updating = false }: { eventId: string; approved: boolean; updating?: boolean }) {
  const { statuses, update } = useCalendarUpdates();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const current = statuses[eventId];
  if (current === "Published") return <p role="status" className="text-xs text-emerald-800">Published to calendar.</p>;
  const isApproved = current === "Approved" || current === "Update approved" || approved;
  return <div className="space-y-2">
    <form action={async form => {
      setMessage(""); setError(false);
      try {
        const result = await reviewCalendarEventInline(form);
        if (result === "calendar-approved") {
          update(eventId, updating ? "Update approved" : "Approved");
          setMessage("Approved. Calendar unchanged.");
        } else if (result === "calendar-published") {
          update(eventId, "Published");
        } else {
          setError(true);
          setMessage(result === "calendar-approval-required" ? "The event changed. Reload and review it again." : result === "calendar-details" ? "Complete the public description, dates, location and vTools link before approval." : result === "calendar-forbidden" ? "You do not have calendar review access." : "The change could not be confirmed. Please try again.");
        }
      } catch {
        setError(true); setMessage("The change could not be confirmed. Please try again.");
      }
    }} className="flex items-center gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <Buttons approved={isApproved} updating={updating} />
    </form>
    {message && <p role={error ? "alert" : "status"} className={`max-w-48 text-xs ${error ? "text-red-700" : "text-ink-soft"}`}>{message}</p>}
  </div>;
}
