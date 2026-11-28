import * as descriptions from "./event-descriptions.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compiled = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exports = {};
vm.runInNewContext(compiled("./funding-leadership.ts"), { exports, require: () => ({}) });
const { missingFundingOfficials } = exports;
const badge = label => ({ unitId: "unit", email: "official@example.test", label });
const leadership = { chairs: [], badges: [], roles: [], applications: [] };

test("all four officials are required in the activity's own unit", () => {
  const team = { ...leadership, chairs: [{ unitId: "unit", email: "chair@example.test" }],
    badges: [badge("Vice-Chair"), badge("Secretary"), badge("Treasurer")] };
  assert.equal(missingFundingOfficials("unit", team).length, 0);
  assert.deepEqual(Array.from(missingFundingOfficials("child", team)), ["Chair", "Vice Chair", "Secretary", "Treasurer"]);
  assert.deepEqual(Array.from(missingFundingOfficials("unit", { ...team, badges: team.badges.slice(0, 2) })), ["Treasurer"]);
});

test("only approved role applications fill positions; unrelated open roles do not block", () => {
  const team = { ...leadership, badges: [badge("Chair"), badge("Secretary"), badge("Treasurer")],
    roles: [{ id: "vice", unitId: "unit", title: "Vice Chair" }, { id: "web", unitId: "unit", title: "Webmaster" }],
    applications: [{ roleId: "vice", email: "vice@example.test", decision: "approved" }] };
  assert.equal(missingFundingOfficials("unit", team).length, 0);
  for (const decision of [undefined, "declined"]) {
    assert.deepEqual(Array.from(missingFundingOfficials("unit", { ...team,
      applications: [{ ...team.applications[0], decision }] })), ["Vice Chair"]);
  }
});

test("recognizes explicit role titles without counting former or assistant officers", () => {
  assert.equal(missingFundingOfficials("unit", { ...leadership,
    badges: [badge("Student Branch Chairperson"), badge("Chapter Vice-Chairperson"), badge("Secretary / Treasurer")] }).length, 0);
  assert.deepEqual(Array.from(missingFundingOfficials("unit", { ...leadership,
    badges: [badge("Assistant Chair"), badge("Former Treasurer"), { ...badge("Secretary"), email: "" }] })),
  ["Chair", "Vice Chair", "Secretary", "Treasurer"]);
});

test("direct funding submissions use the saved activity unit and reject missing leadership before writing", async () => {
  let activity = { title: "Workshop", date: "2026-11-27", eventUnitId: "incomplete" };
  let writes = 0;
  const api = {};
  vm.runInNewContext(compiled("../app/api/volunteers/route.ts"), {
    exports: api, Request, Response, FormData,
    require: name => ({
      "@/lib/event-descriptions": descriptions,
      "@/lib/session": { getVolunteer: async () => "volunteer@example.test" },
      "@/lib/volunteer-store": { ownVolunteerEvent: async () => activity, saveIntakeFile: async () => { writes++; } },
      "@/lib/volunteer-intake": { attachmentLimit: 4 * 1024 * 1024 },
      "@/lib/funding-leadership": { fundingLeadershipBlocks: async () => new Map([["incomplete", "Assign Treasurer."], ["complete", null]]),
        unlinkedFundingActivity: "Link an organization." },
    }[name] ?? {}),
  });
  const post = async () => {
    const form = new FormData();
    form.set("kind", "funding");
    form.set("intendedUse", "Workshop materials");
    form.set("fundingEventId", "activity");
    form.set("eventUnitId", "complete");
    return api.POST(new Request("http://localhost/api/volunteers", { method: "POST", body: form }));
  };
  let result = await post();
  assert.equal(result.status, 400);
  assert.equal((await result.json()).error, "Assign Treasurer.");
  activity = { ...activity, eventUnitId: undefined };
  result = await post();
  assert.equal((await result.json()).error, "Link an organization.");
  activity = { ...activity, eventUnitId: "complete" };
  result = await post();
  assert.equal((await result.json()).error, "Select an activity with a description and enter a valid lead volunteer email.");
  assert.equal(writes, 0);
});
