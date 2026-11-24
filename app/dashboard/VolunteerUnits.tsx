import Link from "next/link";
import UnitLogo from "./UnitLogo";
import { canDesignateUnitChair, canManageAllUnits, canManageUnit, openUnitRoles, roleApplications, unitBadges, unitLeads, unitMemberships, unitTypes, volunteerUnits } from "@/lib/volunteer-units";
import { addUnitRole, assignUnit, createUnit, giveUnitBadge, reviewUnitApplication } from "./team-actions";

const organizationGroups = [
  { type: "chapter", title: "Chapters", empty: "No chapters have been added." },
  { type: "branch", title: "Student branches", empty: "No student branches have been added." },
  { type: "affinity", title: "Affinity groups", empty: "No affinity groups have been added." },
] as const;

const messages: Record<string, string> = {
  "unit-added": "Unit created.",
  "unit-assigned": "Volunteer assigned to the unit.",
  "unit-chair-assigned": "Volunteer designated as a unit chair.",
  "invalid-unit-logo": "Attach a PNG or JPEG logo up to 1 MB.",
  "invalid-unit": "Check the unit name and parent branch. Each unit name must be unique within its type and parent.",
  "invalid-unit-member": "Select an existing volunteer and unit.",
  "badge-awarded": "Role badge awarded.",
  "role-posted": "Open role posted.",
  "role-applied": "Application submitted.",
  "application-reviewed": "Application decision saved.",
  "unit-forbidden": "You do not have permission to manage that unit.",
  "invalid-badge": "Select a unit member and enter a badge title.",
  "invalid-role": "Check the role details or application status.",
  "unit-unavailable": "The change could not be saved. Please try again.",
};

export default async function VolunteerUnits({ members, viewer, admin = false, status, group }: {
  members: { email: string; name: string }[];
  viewer: string;
  admin?: boolean;
  status?: string;
  group?: string;
}) {
  const [units, memberships, leads, badges, roles, applications] = await Promise.all([
    volunteerUnits(), unitMemberships(), unitLeads(), unitBadges(), openUnitRoles(), roleApplications(),
  ]);
  const names = new Map(members.map(member => [member.email, member.name]));
  const systemWide = canManageAllUnits(admin);
  const manageable = units.filter(unit => canManageUnit(viewer, unit, systemWide, leads));
  const branches = manageable.filter(unit => unit.type === "branch");
  const canCreate = systemWide || branches.length > 0;
  const canAppointChair = manageable.some(unit => canDesignateUnitChair(viewer, unit, systemWide, leads));
  const activeGroup = group === undefined ? undefined : organizationGroups.find(item => item.type === group) ?? organizationGroups[0];
  const groups = activeGroup ? [activeGroup] : organizationGroups;
  const message = status && Object.hasOwn(messages, status) ? messages[status] : null;

  return (
    <section className="panel scroll-mt-5" id="volunteer-units" aria-labelledby="volunteer-units-title">
      <h2 id="volunteer-units-title" className="panel-title">Organizations</h2>
      {message && <p role="status" className="mt-3 text-sm font-semibold text-navy">{message}</p>}
      {(canCreate || manageable.length > 0) && (
        <details className="mt-4 rounded-lg border border-line bg-paper-2 p-4">
          <summary className="cursor-pointer font-semibold text-navy">Manage organizations</summary>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {canCreate && <form action={createUnit} aria-label="Create a unit" className="space-y-3">
              <label className="block text-sm font-semibold">Unit name
                <input name="name" className="login-input" required maxLength={120} />
              </label>
              {systemWide ? <label className="block text-sm font-semibold">Unit type
                <select name="type" className="login-input">
                  {Object.entries(unitTypes).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                </select>
              </label> : <input type="hidden" name="type" value="branchChapter" />}
              <label className="block text-sm font-semibold">Parent student branch
                <select name="parentId" className="login-input" required={!systemWide}>
                  {systemWide && <option value="">None</option>}
                  {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
                <span className="mt-1 block font-normal text-ink-soft">Required for student branch chapters.</span>
              </label>
              <label className="block text-sm font-semibold">Organization logo
                <input name="logo" className="login-input" type="file" accept="image/png,image/jpeg" />
                <span className="mt-1 block font-normal text-ink-soft">Optional PNG or JPEG, up to 1 MB. Initials are shown without a logo.</span>
              </label>
              <button className="btn btn-primary" type="submit">{systemWide ? "Create unit" : "Create student branch chapter"}</button>
            </form>}
            {manageable.length > 0 && members.length > 0 && (
              <form action={assignUnit} aria-label="Assign a volunteer" className="space-y-3">
                <label className="block text-sm font-semibold">Volunteer
                  <select name="email" className="login-input" required defaultValue="">
                    <option disabled value="">Select a volunteer</option>
                    {members.map(member => <option key={member.email} value={member.email}>{member.name} · {member.email}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold">Unit
                  <select name="unitId" className="login-input" required defaultValue="">
                    <option disabled value="">Select a unit</option>
                    {manageable.map(unit => <option key={unit.id} value={unit.id}>{unit.label} · {unitTypes[unit.type]}</option>)}
                  </select>
                </label>
                {canAppointChair && <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="lead" value="yes" className="mt-1" />
                  <span>{systemWide ? "Designate as an authorized unit chair" : "Designate as chapter chair (student branch chapters only)"}</span>
                </label>}
                <button className="btn btn-primary" type="submit">Assign volunteer</button>
              </form>
            )}
          </div>
        </details>
      )}
      {activeGroup && (
        <nav aria-label="Organization categories" className="dashboard-nav mt-5">
          {organizationGroups.map(item => (
            <Link key={item.type} href={`/?section=volunteers&tab=organizations&group=${item.type}`}
              aria-current={activeGroup.type === item.type ? "page" : undefined}>{item.title}</Link>
          ))}
        </nav>
      )}
      <div className="mt-5 space-y-6">
        {groups.map(group => {
          const groupUnits = units.filter(unit => unit.type === group.type);
          return (
            <section key={group.type} aria-labelledby={`volunteer-group-${group.type}`} className="border-t border-line pt-5">
              <h3 id={`volunteer-group-${group.type}`} className="font-display text-lg font-bold text-navy">{group.title}</h3>
              {groupUnits.length ? (
                <ul className="mt-3 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groupUnits.map(unit => {
                    const chapters = units.filter(chapter => chapter.type === "branchChapter" && chapter.parentId === unit.id);
                    return (
                      <li key={unit.id} className="min-w-0 rounded-lg border border-line p-4">
                        <div className="mb-2 flex items-center gap-3">
                          <UnitLogo unit={unit} />
                          <h4 className="wrap-anywhere font-semibold text-navy">{unit.name}</h4>
                        </div>
                        {unitDetails(unit.id)}
                        {chapters.length > 0 && (
                          <div className="mt-4 border-t border-line pt-3">
                            <h5 className="text-sm font-semibold text-navy">Student branch chapters</h5>
                            <ul className="mt-2 space-y-3 border-s border-line ps-3">
                              {chapters.map(chapter => (
                                <li key={chapter.id}>
                                  <div className="mb-2 flex items-center gap-3">
                                    <UnitLogo unit={chapter} />
                                    <h6 className="wrap-anywhere text-sm font-semibold text-navy">{chapter.name}</h6>
                                  </div>
                                  {unitDetails(chapter.id)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="mt-2 text-sm text-ink-soft">{group.empty}</p>}
            </section>
          );
        })}
      </div>
    </section>
  );

  function unitDetails(unitId: string) {
    const manager = manageable.some(unit => unit.id === unitId);
    const unitRoles = roles.filter(role => role.unitId === unitId);
    const accepted = applications.flatMap(application => {
      const role = unitRoles.find(role => role.id === application.roleId);
      return application.decision === "approved" && role ? [{ email: application.email, label: role.title }] : [];
    });
    const memberEmails = new Set([
      ...memberships.filter(item => item.unitId === unitId).map(item => item.email),
      ...accepted.map(item => item.email),
    ]);
    const assigned = members.filter(member => memberEmails.has(member.email));

    return (
      <>
        {assigned.length ? (
          <ul className="mt-2 space-y-2 text-sm text-ink-soft">
            {assigned.map(member => {
              const labels = new Set([
                ...badges.filter(badge => badge.email === member.email && badge.unitId === unitId).map(badge => badge.label),
                ...accepted.filter(item => item.email === member.email).map(item => item.label),
              ]);
              if (leads.some(lead => lead.email === member.email && lead.unitId === unitId)) labels.add("Unit chair");
              return (
                <li key={member.email}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{member.name}</span>
                    {[...labels].map(label => (
                      <span key={label} className="rounded-full bg-paper-2 px-2 py-0.5 text-xs font-semibold text-navy"><span aria-hidden="true">★ </span>{label}</span>
                    ))}
                  </div>
                  {manager && (
                    <details className="mt-1">
                      <summary className="cursor-pointer font-medium text-blue">Award role badge</summary>
                      <form action={giveUnitBadge} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="unitId" value={unitId} />
                        <input type="hidden" name="email" value={member.email} />
                        <label className="min-w-0 grow text-xs font-semibold">Badge title
                          <input name="label" className="login-input" maxLength={60} required />
                        </label>
                        <button className="btn btn-primary text-xs" type="submit">Award badge</button>
                      </form>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-1 text-sm text-ink-soft">No volunteers assigned.</p>}
        {manager && unitRoles.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <h3 className="text-sm font-semibold text-navy">Open roles</h3>
            <ul className="mt-2 space-y-3">
              {unitRoles.map(role => {
                const applicants = applications.filter(application => application.roleId === role.id);
                return (
                  <li className="rounded-md bg-paper-2 p-3 text-sm" key={role.id}>
                    <p className="font-semibold text-navy">{role.title}</p>
                    <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-ink-soft">{role.description}</p>
                    {applicants.length > 0 && (
                      <ul className="mt-3 space-y-2 border-t border-line pt-2">
                        {applicants.map(application => (
                          <li key={application.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span className="wrap-anywhere">{names.get(application.email) ?? application.email}</span>
                            {application.decision ? (
                              <span className="capitalize">{application.decision}</span>
                            ) : (
                              <form action={reviewUnitApplication} className="flex gap-2">
                                <input type="hidden" name="applicationId" value={application.id} />
                                <button className="action-link" name="decision" value="approved" type="submit">Accept</button>
                                <button className="action-link" name="decision" value="declined" type="submit">Decline</button>
                              </form>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {manager && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-blue">Post an open role</summary>
            <form action={addUnitRole} className="mt-2 space-y-2">
              <input type="hidden" name="unitId" value={unitId} />
              <label className="block font-semibold">Role title
                <input name="title" className="login-input" maxLength={60} required />
              </label>
              <label className="block font-semibold">Responsibilities
                <textarea name="description" className="login-input" rows={3} maxLength={1000} required />
              </label>
              <button className="btn btn-primary text-xs" type="submit">Post role</button>
            </form>
          </details>
        )}
      </>
    );
  }
}
