"use client";

import { useState } from "react";

export type FundReleaseRow = { id: string; title: string; date: string; amount: string; actor: string; method: string; reported: string; eventId?: string };

export default function FundReleaseHistory({ rows }: { rows: FundReleaseRow[] }) {
  const [filter, setFilter] = useState("all");
  const visible = rows.filter(row => filter === "all" || `${row.method}-${row.actor}` === filter);
  return (
    <section className="mt-6" aria-labelledby="release-history">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="release-history" className="font-semibold text-navy">Release history</h3>
        <label className="text-sm font-semibold">Filter releases
          <select className="login-input" value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="all">All releases</option>
            <option value="transfer-kip">Released by me</option>
            <option value="transfer-cyiza">Released by Cyiza</option>
            <option value="card-cyiza">Cyiza’s card</option>
            <option value="card-kip">My card</option>
          </select>
        </label>
      </div>
      <div className="mt-3 scrollable-table" role="region" aria-label="Release history table" tabIndex={0}>
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line bg-paper-2">
            <tr>{["Activity / transaction", "Date", "Released", "Released by", "Reported"].map(label => <th key={label} scope="col" className="px-3 py-2">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map(row => (
              <tr key={row.id} className="align-top">
                <th scope="row" className="wrap-anywhere px-3 py-3 font-normal">
                  {row.method === "transfer" && row.eventId ? (
                    <a className="action-link" href={`/?section=team&tab=events#activity-${row.eventId}`}>{row.title}</a>
                  ) : row.title}
                </th>
                <td className="whitespace-nowrap px-3 py-3">{row.date}</td>
                <td className="whitespace-nowrap px-3 py-3">{row.amount}</td>
                <td className="px-3 py-3">{row.actor === "kip" ? "Kip" : row.actor === "cyiza" ? "Cyiza" : "Unverified"}{row.method === "card" && " · Card"}</td>
                <td className="px-3 py-3">{row.reported}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && <p className="mt-3 text-sm text-ink-soft">No releases match this filter.</p>}
    </section>
  );
}
