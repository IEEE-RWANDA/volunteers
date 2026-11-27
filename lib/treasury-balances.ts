import { allocatedReleases, listIntakeRecords, readIntakeJson } from "./volunteer-store";
import { usdCents } from "./fund-amounts";

export type TreasuryBalanceRow = { id: string; name: string; date: string; incoming: number; released: number; balance: number; reference: string };
type Baseline = { rows: TreasuryBalanceRow[]; includedFundIds: string[]; includedRequestIds: string[]; includedPaymentIds: number[] };
type Fund = { id: string; name: string; cents?: number; amount?: string; receivedAt?: string };
type Release = { requestId: string; releasedAt: string; releasedAmount: string; allocations?: { id: string; name: string; cents: number }[] };
type Request = { id: string; title: string; fundingSource?: string; sourceReference?: { paymentId?: number } };

function dollarAmount(amount: string) {
  const value = amount.replaceAll(",", "").trim();
  const match = /^(?:USD\s+(\d{1,12}(?:\.\d{1,2})?)|(\d{1,12}(?:\.\d{1,2})?)\s+USD)$/.exec(value);
  return match ? usdCents(match[1] ?? match[2]) : null;
}

export function combineTreasuryBalances(baseline: Baseline, funds: Fund[], releases: Release[], requests: Request[]) {
  const rows = baseline.rows.map(row => ({ ...row }));
  const includedFunds = new Set(baseline.includedFundIds);
  const includedRequests = new Set(baseline.includedRequestIds);
  const includedPayments = new Set(baseline.includedPaymentIds);
  const requestMap = new Map(requests.map(request => [request.id, request]));
  const fundRows = new Map<string, TreasuryBalanceRow>();
  const warnings: string[] = [];

  for (const fund of funds) {
    if (includedFunds.has(fund.id)) continue;
    const incoming = fund.cents ?? dollarAmount(fund.amount ?? "");
    if (incoming === null || !Number.isSafeInteger(incoming)) {
      warnings.push(`Check the USD amount for ${fund.name}.`);
      continue;
    }
    const row = { id: fund.id, name: fund.name, date: fund.receivedAt?.slice(0, 10) ?? "", incoming, released: 0, balance: incoming, reference: "Portal incoming fund" };
    rows.push(row);
    fundRows.set(fund.id, row);
  }

  const seen = new Set<string>();
  for (const release of releases) {
    const request = requestMap.get(release.requestId);
    if (seen.has(release.requestId) || includedRequests.has(release.requestId) ||
        (request?.sourceReference?.paymentId !== undefined && includedPayments.has(request.sourceReference.paymentId))) continue;
    seen.add(release.requestId);
    if (release.allocations?.length) {
      for (const allocation of release.allocations) {
        let row = fundRows.get(allocation.id);
        if (!row) {
          row = { id: `release-fund-${allocation.id}`, name: allocation.name, date: release.releasedAt.slice(0, 10), incoming: 0, released: 0, balance: 0, reference: "New release against an imported fund" };
          rows.push(row);
          fundRows.set(allocation.id, row);
        }
        row.released += allocation.cents;
        row.balance -= allocation.cents;
      }
    } else {
      const released = dollarAmount(release.releasedAmount);
      if (released === null) {
        warnings.push(`Reconcile the currency of the release for ${request?.title ?? release.requestId}.`);
        continue;
      }
      rows.push({ id: `release-${release.requestId}`, name: request?.fundingSource || request?.title || "Unassigned release", date: release.releasedAt.slice(0, 10), incoming: 0, released, balance: -released, reference: "Portal release without fund allocation" });
    }
  }
  return { rows, warnings };
}

export async function treasuryBalances() {
  const baseline = await readIntakeJson<Baseline>("treasury-history/fund-balances.json");
  if (!baseline) return { rows: [], warnings: ["Import the funding ledger before using automatic balances."] };
  if (!baseline.includedFundIds || !baseline.includedRequestIds || !baseline.includedPaymentIds) {
    return { rows: baseline.rows, warnings: ["The imported funding ledger needs its reconciliation baseline before automatic updates can begin."] };
  }
  const [fundPaths, requestPaths, releasePaths, allocated] = await Promise.all([
    listIntakeRecords("listed-funds"), listIntakeRecords("records"), listIntakeRecords("funding-releases"), allocatedReleases(),
  ]);
  const [funds, requests, legacy] = await Promise.all([
    Promise.all(fundPaths.map(path => readIntakeJson<Fund>(path))),
    Promise.all(requestPaths.map(path => readIntakeJson<Request>(path))),
    Promise.all(releasePaths.map(async path => {
      const release = await readIntakeJson<Omit<Release, "requestId">>(path);
      return release ? { ...release, requestId: path.slice("funding-releases/".length, -5) } : null;
    })),
  ]);
  return combineTreasuryBalances(baseline, funds.filter(fund => fund !== null), [...allocated, ...legacy.filter(release => release !== null)], requests.filter(request => request !== null));
}
