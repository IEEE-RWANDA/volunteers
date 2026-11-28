import { allocatedReleases, listIntakeRecords, readIntakeJson, saveIntakeFile, volunteerSubmissions } from "./volunteer-store";
import { fundingReport } from "./funding-reports";
import { usdCents } from "./fund-amounts";
import type { FundAllocation, Submission } from "./volunteer-intake";

type ListedFund = { id: string; name: string; amount?: string; cents?: number; volunteerEmail?: string; unitId?: string; unitName?: string; treasuryRowId?: string };
export type FundBalance = { id: string; name: string; remainingCents: number; assignedCents?: number; unitId?: string; unitName?: string };

export async function listedFunds(releases?: Awaited<ReturnType<typeof allocatedReleases>>): Promise<(FundBalance & { volunteerEmail?: string; treasuryRowId?: string })[]> {
  const [paths, ledger, baseline] = await Promise.all([listIntakeRecords("listed-funds"), releases ?? allocatedReleases(),
    readIntakeJson<{ rows: { id: string; balance: number }[] }>("treasury-history/fund-balances.json")]);
  const funds = await Promise.all(paths.map(path => readIntakeJson<ListedFund>(path)));
  const spent = new Map<string, number>();
  for (const release of ledger) {
    for (const allocation of release.allocations) {
      spent.set(allocation.id, (spent.get(allocation.id) ?? 0) + allocation.cents);
    }
  }
  return funds.filter(fund => fund !== null).map(fund => {
    const amount = fund.cents ?? usdCents((fund.amount ?? "").replace(/^USD\s+/, "").replaceAll(",", ""));
    const available = fund.treasuryRowId ? Math.min(amount, baseline?.rows.find(row => row.id === fund.treasuryRowId)?.balance ?? 0) : amount;
    return {
      id: fund.id,
      name: fund.name,
      volunteerEmail: fund.volunteerEmail,
      unitId: fund.unitId,
      unitName: fund.unitName,
      treasuryRowId: fund.treasuryRowId,
      assignedCents: available,
      remainingCents: available - (spent.get(fund.id) ?? 0),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fundsForVolunteer(email: string): Promise<FundBalance[]> {
  return (await listedFunds())
    .filter(fund => fund.volunteerEmail === email)
    .map(({ id, name, remainingCents, unitId, unitName }) => ({ id, name, remainingCents, unitId, unitName }));
}

export function allocationTotal(allocations: FundAllocation[]) {
  return allocations.reduce((sum, item) => sum + item.cents, 0);
}

function activityLink(value?: string) {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.host + url.pathname.replace(/\/+$/, "") + url.search + url.hash;
}

function fundingSources(request: Submission) {
  return [
    request.fundingSource,
    ...(request.fundAllocations ?? []).map(fund => fund.name),
    ...(request.listedFunds ?? []).map(fund => fund.name),
  ].map(name => name?.trim().replace(/\s+/g, " ").toLowerCase()).filter(name => !!name);
}

export async function releaseFunding(request: Submission, email: string, date: string, amount: string) {
  const allocations = request.fundAllocations ?? [];
  const ledger = await allocatedReleases();
  if (ledger.some(entry => entry.requestId === request.id)) return "funding-state";
  const activity = activityLink(request.vtools);
  const sources = new Set(fundingSources(request));
  const previous = (await volunteerSubmissions(request.submittedBy, ledger)).filter(item =>
    item.id !== request.id && item.releasedAt &&
    fundingSources(item).some(source => sources.has(source)) &&
    (!(request.fundingEventId && item.fundingEventId === request.fundingEventId)) &&
    (!activity || activityLink(item.vtools) !== activity));
  const reports = await Promise.all(previous.map(item => fundingReport(item.id)));
  if (reports.some(report => report?.review?.decision !== "approved" || !report.attachments.some(file => file.type === "receipt"))) return "funding-receipts";
  if (allocations.length) {
    const funds = await listedFunds(ledger);
    const event = request.fundingEventId ? await readIntakeJson<Submission>(`records/${request.fundingEventId}.json`) : null;
    if (allocations.some(item => {
      const fund = funds.find(fund => fund.id === item.id);
      return fund && ((fund.volunteerEmail && fund.volunteerEmail !== request.submittedBy) || (fund.unitId && fund.unitId !== event?.eventUnitId));
    })) return "funding-assignment";
    if (allocations.some(item => item.cents > (funds.find(fund => fund.id === item.id)?.remainingCents ?? 0))) {
      return "funding-balance";
    }
  }
  // The next slot is create-only. A concurrent release must re-read balances before retrying.
  await saveIntakeFile(`allocated-releases/${ledger.length}.json`, JSON.stringify({
    requestId: request.id, allocations, releasedAt: date, releasedAmount: amount,
    recordedAt: new Date().toISOString(), recordedBy: email,
  }));
  return "funding-released";
}
