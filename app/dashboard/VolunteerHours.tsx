import { roster } from "@/lib/volunteer-roster";
import { formatHours, volunteerHours } from "@/lib/volunteer-hours";
import { logHours } from "./hours-actions";
import HoursFields from "./HoursFields";

export default async function VolunteerHours({ email, status }: { email: string; status?: string }) {
  const [directory, entries] = await Promise.all([roster(), volunteerHours(email)]);
  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.25fr_1fr]">
      <section className="panel" aria-labelledby="hours-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="hours-title" className="panel-title">Log volunteer hours</h2>
          <p className="text-sm text-ink-soft"><strong className="text-navy">{formatHours(total)}</strong> logged</p>
        </div>
        <form action={logHours} className="mt-4 space-y-4">
          <HoursFields />
          <button className="btn btn-primary" type="submit">Log hours</button>
          {status === "saved" && <p role="status" className="text-sm font-semibold text-blue">Hours saved.</p>}
          {status === "invalid" && <p role="alert" className="text-sm text-red-700">Enter an activity, a date up to today, and a duration from 1 minute to 24 hours.</p>}
          {status === "unavailable" && <p role="alert" className="text-sm text-red-700">Hours could not be saved. Try again.</p>}
        </form>

        <div className="mt-6 border-t border-line pt-5">
          <h3 className="font-semibold text-navy">Your hours history</h3>
          {entries.length ? (
            <ul className="mt-2 divide-y divide-line">
              {entries.map(entry => (
                <li key={entry.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="wrap-anywhere font-medium text-navy">{entry.activity}</p>
                    <time dateTime={entry.date} className="text-sm text-ink-soft">{entry.date}</time>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-navy">{formatHours(entry.minutes)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-ink-soft">Your logged activities will appear here.</p>}
        </div>
      </section>

      <section className="panel" aria-labelledby="directory-title">
        <h2 id="directory-title" className="panel-title">Volunteer directory</h2>
        <ul className="mt-3 divide-y divide-line">
          {directory.map(volunteer => (
            <li key={volunteer.email} className="py-2.5">
              <p className="wrap-anywhere font-medium text-navy">
                {volunteer.name}{volunteer.email === email && <span className="ms-2 text-xs text-ink-soft">(you)</span>}
              </p>
              {(volunteer.officerTitle || volunteer.committee) && (
                <p className="mt-1 text-sm text-ink-soft">{[volunteer.officerTitle, volunteer.committee].filter(Boolean).join(" · ")}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
