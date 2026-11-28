import { publicEventDescription, eventTreasuryNotes } from "@/lib/event-descriptions";
import { treasuryHistoryOwner } from "./TreasuryHistory";
import { volunteerEvents } from "@/lib/volunteer-store";
import { volunteerUnits } from "@/lib/volunteer-units";
import { accountRoster } from "@/lib/session";
import { calendarReviewAccess, calendarReviewers } from "@/lib/calendar-reviewers";
import { updateCalendarReviewer } from "./calendar-review-actions";
import { calendarEventState, eventCalendarDecision } from "@/lib/event-calendar";
import EventSubmissionTable, { EventCalendarStatus } from "./EventSubmissionTable";
import ActionModal from "./ActionModal";
import CalendarEventActions from "./CalendarEventActions";

const calendarMessages: Record<string, string> = {
  "calendar-approved": "Event approved for the IEEE Rwanda Events page. It can now be published to the public calendar.",
  "calendar-published": "Event published to the public calendar.",
  "calendar-forbidden": "Only the Secretary and delegated calendar reviewers can approve or publish events.",
  "calendar-details": "Complete the event title, description, venue, vTools link and valid start/end times before approval.",
  "calendar-connection": "Connect the calendar owner's Google account before publishing. The event approval is saved.",
  "calendar-approval-required": "Approve the current event details before publishing.",
  "calendar-publish-error": "Calendar publication could not be confirmed. Retry publishing; the same event will not be duplicated.",
  "calendar-save-error": "The change could not be saved. Check the current status and retry.",
};

export default async function AdminEvents({ viewer, status }: { viewer: string; status?: string }) {
  const permission = await calendarReviewAccess(viewer);
  const [reviewers, members] = permission.canManage ? await Promise.all([calendarReviewers(), accountRoster()]) : [[], []];
  const [events, units] = await Promise.all([volunteerEvents(), volunteerUnits()]);
  const unitNames = new Map(units.map(unit => [unit.id, unit.label]));
  const decisions = new Map(await Promise.all(events.map(async event => [event.id, await eventCalendarDecision(event.id)] as const)));
  const calendarMessage = status ? calendarMessages[status] : undefined;

  return (
    <section className="panel" aria-labelledby="admin-events">
      <h2 id="admin-events" className="panel-title">Event submissions</h2>
      {calendarMessage && <p role={status === "calendar-approved" || status === "calendar-published" ? "status" : "alert"} className="mt-3 text-sm font-semibold text-navy">{calendarMessage}</p>}
      {permission.canManage && <details className="mt-4 rounded-md border border-line p-4">
        <summary className="cursor-pointer font-semibold text-blue">Calendar reviewers</summary>
        {status === "calendar-reviewer-saved" && <p role="status" className="mt-3 text-sm text-blue">Calendar reviewers updated.</p>}
        {status === "calendar-reviewer-error" && <p role="alert" className="mt-3 text-sm text-red-700">The reviewer could not be updated. Choose an approved volunteer and try again.</p>}
        <p className="mt-3 text-sm text-ink-soft">The Secretary has review access automatically. Added reviewers can review event submissions without receiving other admin permissions.</p>
        <ul className="mt-3 divide-y divide-line">
          {reviewers.map(member => <li key={member.email} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <span className="wrap-anywhere">{member.name} · {member.email}{member.officerTitle === "Secretary" && " · Secretary"}</span>
            {member.officerTitle !== "Secretary" && <form action={updateCalendarReviewer}>
              <input type="hidden" name="email" value={member.email} />
              <button name="action" value="remove" className="action-link">Remove reviewer</button>
            </form>}
          </li>)}
        </ul>
        <form action={updateCalendarReviewer} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm font-semibold">Add reviewer
            <select className="login-input" name="email" defaultValue="" required>
              <option value="" disabled>Select a volunteer</option>
              {members.filter(member => !reviewers.some(reviewer => reviewer.email === member.email)).map(member => <option key={member.email} value={member.email}>{member.name} · {member.email}</option>)}
            </select>
          </label>
          <button name="action" value="add" className="btn btn-primary">Add reviewer</button>
        </form>
      </details>}
      {events.length ? (
        <>
          <EventSubmissionTable rows={events.map(event => {
                  const decision = decisions.get(event.id);
                  const state = calendarEventState(event, decision);
                  const description = publicEventDescription(event);
                  const unit = unitNames.get(event.eventUnitId ?? "") ?? event.committee;
                  const calendarStatus = state.published ? "Published" : state.approved ? state.updating ? "Update approved" : "Approved" : state.updating ? "Changes need review" : "Needs review";
                  return { id: event.id, title: event.title, location: event.location ?? "", unit, lead: event.submittedBy, status: calendarStatus, content: (
                  <tr id={`activity-${event.id}`} className="scroll-mt-5 align-top target:bg-paper-2" key={event.id}>
                    <th scope="row" className="wrap-anywhere px-3 py-3 font-semibold text-navy">
                      <ActionModal label={`View ${event.title}`} title={event.title} icon="role" trigger={<span>{event.title}</span>}>
                        <div className="space-y-4 text-sm font-normal">
                          {event.eventPoster && <a href={`/api/public-events/${event.id}/poster/${event.eventPoster.id}`} className="action-link" target="_blank" rel="noopener noreferrer">View submitted poster</a>}
                          <div><h3 className="font-semibold text-navy">Public description</h3><p className="mt-1 whitespace-pre-wrap wrap-anywhere text-ink-soft">{description || "Public description required before approval"}</p></div>
                          {viewer === treasuryHistoryOwner && eventTreasuryNotes(event) && <div className="rounded-md border border-line bg-paper-2 p-3"><h3 className="font-semibold text-navy">Private treasury notes</h3><p className="mt-1 whitespace-pre-wrap wrap-anywhere text-ink-soft">{eventTreasuryNotes(event)}</p></div>}
                          {state.updating && !state.published && <p className="rounded-md bg-amber-50 p-3 text-amber-900">These are the revised details. The public calendar keeps the previous published version until this update is approved and published.</p>}
                          <div className="overflow-hidden rounded-lg border border-line">
                            <table className="w-full table-fixed text-left text-sm" aria-label="Submitted event details">
                              <thead className="bg-paper-2 text-navy"><tr><th scope="col" className="w-[38%] px-3 py-2">Field</th><th scope="col" className="px-3 py-2">Details</th></tr></thead>
                              <tbody className="divide-y divide-line">
                                {[
                                  { label: "Starts (CAT)", value: event.date.replace("T", " ") || "Not provided" },
                                  { label: "Ends (CAT)", value: event.end?.replace("T", " ") || "Not provided" },
                                  { label: "Location", value: event.location || "Not provided" },
                                  { label: "Organization", value: unitNames.get(event.eventUnitId ?? "") ?? (event.committee || "Not provided") },
                                  { label: "Submitted by / event lead", value: event.submittedBy },
                                  { label: "Contact email", value: event.email || "Not provided" },
                                  { label: "Organizing committee", value: event.organizers?.map(person => person.name).join(", ") || event.committee || "Not provided" },
                                  { label: "Selected volunteers", value: event.eventVolunteerEmails?.length ? <ul className="space-y-1">{event.eventVolunteerEmails.map(email => <li key={email}>{email}</li>)}</ul> : "No additional volunteers selected." },
                                  { label: "vTools", value: event.vtools ? <a className="action-link" href={event.vtools} target="_blank" rel="noreferrer">Open vTools event</a> : "Not provided" },
                                  { label: "vTools acknowledgement", value: event.vtoolsAcknowledgedAt ? "IEEE Rwanda collaborator and contact email confirmed." : "Not recorded" },
                                  { label: "Submitted (CAT)", value: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Kigali" }).format(new Date(event.receivedAt)) },
                                  { label: "Revision", value: event.revision ?? 0 },
                                ].map(row => <tr key={row.label}><th scope="row" className="wrap-anywhere px-3 py-3 align-top font-semibold text-navy">{row.label}</th><td className="whitespace-pre-wrap wrap-anywhere px-3 py-3 align-top text-ink-soft">{row.value}</td></tr>)}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </ActionModal>
                    </th>
                    <td className="px-3 py-3">
                      <div className="flex min-w-32 flex-col items-start gap-2.5">
                        <EventCalendarStatus id={event.id} initial={calendarStatus} />
                        {decision?.calendarUrl && <a className="action-link inline-flex items-center gap-1 text-xs" href={decision.calendarUrl} target="_blank" rel="noreferrer">View in calendar <span aria-hidden="true">↗</span></a>}
                        {!description?.trim() && <span className="text-xs text-amber-900">Public description required</span>}
                        {permission.canReview && description?.trim() && !state.published && <CalendarEventActions eventId={event.id} approved={state.approved} updating={state.updating} />}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-soft">
                      <time className="whitespace-nowrap" dateTime={event.date}>{event.date.replace("T", " ")}</time>
                      {event.end && <> – <time className="whitespace-nowrap" dateTime={event.end}>{event.end.replace("T", " ")}</time></>}
                    </td>
                    <td className="wrap-anywhere px-3 py-3 text-ink-soft">{event.location || "Not provided"}</td>
                    <td className="wrap-anywhere px-3 py-3 text-ink-soft">
                      <p>{unitNames.get(event.eventUnitId ?? "") ?? event.committee}</p>
                      <p className="mt-1">{event.submittedBy}</p>
                      {event.organizers?.length ? <p className="mt-1">Volunteers · {event.organizers.map(person => person.name).join(", ")}</p> : null}
                    </td>
                    <td className="px-3 py-3">
                      {event.vtools && <a className="action-link whitespace-nowrap" href={event.vtools} target="_blank" rel="noreferrer">vTools event</a>}
                    </td>
                  </tr>
                ) };})} />
        </>
      ) : <p className="mt-4 text-sm text-ink-soft">No event submissions yet.</p>}
    </section>
  );
}
