import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
function load(file, modules) {
  const api = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: api, Request, Response, FormData, File, Buffer, URL, console,
    require: name => modules[name] ?? {},
  });
  return api;
}

test('event posters validate images, persist across edits, replace and remove without changing old revisions', async () => {
  const files = new Map(); let current;
  const api = load('../app/api/volunteers/route.ts', {
    'node:crypto': crypto,
    '@/lib/session': { getVolunteer: async () => 'lead@example.test' },
    '@/lib/volunteer-intake': { attachmentLimit: 4 * 1024 * 1024, fundingRequestAttachmentCount: 6 },
    '@/lib/volunteer-roster': { organizerDirectory: async () => [{id:'lead',name:'Lead',email:'lead@example.test'}] },
    '@/lib/volunteer-store': {
      ownVolunteerEvent: async id => current?.id === id ? current : null,
      saveIntakeFile: async (path, value) => { files.set(path, value); if (path.startsWith('records/')) current=JSON.parse(value); },
      saveEventRevision: async record => { current={...record,revision:(current.revision??0)+1}; return true; },
      removeIntakeFiles: async paths => paths.forEach(path => files.delete(path)),
    },
  });
  const form = new FormData();
  for (const [key,value] of Object.entries({kind:'event',title:'Workshop',email:'lead@example.test',date:'2026-12-01T09:00',end:'2026-12-01T10:00',location:'Kigali',details:'Description',vtools:'https://events.vtools.ieee.org/m/123',acknowledgeVtools:'yes',committeeOrganizer:'lead'})) form.set(key,value);
  const post = () => api.POST(new Request('http://localhost/api/volunteers',{method:'POST',body:form}));
  form.set('eventPoster',new File(['not an image'],'poster.png'));
  assert.equal((await post()).status,400); assert.equal(files.size,0);
  form.set('eventPoster',new File([png],'poster.png'));
  assert.equal((await post()).status,201);
  const first = current.eventPoster;
  assert.equal(first.type,'image/png'); assert.deepEqual(files.get(`event-posters/${first.id}`),png);
  assert.equal(current.attachments.length,0);
  form.delete('eventPoster'); form.set('eventId',current.id); form.set('baseRevision','0');
  assert.equal((await post()).status,200); assert.equal(current.eventPoster.id,first.id);
  form.set('baseRevision','1'); form.set('eventPoster',new File([png],'replacement.png'));
  assert.equal((await post()).status,200); assert.notEqual(current.eventPoster.id,first.id);
  assert.ok(files.has(`event-posters/${first.id}`));
  form.delete('eventPoster'); form.set('baseRevision','2'); form.set('removeEventPoster','yes');
  assert.equal((await post()).status,200); assert.equal(current.eventPoster,undefined);
});

test('poster delivery exposes only the approved image; pending replacements require lead or reviewer access', async () => {
  const id=crypto.randomUUID(), oldId=crypto.randomUUID(), pendingId=crypto.randomUUID();
  let viewer=null, approvedId=oldId;
  const api=load('../app/api/public-events/[id]/poster/[posterId]/route.ts', {
    '@/lib/session': {getVolunteer:async()=>viewer},
    '@/lib/event-calendar': {eventCalendarDecision:async()=>({publicEvent:{posterUrl:`https://volunteers.ieeerwanda.org/api/public-events/${id}/poster/${approvedId}`}})},
    '@/lib/calendar-reviewers': {calendarReviewAccess:async email=>({canReview:email==='reviewer'})},
    '@/lib/volunteer-store': {
      submissionIdPattern:/^[a-f0-9-]{36}$/,
      readIntakeFile:async()=>png,
      ownVolunteerEvent:async(_id,email)=>email==='lead'?{eventPoster:{id:pendingId}}:null,
      volunteerEvents:async()=>[{id,eventPoster:{id:pendingId}}],
    },
  });
  const get=posterId=>api.GET(new Request('http://localhost'),{params:Promise.resolve({id,posterId})});
  assert.equal((await get(oldId)).status,200);
  assert.equal((await get(pendingId)).status,404);
  viewer='other'; assert.equal((await get(pendingId)).status,404);
  viewer='lead'; let response=await get(pendingId); assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'private, no-store');
  viewer='reviewer'; assert.equal((await get(pendingId)).status,200);
  viewer=null; approvedId=pendingId;
  response=await get(pendingId); assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),'image/png'); assert.match(response.headers.get('cache-control'),/public/);
  assert.equal((await get(oldId)).status,404);
});
