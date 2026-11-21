import FundingReportForm from "@/app/components/FundingReportForm";
import type { ReportStatus } from "@/lib/funding-reports";
import type { Submission } from "@/lib/volunteer-intake";

export function ReleasedFunds({ records, statuses }: { records: Submission[]; statuses: Map<string, ReportStatus> }) {
  const released = records.filter(record => record.kind === "funding" && record.releasedAt)
    .sort((a, b) => (b.releasedAt ?? "").localeCompare(a.releasedAt ?? ""));
  return (
    <section className="panel mb-5" aria-labelledby="released-funds">
      <h2 id="released-funds" className="panel-title">Released funds</h2>
      {released.length ? (
        <ul className="mt-3 divide-y divide-line">
          {released.map(record => {
            const status = statuses.get(record.id);
            const action = status?.review?.decision === "returned" ? "Resubmit report" : "Submit report";
            return (
              <li key={record.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 py-3">
                <div className="min-w-0">
                  <p className="wrap-anywhere font-semibold text-navy">{record.title}</p>
                  <p className="text-sm text-ink-soft">Released {record.releasedAt?.slice(0, 10)} · {record.committee}{record.demo && " · Demo data"}</p>
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-navy">{record.releasedAmount}</p>
                  {status && <p className="text-ink-soft">{status.label}</p>}
                  {(!status || status.review?.decision === "returned") && (
                    <a className="action-link inline-block py-1" aria-label={`${action} for ${record.title}`}
                      href={`/dashboard?section=funding&tab=reporting&request=${record.id}#funding-report-title`}>{action}</a>
                  )}
                </div>
                {status?.review?.decision === "returned" && (
                  <div className="basis-full rounded-md bg-paper-2 p-3 text-sm text-navy">
                    <p className="font-semibold">Reviewer comments</p>
                    <p className="mt-1 whitespace-pre-wrap wrap-anywhere">{status.review.comments}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-3 text-sm text-ink-soft">Released funds will appear here.</p>}
    </section>
  );
}

export default function FundingReports({ records, statuses, saved, requestId }: {
  records: Submission[];
  statuses: Map<string, ReportStatus>;
  saved: boolean;
  requestId?: string;
}) {
  const funding = records.filter(record => record.kind === "funding");
  const open = funding.filter(record => record.releasedAt && (!statuses.has(record.id) || statuses.get(record.id)?.review?.decision === "returned")).map(({ id, title, date }) => ({ id, title, date }));
  const selected = open.find(request => request.id === requestId)?.id;
  const selectedReview = selected ? statuses.get(selected)?.review : null;
  const completed = funding.filter(record => statuses.has(record.id));

  return (
    <section className="panel mt-5" aria-labelledby="funding-report-title">
      <h2 id="funding-report-title" className="panel-title">Report after the activity</h2>
      <p className="mt-2 text-sm text-ink-soft">Submit receipts, an expense sheet, photo and vTools links, and a one-page PDF for each funded activity.</p>
      {saved && <p role="status" className="mt-3 text-sm font-semibold text-blue">Funding report saved.</p>}
      {selectedReview?.decision === "returned" && (
        <div className="mt-4 rounded-md bg-paper-2 p-3 text-sm text-navy">
          <p className="font-semibold">Changes requested</p>
          <p className="mt-1 whitespace-pre-wrap wrap-anywhere">{selectedReview.comments}</p>
        </div>
      )}
      {open.length ? <FundingReportForm key={selected ?? ""} requests={open} selected={selected} revision={selectedReview?.decision === "returned"} /> : (
        <p className="mt-3 text-sm text-ink-soft">{funding.some(record => record.releasedAt) ? "All released funds have a report." : "Reports can be submitted once funds are released."}</p>
      )}
      {completed.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {completed.map(record => (
            <li className="flex flex-wrap items-baseline justify-between gap-2 py-2.5" key={record.id}>
              <span className="wrap-anywhere font-semibold text-navy">{record.title}</span>
              <span className="text-sm text-ink-soft">{statuses.get(record.id)?.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
