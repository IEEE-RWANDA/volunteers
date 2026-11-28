import Link from "next/link";
import VolunteerForm from "@/app/components/VolunteerForm";
import { volunteerEvents } from "@/lib/volunteer-store";
import { organizerDirectory } from "@/lib/volunteer-roster";
import type { OrganizerOption } from "@/lib/volunteer-intake";
import { redirect } from "next/navigation";
import { calendarEventState, eventCalendarDecision } from "@/lib/event-calendar";

export default async function OwnEvents({ email, editId, saved, organizers, eventUnits }: { email: string; editId?: string; saved?: string; organizers: OrganizerOption[]; eventUnits: { id: string; label: string }[] }) {
  const events = (await volunteerEvents()).filter(event => event.submittedBy === email);
  const decisions = new Map(await Promise.all(events.map(async event => [event.id, await eventCalendarDecision(event.id)] as const)));
  const record = events.find(event => event.id === editId);
  if (editId && !record) redirect("/?section=events");
  const directory = record ? await organizerDirectory() : [];
  const committeeIds = record ? directory.filter(member => record.eventCommitteeEmails ? record.eventCommitteeEmails.includes(member.email) : record.organizers?.some(person => person.name === member.name)).map(member => member.id) : [];
  const volunteerIds = record ? directory.filter(member => record.eventVolunteerEmails?.includes(member.email) && !committeeIds.includes(member.id)).map(member => member.id) : [];
  return <div className="space-y-5">
    {saved && events.some(event => event.id === saved) && <p role="status" className="panel text-sm text-blue">Event changes saved for calendar review. The public calendar has not been changed.</p>}
    {events.length > 0 && <section className="panel" aria-labelledby="your-events-title">
      <h2 id="your-events-title" className="panel-title">Your events and activities</h2>
      <div className="mt-4 scrollable-table" role="region" aria-label="Your events and activities" tabIndex={0}>
        <table className="w-full text-left text-sm"><thead className="border-b border-line bg-paper-2 text-navy"><tr><th scope="col" className="px-3 py-2">Activity</th><th scope="col" className="px-3 py-2">Starts (CAT)</th><th scope="col" className="px-3 py-2">Calendar</th><th scope="col" className="px-3 py-2"><span className="sr-only">Edit</span></th></tr></thead>
          <tbody className="divide-y divide-line">{events.map(event => {
            const state = calendarEventState(event, decisions.get(event.id));
            return <tr key={event.id}><th scope="row" className="wrap-anywhere px-3 py-3 font-semibold text-navy">{event.title}</th><td className="px-3 py-3 text-ink-soft">{event.date.replace("T", " ")}</td><td className="px-3 py-3 text-ink-soft">{state.published ? "Published" : state.approved ? "Approved for publication" : state.updating ? "Changes need review" : "Needs review"}</td><td className="px-3 py-3"><Link className="action-link" href={`/?section=events&edit=${event.id}#event-form`} aria-label={`Edit ${event.title}`}>Edit</Link></td></tr>;
          })}</tbody>
        </table>
      </div>
    </section>}
    <section id="event-form" className="panel scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="panel-title">{record ? "Edit event or activity" : "Event/activity submission"}</h2>{record && <Link className="action-link text-sm" href="/?section=events">Cancel editing</Link>}</div>
      <VolunteerForm key={record ? `${record.id}:${record.revision ?? 0}` : "new-event"} kind="event" contactEmail={email} organizers={organizers} eventUnits={eventUnits} editing={record ? { record, committeeIds, volunteerIds } : undefined} />
    </section>
    <aside className="panel"><h2 className="panel-title">Public calendar</h2><p className="my-3 text-ink-soft">Submissions go to IEEE Rwanda for review. Approved events and activities can be added to the public calendar.</p><a className="action-link" href="https://www.ieeerwanda.org/events">Browse and subscribe</a></aside>
  </div>;
}
