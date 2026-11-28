import { allFundingRequests, allocatedReleases, listIntakeRecords, readIntakeJson, volunteerEvents } from "./volunteer-store";
import { fundingReport } from "./funding-reports";
import { reportStatus } from "./funding-reports";
import { releaseAmountCents } from "./release-history-filters";
import { formatUsd } from "./fund-amounts";

type Metadata = {
  cards: { id: string; title: string; date: string; amount: number; actor: string; method: string; reported: string }[];
  payments: { id: number; actor: string }[];
};

export async function treasuryReleaseHistory() {
  const [metadata, requests, allocations, events, linkPaths, reconciliationScope] = await Promise.all([
    readIntakeJson<Metadata>("treasury-history/release-metadata.json"), allFundingRequests(), allocatedReleases(),
    volunteerEvents(),
    listIntakeRecords("release-event-links"),
    readIntakeJson<{ releaseIds: string[] }>("treasury-history/historical-release-scope.json"),
  ]);
  const links = await Promise.all(linkPaths.map(path => readIntakeJson<{ releaseId: string; eventId?: string | null; actor?: string; eventAllocations?: { eventId: string; cents: number }[] }>(path)));
  const eventIds = new Set(events.map(event => event.id));
  const transfers = await Promise.all(requests.filter(request => request.releasedAt).map(async request => {
    const [source, legacy, report] = await Promise.all([
      readIntakeJson<{ sourceReference?: { paymentId?: number } }>(`records/${request.id}.json`),
      readIntakeJson<{ recordedBy?: string }>(`funding-releases/${request.id}.json`),
      fundingReport(request.id),
    ]);
    const paymentId = source?.sourceReference?.paymentId;
    const recorder = allocations.find(release => release.requestId === request.id)?.recordedBy ?? legacy?.recordedBy;
    const actor = paymentId !== undefined
      ? metadata?.payments.find(payment => payment.id === paymentId)?.actor ?? "unknown"
      : recorder === "kipngeno.koech@ieee.org" ? "kip" : recorder === "cyizaaugustin1@ieee.org" ? "cyiza" : "unknown";
    return {
      id: request.id, title: request.title, date: request.releasedAt!.slice(0, 10), amount: request.releasedAmount ?? "",
      actor, method: "transfer",
      allocations: allocations.find(release => release.requestId === request.id)?.allocations ?? request.fundAllocations,
      paymentId,
      eventId: request.fundingEventId && eventIds.has(request.fundingEventId) ? request.fundingEventId : undefined,
      reported: report ? reportStatus(report.review).label : "Not submitted",
    };
  }));
  const eventReports = new Map(events.map(event => {
    const releases = transfers.filter(release => release.eventId === event.id);
    const labels = releases.map(release => release.reported);
    const reported = !labels.length || labels.every(label => label === "Not submitted") ? "Not submitted"
      : labels.includes("Changes requested") ? "Changes requested"
      : labels.includes("Not submitted") ? "Partially reported"
      : labels.every(label => label === "Report approved") ? "Report approved" : "Report submitted";
    return [event.id, reported];
  }));
  return [
    ...transfers,
    ...(metadata?.cards ?? []).map(row => ({ ...row, id: `card-${row.id}`, amount: formatUsd(row.amount) })),
  ].map(row => {
    const override = links.find(link => link?.releaseId === row.id);
    const eventId = override ? override.eventId : ("eventId" in row ? row.eventId : undefined);
    const event = events.find(event => event.id === eventId);
    const total = releaseAmountCents(row.amount);
    const eventAllocations = override?.eventAllocations ?? (event && total !== null ? [{ eventId: event.id, cents: total }] : undefined);
    return { ...row, actor: override?.actor ?? row.actor, eventId: event?.id, eventTitle: event?.title,
      historicalSplitAllowed: reconciliationScope?.releaseIds.includes(row.id) ?? false,
      eventAllocations: eventAllocations?.map(item => ({ ...item, eventTitle: events.find(event => event.id === item.eventId)?.title ?? "Unavailable event", reported: eventReports.get(item.eventId) ?? "Not submitted" })) };
  }).sort((a, b) => b.date.localeCompare(a.date));
}
