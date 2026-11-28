type Row = { id: string; reference: string };
type Payment = { id: string; title: string; details: string[] };
type Release = { id: string; title: string; date: string; paymentId?: number; allocations?: { id: string; cents: number }[] };

export function fundReleaseDetails(rows: Row[], payments: Payment[], releases: Release[], funds: { id: string; treasuryRowId?: string }[], baseline: { includedRequestIds: string[]; includedPaymentIds: number[] }, activities: { details: string[]; paymentIds?: string[] }[] = []) {
  const result = new Map<string, { id: string; title: string; date: string; cents: number }[]>();
  const add = (rowId: string, detail: { id: string; title: string; date: string; cents: number }) => {
    const items = result.get(rowId) ?? [];
    if (!items.some(item => item.id === detail.id)) items.push(detail);
    result.set(rowId, items);
  };
  for (const payment of payments) {
    const reference = payment.details[0]?.match(/^CB payment \d+ · (.+)$/)?.[1];
    const matches = rows.filter(row => reference && (row.reference === reference ||
      activities.some(activity => activity.paymentIds?.includes(payment.id) && activity.details[0]?.includes(`Transaction ${row.reference} ·`))));
    const amount = payment.title.match(/USD ([\d,]+(?:\.\d{2})?)$/)?.[1];
    if (matches.length !== 1 || !amount || !payment.details.some(line => /^Paid \d{4}-\d{2}-\d{2}$/.test(line))) continue;
    add(matches[0].id, { id: payment.id, title: payment.details.slice(2).join(" · ") || payment.title,
      date: payment.details.find(line => /^Paid \d{4}-\d{2}-\d{2}$/.test(line))?.slice(5) ?? "", cents: Math.round(Number(amount.replaceAll(",", "")) * 100) });
  }
  for (const release of releases) {
    if (baseline.includedRequestIds.includes(release.id) || (release.paymentId !== undefined && baseline.includedPaymentIds.includes(release.paymentId))) continue;
    for (const allocation of release.allocations ?? []) {
      const fund = funds.find(fund => fund.id === allocation.id);
      const row = rows.find(row => row.id === (fund?.treasuryRowId ?? allocation.id)) ?? rows.find(row => row.id === `release-fund-${allocation.id}`);
      if (row) add(row.id, { id: release.id, title: release.title, date: release.date, cents: allocation.cents });
    }
  }
  return result;
}
