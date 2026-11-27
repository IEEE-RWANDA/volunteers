"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountRoster, getTeamAccess, getVolunteer } from "@/lib/session";
import { addToRoster, roster } from "@/lib/volunteer-roster";
import { addVolunteerUnit, applyForUnitRole, archiveVolunteerUnit, assignVolunteerUnit, awardUnitBadge, canCreateUnit, canDeleteUnit, canDesignateUnitChair, canManageAllUnits, canManageUnit, decideUnitApplication, designateUnitLead, editUnitBadge, openUnitRoles, postUnitRole, roleApplications, unitBadges, unitLeads, unitMemberships, updateVolunteerUnit, volunteerUnits, type UnitType } from "@/lib/volunteer-units";

function finish(status: string): never {
  revalidatePath("/");
  redirect("/?section=team&tab=roster&team=" + status);
}

export async function addVolunteer(form: FormData) {
  const access = await getTeamAccess();
  if (access?.role !== "admin") redirect("/");
  const field = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const name = field("name");
  const email = field("email").toLowerCase();
  const committee = field("committee");
  if (!name || name.length > 120 || !committee || committee.length > 120 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) finish("invalid-volunteer");
  if ((await roster()).some(member => member.email === email)) finish("duplicate");
  try {
    await addToRoster({ name, email, committee });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") finish("duplicate");
    finish("unavailable");
  }
  finish("volunteer-added");
}

export async function createUnit(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const type = String(form.get("type") ?? "") as UnitType;
  const parentId = String(form.get("parentId") ?? "");
  const { email, units, chairs, systemWide } = await unitAuthority();
  if (!canCreateUnit(email, type, units.find(unit => unit.id === parentId), systemWide, chairs)) unitResult("unit-forbidden");
  const logo = form.get("logo");
  if (logo !== null && (!(logo instanceof File) || logo.size > 1024 * 1024)) unitResult("invalid-unit-logo");
  const logoBytes = logo instanceof File && logo.size ? Buffer.from(await logo.arrayBuffer()) : undefined;
  const added = await addVolunteerUnit(name, type, parentId, logoBytes).catch(() => false);
  unitResult(added ? "unit-added" : "invalid-unit", type);
}

export async function assignUnit(form: FormData) {
  const email = String(form.get("email") ?? "");
  const unitId = String(form.get("unitId") ?? "");
  const authority = await requireUnitManager(unitId);
  const chair = form.get("lead") === "yes";
  if (chair && !canDesignateUnitChair(authority.email, authority.unit, authority.systemWide, authority.chairs)) {
    unitResult("unit-forbidden");
  }
  if (!(await roster()).some(volunteer => volunteer.email === email)) unitResult("invalid-unit-member");
  if (chair && !(await accountRoster()).some(account => account.email === email)) unitResult("unit-chair-access");
  try {
    await assignVolunteerUnit(email, unitId);
    if (chair) await designateUnitLead(email, unitId);
  } catch {
    unitResult("unit-unavailable");
  }
  unitResult(chair ? "unit-chair-assigned" : "unit-assigned", authority.unit.type);
}

export async function editUnit(form: FormData) {
  const unitId = String(form.get("unitId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const { unit } = await requireUnitManager(unitId);
  const logo = form.get("logo");
  if (logo !== null && (!(logo instanceof File) || logo.size > 1024 * 1024)) unitResult("invalid-unit-logo", unit.type);
  const logoBytes = logo instanceof File && logo.size ? Buffer.from(await logo.arrayBuffer()) : undefined;
  const updated = await updateVolunteerUnit(unitId, name, logoBytes).catch(() => false);
  unitResult(updated ? "unit-updated" : "invalid-unit", unit.type);
}

export async function deleteUnit(form: FormData) {
  const unitId = String(form.get("unitId") ?? "");
  const confirmation = String(form.get("confirmation") ?? "").trim();
  const authority = await unitAuthority();
  const unit = authority.units.find(candidate => candidate.id === unitId);
  if (!unit || !canDeleteUnit(authority.email, unit, authority.systemWide, authority.chairs, authority.units)) {
    unitResult("unit-forbidden");
  }
  if (authority.units.some(candidate => candidate.parentId === unit.id)) unitResult("unit-has-children", unit.type);
  if (confirmation !== unit.name) unitResult("unit-delete-confirmation", unit.type);
  const deleted = await archiveVolunteerUnit(unit.id, authority.email).catch(() => false);
  unitResult(deleted ? "unit-deleted" : "unit-unavailable", unit.type);
}

function unitResult(status: string, type?: UnitType): never {
  revalidatePath("/");
  const group = type === "branch" || type === "branchChapter" || type === "branchAffinity" ? "branch" : type === "affinity" ? "affinity" : "chapter";
  redirect(`/?section=volunteers&tab=organizations&group=${group}&unitStatus=${status}#volunteer-units`);
}

async function unitAuthority() {
  const email = await getVolunteer();
  if (!email) redirect("/");
  const [access, units, chairs] = await Promise.all([getTeamAccess(), volunteerUnits(), unitLeads()]);
  return { email, units, chairs, systemWide: canManageAllUnits(access?.role === "admin") };
}

async function requireUnitManager(unitId: string) {
  const authority = await unitAuthority();
  const unit = authority.units.find(item => item.id === unitId);
  if (!unit || !canManageUnit(authority.email, unit, authority.systemWide, authority.chairs)) unitResult("unit-forbidden");
  return { ...authority, unit };
}

export async function giveUnitBadge(form: FormData) {
  const unitId = String(form.get("unitId") ?? "");
  const email = String(form.get("email") ?? "");
  const label = String(form.get("label") ?? "").trim();
  const { unit } = await requireUnitManager(unitId);
  const [memberships, roles, applications] = await Promise.all([unitMemberships(), openUnitRoles(), roleApplications()]);
  const accepted = applications.some(item => item.email === email && item.decision === "approved" &&
    roles.some(role => role.id === item.roleId && role.unitId === unitId));
  if (!label || label.length > 60 || (!accepted && !memberships.some(item => item.email === email && item.unitId === unitId))) {
    unitResult("invalid-badge");
  }
  await awardUnitBadge(email, unitId, label).catch(() => unitResult("unit-unavailable"));
  unitResult("badge-awarded", unit.type);
}

export async function updateUnitBadge(form: FormData) {
  const unitId = String(form.get("unitId") ?? "");
  const badgeId = String(form.get("badgeId") ?? "");
  const label = String(form.get("label") ?? "").trim();
  const { unit } = await requireUnitManager(unitId);
  const badge = (await unitBadges()).find(item => item.id === badgeId && item.unitId === unitId);
  if (!badge || !label || label.length > 60) unitResult("invalid-badge", unit.type);
  const updated = await editUnitBadge(badgeId, label).catch(() => false);
  unitResult(updated ? "role-title-updated" : "unit-unavailable", unit.type);
}

export async function addUnitRole(form: FormData) {
  const unitId = String(form.get("unitId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const { unit } = await requireUnitManager(unitId);
  if (!title || title.length > 60 || !description || description.length > 1000 ||
      !(await volunteerUnits()).some(unit => unit.id === unitId)) unitResult("invalid-role");
  await postUnitRole(unitId, title, description).catch(() => unitResult("unit-unavailable"));
  unitResult("role-posted", unit.type);
}

export async function applyToUnitRole(form: FormData) {
  const email = await getVolunteer();
  if (!email) redirect("/");
  const roleId = String(form.get("roleId") ?? "");
  if (!(await openUnitRoles()).some(role => role.id === roleId)) unitResult("invalid-role");
  try {
    await applyForUnitRole(email, roleId);
  } catch {
    redirect(`/?section=volunteers&tab=roles&role=${roleId}&unitStatus=unit-unavailable`);
  }
  revalidatePath("/");
  redirect(`/?section=volunteers&tab=roles&role=${roleId}&unitStatus=role-applied`);
}

export async function reviewUnitApplication(form: FormData) {
  const id = String(form.get("applicationId") ?? "");
  const decision = form.get("decision");
  const application = (await roleApplications()).find(item => item.id === id);
  const role = (await openUnitRoles()).find(item => item.id === application?.roleId);
  if (!role || !application || application.decision || (decision !== "approved" && decision !== "declined")) unitResult("invalid-role");
  const { unit } = await requireUnitManager(role.unitId);
  const saved = await decideUnitApplication(id, decision).catch(() => false);
  unitResult(saved ? "application-reviewed" : "invalid-role", unit.type);
}
