import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("only Treasury owner can assign existing releases to existing events, with validated event allocations and unchanged release total", async () => {
  let email = "other@example.test";
  const writes = [];
  let historicalSplitAllowed = true;
  const exports = {};
  const allocationHelpers = await import("./release-history-filters.ts");
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../app/dashboard/treasury-actions.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: name => ({
      "next/navigation": { redirect: path => { throw new Error(path); } },
      "next/cache": { revalidatePath: () => {} },
      "@/lib/session": { getTeamAccess: async () => ({ email, role: "admin" }) },
      "./TreasuryHistory": { treasuryHistoryOwner: "kipngeno.koech@ieee.org" },
      "@/lib/treasury-release-history": { treasuryReleaseHistory: async () => [{ id: "release", amount: "100 USD", actor: "kip", eventId: "event", historicalSplitAllowed }] },
      "@/lib/release-history-filters": allocationHelpers,
      "@/lib/volunteer-store": { volunteerEvents: async () => [{ id: "event" }], saveIntakeFile: async (path, data) => writes.push({ path, data: JSON.parse(data) }) },
    }[name] ?? {}),
  });
  const form = new FormData(); form.set("releaseId", "release"); form.set("eventId", "event"); form.set("amount", "40");
  await assert.rejects(exports.assignReleaseEvent(form), { message: "/" });
  assert.equal(writes.length, 0);
  email = "kipngeno.koech@ieee.org";
  form.set("eventId", "missing");
  await assert.rejects(exports.assignReleaseEvent(form), /release-event-invalid/);
  form.set("eventId", "event"); form.set("amount", "40"); form.set("releaseId", "../forged");
  await assert.rejects(exports.assignReleaseEvent(form), /release-event-invalid/);
  assert.equal(writes.length, 0);
  form.set("releaseId", "release");
  await assert.rejects(exports.assignReleaseEvent(form), /view=releases.*release-event-saved/);
  assert.equal(writes[0].path, "release-event-links/release.json");
  assert.deepEqual(writes[0].data.eventAllocations, [{ eventId: "event", cents: 4000 }]);
  assert.equal("amount" in writes[0].data, false);
  form.delete("eventId"); form.delete("amount");
  await assert.rejects(exports.assignReleaseEvent(form), /release-event-saved/);
  assert.deepEqual(writes[1].data.eventAllocations, []);
  form.set("eventId", "event"); form.set("amount", "101");
  await assert.rejects(exports.assignReleaseEvent(form), /release-event-invalid/);
  assert.equal(writes.length, 2);
  historicalSplitAllowed = false;
  form.set("amount", "40");
  await assert.rejects(exports.assignReleaseEvent(form), /release-event-invalid/);
  form.set("amount", "100"); form.set("actor", "cyiza");
  await assert.rejects(exports.assignReleaseEvent(form), /release-event-saved/);
  assert.equal(writes.at(-1).data.actor, "cyiza");
  assert.equal(writes.at(-1).data.eventAllocations.length, 1);
  assert.equal(writes.at(-1).data.eventAllocations[0].cents, 10000);
});
