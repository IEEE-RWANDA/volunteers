import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import { formatUsd } from "./fund-amounts.ts";

test("volunteer funding summary excludes other volunteers and unassigned funds", () => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../app/dashboard/VolunteerFundingSummary.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: name => ({ "react/jsx-runtime": jsxRuntime, "next/link": { default: ({ children, ...props }) => createElement("a", props, children) }, "@/lib/fund-amounts": { formatUsd } }[name]),
  });
  const html = renderToStaticMarkup(createElement(exports.default, {
    email: "owner@example.test",
    funds: [{ id: "mine", name: "Assigned fund", volunteerEmail: "owner@example.test", assignedCents: 30000, remainingCents: 5000 }, { id: "other", name: "Other private fund", volunteerEmail: "other@example.test", remainingCents: 1 }, { id: "general", name: "Unassigned fund", remainingCents: 1 }],
    records: [{ id: "request", kind: "funding", title: "My activity", submittedBy: "owner@example.test", amount: "300 USD", releasedAmount: "250 USD", releasedAt: "2026-11-01" }, { id: "other", kind: "funding", title: "Other private request", submittedBy: "other@example.test" }],
    statuses: new Map([["request", { label: "Changes requested" }]]),
  }));
  assert.match(html, /Assigned fund/); assert.match(html, /300\.00/); assert.match(html, /50\.00/);
  assert.match(html, /300 USD/); assert.match(html, /250 USD/); assert.match(html, /Changes requested/);
  assert.doesNotMatch(html, /Other private|Unassigned fund/);
});
