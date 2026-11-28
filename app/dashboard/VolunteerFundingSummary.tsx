import Link from "next/link";
import { formatUsd } from "@/lib/fund-amounts";
import type { FundBalance } from "@/lib/listed-funds";
import type { Submission } from "@/lib/volunteer-intake";
import type { ReportStatus } from "@/lib/funding-reports";

export default function VolunteerFundingSummary({ email, records, funds, statuses }: {
  email: string; records: Submission[]; funds: (FundBalance & { volunteerEmail?: string })[]; statuses: Map<string, ReportStatus>;
}) {
  const assigned = funds.filter(fund => fund.volunteerEmail === email);
  const requests = records.filter(record => record.kind === "funding" && record.submittedBy === email);
  const cell = "px-3 py-3";
  return <section className="panel mb-5" aria-labelledby="your-funding-summary">
    <h2 id="your-funding-summary" className="panel-title">Your funding summary</h2>
    <h3 className="mt-5 font-semibold text-navy">Funds assigned to you</h3>
    {assigned.length ? <div className="scrollable-table mt-3" role="region" aria-label="Your assigned funds" tabIndex={0}>
      <table className="w-full min-w-[36rem] text-left text-sm"><thead><tr><th className={cell} scope="col">Funding source</th><th className={cell} scope="col">Unit</th><th className={cell} scope="col">Assigned (USD)</th><th className={cell} scope="col">Available (USD)</th><th className={cell} scope="col"><span className="sr-only">Action</span></th></tr></thead>
        <tbody className="divide-y divide-line">{assigned.map(fund => <tr key={fund.id}><th className={cell} scope="row">{fund.name}</th><td className={cell}>{fund.unitName ?? "—"}</td><td className={cell}>{fund.assignedCents === undefined ? "—" : formatUsd(fund.assignedCents)}</td><td className={cell}>{formatUsd(fund.remainingCents)}</td><td className={cell}>{fund.remainingCents > 0 && <Link className="action-link" href={`/?section=funding&fund=${fund.id}#funding-request`}>Request funds</Link>}</td></tr>)}</tbody>
      </table></div> : <p className="mt-2 text-sm text-ink-soft">Funds will appear here when the treasurer assigns them to you.</p>}
    <h3 className="mt-6 font-semibold text-navy">Your requests and reports</h3>
    {requests.length ? <div className="scrollable-table mt-3" role="region" aria-label="Your funding requests and reports" tabIndex={0}>
      <table className="w-full min-w-[36rem] text-left text-sm"><thead><tr>{["Activity", "Requested", "Released", "Reporting"].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{requests.map(request => <tr key={request.id}><th scope="row" className={cell}>{request.title}</th><td className={cell}>{request.amount ?? "—"}</td><td className={cell}>{request.releasedAt ? request.releasedAmount ?? "—" : "Not released"}</td><td className={cell}>{request.releasedAt ? <Link className="action-link" href={`/?section=funding&tab=reporting&request=${request.id}#funding-report-title`}>{statuses.get(request.id)?.label ?? "Not submitted"}</Link> : "Awaiting release"}</td></tr>)}</tbody>
      </table></div> : <p className="mt-2 text-sm text-ink-soft">You have no funding requests yet.</p>}
  </section>;
}
