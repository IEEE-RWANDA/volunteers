import { accountRoster } from "@/lib/session";
import { formatUsd } from "@/lib/fund-amounts";
import { listedFunds } from "@/lib/listed-funds";
import { allFundingRequests } from "@/lib/volunteer-store";
import { kigaliToday } from "@/lib/volunteer-hours";
import { approveRequest, listFund, recordRelease } from "./funding-actions";

const messages: Record<string, { text: string; error?: boolean }> = {
  "fund-listed": { text: "Fund assigned to the selected volunteer." },
  "fund-list-invalid": { text: "Enter a funding source and a positive USD amount, and select a volunteer.", error: true },
  "funding-balance": { text: "A selected fund no longer has enough available. The release was not recorded.", error: true },
  "funding-receipts": { text: "The volunteer must submit receipts for earlier activities before you release funds for this activity.", error: true },
  "funding-invoice": { text: "Confirm that the invoices match the requested amount and currency before approving.", error: true },
  "funding-approved": { text: "Funding request approved. Record the release once it has taken place." },
  "funding-released": { text: "Release recorded. The volunteer can now submit their report." },
  "funding-state": { text: "This request is no longer eligible for that action. Check its current status.", error: true },
  "funding-invalid": { text: "Enter a positive amount, a valid currency code, and a release date up to today.", error: true },
  "funding-write": { text: "The change could not be saved. Check the current status before trying again.", error: true },
};

export default async function AdminFundingRequests({ status }: { status?: string }) {
  const [requests, funds, volunteers] = await Promise.all([allFundingRequests(), listedFunds(), accountRoster()]);
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
        <ul className="mt-4 divide-y divide-line">
          {requests.map(request => (
            <li key={request.id} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="wrap-anywhere font-semibold text-navy">{request.title}</h3>
                  <p className="mt-1 wrap-anywhere text-sm text-ink-soft">{request.committee} · {request.submittedBy} · {request.date}</p>
                </div>
                <span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-navy">
                  {request.releasedAt ? "Released" : request.approvedAt ? "Approved" : "Awaiting approval"}
                </span>
              </div>
              {request.leadVolunteerName && (
                <p className="mt-1 wrap-anywhere text-sm text-ink-soft">
                  <strong className="text-navy">Lead volunteer</strong> · {request.leadVolunteerName} · {request.email}
                </p>
              )}
              {(request.fundingSource || request.fundAllocations?.length || request.listedFunds?.length) ? (
                <p className="mt-2 wrap-anywhere text-sm text-ink-soft">
                  <strong className="text-navy">Funding sources</strong> · {[...(request.fundAllocations?.map(item => `${item.name} (${formatUsd(item.cents)})`) ?? request.listedFunds?.map(item => item.name) ?? []), request.fundingSource].filter(Boolean).join(", ")}
                </p>
              ) : null}
              {request.organizers?.length ? (
                <p className="mt-2 wrap-anywhere text-sm text-ink-soft">
                  <strong className="text-navy">Organizers</strong> · {request.organizers.map(member => member.name).join(", ")}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-ink-soft">Requested {request.amount}{request.demo && " · Demo data"}</p>
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
                      {request.receiptsAcknowledgedAt && index === (request.invoiceCount ?? 1) + 1 && "Funding approval email · "}
                      {file}
                    </a>
                  ))}
                </p>
              )}
              {request.receiptsAcknowledgedAt && <p className="mt-2 text-sm text-ink-soft">Receipts policy acknowledged{request.receiptFormatAcknowledged && " · EBM or POS receipts confirmed"}</p>}
              {request.releasedAt ? (
                <p className="mt-3 text-sm font-semibold text-navy">{request.releasedAmount} released on {request.releasedAt.slice(0, 10)}</p>
              ) : request.approvedAt ? (
                <form className="mt-4 space-y-3" action={recordRelease} aria-label={`Record release for ${request.title}`}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    {request.fundAllocations?.length ? (
                      <p className="text-sm text-ink-soft sm:col-span-2">Release {request.amount} from the funds above.</p>
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
              ) : (
                <form className="mt-3 space-y-2" action={approveRequest}>
                  <input type="hidden" name="requestId" value={request.id} />
                  {request.receiptsAcknowledgedAt && (
                    <label className="flex items-start gap-2 text-sm text-navy">
                      <input type="checkbox" name="invoiceMatches" value="yes" required className="mt-0.5 size-4 shrink-0 accent-blue" />
                      <span>I verified that the invoices add up to the requested amount in the requested currency.</span>
                    </label>
                  )}
                  <button className="btn btn-primary" type="submit">Approve request</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-ink-soft">No funding requests yet.</p>}
    </section>
  );
}
