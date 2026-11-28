import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parseEventBudget, itemCents } from "./event-budget.ts";

test("budget planner calculates exact cents and rejects malformed or excessive inputs", () => {
  const item = { description: "Meals", quantity: "3", unitCost: "0.10" };
  assert.equal(itemCents(item), 30);
  assert.equal(itemCents({ ...item, quantity: "999999", unitCost: "999999999.99" }), null);
  assert.deepEqual(parseEventBudget({ total: "300.00", items: [item] }), { total: "300.00", items: [item] });
  for (const value of ["-1", "NaN", "1e3", "0.001", "1000000000"]) assert.equal(parseEventBudget({ total: value, items: [] }), null);
  assert.equal(parseEventBudget({ total: "1", items: [{ ...item, quantity: "1.2" }] }), null);
  assert.equal(parseEventBudget({ total: "1", items: [{ ...item, description: " " }] }), null);
  assert.equal(parseEventBudget({ total: "1", items: Array(101).fill(item) }), null);
});

test("budget updates require the activity owner and only write budget records", async () => {
  let email = null;
  const writes = [];
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../app/dashboard/event-budget-actions.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: name => ({
      "@/lib/session": { getVolunteer: async () => email },
      "@/lib/event-budget": { parseEventBudget },
      "@/lib/volunteer-store": { ownVolunteerEvent: async (id, viewer) => id === "event" && viewer === "owner@example.test" ? { id } : null, saveIntakeFile: async (path, json) => writes.push({ path, data: JSON.parse(json) }) },
    }[name]),
  });
  const form = new FormData(); form.set("eventId", "event"); form.set("eventBudget", JSON.stringify({ total: "300", items: [] }));
  assert.ok((await exports.saveEventBudget(form)).error);
  email = "other@example.test"; assert.ok((await exports.saveEventBudget(form)).error);
  email = "owner@example.test"; form.set("eventBudget", "{}"); assert.ok((await exports.saveEventBudget(form)).error);
  assert.equal(writes.length, 0);
  form.set("eventBudget", JSON.stringify({ total: "300", items: [] }));
  assert.equal((await exports.saveEventBudget(form)).saved, true);
  assert.equal(writes[0].path, "event-budgets/event.json");
  assert.equal(writes[0].data.total, "300");
  assert.equal(writes[0].data.updatedBy, email);
});
