import * as descriptions from "./event-descriptions.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";

test("calendar approval is role-scoped, publishes only approved public fields, and recovers without duplicates", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  let event = { id, kind: "event", title: "Local calendar workflow test", details: "Private ledger note", publicDescription: "Workshop description", treasuryNotes: "Private reconciliation note", date: "2026-12-01T10:00", end: "2026-12-01T12:00", location: "Kigali", vtools: "https://events.vtools.ieee.org/m/123", submittedBy: "private@example.test", attachments: ["private.pdf"] };
  const records = new Map(); const requests = []; const google = new Map();
  let failPublicationSave = false; let configured = true; let failGoogle = false;
  const api = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./event-calendar.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: api, URL, URLSearchParams, Buffer, AbortSignal,
    process: { env: new Proxy({}, { get: () => configured ? "test-only" : undefined }) },
    require: name => ({
      "./event-descriptions": descriptions,
      "node:crypto": crypto,
      "./calendar-reviewers": { calendarReviewAccess: async actor => ({ canReview: ["secretary", "delegate"].includes(actor) }) },
      "./volunteer-store": {
        submissionIdPattern: /^[a-f0-9-]{36}$/,
        volunteerEvent: async requested => requested === event.id ? event : null,
        volunteerEvents: async () => [event],
        readIntakeJson: async path => records.get(path) ?? null,
        saveIntakeFile: async (path, value) => {
          if (failPublicationSave && path.startsWith("event-calendar-publications/")) throw new Error("Storage offline");
          records.set(path, JSON.parse(value));
        },
      },
    }[name]),
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.includes("oauth2.googleapis.com")) return { ok: true, json: async () => ({ access_token: "test-token" }) };
      if (failGoogle) return { ok: false, status: 403 };
      if (options.method === "POST") {
        const payload = JSON.parse(options.body);
        if (google.has(payload.id)) return { ok: false, status: 409 };
        google.set(payload.id, { ...payload, etag: '"0"' });
        return { ok: true, json: async () => google.get(payload.id) };
      }
      if (options.method === "PATCH") {
        const id = url.split("/").at(-1);
        const existing = google.get(id);
        assert.equal(options.headers["If-Match"], existing.etag);
        google.set(id, { ...existing, ...JSON.parse(options.body), etag: '"updated"' });
        return { ok: true, json: async () => google.get(id) };
      }
      return { ok: true, json: async () => google.get(url.split("/").at(-1)) };
    },
  });
  assert.equal(await api.reviewCalendarEvent("admin", id, "approve"), "calendar-forbidden");
  assert.equal((await api.approvedPublicEvents()).length, 0);
  assert.equal(await api.reviewCalendarEvent("delegate", id, "publish"), "calendar-approval-required");
  assert.equal(requests.length, 0);
  assert.equal(await api.reviewCalendarEvent("secretary", id, "approve"), "calendar-approved");
  assert.equal((await api.approvedPublicEvents())[0].title, "Local calendar workflow test");
  event = { ...event, title: "Changed after approval" };
  assert.equal((await api.approvedPublicEvents())[0].title, "Local calendar workflow test");
  assert.equal(await api.reviewCalendarEvent("delegate", id, "publish"), "calendar-approval-required");
  assert.equal(await api.reviewCalendarEvent("delegate", id, "approve"), "calendar-approved");
  configured = false;
  assert.equal(await api.reviewCalendarEvent("delegate", id, "publish"), "calendar-connection");
  configured = true; failGoogle = true;
  assert.equal(await api.reviewCalendarEvent("delegate", id, "publish"), "calendar-publish-error");
  failGoogle = false; failPublicationSave = true;
  assert.equal(await api.reviewCalendarEvent("delegate", id, "publish"), "calendar-save-error");
  assert.equal(google.size, 1);
  failPublicationSave = false;
  assert.equal(await api.reviewCalendarEvent("delegate", id, "publish"), "calendar-published");
  assert.equal(google.size, 1);
  const before = requests.length;
  assert.equal(await api.reviewCalendarEvent("secretary", id, "publish"), "calendar-published");
  assert.equal(requests.length, before);
  const payload = [...google.values()][0];
  assert.equal(payload.start.dateTime, "2026-12-01T10:00:00+02:00");
  assert.equal(payload.start.timeZone, "Africa/Kigali");
  assert.equal(JSON.stringify(payload).includes("private@example.test"), false);
  assert.equal(JSON.stringify(payload).includes("private.pdf"), false);
  assert.equal(JSON.stringify(payload).includes("Private ledger note"), false);
  assert.equal(JSON.stringify(payload).includes("Private reconciliation note"), false);
  assert.equal(payload.description.startsWith("Workshop description"), true);
  const decision = await api.eventCalendarDecision(id);
  assert.equal(decision.approvedBy, "delegate"); assert.equal(decision.publishedBy, "delegate");
  const publicEvent = (await api.approvedPublicEvents())[0];
  assert.deepEqual(Object.keys(publicEvent).sort(), ["description", "endsAt", "id", "location", "startsAt", "title", "url"]);
  assert.equal(JSON.stringify(publicEvent).includes("private@example.test"), false);
  // Check older live approvals too, before snapshots were stored.
  for (const [path, value] of records) if (path.startsWith("event-calendar-")) delete value.publicEvent;
  records.set(`records/${id}.json`, { ...event });
  event = { ...event, revision: 1, location: "Updated venue", eventPoster: { id: "22222222-2222-4222-8222-222222222222", name: "poster.png", type: "image/png" } };
  assert.equal((await api.approvedPublicEvents())[0].location, "Kigali");
  assert.equal((await api.approvedPublicEvents())[0].posterUrl, undefined);
  assert.equal(api.calendarEventState(event, await api.eventCalendarDecision(id)).published, false);
  assert.equal(api.calendarEventState(event, await api.eventCalendarDecision(id)).needsReview, true);
  assert.equal(await api.reviewCalendarEvent("delegate", id, "publish"), "calendar-approval-required");
  assert.equal([...google.values()][0].location, "Kigali");
  assert.equal(await api.reviewCalendarEvent("secretary", id, "approve"), "calendar-approved");
  assert.equal((await api.approvedPublicEvents())[0].location, "Updated venue");
  assert.match((await api.approvedPublicEvents())[0].posterUrl, /poster\/22222222-2222-4222-8222-222222222222$/);
  assert.equal([...google.values()][0].location, "Kigali");
  failPublicationSave = true;
  assert.equal(await api.reviewCalendarEvent("delegate", id, "publish"), "calendar-save-error");
  assert.equal([...google.values()][0].location, "Updated venue");
  failPublicationSave = false;
  assert.equal(await api.reviewCalendarEvent("delegate", id, "publish"), "calendar-published");
  assert.equal(google.size, 1);
  assert.equal([...google.values()][0].id, payload.id);
  assert.equal(api.calendarEventState(event, await api.eventCalendarDecision(id)).published, true);
  event = { ...event, revision: 2, email: "new-private-contact@example.test" };
  assert.equal(await api.reviewCalendarEvent("delegate", id, "publish"), "calendar-approval-required");
  assert.equal(await api.reviewCalendarEvent("secretary", id, "approve"), "calendar-approved");
  event = { ...event, revision: 3 };
  assert.equal(await api.reviewCalendarEvent("delegate", id, "publish"), "calendar-approval-required");
  assert.equal([...google.values()][0].extendedProperties.private.portalRevision, "1");
  event = { ...event, date: "2026-02-30T10:00" };
  assert.equal(await api.reviewCalendarEvent("secretary", id, "approve"), "calendar-details");
});

test("approving reads only the selected activity and never contacts Google", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const event = { id, kind:"event", title:"Targeted approval", details:"Public activity", date:"2026-12-01T10:00", end:"2026-12-01T11:00", location:"Kigali", vtools:"https://events.vtools.ieee.org/m/123" };
  let reads=0, writes=0;
  const api={};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./event-calendar.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports:api,URL,Buffer,process:{env:{}},
    require:name=>({
      "node:crypto":crypto,
      "./event-descriptions":descriptions,
      "./calendar-reviewers":{calendarReviewAccess:async()=>({canReview:true})},
      "./volunteer-store":{
        submissionIdPattern:/^[a-f0-9-]{36}$/,
        volunteerEvent:async requested=>{assert.equal(requested,id);reads++;return event;},
        volunteerEvents:async()=>{throw Error("Approval must not load unrelated events");},
        readIntakeJson:async()=>null,
        saveIntakeFile:async path=>{assert.equal(path,`event-calendar-decisions/${id}.json`);writes++;},
      },
    }[name]),
    fetch:()=>{throw Error("Approval must not contact Google");},
  });
  assert.equal(await api.reviewCalendarEvent("reviewer",id,"approve"),"calendar-approved");
  assert.equal(reads,1); assert.equal(writes,1);
});
