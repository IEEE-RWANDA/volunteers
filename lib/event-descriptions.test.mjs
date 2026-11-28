import assert from "node:assert/strict";
import test from "node:test";
import { publicEventDescription, eventTreasuryNotes, eventForVolunteerForm } from "./event-descriptions.ts";

test("known treasury imports separate ledger text, reuse public summaries and leave originals intact", () => {
  const event = { id: "6761ce93-8e9d-c6fd-9b28-5e2f8b6c1c16", kind: "event", details: "Withdrawals $2,060. Missing receipts $359.32." };
  assert.equal(eventTreasuryNotes(event), event.details);
  assert.match(publicEventDescription(event), /Students explored vehicle assembly/);
  const client = eventForVolunteerForm(event);
  assert.equal(JSON.stringify(client).includes("2,060"), false);
  assert.equal(client.treasuryNotes, undefined);
  assert.equal(event.details, "Withdrawals $2,060. Missing receipts $359.32.");
  const unknownDescription = { ...event, id: "e65d2473-859d-3619-a347-59c905b821f2" };
  assert.equal(publicEventDescription(unknownDescription), "");
  assert.equal(eventTreasuryNotes(unknownDescription), event.details);
});

test("explicit public descriptions never fall back to private notes, including an empty description", () => {
  const event = { id: "event", kind: "event", details: "Old internal text", publicDescription: "Public workshop", treasuryNotes: "Receipt reconciliation" };
  assert.equal(publicEventDescription(event), "Public workshop");
  assert.equal(eventTreasuryNotes(event), "Receipt reconciliation");
  assert.equal(publicEventDescription({ ...event, publicDescription: "" }), "");
  assert.equal(publicEventDescription({ id: "new-event", kind: "event", details: "Volunteer-written description" }), "Volunteer-written description");
});

test("legacy financial snapshots are withheld and an imported activity needs a public description before approval", async () => {
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const ts = (await import('typescript')).default;
  const crypto = await import('node:crypto');
  const descriptions = await import('./event-descriptions.ts');
  let event = { id:'e65d2473-859d-3619-a347-59c905b821f2', kind:'event', title:'GRSS programme', details:'Private receipts and funding reconciliation', date:'2026-12-01T10:00', end:'2026-12-01T12:00', location:'Kigali', vtools:'https://events.vtools.ieee.org/m/123' };
  const records = new Map([[`event-calendar-decisions/${event.id}.json`,{fingerprint:'old',publicEvent:{id:event.id,description:event.details}}]]);
  const api = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./event-calendar.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports:api,URL,URLSearchParams,Buffer,AbortSignal,process:{env:{}},
    require:name=>({
      'node:crypto':crypto,
      './event-descriptions':descriptions,
      './calendar-reviewers':{calendarReviewAccess:async()=>({canReview:true})},
      './volunteer-store':{submissionIdPattern:/^[a-f0-9-]{36}$/,volunteerEvent:async requested=>requested===event.id?event:null,volunteerEvents:async()=>[event],readIntakeJson:async path=>records.get(path)??null,saveIntakeFile:async(path,value)=>records.set(path,JSON.parse(value))},
    }[name]),
    fetch:()=>{throw Error('Approving must not publish to Google');},
  });
  assert.equal((await api.approvedPublicEvents()).length,0);
  assert.equal(await api.reviewCalendarEvent('reviewer',event.id,'approve'),'calendar-details');
  event={...event,publicDescription:'Public programme description',treasuryNotes:event.details};
  assert.equal((await api.approvedPublicEvents()).length,0);
  assert.equal(await api.reviewCalendarEvent('reviewer',event.id,'approve'),'calendar-approved');
  const feed=await api.approvedPublicEvents();
  assert.equal(feed[0].description,'Public programme description');
  assert.equal(JSON.stringify(feed).includes('Private receipts'),false);
});
