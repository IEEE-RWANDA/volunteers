import ReleaseAllocationForm from "./ReleaseAllocationForm";
import FundBalancesTable from "./FundBalancesTable";
import ActionModal from "./ActionModal";
import FundReleaseHistory from "./FundReleaseHistory";
import FundBalanceTabs from "./FundBalanceTabs";
import { treasuryReleaseHistory } from "@/lib/treasury-release-history";
import { treasuryBalances } from "@/lib/treasury-balances";
import { formatUsd } from "@/lib/fund-amounts";
import { treasuryHistoryOwner } from "./TreasuryHistory";
import { roster } from "@/lib/volunteer-roster";
import { volunteerUnits } from "@/lib/volunteer-units";
import { listedFunds } from "@/lib/listed-funds";
import { assignBalanceFund, assignReleaseEvent } from "./treasury-actions";
import { readIntakeJson, volunteerEvents } from "@/lib/volunteer-store";
import { fundReleaseDetails } from "@/lib/fund-release-details";

export default async function AdminFundBalances({ email, status }: { email: string; status?: string }) {
  if (email !== treasuryHistoryOwner) return null;
  const [{ rows, warnings }, releases, volunteers, units, funds, history, baseline, events] = await Promise.all([
    treasuryBalances(), treasuryReleaseHistory(), roster(), volunteerUnits(), listedFunds(),
    readIntakeJson<{ payments: { id: string; title: string; details: string[] }[]; activities?: { details: string[]; paymentIds?: string[] }[] }>("treasury-history/ieee-rwanda.json"),
    readIntakeJson<{ includedRequestIds: string[]; includedPaymentIds: number[] }>("treasury-history/fund-balances.json"),
    volunteerEvents(),
  ]);
  const releaseDetails = fundReleaseDetails(rows, history?.payments ?? [], releases, funds,
    { includedRequestIds: baseline?.includedRequestIds ?? [], includedPaymentIds: baseline?.includedPaymentIds ?? [] }, history?.activities);

  const filterVolunteers = new Map(volunteers.map(person => [person.email, person.name]));
  for (const fund of funds) {
    if (fund.volunteerEmail && !filterVolunteers.has(fund.volunteerEmail)) filterVolunteers.set(fund.volunteerEmail, fund.volunteerEmail);
  }

  return (
    <section className="panel" aria-labelledby="fund-balances">
      <h2 id="fund-balances" className="panel-title">Fund balances</h2>
      {status === "fund-assignment-invalid" && <p role="alert" className="mt-2 text-sm text-red-700">Select an existing volunteer and unit for a fund with an available balance.</p>}
      {status === "fund-assignment-write" && <p role="alert" className="mt-2 text-sm text-red-700">The assignment could not be saved. Refresh and check the current assignment before retrying.</p>}
      {status === "release-event-invalid" && <p role="alert" className="mt-2 text-sm text-red-700">Choose existing events and positive USD allocations whose total does not exceed the release. Each event can appear only once.</p>}
      {status === "release-event-write" && <p role="alert" className="mt-2 text-sm text-red-700">The event assignment could not be saved. Refresh and retry.</p>}
      <FundBalanceTabs balances={<>
      {warnings.map(warning => <p key={warning} role="alert" className="mt-2 text-sm text-red-700">{warning}</p>)}
      <FundBalancesTable volunteers={[...filterVolunteers].map(([id, label]) => ({ id, label }))} units={units.map(unit => ({ id: unit.id, label: unit.label }))} rows={rows.map(row => {
              const assigned = funds.find(fund => fund.id === row.id || fund.treasuryRowId === row.id);
              const details = releaseDetails.get(row.id) ?? [];
              const unitemized = row.released - details.reduce((sum, detail) => sum + detail.cents, 0);
              return { ...row, volunteerEmail: assigned?.volunteerEmail, unitId: assigned?.unitId, content: (
              <tr key={row.id} className={`align-top ${row.balance < 0 ? "bg-red-50" : row.balance === 0 ? "bg-green-50" : row.released > 0 ? "bg-yellow-50" : ""}`}>
                <th scope="row" className="wrap-anywhere px-3 py-3 font-normal">
                  {row.name}
                  {row.reference && <p className="mt-1 text-xs text-ink-soft">{row.reference}</p>}
                </th>
                <td className="whitespace-nowrap px-3 py-3">{row.date}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{formatUsd(row.incoming)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  {row.released > 0 ? <ActionModal icon="plus" label={`View releases for ${row.name}`} title="Fund releases" trigger={formatUsd(row.released)}>
                    <p className="mb-4 text-sm text-ink-soft">{row.name}</p>
                    <div className="scrollable-table" role="region" aria-label="Individual fund releases" tabIndex={0}>
                      <table className="w-full text-left text-sm">
                        <thead><tr><th scope="col" className="px-2 py-2">Release / activity</th><th scope="col" className="px-2 py-2">Date</th><th scope="col" className="px-2 py-2 text-right">Amount</th></tr></thead>
                        <tbody className="divide-y divide-line">
                          {details.map(detail => <tr key={detail.id} className="align-top">
                            <th scope="row" className="px-2 py-3 font-normal">{detail.title}<p className="mt-1 text-xs text-ink-soft">{detail.id.startsWith("payment-") ? `CB payment ${detail.id.slice(8)}` : "Portal release"}</p></th>
                            <td className="whitespace-nowrap px-2 py-3">{detail.date || "—"}</td>
                            <td className="whitespace-nowrap px-2 py-3 text-right font-semibold">{formatUsd(detail.cents)}</td>
                          </tr>)}
                          {unitemized !== 0 && <tr className={unitemized < 0 ? "text-red-700" : ""}><th scope="row" colSpan={2} className="px-2 py-3 font-normal">{unitemized > 0 ? "Released amount not yet itemized" : "Difference from ledger total — needs reconciliation"}</th><td className="whitespace-nowrap px-2 py-3 text-right font-semibold">{formatUsd(unitemized)}</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-4 flex justify-between border-t border-line pt-3 font-semibold"><span>Total released</span><span>{formatUsd(row.released)}</span></p>
                  </ActionModal> : formatUsd(row.released)}
                </td>
                <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${row.balance < 0 ? "text-red-700" : "text-navy"}`}>{formatUsd(row.balance)}</td>
                <td className="min-w-44 px-3 py-3">
                  {assigned?.volunteerEmail && (
                    <div className="mb-2 text-sm">
                      <p>{volunteers.find(person => person.email === assigned.volunteerEmail)?.name ?? assigned.volunteerEmail}</p>
                      {assigned.unitName && <p className="mt-1 text-xs text-ink-soft">{units.find(unit => unit.id === assigned.unitId)?.label ?? assigned.unitName}</p>}
                    </div>
                  )}
                  {row.incoming > 0 && row.balance > 0 ? (
                    <ActionModal compact icon={assigned?.volunteerEmail ? "edit" : "plus"}
                      label={`${assigned?.volunteerEmail ? "Edit assignment for" : "Assign funds from"} ${row.name}`}
                      title={assigned?.volunteerEmail ? "Edit fund assignment" : "Assign funds"}>
                    <p className="mb-4 text-sm text-ink-soft">{row.name}</p>
                    <form action={assignBalanceFund} aria-label={`Assign ${row.name}`} className="space-y-2">
                      <input type="hidden" name="rowId" value={row.id} />
                      <label className="block text-xs font-semibold">Volunteer
                        <select name="volunteerEmail" required defaultValue={assigned?.volunteerEmail ?? ""} className="login-input">
                          <option value="" disabled>Select volunteer</option>
                          {volunteers.map(person => <option key={person.email} value={person.email}>{person.name} · {person.email}</option>)}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold">Unit
                        <select name="unitId" required defaultValue={assigned?.unitId ?? ""} className="login-input">
                          <option value="" disabled>Select unit</option>
                          {units.map(unit => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
                        </select>
                      </label>
                      <button type="submit" className="btn btn-primary">{assigned?.volunteerEmail ? "Save" : "Assign"}</button>
                    </form>
                    </ActionModal>
                  ) : <span className="text-ink-soft">No available balance</span>}
                </td>
              </tr>
              ) };
            })} />
      </>} releases={<FundReleaseHistory rows={releases} assignmentControls={Object.fromEntries(releases.map(release => [release.id,
        <ActionModal key={release.id} compact icon={release.eventAllocations?.length || release.eventId ? "edit" : "plus"} label={`Edit release for ${release.title}`} title="Edit release">
          <p className="mb-4 text-sm text-ink-soft">{release.title} · {release.amount}</p>
          <ReleaseAllocationForm release={release} events={events.map(event => ({ id: event.id, title: event.title, date: event.date }))} action={assignReleaseEvent} />
        </ActionModal>
      ]))} />} />
    </section>
  );
}
