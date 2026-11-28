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
import { assignBalanceFund } from "./treasury-actions";

export default async function AdminFundBalances({ email, status }: { email: string; status?: string }) {
  if (email !== treasuryHistoryOwner) return null;
  const [{ rows, warnings }, releases, volunteers, units, funds] = await Promise.all([
    treasuryBalances(), treasuryReleaseHistory(), roster(), volunteerUnits(), listedFunds(),
  ]);

  const filterVolunteers = new Map(volunteers.map(person => [person.email, person.name]));
  for (const fund of funds) {
    if (fund.volunteerEmail && !filterVolunteers.has(fund.volunteerEmail)) filterVolunteers.set(fund.volunteerEmail, fund.volunteerEmail);
  }

  return (
    <section className="panel" aria-labelledby="fund-balances">
      <h2 id="fund-balances" className="panel-title">Fund balances</h2>
      {status === "fund-assignment-invalid" && <p role="alert" className="mt-2 text-sm text-red-700">Select an existing volunteer and unit for a fund with an available balance.</p>}
      {status === "fund-assignment-write" && <p role="alert" className="mt-2 text-sm text-red-700">The assignment could not be saved. Refresh and check the current assignment before retrying.</p>}
      <FundBalanceTabs balances={<>
      {warnings.map(warning => <p key={warning} role="alert" className="mt-2 text-sm text-red-700">{warning}</p>)}
      <FundBalancesTable volunteers={[...filterVolunteers].map(([id, label]) => ({ id, label }))} units={units.map(unit => ({ id: unit.id, label: unit.label }))} rows={rows.map(row => {
              const assigned = funds.find(fund => fund.id === row.id || fund.treasuryRowId === row.id);
              return { ...row, volunteerEmail: assigned?.volunteerEmail, unitId: assigned?.unitId, content: (
              <tr key={row.id} className={`align-top ${row.balance < 0 ? "bg-red-50" : row.balance === 0 ? "bg-green-50" : row.released > 0 ? "bg-yellow-50" : ""}`}>
                <th scope="row" className="wrap-anywhere px-3 py-3 font-normal">
                  {row.name}
                  {row.reference && <p className="mt-1 text-xs text-ink-soft">{row.reference}</p>}
                </th>
                <td className="whitespace-nowrap px-3 py-3">{row.date}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{formatUsd(row.incoming)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{formatUsd(row.released)}</td>
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
      </>} releases={<FundReleaseHistory rows={releases} />} />
    </section>
  );
}
