import { allocatedReleases, listIntakeRecords, readIntakeJson, saveIntakeFile, volunteerSubmissions } from "./volunteer-store";
import { fundingReport } from "./funding-reports";
import { usdCents } from "./fund-amounts";
import type { FundAllocation, Submission } from "./volunteer-intake";

type ListedFund = { id: string; name: string; amount?: string; cents?: number; volunteerEmail?: string };
export type FundBalance = { id: string; name: string; remainingCents: number };

export async function listedFunds(releases?: Awaited<ReturnType<typeof allocatedReleases>>): Promise<(FundBalance & { volunteerEmail?: string })[]> {
  const [paths, ledger] = await Promise.all([listIntakeRecords("listed-funds"), releases ?? allocatedReleases()]);
  const funds = await Promise.all(paths.map(path => readIntakeJson<ListedFund>(path)));
  const spent = new Map<string, number>();
  for (const release of ledger) {
    for (const allocation of release.allocations) {
      spent.set(allocation.id, (spent.get(allocation.id) ?? 0) + allocation.cents);
    }
  }
  return funds.filter(fund => fund !== null).map(fund => ({
    id: fund.id,
    name: fund.name,
    volunteerEmail: fund.volunteerEmail,
    remainingCents: (fund.cents ?? usdCents((fund.amount ?? "").replace(/^USD\s+/, "").replaceAll(",", ""))) - (spent.get(fund.id) ?? 0),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fundsForVolunteer(email: string): Promise<FundBalance[]> {
  return (await listedFunds())
    .filter(fund => !fund.volunteerEmail || fund.volunteerEmail === email)
    .map(({ id, name, remainingCents }) => ({ id, name, remainingCents }));
}

export function allocationTotal(allocations: FundAllocation[]) {
  return allocations.reduce((sum, item) => sum + item.cents, 0);
}

function activityLink(value?: string) {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.host + url.pathname.replace(/\/+$/, "") + url.search + url.hash;
}

export async function releaseFunding(request: Submission, email: string, date: string, amount: string, today: string) {
  const allocations = request.fundAllocations ?? [];
  const ledger = await allocatedReleases();
  if (ledger.some(entry => entry.requestId === request.id)) return "funding-state";
  const activity = activityLink(request.vtools);
  const previous = (await volunteerSubmissions(request.submittedBy, ledger)).filter(item =>
    item.id !== request.id && item.releasedAt && item.date < today &&
    (!(request.fundingEventId && item.fundingEventId === request.fundingEventId)) &&
    (!activity || activityLink(item.vtools) !== activity));
  const reports = await Promise.all(previous.map(item => fundingReport(item.id)));
  if (reports.some(report => !report?.attachments.some(file => file.type === "receipt"))) return "funding-receipts";
  if (allocations.length) {
    const funds = await listedFunds(ledger);
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
