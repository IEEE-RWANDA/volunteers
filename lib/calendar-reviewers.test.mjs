import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

test("Secretary owns calendar review and delegation; reviewers gain no delegation rights and can be revoked", async () => {
  let members = [
    { email: "secretary@example.test", officerTitle: "Secretary" },
    { email: "admin@example.test", officerTitle: "Treasurer" },
    { email: "volunteer@example.test" },
  ];
  const records = new Map();
  const api = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./calendar-reviewers.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: api,
    require: name => ({
      "node:crypto": { createHash },
      "./session": { accountRoster: async () => members },
      "./volunteer-store": {
        readIntakeJson: async path => records.get(path) ?? null,
        listIntakeRecords: async () => [...records.keys()],
        saveIntakeFile: async (path, data) => records.set(path, JSON.parse(data)),
      },
    }[name]),
  });
  assert.equal((await api.calendarReviewAccess("secretary@example.test")).canManage, true);
  assert.equal((await api.calendarReviewAccess("admin@example.test")).canReview, false);
  assert.equal(await api.setCalendarReviewer("admin@example.test", "volunteer@example.test", true), false);
  assert.equal(await api.setCalendarReviewer("secretary@example.test", "unknown@example.test", true), false);
  assert.equal(await api.setCalendarReviewer("secretary@example.test", "secretary@example.test", false), false);
  assert.equal(await api.setCalendarReviewer("secretary@example.test", "volunteer@example.test", true), true);
  assert.equal((await api.calendarReviewAccess("volunteer@example.test")).canReview, true);
  assert.equal((await api.calendarReviewAccess("volunteer@example.test")).canManage, false);
  assert.equal(await api.setCalendarReviewer("volunteer@example.test", "admin@example.test", true), false);
  assert.equal((await api.calendarReviewers()).length, 2);
  assert.equal(await api.setCalendarReviewer("secretary@example.test", "volunteer@example.test", false), true);
  assert.equal((await api.calendarReviewAccess("volunteer@example.test")).canReview, false);
  members = members.map(member => ({ ...member, officerTitle: member.email === "admin@example.test" ? "Secretary" : undefined }));
  assert.equal((await api.calendarReviewAccess("secretary@example.test")).canManage, false);
  assert.equal((await api.calendarReviewAccess("admin@example.test")).canManage, true);
  await api.setCalendarReviewer("admin@example.test", "volunteer@example.test", true);
  members = members.filter(member => member.email !== "volunteer@example.test");
  assert.equal((await api.calendarReviewAccess("volunteer@example.test")).canReview, false);
  assert.equal((await api.calendarReviewers()).some(member => member.email === "volunteer@example.test"), false);
});
