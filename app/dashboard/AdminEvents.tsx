import { volunteerEvents } from "@/lib/volunteer-store";
import { volunteerUnits } from "@/lib/volunteer-units";

const calendarReviewer = "gentille.uwera@ieee.org";

export default async function AdminEvents({ viewer }: { viewer: string }) {
  const [events, units] = await Promise.all([volunteerEvents(), volunteerUnits()]);
  const unitNames = new Map(units.map(unit => [unit.id, unit.label]));

  return (
    <section className="panel" aria-labelledby="admin-events">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="admin-events" className="panel-title">Event submissions</h2>
          <p className="mt-2 text-sm text-ink-soft">Review submitted activities before calendar publication.</p>
        </div>
        {viewer === calendarReviewer && (
          <span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-navy">Calendar reviewer</span>
        )}
      </div>
      {events.length ? (
        <ul className="mt-4 divide-y divide-line">
          {events.map(event => (
            <li className="py-4" key={event.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="wrap-anywhere font-semibold text-navy">{event.title}</h3>
                <span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-navy">Awaiting calendar decision</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{event.date.replace("T", " ")} – {event.end?.replace("T", " ")} · {event.location}</p>
              <p className="mt-1 wrap-anywhere text-sm text-ink-soft">{unitNames.get(event.eventUnitId ?? "") ?? event.committee} · {event.submittedBy}</p>
              {event.organizers?.length ? <p className="mt-1 wrap-anywhere text-sm text-ink-soft">Volunteers · {event.organizers.map(person => person.name).join(", ")}</p> : null}
              {event.vtools && <a className="action-link mt-2 inline-block" href={event.vtools} target="_blank" rel="noreferrer">vTools event</a>}
              {viewer === calendarReviewer && (
                <p className="mt-3 text-sm font-semibold text-ink-soft">Calendar publishing will be enabled after the calendar connection is configured.</p>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-ink-soft">No event submissions yet.</p>}
    </section>
  );
}
