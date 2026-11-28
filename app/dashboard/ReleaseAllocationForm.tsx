"use client";

import { useState } from "react";
import { formatUsd } from "@/lib/fund-amounts";
import { releaseAmountCents, validateEventAllocations, type ReleaseHistoryRow } from "@/lib/release-history-filters";

export default function ReleaseAllocationForm({ release, events, action }: {
  release: ReleaseHistoryRow;
  events: { id: string; title: string; date: string }[];
  action: (form: FormData) => void | Promise<void>;
}) {
  const total = releaseAmountCents(release.amount);
  const [items, setItems] = useState(() => release.eventAllocations?.map(item => ({ eventId: item.eventId, amount: (item.cents / 100).toFixed(2) })) ?? []);
  const allocated = items.reduce((sum, item) => sum + (releaseAmountCents(`${item.amount} USD`) ?? 0), 0);
  const valid = validateEventAllocations(items.map(item => item.eventId), items.map(item => item.amount), total, new Set(events.map(event => event.id))) !== null;
  return <form action={action} className="space-y-4">
    <input type="hidden" name="releaseId" value={release.id} />
    <p className="text-sm text-ink-soft">{release.historicalSplitAllowed ? "Historical reconciliation: allocate this release to its verified events." : "This release belongs to its funding request’s event and cannot be split."} Reporting is tracked per event.</p>
    <label className="block text-sm font-semibold">Released by
      <select name="actor" className="login-input" defaultValue={release.actor}>
        <option value="kip">Kip</option><option value="cyiza">Cyiza</option><option value="unknown">Unverified</option>
      </select>
    </label>
    {!release.historicalSplitAllowed && items.length === 1 && <>
      <input type="hidden" name="eventId" value={items[0].eventId} />
      <input type="hidden" name="amount" value={items[0].amount} />
      <p className="text-sm">{events.find(event => event.id === items[0].eventId)?.title ?? "Unavailable event"} · {release.amount}</p>
    </>}
    {release.historicalSplitAllowed && items.map((item, index) => <fieldset key={index} className="rounded-md border border-line p-3">
      <legend className="px-1 text-sm font-semibold">Allocation {index + 1}</legend>
      <label className="block text-sm font-semibold">Event or activity
        <select name="eventId" className="login-input" required value={item.eventId} onChange={e => setItems(items.map((current, i) => i === index ? { ...current, eventId: e.target.value } : current))}>
          <option value="">Select event</option>
          {!events.some(event => event.id === item.eventId) && item.eventId && <option value={item.eventId}>Unavailable event</option>}
          {events.map(event => <option key={event.id} value={event.id}>{event.title} · {event.date.slice(0, 10)}</option>)}
        </select>
      </label>
      <label className="mt-2 block text-sm font-semibold">Allocated amount (USD)
        <input name="amount" type="number" min="0.01" step="0.01" required className="login-input" value={item.amount} onChange={e => setItems(items.map((current, i) => i === index ? { ...current, amount: e.target.value } : current))} />
      </label>
      <button type="button" className="mt-2 text-sm font-semibold text-red-700" onClick={() => setItems(items.filter((_, i) => i !== index))}>Remove allocation {index + 1}</button>
    </fieldset>)}
    {release.historicalSplitAllowed && <button type="button" className="btn" disabled={total === null || items.length >= events.length} onClick={() => setItems([...items, { eventId: "", amount: "" }])}>Add event allocation</button>}
    <div className="rounded-md bg-paper-2 p-3 text-sm" aria-live="polite">
      <p>Total release: {release.amount}</p><p>Allocated: {formatUsd(allocated)}</p>
      <p className={total !== null && allocated > total ? "font-semibold text-red-700" : "font-semibold"}>Remaining balance: {total === null ? "Unverified" : formatUsd(total - allocated)}</p>
    </div>
    {total === null && <p role="alert" className="text-sm text-red-700">A verified USD release amount is required before allocating funds.</p>}
    {!valid && <p role="alert" className="text-sm text-red-700">Choose a different event for each allocation and enter positive amounts within the release total.</p>}
    <button type="submit" className="btn btn-primary" disabled={!valid}>Save</button>
  </form>;
}
