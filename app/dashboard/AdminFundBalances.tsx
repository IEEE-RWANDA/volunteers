import FundReleaseHistory from "./FundReleaseHistory";
import FundBalanceTabs from "./FundBalanceTabs";
import { treasuryReleaseHistory } from "@/lib/treasury-release-history";
import { treasuryBalances } from "@/lib/treasury-balances";
import { formatUsd } from "@/lib/fund-amounts";
import { treasuryHistoryOwner } from "./TreasuryHistory";

export default async function AdminFundBalances({ email }: { email: string }) {
  if (email !== treasuryHistoryOwner) return null;
  const [{ rows, warnings }, releases] = await Promise.all([treasuryBalances(), treasuryReleaseHistory()]);
  const totals = rows.reduce((sum, row) => ({
    incoming: sum.incoming + row.incoming,
    released: sum.released + row.released,
    balance: sum.balance + row.balance,
  }), { incoming: 0, released: 0, balance: 0 });

  return (
    <section className="panel" aria-labelledby="fund-balances">
      <h2 id="fund-balances" className="panel-title">Fund balances</h2>
      <FundBalanceTabs balances={<>
      <p className="mt-2 text-sm text-ink-soft">Imported funding plus new portal funds and releases. All amounts are in USD.</p>
      {warnings.map(warning => <p key={warning} role="alert" className="mt-2 text-sm text-red-700">{warning}</p>)}
      <div className="mt-4 overflow-x-auto" role="region" aria-label="Fund balances table" tabIndex={0}>
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="border-b border-line bg-paper-2 text-navy">
            <tr>
              <th scope="col" className="px-3 py-2">Funding source</th>
              <th scope="col" className="px-3 py-2">Received</th>
              <th scope="col" className="px-3 py-2 text-right">Incoming</th>
              <th scope="col" className="px-3 py-2 text-right">Released</th>
              <th scope="col" className="px-3 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(row => (
              <tr key={row.id} className="align-top">
                <th scope="row" className="wrap-anywhere px-3 py-3 font-normal">
                  {row.name}
                  {row.reference && <p className="mt-1 text-xs text-ink-soft">{row.reference}</p>}
                </th>
                <td className="whitespace-nowrap px-3 py-3">{row.date}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{formatUsd(row.incoming)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{formatUsd(row.released)}</td>
                <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${row.balance < 0 ? "text-red-700" : "text-navy"}`}>{formatUsd(row.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line font-semibold text-navy">
            <tr>
              <th scope="row" colSpan={2} className="px-3 py-3">Total</th>
              <td className="px-3 py-3 text-right">{formatUsd(totals.incoming)}</td>
              <td className="px-3 py-3 text-right">{formatUsd(totals.released)}</td>
              <td className="px-3 py-3 text-right">{formatUsd(totals.balance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {!rows.length && <p className="mt-3 text-sm text-ink-soft">No funding ledger has been imported.</p>}
      </>} releases={<FundReleaseHistory rows={releases} />} />
    </section>
  );
}
