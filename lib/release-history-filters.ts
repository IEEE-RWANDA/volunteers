export type ReleaseHistoryRow = { id: string; title: string; date: string; amount: string; actor: string; method: string; reported: string; eventId?: string; eventTitle?: string; historicalSplitAllowed?: boolean; eventAllocations?: { eventId: string; eventTitle?: string; reported?: string; cents: number }[]; releaseAmount?: string; remainingCents?: number; unallocated?: boolean };

export function releaseReportStatus(reported: string) {
  if (reported.startsWith("Covered")) return "Receipt covered";
  if (reported.startsWith("Receipt not matched")) return "Receipt not matched";
  return reported;
}

export function releaseAmountCents(amount: string) {
  const value = amount.replaceAll(",", "").trim();
  const match = /^(?:USD\s+(\d{1,12}(?:\.\d{1,2})?)|(\d{1,12}(?:\.\d{1,2})?)\s+USD)$/.exec(value);
  if (!match) return null;
  const [whole, fraction = ""] = (match[1] ?? match[2]).split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function filterReleaseHistory(rows: ReleaseHistoryRow[], search: string, actor: string, event: string, status: string) {
  const query = search.trim().toLowerCase();
  return rows.filter(row => (!query || `${row.title} ${row.eventTitle ?? ""} ${row.date} ${row.reported}`.toLowerCase().includes(query)) &&
    (!actor || `${row.method}-${row.actor}` === actor) &&
    (!event || (event === "unlinked" ? !row.eventId : row.eventId === event)) &&
    (!status || releaseReportStatus(row.reported) === status));
}

export function groupEventReleases(rows: ReleaseHistoryRow[]) {
  const groups = new Map<string, ReleaseHistoryRow[]>();
  for (const row of rows) {
    const key = row.eventId ?? "unlinked";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].sort(([a], [b]) => Number(a === "unlinked") - Number(b === "unlinked"));
}

export function validateEventAllocations(eventIds: string[], amounts: string[], total: number | null, validEvents: Set<string>) {
  if (eventIds.length !== amounts.length || eventIds.length > 200) return null;
  const allocations: { eventId: string; cents: number }[] = [];
  for (let index = 0; index < eventIds.length; index++) {
    const eventId = eventIds[index];
    const amount = amounts[index].trim();
    if (!eventId && !amount) continue;
    const cents = releaseAmountCents(`${amount} USD`);
    if (!validEvents.has(eventId) || cents === null || cents <= 0 || allocations.some(item => item.eventId === eventId)) return null;
    allocations.push({ eventId, cents });
  }
  if (allocations.length && (total === null || allocations.reduce((sum, item) => sum + item.cents, 0) > total)) return null;
  return allocations;
}

export function validReleaseEventEdit(release: ReleaseHistoryRow, allocations: { eventId: string; cents: number }[]) {
  if (release.historicalSplitAllowed) return true;
  const total = releaseAmountCents(release.amount);
  return allocations.length === 1 && allocations[0].eventId === release.eventId && allocations[0].cents === total;
}

export function expandReleaseAllocations(rows: ReleaseHistoryRow[]) {
  return rows.flatMap(row => {
    if (!row.eventAllocations) return [row];
    const total = releaseAmountCents(row.amount);
    const remaining = total === null ? null : total - row.eventAllocations.reduce((sum, item) => sum + item.cents, 0);
    const parts: ReleaseHistoryRow[] = row.eventAllocations.map(item => ({ ...row, eventId: item.eventId, eventTitle: item.eventTitle, reported: item.reported ?? "Not submitted",
      amount: `${(item.cents / 100).toFixed(2)} USD`, releaseAmount: row.amount, remainingCents: remaining ?? undefined }));
    if (remaining === null || remaining > 0 || !parts.length) parts.push({ ...row, eventId: undefined, eventTitle: undefined,
      amount: remaining === null ? row.amount : `${(remaining / 100).toFixed(2)} USD`, releaseAmount: row.amount,
      remainingCents: remaining ?? undefined, reported: "Not assigned to an event", unallocated: true });
    return parts;
  });
}
