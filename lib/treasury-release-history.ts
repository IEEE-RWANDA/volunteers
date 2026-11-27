import { allFundingRequests, allocatedReleases, readIntakeJson, volunteerEvents } from "./volunteer-store";
import { fundingReport } from "./funding-reports";
import { reportStatus } from "./funding-reports";
import { formatUsd } from "./fund-amounts";

type Metadata = {
  cards: { id: string; title: string; date: string; amount: number; actor: string; method: string; reported: string }[];
  payments: { id: number; actor: string }[];
};

export async function treasuryReleaseHistory() {
  const [metadata, requests, allocations, events] = await Promise.all([
    readIntakeJson<Metadata>("treasury-history/release-metadata.json"), allFundingRequests(), allocatedReleases(),
    volunteerEvents(),
  ]);
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
      eventId: request.fundingEventId && eventIds.has(request.fundingEventId) ? request.fundingEventId : undefined,
      reported: report ? reportStatus(report.review).label : "Not submitted",
    };
  }));
  return [
    ...transfers,
    ...(metadata?.cards ?? []).map(row => ({ ...row, id: `card-${row.id}`, amount: formatUsd(row.amount) })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
