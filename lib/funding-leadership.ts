import { volunteerUnits, unitLeads, unitBadges, openUnitRoles, roleApplications } from "./volunteer-units";

const required = ["Chair", "Vice Chair", "Secretary", "Treasurer"] as const;

type Leadership = {
  chairs: { unitId: string; email: string }[];
  badges: { unitId: string; email: string; label: string }[];
  roles: { id: string; unitId: string; title: string }[];
  applications: { roleId: string; email: string; decision?: string }[];
};

export function missingFundingOfficials(unitId: string, leadership: Leadership) {
  const titles = leadership.badges.filter(item => item.unitId === unitId && item.email.trim()).map(item => item.label);
  if (leadership.chairs.some(item => item.unitId === unitId && item.email.trim())) titles.push("Chair");
  for (const application of leadership.applications) {
    if (application.decision !== "approved" || !application.email.trim()) continue;
    const role = leadership.roles.find(item => item.id === application.roleId && item.unitId === unitId);
    if (role) titles.push(role.title);
  }
  const assigned = new Set(titles.flatMap(title => title.toLowerCase().replace(/\bchairperson\b/g, "chair").replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ").trim().replace(/^(?:unit|chapter|student branch(?: chapter)?|branch)\s+/, "")
    .split(/\s*(?:\/|&|\band\b)\s*/)));
  return required.filter(title => !assigned.has(title.toLowerCase()));
}

export const unlinkedFundingActivity = "Link this activity to an organization before requesting funds. Its Chair, Vice Chair, Secretary and Treasurer must be assigned.";

export async function fundingLeadershipBlocks() {
  const [units, chairs, badges, roles, applications] = await Promise.all([
    volunteerUnits(), unitLeads(), unitBadges(), openUnitRoles(), roleApplications(),
  ]);
  return new Map(units.map(unit => {
    const missing = missingFundingOfficials(unit.id, { chairs, badges, roles, applications });
    return [unit.id, missing.length ? `${unit.name} cannot request funding yet. Assign: ${missing.join(", ")}.` : null] as const;
  }));
}
