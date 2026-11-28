import { allocatedReleases, readIntakeJson, submissionIdPattern } from "./volunteer-store";
import { formatUsd } from "./fund-amounts";
import type { Submission } from "./volunteer-intake";

export async function releaseEditContext(id: string, eventIds: string[]) {
  const card = /^card-\d+$/.test(id);
  if ((!card && !submissionIdPattern.test(id)) || eventIds.length > 200 || eventIds.some(id => id && !submissionIdPattern.test(id))) return null;
  const [metadata, scope, record, legacy, ledger, events] = await Promise.all([
    readIntakeJson<{ cards: { id: string; amount: number; actor: string }[]; payments: { id: number; actor: string }[] }>("treasury-history/release-metadata.json"),
    readIntakeJson<{ releaseIds: string[] }>("treasury-history/historical-release-scope.json"),
    card ? null : readIntakeJson<Submission & { sourceReference?: { paymentId?: number } }>(`records/${id}.json`),
    card ? null : readIntakeJson<{ releasedAt: string; releasedAmount: string; recordedBy: string }>(`funding-releases/${id}.json`),
    card ? [] : allocatedReleases(),
    Promise.all([...new Set(eventIds.filter(Boolean))].map(id => readIntakeJson<Submission>(`records/${id}.json`))),
  ]);
  const validEvents = events.filter(event => event?.kind === "event").map(event => event!.id);
  const historicalSplitAllowed = scope?.releaseIds.includes(id) ?? false;
  if (card) {
    const row = metadata?.cards.find(row => `card-${row.id}` === id);
    return row ? { release: { id, amount: formatUsd(row.amount), actor: row.actor, historicalSplitAllowed }, events: validEvents } : null;
  }
  const release = ledger.find(release => release.requestId === id) ?? legacy ?? record;
  if (record?.kind !== "funding" || record.id !== id || !release?.releasedAt || !release.releasedAmount) return null;
  const paymentId = record.sourceReference?.paymentId;
  const recorder = "recordedBy" in release ? release.recordedBy : undefined;
  const actor = paymentId !== undefined ? metadata?.payments.find(payment => payment.id === paymentId)?.actor ?? "unknown"
    : recorder === "kipngeno.koech@ieee.org" ? "kip" : recorder === "cyizaaugustin1@ieee.org" ? "cyiza" : "unknown";
  return { release: { id, amount: release.releasedAmount, actor, eventId: record.fundingEventId, historicalSplitAllowed }, events: validEvents };
}
