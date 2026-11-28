import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { formatUsd, usdCents } from "./fund-amounts.ts";

test("funding inherits the owned event description and accepts documents without a repeated event PDF", async () => {
  const writes = [];
  const api = {};
  const activity = { id: "event", title: "Workshop", date: "2026-11-28", eventUnitId: "unit", details: "Saved activity description", vtools: "https://events.vtools.ieee.org/m/123" };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../app/api/volunteers/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: api, Request, Response, FormData, File, Buffer, URL,
    require: name => ({
      "node:crypto": { randomUUID: () => "request" },
      "@/lib/session": { getVolunteer: async () => "lead@example.test" },
      "@/lib/fund-amounts": { formatUsd, usdCents },
      "@/lib/volunteer-intake": { attachmentLimit: 4 * 1024 * 1024, fundingRequestAttachmentCount: 6 },
      "@/lib/volunteer-store": { ownVolunteerEvent: async id => id === "event" ? activity : null, saveIntakeFile: async (path, data) => writes.push({ path, data }) },
      "@/lib/funding-leadership": { fundingLeadershipBlocks: async () => new Map([["unit",null]]) },
      "@/lib/listed-funds": { fundsForVolunteer: async () => [{id:"fund",name:"IEEE grant",remainingCents:10000,unitId:"unit"}], allocationTotal: values => values.reduce((sum,item) => sum + item.cents,0) },
      "@/lib/volunteer-roster": { organizerDirectory: async () => [{id:"organizer",name:"Volunteer",email:"lead@example.test"}] },
    }[name] ?? {}),
  });
  const form = new FormData();
  form.set("intendedUse", "Catering and workshop materials");
  for (const [key,value] of Object.entries({kind:"funding",fundingEventId:"event",email:"lead@example.test",leadVolunteerName:"Lead",acknowledgeReceipts:"yes",acknowledgeReceiptFormat:"yes",fund:"fund","fundAmount-fund":"50",organizer:"organizer",details:"Forged description",vtools:"https://example.test/forged"})) form.set(key,value);
  form.set("budget",new File([Buffer.from("504b0304","hex")],"budget.xlsx"));
  form.set("approvalEmail",new File(["%PDF-1.4"],"approval.pdf"));
  form.set("eventPoster",new File([Buffer.from("89504e470d0a1a0a","hex")],"poster.png"));
  for(let i=0;i<3;i++) form.append("invoice",new File(["%PDF-1.4"],`invoice-${i}.pdf`));
  const post = () => api.POST(new Request("http://localhost/api/volunteers",{method:"POST",body:form}));
  assert.equal((await post()).status,201);
  const record = JSON.parse(writes.find(write => write.path === "records/request.json").data);
  assert.equal(record.details,activity.details);
  assert.equal(record.intendedUse,"Catering and workshop materials");
  assert.equal(record.vtools,activity.vtools);
  assert.deepEqual(record.attachmentLabels,["Budget expense sheet","Invoice","Invoice","Invoice","Funding approval email","Event poster"]);
  assert.equal(record.attachments.length,6);
  form.delete("intendedUse");
  assert.equal((await post()).status,400);
  form.set("intendedUse","x".repeat(1001));
  assert.equal((await post()).status,400);
  form.set("intendedUse","Catering and workshop materials");
  form.append("invoice",new File(["%PDF-1.4"],"invoice-extra.pdf"));
  assert.equal((await post()).status,413);
  form.delete("invoice");
  assert.equal((await post()).status,400);
});
