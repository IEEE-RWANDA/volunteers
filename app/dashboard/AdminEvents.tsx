import { volunteerEvents } from "@/lib/volunteer-store";
import { volunteerUnits } from "@/lib/volunteer-units";
import { accountRoster } from "@/lib/session";
import { calendarReviewAccess, calendarReviewers } from "@/lib/calendar-reviewers";
import { decideCalendarEvent, updateCalendarReviewer } from "./calendar-review-actions";
import { calendarConfigured, eventCalendarDecision } from "@/lib/event-calendar";

const calendarMessages: Record<string, string> = {
  "calendar-approved": "Event approved. It can now be published to the public calendar.",
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="admin-events" className="panel-title">Event submissions</h2>
          <p className="mt-2 text-sm text-ink-soft">Review submitted activities before calendar publication.</p>
        </div>
        {permission.canReview && (
          <span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-navy">Calendar reviewer</span>
        )}
      </div>
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
          {permission.canReview && (
            <p className="mt-3 text-sm text-ink-soft">Publishing makes the event title, description, schedule, venue and vTools link public.{!calendarConfigured() && " Calendar owner connection required before publishing."}</p>
          )}
          <div className="mt-4 scrollable-table" role="region" aria-labelledby="admin-events" tabIndex={0}>
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b border-line bg-paper-2 text-navy">
                <tr>
                  <th scope="col" className="px-3 py-2">Activity</th>
                  <th scope="col" className="px-3 py-2">Calendar status</th>
                  <th scope="col" className="px-3 py-2">Schedule and venue</th>
                  <th scope="col" className="px-3 py-2">Organizers</th>
                  <th scope="col" className="px-3 py-2">vTools</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map(event => {
                  const decision = decisions.get(event.id);
                  return (
                  <tr id={`activity-${event.id}`} className="scroll-mt-5 align-top target:bg-paper-2" key={event.id}>
                    <th scope="row" className="wrap-anywhere px-3 py-3 font-semibold text-navy">{event.title}</th>
                    <td className="px-3 py-3">
                      <span className="inline-block rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-navy">{decision?.publishedAt ? "Published to calendar" : decision ? "Approved" : "Awaiting calendar decision"}</span>
                      {decision?.calendarUrl && <a className="action-link mt-2 block text-sm" href={decision.calendarUrl} target="_blank" rel="noreferrer">View calendar event</a>}
                      {permission.canReview && !decision?.publishedAt && <form action={decideCalendarEvent} className="mt-3 flex flex-wrap gap-2">
                        <input type="hidden" name="eventId" value={event.id} />
                        <button className="btn border border-line text-blue" name="decision" value="approve">{decision ? "Reapprove event" : "Approve event"}</button>
                        {decision && <button className="btn btn-primary" name="decision" value="publish">Publish to calendar</button>}
                      </form>}
                    </td>
                    <td className="px-3 py-3 text-ink-soft">
                      <time className="whitespace-nowrap" dateTime={event.date}>{event.date.replace("T", " ")}</time>
                      {event.end && <> – <time className="whitespace-nowrap" dateTime={event.end}>{event.end.replace("T", " ")}</time></>}
                      {event.location && <p className="mt-1">{event.location}</p>}
                    </td>
                    <td className="wrap-anywhere px-3 py-3 text-ink-soft">
                      <p>{unitNames.get(event.eventUnitId ?? "") ?? event.committee}</p>
                      <p className="mt-1">{event.submittedBy}</p>
                      {event.organizers?.length ? <p className="mt-1">Volunteers · {event.organizers.map(person => person.name).join(", ")}</p> : null}
                    </td>
                    <td className="px-3 py-3">
                      {event.vtools && <a className="action-link whitespace-nowrap" href={event.vtools} target="_blank" rel="noreferrer">vTools event</a>}
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </>
      ) : <p className="mt-4 text-sm text-ink-soft">No event submissions yet.</p>}
    </section>
  );
}
