import Link from "next/link";
import { formatHours, kigaliToday, type volunteerHours } from "@/lib/volunteer-hours";
import type { ReportStatus } from "@/lib/funding-reports";
import type { Submission } from "@/lib/volunteer-intake";

export default function OverviewActivity({ entries, records, statuses }: {
  entries: Awaited<ReturnType<typeof volunteerHours>>;
  records: Submission[];
  statuses: Map<string, ReportStatus>;
}) {
  const month = kigaliToday().slice(0, 7);
  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const monthly = entries.filter(entry => entry.date.startsWith(month)).reduce((sum, entry) => sum + entry.minutes, 0);
  const released = records.filter(record => record.kind === "funding" && record.releasedAt);
  const reportsToSubmit = released.filter(record => !statuses.has(record.id) || statuses.get(record.id)?.review?.decision === "returned").length;

  return (
    <section className="panel mt-5" aria-labelledby="overview-activity">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="panel-title" id="overview-activity">Your activity</h2>
        <Link className="action-link" href="/?section=volunteers">View volunteer hours</Link>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Total volunteer hours", formatHours(total)],
          ["Hours this month", formatHours(monthly)],
          ["Activity entries", entries.length],
        ].map(([label, value]) => (
          <div className="rounded-md bg-paper-2 p-3" key={label}>
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="mt-1 text-lg font-semibold text-navy">{value}</dd>
          </div>
        ))}
      </dl>
      <div className={released.length ? "mt-5 grid gap-5 md:grid-cols-2" : "mt-5"}>
        <div>
          <h3 className="font-semibold text-navy">Recent volunteer work</h3>
          {entries.length ? (
            <ul className="mt-2 divide-y divide-line">
              {entries.slice(0, 3).map(entry => (
                <li key={entry.id} className="flex items-baseline justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="wrap-anywhere text-sm font-medium text-navy">{entry.activity}</p>
                    <time dateTime={entry.date} className="text-xs text-ink-soft">{entry.date}</time>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-navy">{formatHours(entry.minutes)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-ink-soft">Your logged work will appear here.</p>}
        </div>
        {released.length > 0 && (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-navy">Activity reports</h3>
              <Link className="action-link" href="/?section=funding&tab=reporting">Open Reporting</Link>
            </div>
            <p className="mt-2 text-sm text-ink-soft">{reportsToSubmit ? `${reportsToSubmit} to submit or revise` : "All released activities have a report."}</p>
            <ul className="mt-2 divide-y divide-line">
              {released.slice(0, 3).map(record => (
                <li key={record.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2 text-sm">
                  <span className="wrap-anywhere font-medium text-navy">{record.title}</span>
                  <span className="text-ink-soft">{statuses.get(record.id)?.label ?? "Report due"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
