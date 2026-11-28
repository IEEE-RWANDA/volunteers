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
        <>
          {viewer === calendarReviewer && (
            <p className="mt-3 text-sm font-semibold text-ink-soft">Calendar publishing will be enabled after the calendar connection is configured.</p>
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
                {events.map(event => (
                  <tr id={`activity-${event.id}`} className="scroll-mt-5 align-top target:bg-paper-2" key={event.id}>
                    <th scope="row" className="wrap-anywhere px-3 py-3 font-semibold text-navy">{event.title}</th>
                    <td className="px-3 py-3">
                      <span className="inline-block rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-navy">Awaiting calendar decision</span>
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <p className="mt-4 text-sm text-ink-soft">No event submissions yet.</p>}
    </section>
  );
}
