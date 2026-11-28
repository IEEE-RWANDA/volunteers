"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type CalendarStatus = "Needs review" | "Changes need review" | "Approved" | "Update approved" | "Published";
const CalendarUpdates = createContext<{ statuses: Record<string, CalendarStatus>; update: (id: string, status: CalendarStatus) => void }>({ statuses: {}, update: () => {} });
export const useCalendarUpdates = () => useContext(CalendarUpdates);

export function EventCalendarStatus({ id, initial }: { id: string; initial: CalendarStatus }) {
  const { statuses } = useCalendarUpdates();
  const status = statuses[id] ?? initial;
  const colors = status === "Published" ? "bg-emerald-50 text-emerald-800" : status === "Approved" || status === "Update approved" ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800";
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${colors}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{status}</span>;
}

type EventRow = { id: string; title: string; location: string; unit: string; lead: string; status: string; content: ReactNode };
const field = "mt-1 h-11 w-full min-w-0 rounded-md border border-line bg-paper px-3 text-sm font-normal text-ink";

export default function EventSubmissionTable({ rows }: { rows: EventRow[] }) {
  const [statuses, setStatuses] = useState<Record<string, CalendarStatus>>({});
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState("");
  const [lead, setLead] = useState("");
  const [status, setStatus] = useState("");
  const query = search.trim().toLowerCase();
  const visible = rows.filter(row => (!query || `${row.title} ${row.location} ${row.unit} ${row.lead}`.toLowerCase().includes(query)) && (!unit || row.unit === unit) && (!lead || row.lead === lead) && (!status || (statuses[row.id] ?? row.status) === status));
  return <CalendarUpdates.Provider value={{ statuses, update: (id, value) => setStatuses(previous => ({ ...previous, [id]: value })) }}>
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="min-w-0 text-sm font-semibold">Search events<input type="search" className={field} value={search} onChange={event => setSearch(event.target.value)} placeholder="Activity or location" /></label>
      <label className="min-w-0 text-sm font-semibold">Organization<select aria-label="Organization" className={field} value={unit} onChange={event => setUnit(event.target.value)}><option value="">All organizations</option>{[...new Set(rows.map(row => row.unit))].filter(Boolean).sort().map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="min-w-0 text-sm font-semibold">Event lead<select aria-label="Event lead" className={field} value={lead} onChange={event => setLead(event.target.value)}><option value="">All event leads</option>{[...new Set(rows.map(row => row.lead))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="min-w-0 text-sm font-semibold">Calendar status<select aria-label="Calendar status" className={field} value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{["Needs review", "Changes need review", "Approved", "Update approved", "Published"].map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <p className="mt-3 text-sm text-ink-soft" role="status">{visible.length} of {rows.length} activities</p>
    <div className="mt-4 scrollable-table" role="region" aria-labelledby="admin-events" tabIndex={0}>
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="border-b border-line bg-paper-2 text-navy"><tr>{["Activity", "Calendar status", "Schedule (CAT)", "Location", "Organizers", "vTools"].map(title => <th scope="col" className="px-3 py-2" key={title}>{title}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{visible.length ? visible.map(row => row.content) : <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-soft">No activities match these filters.</td></tr>}</tbody>
      </table>
    </div>
  </CalendarUpdates.Provider>;
}
