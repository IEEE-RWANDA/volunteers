"use client";

import { Fragment, useState, type ReactNode } from "react";
import { formatUsd } from "@/lib/fund-amounts";
import { expandReleaseAllocations, filterReleaseHistory, groupEventReleases, releaseAmountCents, releaseReportStatus, type ReleaseHistoryRow } from "@/lib/release-history-filters";

export type FundReleaseRow = ReleaseHistoryRow;

export default function FundReleaseHistory({ rows, assignmentControls = {} }: { rows: FundReleaseRow[]; assignmentControls?: Record<string, ReactNode> }) {
  const [search, setSearch] = useState("");
  const [actor, setActor] = useState("");
  const [event, setEvent] = useState("");
  const [status, setStatus] = useState("");
  const allocatedRows = expandReleaseAllocations(rows);
  const events = [...new Map(allocatedRows.filter(row => row.eventId).map(row => [row.eventId!, row.eventTitle ?? row.title])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const statuses = [...new Set(allocatedRows.map(row => releaseReportStatus(row.reported)))].sort();
  const visible = filterReleaseHistory(allocatedRows, search, actor, event, status);
  const total = visible.reduce((sum, row) => sum + (releaseAmountCents(row.amount) ?? 0), 0);
  const excluded = visible.filter(row => releaseAmountCents(row.amount) === null).length;
  const filtered = Boolean(search.trim() || actor || event || status);
  return (
    <section className="mt-6" aria-labelledby="release-history">
      <h3 id="release-history" className="font-semibold text-navy">Release history</h3>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="min-w-0 text-sm font-semibold">Search releases
          <input type="search" className="login-input h-12 min-w-0 max-w-full" placeholder="Activity or transaction" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <label className="min-w-0 text-sm font-semibold">Released by
          <select className="login-input h-12 min-w-0 max-w-full" value={actor} onChange={e => setActor(e.target.value)}>
            <option value="">All releases</option>
            <option value="transfer-kip">Released by me</option>
            <option value="transfer-cyiza">Released by Cyiza</option>
            <option value="card-cyiza">Cyiza’s card</option>
            <option value="card-kip">My card</option>
            <option value="transfer-unknown">Unverified transfers</option>
          </select>
        </label>
        <label className="min-w-0 text-sm font-semibold">Event
          <select className="login-input h-12 min-w-0 max-w-full" value={event} onChange={e => setEvent(e.target.value)}>
            <option value="">All events and transactions</option>
            <option value="unlinked">Unassigned</option>
            {events.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-semibold">Report status
          <select className="login-input h-12 min-w-0 max-w-full" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All report statuses</option>
            {statuses.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {filtered && <button type="button" className="rounded-md px-3 py-3 text-sm font-semibold text-blue" onClick={() => { setSearch(""); setActor(""); setEvent(""); setStatus(""); }}>Clear filters</button>}
      </div>
      <div className="mt-3 scrollable-table" role="region" aria-label="Release history table" tabIndex={0}>
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line bg-paper-2">
            <tr>{["Event / activity", "Release / transaction", "Date", "Allocated / unallocated", "Released by", "Event report"].map(label => <th key={label} scope="col" className="px-3 py-2">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {groupEventReleases(visible).map(([eventId, group]) => <Fragment key={eventId}>
            {group.map((row, index) => (
              <tr key={`${row.id}-${row.eventId ?? "unlinked"}`} className="align-top">
                {index === 0 && <th scope="rowgroup" rowSpan={group.length + (group.length > 1 ? 1 : 0)} className="align-middle text-center min-w-40 wrap-anywhere border-r border-line bg-paper-2/50 px-3 py-3 font-semibold">
                  {row.eventId ? <a className="action-link" href={`/?section=team&tab=events#activity-${row.eventId}`}>{row.eventTitle ?? row.title}</a> : "Unassigned"}
                </th>}
                <th scope="row" className="wrap-anywhere px-3 py-3 font-normal">
                  <div className="flex items-start justify-between gap-2"><span>{row.title}</span>{assignmentControls[row.id]}</div>
                  {row.releaseAmount && <p className="mt-1 text-xs text-ink-soft">Release: {row.releaseAmount} · Remaining: {row.remainingCents === undefined ? "Unverified" : formatUsd(row.remainingCents)}</p>}
                  {row.unallocated && <p className="mt-1 text-xs text-ink-soft">Unallocated balance</p>}
                </th>
                <td className="whitespace-nowrap px-3 py-3">{row.date}</td>
                <td className="whitespace-nowrap px-3 py-3">{row.amount}</td>
                <td className="px-3 py-3">{row.actor === "kip" ? "Kip" : row.actor === "cyiza" ? "Cyiza" : "Unverified"}{row.method === "card" && " · Card"}</td>
                <td className={`px-3 py-3 ${["Report submitted", "Report approved"].includes(row.reported) ? "bg-green-50 font-semibold text-green-800" : ""}`}>{row.reported}</td>
              </tr>
            ))}
            {group.length > 1 && <tr className="bg-paper-2/50 font-semibold"><th scope="row" colSpan={2} className="px-3 py-2">{eventId === "unlinked" ? "Unassigned subtotal" : "Event subtotal"}</th><td className="whitespace-nowrap px-3 py-2">{formatUsd(group.reduce((sum, row) => sum + (releaseAmountCents(row.amount) ?? 0), 0))}</td><td colSpan={2} /></tr>}
            </Fragment>)}
            {!visible.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-soft">No releases match these filters.</td></tr>}
          </tbody>
          <tfoot className="border-t border-line font-semibold text-navy">
            <tr><th scope="row" colSpan={3} className="px-3 py-3">{filtered ? "Filtered total" : "Total"}</th><td className="whitespace-nowrap px-3 py-3">{formatUsd(total)}</td><td colSpan={2} /></tr>
          </tfoot>
        </table>
      </div>
      {excluded > 0 && <p role="status" className="mt-3 text-sm text-ink-soft">{excluded} release(s) without a verified USD amount are excluded from this total.</p>}
    </section>
  );
}
