import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";

function moduleAt(path, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: name => mocks[name] ?? {} });
  return exports;
}

test("assignment creates one fund from the remaining balance and reassignment preserves its original amount", async () => {
  const store = new Map();
  const row = { id: "source", name: "IEEE grant", date: "2026-11-01", incoming: 100000, balance: 60000 };
  const { assignTreasuryFund } = moduleAt("./treasury-assignments.ts", {
    "node:crypto": { createHash },
    "./treasury-balances": { treasuryBalances: async () => ({ rows: [row] }) },
    "./volunteer-roster": { roster: async () => [{ email: "one@example.test" }, { email: "two@example.test" }] },
    "./volunteer-units": { volunteerUnits: async () => [{ id: "unit", label: "Student Branch" }] },
    "./volunteer-store": {
      listIntakeRecords: async () => [...store.keys()],
      readIntakeJson: async path => path.startsWith("treasury-history/") ? { rows: [row] } : store.get(path),
      saveIntakeFile: async (path, value, overwrite) => {
        assert.equal(overwrite, store.has(path));
        store.set(path, JSON.parse(value));
      },
    },
  });
  assert.equal(await assignTreasuryFund("source", "one@example.test", "unit", "kip"), true);
  assert.equal(store.size, 1);
  assert.equal([...store.values()][0].cents, 60000);
  assert.equal([...store.values()][0].treasuryRowId, "source");
  row.balance = 40000;
  assert.equal(await assignTreasuryFund("source", "two@example.test", "unit", "kip"), true);
  assert.equal(store.size, 1);
  assert.equal([...store.values()][0].cents, 60000);
  assert.equal([...store.values()][0].volunteerEmail, "two@example.test");
  assert.equal(await assignTreasuryFund("source", "outsider@example.test", "unit", "kip"), false);
  assert.equal(await assignTreasuryFund("source", "one@example.test", "missing", "kip"), false);
  row.balance = 0;
  assert.equal(await assignTreasuryFund("source", "one@example.test", "unit", "kip"), false);
});

test("assigned funds remain private to their volunteer, honor the baseline cap, and reject a release for another unit", async () => {
  const fund = { id: "fund", name: "Grant", cents: 60000, treasuryRowId: "source", volunteerEmail: "one@example.test", unitId: "unit" };
  let baselineBalance = 60000;
  let ledger = [{ requestId: "previous", allocations: [{ id: "fund", cents: 20000 }] }];
  let writes = 0;
  const { fundsForVolunteer, releaseFunding } = moduleAt("./listed-funds.ts", {
    "./fund-amounts": { usdCents: value => Math.round(Number(value) * 100) },
    "./funding-reports": { fundingReport: async () => null },
    "./volunteer-store": {
      allocatedReleases: async () => ledger, volunteerSubmissions: async () => [],
      listIntakeRecords: async () => ["listed-funds/fund.json"],
      readIntakeJson: async path => path.startsWith("listed-funds/") ? fund
        : path.startsWith("treasury-history/") ? { rows: [{ id: "source", balance: baselineBalance }] }
        : { kind: "event", eventUnitId: "other-unit" },
      saveIntakeFile: async () => { writes++; },
    },
  });
  assert.equal((await fundsForVolunteer("one@example.test"))[0].remainingCents, 40000);
  assert.equal((await fundsForVolunteer("two@example.test")).length, 0);
  fund.volunteerEmail = undefined;
  assert.equal((await fundsForVolunteer("one@example.test")).length, 0, "Unassigned funds must not appear in the volunteer picker");
  fund.volunteerEmail = "one@example.test";
  baselineBalance = 30000;
  assert.equal((await fundsForVolunteer("one@example.test"))[0].remainingCents, 10000);
  ledger = [];
  const request = { id: "new", submittedBy: "one@example.test", fundingEventId: "activity",
    fundAllocations: [{ id: "fund", name: "Grant", cents: 10000 }] };
  assert.equal(await releaseFunding(request, "kip", "2026-11-27", "100 USD"), "funding-assignment");
  fund.unitId = undefined;
  fund.volunteerEmail = "two@example.test";
  assert.equal(await releaseFunding(request, "kip", "2026-11-27", "100 USD"), "funding-assignment");
  assert.equal(writes, 0);
});

test("only the Treasury owner can submit an assignment action", async () => {
  let assigned = false;
  const { assignBalanceFund } = moduleAt("../app/dashboard/treasury-actions.ts", {
    "next/navigation": { redirect: path => { throw new Error(path); } },
    "@/lib/session": { getTeamAccess: async () => ({ role: "admin", email: "other@example.test" }) },
    "./TreasuryHistory": { treasuryHistoryOwner: "kipngeno.koech@ieee.org" },
    "@/lib/treasury-assignments": { assignTreasuryFund: async () => { assigned = true; } },
  });
  await assert.rejects(assignBalanceFund(new FormData()), { message: "/" });
  assert.equal(assigned, false);
});
