import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

test("event revisions retain originals, reject stale/concurrent saves and resolve latest details for all event readers", async () => {
  const directory = await fs.mkdtemp("/private/tmp/event-revisions-test-");
  const api = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./volunteer-store.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: api, Buffer, TextEncoder, TextDecoder,
    process: { env: { NODE_ENV: "development" }, cwd: () => directory },
    require: name => ({
      "node:fs/promises": fs, "node:path": path, "node:crypto": crypto,
      "./funding-approvals": {}, "@supabase/supabase-js": {},
    }[name]),
  });
  try {
    const event = { id: "11111111-1111-4111-8111-111111111111", kind: "event", title: "Original workshop", submittedBy: "lead@example.test", receivedAt: "2026-11-28T10:00:00Z", attachments: [] };
    await api.saveIntakeFile(`records/${event.id}.json`, JSON.stringify(event));
    assert.equal(await api.ownVolunteerEvent(event.id, "other@example.test"), null);
    const results = await Promise.all([
      api.saveEventRevision({ ...event, title: "Edited A" }, 0),
      api.saveEventRevision({ ...event, title: "Edited B" }, 0),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    const latest = await api.ownVolunteerEvent(event.id, event.submittedBy);
    assert.equal(latest.revision, 1);
    assert.equal((await api.volunteerEvent(event.id)).revision, 1);
    assert.equal(await api.volunteerEvent("invalid"), null);
    assert.equal((await api.readIntakeJson(`records/${event.id}.json`)).title, "Original workshop");
    assert.equal((await api.volunteerEvents())[0].title, latest.title);
    assert.equal((await api.volunteerSubmissions(event.submittedBy))[0].title, latest.title);
    assert.equal(await api.saveEventRevision({ ...event, title: "Stale overwrite" }, 0), false);
    assert.equal(await api.saveEventRevision({ ...latest, title: "Second revision" }, 1), true);
    assert.equal((await api.ownVolunteerEvent(event.id, event.submittedBy)).revision, 2);
    assert.equal((await api.readIntakeJson(`event-revisions/${event.id}/1.json`)).title, latest.title);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
