export type ReleaseHistoryRow = { id: string; title: string; date: string; amount: string; actor: string; method: string; reported: string; eventId?: string; eventTitle?: string };

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
