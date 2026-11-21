import { allocatedReleases, listIntakeRecords, readIntakeJson, saveIntakeFile } from "./volunteer-store";
import { formatUsd, usdCents } from "./fund-amounts";
import type { FundAllocation, Submission } from "./volunteer-intake";

type ListedFund = { id: string; name: string; amount?: string; cents?: number };
export type FundBalance = { id: string; name: string; remainingCents: number };

export async function listedFunds(releases?: Awaited<ReturnType<typeof allocatedReleases>>): Promise<FundBalance[]> {
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
    remainingCents: (fund.cents ?? usdCents((fund.amount ?? "").replace(/^USD\s+/, "").replaceAll(",", ""))) - (spent.get(fund.id) ?? 0),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export function allocationTotal(allocations: FundAllocation[]) {
  return allocations.reduce((sum, item) => sum + item.cents, 0);
}

export async function releaseAllocatedFunds(request: Submission, email: string, date: string) {
  const allocations = request.fundAllocations ?? [];
  const ledger = await allocatedReleases();
  if (ledger.some(entry => entry.requestId === request.id)) return "funding-state";
  const funds = await listedFunds(ledger);
  if (allocations.some(item => item.cents > (funds.find(fund => fund.id === item.id)?.remainingCents ?? 0))) {
    return "funding-balance";
  }
  // The next slot is create-only. A concurrent release must re-read balances before retrying.
  await saveIntakeFile(`allocated-releases/${ledger.length}.json`, JSON.stringify({
    requestId: request.id, allocations, releasedAt: date, releasedAmount: formatUsd(allocationTotal(allocations)),
    recordedAt: new Date().toISOString(), recordedBy: email,
  }));
  return "funding-released";
}
