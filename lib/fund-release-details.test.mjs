import assert from "node:assert/strict";
import test from "node:test";
import { fundReleaseDetails } from "./fund-release-details.ts";

test("release breakdown uses unique references, skips unpaid and duplicate imports, and maps new allocations once", () => {
  const rows = [{ id: "source", reference: "COMSOC-2026" }, { id: "shared-a", reference: "SHARED" }, { id: "shared-b", reference: "SHARED" }];
  const payment = { id: "payment-1", title: "Beneficiary · USD 820.00", details: ["CB payment 1 · COMSOC-2026", "Paid 2026-06-30", "ComSoc activity"] };
  const releases = [
    { id: "imported", paymentId: 1, title: "Imported", date: "2026-06-30", allocations: [{ id: "fund", cents: 82000 }] },
    { id: "new", title: "Next activity", date: "2026-11-28", allocations: [{ id: "fund", cents: 10000 }] },
  ];
  const result = fundReleaseDetails(rows, [payment, payment,
    { ...payment, id: "unpaid", details: ["CB payment 2 · COMSOC-2026", "Pending"] },
    { ...payment, id: "ambiguous", details: ["CB payment 3 · SHARED", "Paid 2026-06-30"] }],
    [...releases, releases[1]], [{ id: "fund", treasuryRowId: "source" }], { includedRequestIds: [], includedPaymentIds: [1] });
  assert.equal(result.size, 1);
  assert.equal(result.get("source").length, 2);
  assert.equal(result.get("source").reduce((sum, item) => sum + item.cents, 0), 92000);
  assert.equal(result.get("source")[0].date, "2026-06-30");
});

test("explicit activity payment links include differently named releases without changing the ledger", () => {
  const result = fundReleaseDetails([{ id: "source", reference: "COMSOC-2026" }], [
    { id: "payment-2", title: "Volunteer · USD 456.31", details: ["CB payment 2 · COMSOC-MEET-2026", "Paid 2026-08-25"] },
  ], [], [], { includedRequestIds: [], includedPaymentIds: [] }, [
    { paymentIds: ["payment-2"], details: ["Society · Transaction COMSOC-2026 · 2026-06-30"] },
  ]);
  assert.equal(result.get("source")[0].cents, 45631);
});
