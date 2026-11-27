import { accountRoster } from "@/lib/session";
import { formatUsd } from "@/lib/fund-amounts";
import { listedFunds } from "@/lib/listed-funds";
import { allFundingRequests, volunteerEvents } from "@/lib/volunteer-store";
import { kigaliToday } from "@/lib/volunteer-hours";
import { approveRequest, listFund, recordRelease } from "./funding-actions";
import type { OfficerTitle } from "@/lib/session";

const messages: Record<string, { text: string; error?: boolean }> = {
  "fund-listed": { text: "Fund assigned to the selected volunteer." },
  "fund-list-invalid": { text: "Enter a funding source and a positive USD amount, and select a volunteer.", error: true },
  "funding-balance": { text: "A selected fund no longer has enough available. The release was not recorded.", error: true },
  "funding-receipts": { text: "Approve the volunteer’s outstanding funding reports for this funder before releasing funds for a different activity.", error: true },
  "funding-invoice": { text: "Confirm that the invoices match the requested amount and currency before approving.", error: true },
  "funding-approved": { text: "Funding request approved. Record the release once it has taken place." },
  "funding-approval-recorded": { text: "Your approval was recorded. Funding remains pending until all three required officer approvals are recorded." },
  "funding-released": { text: "Release recorded. The volunteer can now submit their report." },
  "funding-state": { text: "This request is no longer eligible for that action. Check its current status.", error: true },
  "funding-invalid": { text: "Enter a positive amount, a valid currency code, and a release date up to today.", error: true },
  "funding-write": { text: "The change could not be saved. Check the current status before trying again.", error: true },
};

export default async function AdminFundingRequests({ status, officerTitle }: { status?: string; officerTitle?: OfficerTitle }) {
  const [requests, funds, volunteers, events] = await Promise.all([allFundingRequests(), listedFunds(), accountRoster(), volunteerEvents()]);
  const eventIds = new Set(events.map(event => event.id));
  const names = new Map(volunteers.map(volunteer => [volunteer.email, volunteer.name]));
  const message = status && Object.hasOwn(messages, status) ? messages[status] : null;
  const today = kigaliToday();

  return (
    <section className="panel scroll-mt-5" aria-labelledby="admin-funding" id="admin-funding-panel">
      <h2 id="admin-funding" className="panel-title">Funding requests</h2>
      <p className="mt-2 text-sm text-ink-soft">Review budgets, approve requests, and record payments after they are released.</p>
      {message && (
        <p role={message.error ? "alert" : "status"} className={`mt-3 text-sm font-semibold ${message.error ? "text-red-700" : "text-blue"}`}>
          {message.text}
        </p>
      )}
      <section className="mt-5 rounded-md border border-line p-4" aria-labelledby="list-fund">
        <h3 id="list-fund" className="font-semibold text-navy">List a fund</h3>
        <form action={listFund} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block min-w-0 flex-1 text-sm font-semibold">Funding source
            <input name="name" className="login-input" placeholder="e.g. IEEE Computer Society" maxLength={150} required />
          </label>
          <label className="block text-sm font-semibold">Amount (USD)
            <input name="amount" className="login-input" type="number" min="0.01" step="0.01" required />
          </label>
          <label className="block min-w-0 flex-1 text-sm font-semibold">Assign to volunteer
            <select name="volunteerEmail" className="login-input" defaultValue="" required>
              <option value="" disabled>Select a volunteer</option>
              {volunteers.map(volunteer => (
                <option key={volunteer.email} value={volunteer.email}>{volunteer.name} · {volunteer.email}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" type="submit">Assign fund</button>
        </form>
        {funds.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {funds.map(fund => <li className="py-2" key={fund.id}>{fund.name} · {fund.volunteerEmail ? names.get(fund.volunteerEmail) ?? fund.volunteerEmail : "Shared"} · {formatUsd(fund.remainingCents)} left</li>)}
          </ul>
        )}
      </section>
      {requests.length ? (
        <div className="mt-4 overflow-x-auto" role="region" aria-labelledby="admin-funding" tabIndex={0}>
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-line bg-paper-2 text-navy">
              <tr>
                <th scope="col" className="px-3 py-2">Activity</th>
                <th scope="col" className="px-3 py-2">Lead volunteer</th>
                <th scope="col" className="px-3 py-2">Funding</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {requests.map(request => {
                const approvals = request.fundingApprovals ?? [];
                const approvedRoles = new Set(approvals.map(approval => approval.officerTitle));
                const viewerApproved = officerTitle && approvedRoles.has(officerTitle);
                const sources = [
                  ...(request.fundAllocations?.map(item => `${item.name} (${formatUsd(item.cents)})`) ?? request.listedFunds?.map(item => item.name) ?? []),
                  request.fundingSource,
                ].filter(Boolean).join(", ");
                return (
                  <tr key={request.id} className="align-top">
                    <th scope="row" className="wrap-anywhere px-3 py-3 font-semibold text-navy">
                      {request.fundingEventId && eventIds.has(request.fundingEventId) ? (
                        <a className="action-link" href={`/?section=team&tab=events#activity-${request.fundingEventId}`}>
                          {request.title}
                        </a>
                      ) : request.title}
                      <p className="mt-1 font-normal text-ink-soft">{request.committee}</p>
                      <p className="mt-1 font-normal text-ink-soft">{request.date}</p>
                    </th>
                    <td className="wrap-anywhere px-3 py-3 text-ink-soft">
                      {request.leadVolunteerName && <p className="font-semibold text-navy">{request.leadVolunteerName}</p>}
                      <p>{request.email || request.submittedBy}</p>
                      {request.email && request.submittedBy !== request.email && <p className="mt-1">Submitted by {request.submittedBy}</p>}
                    </td>
                    <td className="px-3 py-3 text-ink-soft">
                      <p className="font-semibold text-navy">{request.amount}</p>
                      {sources && <p className="mt-1 wrap-anywhere">{sources}</p>}
                      {request.demo && <p className="mt-1">Demo data</p>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-navy">
                        {request.releasedAt ? "Released" : request.approvedAt ? "Approved" : "Awaiting approval"}
                      </span>
                      {request.releasedAt && <p className="mt-1 text-ink-soft">{request.releasedAmount} on {request.releasedAt.slice(0, 10)}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <details className="min-w-32">
                        <summary className="cursor-pointer font-semibold text-blue">View request</summary>
                        {request.organizers?.length ? (
                          <p className="mt-2 wrap-anywhere text-sm text-ink-soft">
                            <strong className="text-navy">Organizers</strong> · {request.organizers.map(member => member.name).join(", ")}
                          </p>
                        ) : null}
                        {(!request.approvedAt || approvals.length > 0) && (
                          <div className="mt-3">
                            <p className="text-sm font-semibold text-navy">Officer approvals · {approvals.length} recorded · 3 required</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {(["Chair", "Treasurer", "Vice Chair or Secretary"] as const).map(role => {
                                const complete = role === "Vice Chair or Secretary"
                                  ? approvedRoles.has("Vice Chair") || approvedRoles.has("Secretary")
                                  : approvedRoles.has(role);
                                return <span key={role} className="rounded-full bg-paper-2 px-2.5 py-1 font-semibold text-navy">{complete ? "✓ " : "○ "}{role}</span>;
                              })}
                            </div>
                          </div>
                        )}
                        <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm text-ink-soft">{request.details}</p>
                        {request.vtools && (
                          <p className="mt-2 text-sm">
                            <a className="action-link" href={request.vtools} target="_blank" rel="noreferrer">vTools event</a>
                          </p>
                        )}
                        {request.attachments.length > 0 && (
                          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {request.attachments.map((file, index) => (
                              <a className="action-link wrap-anywhere" key={index} href={`/api/funding-requests/${request.id}/${index}`}>
                                {request.vtools && index === 0 && "Budget expense sheet · "}
                                {request.vtools && index >= 1 && index <= (request.invoiceCount ?? 1) && "Invoice · "}
                                {request.receiptsAcknowledgedAt && index === (request.invoiceCount ?? 1) + 1 && "MTTS approval email · "}
                                {request.receiptsAcknowledgedAt && index === (request.invoiceCount ?? 1) + 2 && "One-page event description · "}
                                {request.receiptsAcknowledgedAt && index === (request.invoiceCount ?? 1) + 3 && "Event poster · "}
                                {file}
                              </a>
                            ))}
                          </p>
                        )}
                        {request.receiptsAcknowledgedAt && <p className="mt-2 text-sm text-ink-soft">Receipts policy acknowledged{request.receiptFormatAcknowledged && " · EBM or POS receipts confirmed"}</p>}
                        {request.releasedAt ? null : request.approvedAt ? (
                          <form className="mt-4 space-y-3" action={recordRelease} aria-label={`Record release for ${request.title}`}>
                            <input type="hidden" name="requestId" value={request.id} />
                            <div className="grid gap-3">
                              {request.fundAllocations?.length ? (
                                <p className="text-sm text-ink-soft">Release {request.amount} from the funds above.</p>
                              ) : <>
                              <label className="block min-w-0 text-sm font-semibold">Released amount
                                <input className="login-input" type="number" name="amount" min="0.01" max="999999999999.99" step="0.01" required />
                              </label>
                              <label className="block min-w-0 text-sm font-semibold">Currency code
                                <input className="login-input uppercase" name="currency" defaultValue="USD" minLength={3} maxLength={3} pattern="[A-Za-z]{3}" required />
                              </label>
                              </>}
                              <label className="block min-w-0 text-sm font-semibold">Release date
                                <input className="login-input min-w-0" type="date" name="date" max={today} defaultValue={today} required />
                              </label>
                            </div>
                            <button className="btn btn-primary" type="submit">Record release</button>
                          </form>
                        ) : officerTitle && !viewerApproved ? (
                          <form className="mt-3 space-y-2" action={approveRequest}>
                            <input type="hidden" name="requestId" value={request.id} />
                            {request.receiptsAcknowledgedAt && (
                              <label className="flex items-start gap-2 text-sm text-navy">
                                <input type="checkbox" name="invoiceMatches" value="yes" required className="mt-0.5 size-4 shrink-0 accent-blue" />
                                <span>I verified that the invoices add up to the requested amount in the requested currency.</span>
                              </label>
                            )}
                            <button className="btn btn-primary" type="submit">Approve as {officerTitle}</button>
                          </form>
                        ) : !request.approvedAt ? <p className="mt-3 text-sm text-ink-soft">{viewerApproved ? `Approved by you as ${officerTitle}.` : "Officer approval required."}</p> : null}
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-4 text-sm text-ink-soft">No funding requests yet.</p>}
    </section>
  );
}
