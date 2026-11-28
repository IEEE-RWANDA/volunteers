export function fundReleaseStatus(row: { released: number; balance: number }) {
  if (row.released <= 0) return "not-released";
  return row.balance > 0 ? "partially-released" : "fully-released";
}
