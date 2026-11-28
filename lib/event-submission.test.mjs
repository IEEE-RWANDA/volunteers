import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("events require registered committee members, keep volunteer selections and need no event budget", async () => {
  const writes = [];
  const api = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../app/api/volunteers/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: api, Request, Response, FormData, File, Buffer, URL,
    require: name => ({
      "node:crypto": { randomUUID: () => "event-id" },
      "@/lib/session": { getVolunteer: async () => "lead@example.test" },
      "@/lib/volunteer-store": { saveIntakeFile: async (path, value) => writes.push({ path, record: JSON.parse(value) }) },
      "@/lib/volunteer-intake": { attachmentLimit: 4 * 1024 * 1024 },
      "@/lib/volunteer-roster": { organizerDirectory: async () => [{ id: "committee", name: "Registered Chair", email: "chair@example.test", committee: "Chapter" }, { id: "helper", name: "Registered Helper", email: "helper@example.test" }] },
    }[name] ?? {}),
  });
  const form = new FormData();
  for (const [key,value] of Object.entries({ kind: "event", title: "Workshop", email: "lead@example.test", date: "2026-11-28T09:00", end: "2026-11-28T10:00", location: "Kigali", details: "Workshop description", vtools: "https://events.vtools.ieee.org/m/123", acknowledgeVtools: "yes" })) form.set(key,value);
  const post = () => api.POST(new Request("http://localhost/api/volunteers", { method: "POST", body: form }));
  assert.equal((await post()).status,400);
  form.set("committeeOrganizer", "unregistered"); assert.equal((await post()).status,400);
  assert.equal(writes.length,0);
  form.set("committeeOrganizer","committee"); form.set("organizer","helper");
  assert.equal((await post()).status,201);
  assert.deepEqual(writes[0].record.organizers,[{ name: "Registered Chair", committee: "Chapter" }]);
  assert.deepEqual(writes[0].record.eventVolunteerEmails,["chair@example.test","helper@example.test"]);
  assert.equal("eventBudget" in writes[0].record,false);
});

test("organizer picker excludes seeded and demo directory entries without portal accounts", async () => {
  const { createHash, createHmac } = await import("node:crypto");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./volunteer-roster.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, TextDecoder,
    process: { env: { NODE_ENV: "development", VOLUNTEER_SESSION_SECRET: "test-secret-for-registered-volunteers-only" } },
    require: name => ({
      "node:crypto": { createHash, createHmac },
      "./session": { accountRoster: async () => [{ email: "registered@example.test", name: "Registered Volunteer" }] },
      "./volunteer-store": {
        listIntakeRecords: async prefix => prefix === "roster" ? ["roster/seeded.json"] : [],
        readIntakeFile: async () => new TextEncoder().encode(JSON.stringify({ email: "seeded@example.test", name: "Not signed up" })),
      },
    }[name] ?? {}),
  });
  const members = await exports.organizerDirectory();
  assert.equal(members.length,1);
  assert.equal(members[0].email,"registered@example.test");
});
