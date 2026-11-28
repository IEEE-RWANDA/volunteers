import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";

test("unit managers assign standard and custom roles, reassign badges, and cannot bypass Chair scope", async () => {
  const stored = new Map();
  const units = {};
  const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compile("./volunteer-units.ts"), { exports: units, require: name => ({
    "node:crypto": crypto,
    "./volunteer-store": {
      listIntakeRecords: async folder => [...stored.keys()].filter(path => path.startsWith(folder + "/")),
      readIntakeJson: async path => stored.get(path) ?? null,
      saveIntakeFile: async (path, data) => stored.set(path, JSON.parse(data)),
    },
  }[name]) });
  const unit = { id: "unit", type: "chapter" };
  stored.set("volunteer-units/unit.json", unit);
  let manager = "chair@example.test";
  const members = [{ email: manager }, { email: "volunteer@example.test" }];
  const badges = [{ id: crypto.createHash("sha256").update(JSON.stringify([manager, "unit", "secretary"])).digest("hex"), email: manager, unitId: "unit", label: "Secretary" }];
  stored.set(`volunteer-unit-badges/${badges[0].id}.json`, badges[0]);
  const roles = [{ unitId: "unit", title: "Outreach lead" }, { unitId: "other", title: "Other unit role" }];
  assert.deepEqual(Array.from(units.unitAssignmentTitles("unit", roles, badges)), ["Chair", "Vice Chair", "Secretary", "Treasurer", "Outreach lead"]);
  const actions = {};
  vm.runInNewContext(compile("../app/dashboard/team-actions.ts"), { exports: actions, FormData, require: name => ({
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": { redirect: url => { throw new Error(url); } },
    "@/lib/session": { getVolunteer: async () => manager, getTeamAccess: async () => null, accountRoster: async () => members },
    "@/lib/volunteer-roster": { roster: async () => members },
    "@/lib/volunteer-units": { ...units, volunteerUnits: async () => [unit], unitLeads: async () => [{ email: "chair@example.test", unitId: "unit" }], openUnitRoles: async () => roles, unitBadges: async () => badges },
  }[name]) });
  const form = new FormData();
  form.set("unitId", "unit"); form.set("email", "volunteer@example.test");
  for (const title of ["Vice Chair", "Secretary", "Treasurer", "Outreach lead"]) {
    form.set("roleTitle", title);
    await assert.rejects(actions.assignUnit(form), /unit-assigned/);
    assert.ok([...stored.values()].some(item => item.email === "volunteer@example.test" && item.label === title));
  }
  form.set("roleTitle", "Other unit role");
  await assert.rejects(actions.assignUnit(form), /invalid-role/);
  form.set("roleTitle", "Chair");
  await assert.rejects(actions.assignUnit(form), /unit-forbidden/);
  form.set("badgeId", badges[0].id); form.set("label", "Secretary");
  await assert.rejects(actions.updateUnitBadge(form), /role-title-updated/);
  assert.equal(stored.get(`volunteer-unit-badges/${badges[0].id}.json`).email, "volunteer@example.test");
  await units.awardUnitBadge("chair@example.test", "unit", "Secretary");
  assert.ok([...stored.values()].some(item => item.email === "chair@example.test" && item.label === "Secretary"));
  const count = stored.size;
  await units.awardUnitBadge("chair@example.test", "unit", "Secretary");
  assert.equal(stored.size, count);
  manager = "outsider@example.test";
  await assert.rejects(actions.updateUnitBadge(form), /unit-forbidden/);
});
