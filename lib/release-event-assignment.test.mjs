import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("only Treasury owner can assign existing releases to existing events, without changing amounts", async () => {
  let email = "other@example.test";
  const writes = [];
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../app/dashboard/treasury-actions.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: name => ({
      "next/navigation": { redirect: path => { throw new Error(path); } },
      "next/cache": { revalidatePath: () => {} },
      "@/lib/session": { getTeamAccess: async () => ({ email, role: "admin" }) },
      "./TreasuryHistory": { treasuryHistoryOwner: "kipngeno.koech@ieee.org" },
      "@/lib/treasury-release-history": { treasuryReleaseHistory: async () => [{ id: "release" }] },
      "@/lib/volunteer-store": { volunteerEvents: async () => [{ id: "event" }], saveIntakeFile: async (path, data) => writes.push({ path, data: JSON.parse(data) }) },
    }[name] ?? {}),
  });
  const form = new FormData(); form.set("releaseId", "release"); form.set("eventId", "event");
  await assert.rejects(exports.assignReleaseEvent(form), { message: "/" });
  assert.equal(writes.length, 0);
  email = "kipngeno.koech@ieee.org";
  form.set("eventId", "missing");
  await assert.rejects(exports.assignReleaseEvent(form), /release-event-invalid/);
  form.set("eventId", "event"); form.set("releaseId", "../forged");
  await assert.rejects(exports.assignReleaseEvent(form), /release-event-invalid/);
  assert.equal(writes.length, 0);
  form.set("releaseId", "release");
  await assert.rejects(exports.assignReleaseEvent(form), /view=releases.*release-event-saved/);
  assert.equal(writes[0].path, "release-event-links/release.json");
  assert.equal(writes[0].data.eventId, "event");
  assert.equal("amount" in writes[0].data, false);
  form.set("eventId", "");
  await assert.rejects(exports.assignReleaseEvent(form), /release-event-saved/);
  assert.equal(writes[1].data.eventId, null);
});
