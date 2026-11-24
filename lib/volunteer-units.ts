import { createHash, randomUUID } from "node:crypto";
import { listIntakeRecords, readIntakeJson, removeIntakeFiles, saveIntakeFile } from "./volunteer-store";

export const unitTypes = {
  chapter: "Chapter",
  branch: "Student branch",
  branchChapter: "Student branch chapter",
  affinity: "Affinity group",
  branchAffinity: "Student branch affinity group",
};

export type UnitType = keyof typeof unitTypes;
type Unit = { id: string; name: string; type: UnitType; parentId?: string; logoId?: string; logoType?: "image/png" | "image/jpeg"; deletedAt?: string; deletedBy?: string };
type Membership = { email: string; unitId: string };

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const isBranchOrganization = (type: UnitType) => type === "branchChapter" || type === "branchAffinity";

export async function volunteerUnits() {
  const paths = await listIntakeRecords("volunteer-units");
  const units = (await Promise.all(paths.map(path => readIntakeJson<Unit>(path))))
    .filter((unit): unit is Unit => unit !== null && !unit.deletedAt);
  const byId = new Map(units.map(unit => [unit.id, unit]));
  return units.map(unit => ({
    ...unit,
    label: unit.parentId ? `${byId.get(unit.parentId)?.name ?? "Student branch"} / ${unit.name}` : unit.name,
  })).sort((a, b) => a.label.localeCompare(b.label));
}

export async function archiveVolunteerUnit(id: string, deletedBy: string) {
  const path = `volunteer-units/${id}.json`;
  const unit = await readIntakeJson<Unit>(path);
  if (!unit || unit.deletedAt) return false;
  await saveIntakeFile(path, JSON.stringify({ ...unit, deletedAt: new Date().toISOString(), deletedBy }), true);
  return true;
}

export function unitLogoType(bytes: Buffer) {
  if (bytes.length > 1024 * 1024) return null;
  const header = bytes.subarray(0, 8).toString("hex");
  if (header === "89504e470d0a1a0a") return "image/png";
  if (header.startsWith("ffd8ff")) return "image/jpeg";
  return null;
}

export async function addVolunteerUnit(name: string, type: UnitType, parentId: string, logo?: Buffer) {
  const logoType = logo ? unitLogoType(logo) : undefined;
  if (logo && !logoType) return false;
  if (!name || name.length > 120 || !Object.hasOwn(unitTypes, type)) return false;
  if (isBranchOrganization(type)) {
    const parent = (await volunteerUnits()).find(unit => unit.id === parentId);
    if (parent?.type !== "branch") return false;
  } else if (parentId) {
    return false;
  }
  const id = hash(JSON.stringify([type, parentId, name.toLowerCase()]));
  const path = `volunteer-units/${id}.json`;
  if (await readIntakeJson<Unit>(path)) return false;
  if (!logo || !logoType) {
    try {
      await saveIntakeFile(path, JSON.stringify({ id, name, type, parentId: parentId || undefined }));
      return true;
    } catch (error) {
      if (await readIntakeJson<Unit>(path)) return false;
      throw error;
    }
  }
  const logoId = randomUUID();
  const logoPath = `volunteer-unit-logos/${logoId}`;
  await saveIntakeFile(logoPath, logo);
  try {
    await saveIntakeFile(path, JSON.stringify({ id, name, type, parentId: parentId || undefined, logoId, logoType }));
  } catch (error) {
    const saved = await readIntakeJson<Unit>(path);
    if (saved?.logoId === logoId) return true;
    await removeIntakeFiles([logoPath]).catch(() => {});
    if (saved) return false;
    throw error;
  }
  return true;
}

export async function assignVolunteerUnit(email: string, unitId: string) {
  if (!(await volunteerUnits()).some(unit => unit.id === unitId)) return false;
  const path = `volunteer-memberships/${hash(JSON.stringify([email, unitId]))}.json`;
  if (await readIntakeJson<Membership>(path)) return true;
  try {
    await saveIntakeFile(path, JSON.stringify({ email, unitId }));
  } catch (error) {
    if (!await readIntakeJson<Membership>(path)) throw error;
  }
  return true;
}

export async function unitMemberships() {
  const paths = await listIntakeRecords("volunteer-memberships");
  return (await Promise.all(paths.map(path => readIntakeJson<Membership>(path))))
    .filter(membership => membership !== null);
}

type UnitBadge = { id: string; email: string; unitId: string; label: string };
type UnitRole = { id: string; unitId: string; title: string; description: string };
type RoleApplication = { id: string; roleId: string; email: string };
type RoleDecision = { decision: "approved" | "declined" };

async function records<T>(folder: string) {
  const paths = await listIntakeRecords(folder);
  return (await Promise.all(paths.map(path => readIntakeJson<T>(path))))
    .filter(record => record !== null);
}

export const unitLeads = () => records<Membership>("volunteer-unit-leads");
export const openUnitRoles = () => records<UnitRole>("volunteer-unit-roles");

export async function unitBadges() {
  const folder = "volunteer-unit-badges";
  const paths = await listIntakeRecords(folder);
  const badges = await Promise.all(paths.map(async path => {
    const badge = await readIntakeJson<Omit<UnitBadge, "id">>(path);
    return badge ? { id: path.slice(folder.length + 1, -5), ...badge } : null;
  }));
  return badges.filter((badge): badge is UnitBadge => badge !== null);
}

export async function roleApplications() {
  const applications = await records<RoleApplication>("volunteer-role-applications");
  return Promise.all(applications.map(async application => ({
    ...application,
    decision: (await readIntakeJson<RoleDecision>(`volunteer-role-decisions/${application.id}.json`))?.decision,
  })));
}

async function saveOnce<T>(path: string, record: T) {
  if (await readIntakeJson<T>(path)) return;
  try {
    await saveIntakeFile(path, JSON.stringify(record));
  } catch (error) {
    if (!await readIntakeJson<T>(path)) throw error;
  }
}

export async function designateUnitLead(email: string, unitId: string) {
  await saveOnce(`volunteer-unit-leads/${hash(JSON.stringify([email, unitId]))}.json`, { email, unitId });
}

export async function awardUnitBadge(email: string, unitId: string, label: string) {
  await saveOnce(`volunteer-unit-badges/${hash(JSON.stringify([email, unitId, label.toLowerCase()]))}.json`, { email, unitId, label });
}

export async function editUnitBadge(id: string, label: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) return false;
  const path = `volunteer-unit-badges/${id}.json`;
  const badge = await readIntakeJson<Omit<UnitBadge, "id">>(path);
  if (!badge) return false;
  await saveIntakeFile(path, JSON.stringify({ ...badge, label }), true);
  return true;
}

export async function postUnitRole(unitId: string, title: string, description: string) {
  const id = hash(JSON.stringify([unitId, title.toLowerCase()]));
  await saveOnce(`volunteer-unit-roles/${id}.json`, { id, unitId, title, description });
}

export async function applyForUnitRole(email: string, roleId: string) {
  const id = hash(JSON.stringify([email, roleId]));
  await saveOnce(`volunteer-role-applications/${id}.json`, { id, email, roleId });
}

export async function decideUnitApplication(id: string, decision: RoleDecision["decision"]) {
  const path = `volunteer-role-decisions/${id}.json`;
  if (await readIntakeJson<RoleDecision>(path)) return false;
  await saveIntakeFile(path, JSON.stringify({ decision }));
  return true;
}

export function canManageAllUnits(admin: boolean) {
  return admin;
}

export function canManageUnit(email: string, unit: Unit, systemWide: boolean, chairs: Membership[]) {
  return systemWide || chairs.some(chair => chair.email === email &&
    (chair.unitId === unit.id || (isBranchOrganization(unit.type) && chair.unitId === unit.parentId)));
}

export function canCreateUnit(email: string, type: UnitType, parent: Unit | undefined, systemWide: boolean, chairs: Membership[]) {
  return systemWide || (isBranchOrganization(type) && parent?.type === "branch" &&
    canManageUnit(email, parent, false, chairs));
}

export function canDeleteUnit(email: string, unit: Unit, systemWide: boolean, chairs: Membership[], units: Unit[]) {
  if (systemWide) return true;
  if (!isBranchOrganization(unit.type) || !unit.parentId) return false;
  const parent = units.find(candidate => candidate.id === unit.parentId);
  return parent?.type === "branch" && canManageUnit(email, parent, false, chairs);
}

export function canDesignateUnitChair(email: string, unit: Unit, systemWide: boolean, chairs: Membership[]) {
  return systemWide || (isBranchOrganization(unit.type) &&
    chairs.some(chair => chair.email === email && chair.unitId === unit.parentId));
}


export async function volunteerExperiences(emails: string[]) {
  const [units, chairs, badges, openings, applications] = await Promise.all([
    volunteerUnits(), unitLeads(), unitBadges(), openUnitRoles(), roleApplications(),
  ]);
  const result = new Map(emails.map(email => [email, [] as { unit: (typeof units)[number]; title: string; description: string }[]]));
  for (const email of emails) {
    const experience = result.get(email)!;
    const applied = new Set(applications.filter(item => item.email === email && item.decision === "approved").map(item => item.roleId));
    for (const unit of units) {
      const descriptions = new Map(openings.filter(role => role.unitId === unit.id && applied.has(role.id))
        .map(role => [role.title, role.description]));
      for (const badge of badges.filter(item => item.email === email && item.unitId === unit.id)) {
        if (!descriptions.has(badge.label)) descriptions.set(badge.label, "");
      }
      if (chairs.some(entry => entry.email === email && entry.unitId === unit.id) && !descriptions.has("Unit chair")) {
        descriptions.set("Unit chair", "");
      }
      experience.push(...[...descriptions].map(([title, description]) => ({ unit, title, description })));
    }
  }
  return result;
}

export async function volunteerExperience(email: string) {
  return (await volunteerExperiences([email])).get(email) ?? [];
}
