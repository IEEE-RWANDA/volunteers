"use client";

import { useState, type ReactNode } from "react";
import { formatUsd } from "@/lib/fund-amounts";

type Option = { id: string; label: string };
type Row = { id: string; volunteerEmail?: string; unitId?: string; incoming: number; released: number; balance: number; content: ReactNode };

export default function FundBalancesTable({ rows, volunteers, units }: { rows: Row[]; volunteers: Option[]; units: Option[] }) {
  const [volunteer, setVolunteer] = useState("");
  const [unit, setUnit] = useState("");
  const visible = rows.filter(row => (!volunteer || (volunteer === "unassigned" ? !row.volunteerEmail : row.volunteerEmail === volunteer)) &&
    (!unit || (unit === "unassigned" ? !row.unitId : row.unitId === unit)));
  const totals = visible.reduce((sum, row) => ({ incoming: sum.incoming + row.incoming, released: sum.released + row.released, balance: sum.balance + row.balance }), { incoming: 0, released: 0, balance: 0 });

  return <>
    <div className="mt-4 flex flex-wrap justify-center gap-3">
      <label className="min-w-0 text-sm font-semibold">Filter by volunteer
        <select className="login-input max-w-full" value={volunteer} onChange={event => setVolunteer(event.target.value)}>
          <option value="">All volunteers</option>
          <option value="unassigned">Unassigned</option>
          {volunteers.map(person => <option key={person.id} value={person.id}>{person.label}</option>)}
        </select>
      </label>
      <label className="min-w-0 text-sm font-semibold">Filter by unit
        <select className="login-input max-w-full" value={unit} onChange={event => setUnit(event.target.value)}>
          <option value="">All units</option>
          <option value="unassigned">Unassigned</option>
          {units.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      {(volunteer || unit) && <button type="button" className="self-end rounded-md px-3 py-3 text-sm font-semibold text-blue" onClick={() => { setVolunteer(""); setUnit(""); }}>Clear filters</button>}
    </div>
    <div className="mt-4 scrollable-table" role="region" aria-label="Fund balances table" tabIndex={0}>
      <table className="w-full min-w-[60rem] text-left text-sm">
        <thead className="border-b border-line bg-paper-2 text-navy">
          <tr>{["Funding source", "Received", "Incoming", "Released", "Balance", "Assign funds"].map((label, index) => <th key={label} scope="col" className={`px-3 py-2 ${index >= 2 && index <= 4 ? "text-right" : ""}`}>{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {visible.map(row => row.content)}
          {!visible.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-soft">{rows.length ? "No funds match these filters." : "No funding ledger has been imported."}</td></tr>}
        </tbody>
        <tfoot className="border-t border-line font-semibold text-navy">
          <tr>
            <th scope="row" colSpan={2} className="px-3 py-3">{volunteer || unit ? "Filtered total" : "Total"}</th>
            <td className="px-3 py-3 text-right">{formatUsd(totals.incoming)}</td>
            <td className="px-3 py-3 text-right">{formatUsd(totals.released)}</td>
            <td className="px-3 py-3 text-right">{formatUsd(totals.balance)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  </>;
}
