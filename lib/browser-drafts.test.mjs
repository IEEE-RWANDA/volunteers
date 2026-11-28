import assert from "node:assert/strict";
import test from "node:test";
import { browserDraft, draftKey } from "./browser-drafts.ts";

test("draft storage isolates accounts and forms, saves partial work, clears only its own key, and reports failures", async () => {
  const records = new Map();
  let fail = false;
  let closed = 0;
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = { open() {
    const open = {};
    queueMicrotask(() => {
      open.result = { close() { closed++; }, transaction() {
        const transaction = { objectStore() { return {
          get(key) { const request = {}; queueMicrotask(() => { request.result = records.get(key); transaction.oncomplete(); }); return request; },
          put(value, key) { queueMicrotask(() => {
            if (fail) { transaction.error = new Error("Quota exceeded"); transaction.onerror(); }
            else { records.set(key, value); transaction.oncomplete(); }
          }); return {}; },
          delete(key) { queueMicrotask(() => { records.delete(key); transaction.oncomplete(); }); return {}; },
        }; } };
        return transaction;
      } };
      open.onsuccess();
    }); return open;
  } };
  try {
    const key = draftKey("Owner@Example.test", "funding");
    const other = draftKey("other@example.test", "funding");
    const event = draftKey("owner@example.test", "event");
    assert.equal(key, draftKey("owner@example.test", "funding"));
    const draft = { entries: [["title", "Incomplete draft"]], state: { selectedFunds: ["fund"], fundAmounts: { fund: "4." } }, savedAt: "now" };
    await browserDraft(key, "write", draft);
    assert.deepEqual(await browserDraft(key, "read"), draft);
    assert.equal(await browserDraft(other, "read"), undefined);
    assert.equal(await browserDraft(event, "read"), undefined);
    assert.notEqual(draftKey("owner@example.test", "budget:first"), draftKey("owner@example.test", "budget:second"));
    fail = true;
    await assert.rejects(browserDraft(key, "write", { ...draft, state: null }), /Quota/);
    assert.deepEqual(await browserDraft(key, "read"), draft);
    await browserDraft(other, "write", draft).catch(() => {});
    fail = false; await browserDraft(other, "write", draft);
    await browserDraft(key, "delete");
    assert.equal(await browserDraft(key, "read"), undefined);
    assert.deepEqual(await browserDraft(other, "read"), draft);
    assert.equal(closed, 11);
  } finally { globalThis.indexedDB = previous; }
});
