import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(new URL("./treasury-balances.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require: name => name === "./fund-amounts" ? {
    usdCents: value => Math.round(Number(value) * 100),
  } : {},
});
const { combineTreasuryBalances } = exports;

test("new incoming funds and releases update the imported baseline exactly once", () => {
  const baseline = {
    rows: [{ id: "original", incoming: 100000, released: 30000, balance: 70000 }],
    includedFundIds: ["imported-fund"],
    includedRequestIds: ["imported-request"],
    includedPaymentIds: [5497],
  };
  const funds = [
    { id: "imported-fund", name: "IEEE YP", cents: 30000 },
    { id: "new-fund", name: "IEEE YP", cents: 50000 },
  ];
  const releases = [
    { requestId: "imported-request", allocations: [{ id: "imported-fund", name: "IEEE YP", cents: 30000 }] },
    { requestId: "reimported-request", allocations: [{ id: "imported-fund", name: "IEEE YP", cents: 30000 }] },
    { requestId: "new-request", releasedAt: "2026-11-27", allocations: [{ id: "new-fund", name: "IEEE YP", cents: 20000 }] },
    { requestId: "new-request", releasedAt: "2026-11-27", releasedAmount: "200 USD" },
    { requestId: "new-release-imported-fund", releasedAt: "2026-11-27", allocations: [{ id: "imported-fund", name: "IEEE YP", cents: 10000 }] },
  ];
  const result = combineTreasuryBalances(baseline, funds, releases, [
    { id: "reimported-request", sourceReference: { paymentId: 5497 } },
  ]);
  const total = key => result.rows.reduce((sum, row) => sum + row[key], 0);
  assert.equal(total("incoming"), 150000);
  assert.equal(total("released"), 60000);
  assert.equal(total("balance"), 90000);
  assert.equal(baseline.rows[0].balance, 70000);
});

test("legacy USD releases count once and foreign currency requires reconciliation", () => {
  const baseline = { rows: [], includedFundIds: [], includedRequestIds: [], includedPaymentIds: [] };
  const result = combineTreasuryBalances(baseline, [], [
    { requestId: "usd", releasedAt: "2026-11-27", releasedAmount: "1,200 USD" },
    { requestId: "foreign", releasedAt: "2026-11-27", releasedAmount: "1200 RWF" },
  ], []);
  assert.equal(result.rows[0].released, 120000);
  assert.equal(result.rows[0].balance, -120000);
  assert.equal(result.warnings.length, 1);
});
