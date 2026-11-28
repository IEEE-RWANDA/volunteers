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

test("subsection budget template preserves currencies, conversions, categories and funding gap", async () => {
  const { templateBudget, budgetTotals, budgetRate } = await import("./event-budget.ts");
  const budget = templateBudget();
  assert.equal(budget.currency, "RWF");
  assert.equal(budget.items.length, 16);
  assert.equal(budget.items.every(item => item.unitCost === "0"), true);
  budget.items = [{ category: "CATERING", description: "Lunch", quantity: "100", unitCost: "8000" }];
  budget.fundingSources = [{ name: "IEEE", currency: "USD", amount: "700" }];
  const totals = budgetTotals(budget);
  assert.equal(totals.required.rwf, 80000000);
  assert.equal(totals.required.usd, 54179);
  assert.equal(totals.funding.rwf, 103362000);
  assert.equal(totals.gap.rwf, 23362000);
  assert.ok(parseEventBudget(budget));
  assert.equal(parseEventBudget({ ...budget, exchangeRate: "0" }), null);
  assert.equal(budgetRate({ ...budget, exchangeRate: "NaN" }), null);
  assert.equal(parseEventBudget({ ...budget, fundingSources: [{ name: "", amount: "1", currency: "USD" }] }), null);
  const legacy = { total: "300", items: [{ description: "Catering", quantity: "25", unitCost: "10" }] };
  assert.equal(budgetTotals(legacy).required.usd, 25000);
  assert.deepEqual(parseEventBudget(legacy), legacy);
});

test("reference workshop figures reconcile to the spreadsheet's RWF 8,859,600 and USD 6,000", async () => {
  const { templateBudget, budgetTotals } = await import("./event-budget.ts");
  const budget = templateBudget();
  const figures = [[65,14400],[3,177000],[120,4760],[1,326240],[65,10200],[40,8500],[65,3600],[65,2400],[65,10200],[100,5000],[100,8000],[100,5000],[1,162500],[1,147660],[1,649000],[1,1680000]];
  budget.items = budget.items.map((item, index) => ({ ...item, quantity: String(figures[index][0]), unitCost: String(figures[index][1]) }));
  budget.fundingSources = [700,700,1000,800,500,2300].map((amount, i) => ({ name: `Source ${i+1}`, amount: String(amount), currency: "USD" }));
  assert.deepEqual(budgetTotals(budget), { required: { rwf: 885960000, usd: 600000 }, funding: { rwf: 885960000, usd: 600000 }, gap: { rwf: 0, usd: 0 } });
});
