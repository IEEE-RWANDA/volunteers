"use client";

import { useFormStatus } from "react-dom";
import { decideCalendarEvent } from "./calendar-review-actions";

function Buttons({ approved, updating }: { approved: boolean; updating: boolean }) {
  const { pending, data } = useFormStatus();
  const publishing = data?.get("decision") === "publish";
  return <>
    <button type="submit" name="decision" value={approved ? "publish" : "approve"} disabled={pending} aria-busy={pending}
      aria-label={approved ? updating ? "Update calendar" : "Publish to calendar" : "Approve event"}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-blue px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy disabled:opacity-60">
      <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {approved ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18m-10 5 2 2 4-4" /></> : <path d="m5 12 4 4L19 6" />}
      </svg>
      {pending ? publishing ? updating ? "Updating…" : "Publishing…" : "Approving…" : approved ? updating ? "Update calendar" : "Publish" : "Approve"}
    </button>
    {approved && <button type="submit" name="decision" value="approve" disabled={pending} aria-label="Reapprove event" title="Reapprove event"
      className="inline-grid size-8 place-items-center rounded-md border border-line text-blue hover:bg-paper-2 disabled:opacity-60">
      <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5m-4-4a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3" /></svg>
    </button>}
  </>;
}

export default function CalendarEventActions({ eventId, approved, updating = false }: { eventId: string; approved: boolean; updating?: boolean }) {
  return <form action={decideCalendarEvent} className="flex items-center gap-2">
    <input type="hidden" name="eventId" value={eventId} />
    <Buttons approved={approved} updating={updating} />
  </form>;
}
