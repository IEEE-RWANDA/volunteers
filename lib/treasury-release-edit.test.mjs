import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("release save reads only the target release and selected events, preserving the authoritative release amount", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const event = "22222222-2222-4222-8222-222222222222";
  const reads = [];
  let ledgerReads = 0;
  const records = {
    "treasury-history/release-metadata.json": { cards: [{ id: "123", amount: 13320, actor: "kip" }], payments: [{ id: 5737, actor: "cyiza" }] },
    "treasury-history/historical-release-scope.json": { releaseIds: [id, "card-123"] },
    [`records/${id}.json`]: { id, kind: "funding", fundingEventId: event, amount: "999 USD", sourceReference: { paymentId: 5737 } },
    [`funding-releases/${id}.json`]: { releasedAt: "2026-06-30", releasedAmount: "820 USD" },
    [`records/${event}.json`]: { id: event, kind: "event" },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./treasury-release-edit.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: name => name === "./fund-amounts" ? { formatUsd: cents => `${(cents / 100).toFixed(2)} USD` } : {
      submissionIdPattern: /^[a-f0-9-]{36}$/,
      allocatedReleases: async () => { ledgerReads++; return []; },
      readIntakeJson: async path => { reads.push(path); return records[path] ?? null; },
    },
  });
  const context = await exports.releaseEditContext(id, [event]);
  assert.equal(context.release.amount, "820 USD");
  assert.equal(context.release.eventId, event);
  assert.equal(context.release.historicalSplitAllowed, true);
  assert.equal(reads.length, 5);
  assert.equal(reads.some(path => /report|approval/.test(path)), false);
  assert.equal(ledgerReads, 1);
  reads.length = 0;
  assert.equal(await exports.releaseEditContext("../forged", [event]), null);
  assert.equal(await exports.releaseEditContext(id, ["../forged"]), null);
  assert.equal(reads.length, 0);
  const card = await exports.releaseEditContext("card-123", [event]);
  assert.equal(card.release.amount, "133.20 USD");
  assert.equal(ledgerReads, 1);
  assert.equal(reads.length, 3);
});
