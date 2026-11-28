import Link from "next/link";
import type { ReactNode } from "react";
import ActionModal from "./ActionModal";
import UnitLogo from "./UnitLogo";
import StudentBranchTabs from "./StudentBranchTabs";
import { canDeleteUnit, canDesignateUnitChair, canManageAllUnits, canManageUnit, openUnitRoles, roleApplications, unitAssignmentTitles, unitBadges, unitLeads, unitMemberships, unitTypes, volunteerUnits } from "@/lib/volunteer-units";
import { addUnitRole, assignUnit, createUnit, deleteUnit, editUnit, giveUnitBadge, reviewUnitApplication, updateUnitBadge } from "./team-actions";

const organizationGroups = [
  { type: "chapter", title: "Chapters", empty: "No chapters have been added.", createTitle: "Create a chapter" },
  { type: "branch", title: "Student branches", empty: "No student branches have been added.", createTitle: "Create a student branch" },
  { type: "affinity", title: "Affinity groups", empty: "No affinity groups have been added.", createTitle: "Create an affinity group" },
] as const;

const messages: Record<string, string> = {
  "unit-added": "Organization created. You can assign volunteers from its card below.",
  "unit-assigned": "Volunteer assigned to the unit.",
  "unit-chair-assigned": "Volunteer designated as a unit chair.",
  "unit-chair-access": "Only a volunteer with approved sign-in access can be designated as a unit chair.",
  "unit-updated": "Organization updated.",
  "unit-deleted": "Organization deleted from active views. Its historical records were preserved.",
  "unit-delete-confirmation": "Enter the organization name exactly to confirm deletion.",
  "unit-has-children": "Delete the student branch’s child organizations before deleting the student branch.",
  "invalid-unit-logo": "Attach a PNG or JPEG logo up to 1 MB.",
  "invalid-unit": "Check the organization name, type, and parent. Only student branch chapters and affinity groups use a parent student branch.",
  "invalid-unit-member": "Select an existing volunteer and unit.",
  "badge-awarded": "Role title added.",
  "role-title-updated": "Role assignment updated.",
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
  const activeGroup = group === undefined ? undefined : organizationGroups.find(item => item.type === group) ?? organizationGroups[0];
  const groups = activeGroup ? [activeGroup] : organizationGroups;
  const message = status && Object.hasOwn(messages, status) ? messages[status] : null;

  return (
    <section className="panel scroll-mt-5" id="volunteer-units" aria-labelledby="volunteer-units-title">
      <h2 id="volunteer-units-title" className="panel-title">Organizations</h2>
      {message && <p role="status" className="mt-3 text-sm font-semibold text-navy">{message}</p>}
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
          const cards = groupUnits.map(unit => {
            const chapters = units.filter(chapter => (chapter.type === "branchChapter" || chapter.type === "branchAffinity") && chapter.parentId === unit.id);
            return (
              <li key={unit.id} className="min-w-0 rounded-lg border border-line p-4">
                {organizationModal(unit)}
                {chapters.length > 0 && (
                  <div className="mt-4 border-t border-line pt-3">
                    <h5 className="text-sm font-semibold text-navy">Student branch organizations</h5>
                    <ul className="mt-3 grid items-start gap-3 md:grid-cols-2">
                      {chapters.map(chapter => (
                        <li key={chapter.id} className="rounded-md border border-line p-3">
                          {organizationModal(chapter)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          });
          return (
            <section key={group.type} aria-labelledby={`volunteer-group-${group.type}`} className="border-t border-line pt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 id={`volunteer-group-${group.type}`} className="font-display text-lg font-bold text-navy">{group.title}</h3>
                {systemWide && (
                  <ActionModal label={`Create ${unitTypes[group.type].toLowerCase()}`} title={group.createTitle} icon="plus">
                    {createUnitForm(group.type)}
                  </ActionModal>
                )}
              </div>
              {groupUnits.length ? (
                group.type === "branch" ? (
                  <StudentBranchTabs branches={groupUnits.map(unit => ({ id: unit.id, name: unit.name, logo: <UnitLogo unit={unit} /> }))} panels={cards} />
                ) : (
                  <ul className="mt-3 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">{cards}</ul>
                )
              ) : <p className="mt-2 text-sm text-ink-soft">{group.empty}</p>}
            </section>
          );
        })}
      </div>
    </section>
  );

  function organizationModal(unit: (typeof units)[number]) {
    return <ActionModal label={`Open ${unit.name}`} title={unit.name} icon="person"
      triggerClassName="flex w-full items-start gap-3 rounded-md text-left hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-blue"
      trigger={<><UnitLogo unit={unit} /><span className="min-w-0 grow"><span className="block wrap-anywhere font-semibold text-navy">{unit.name}</span><span className="mt-0.5 block text-xs text-ink-soft">{unitTypes[unit.type]}</span></span></>}>
      <p className="mb-3 text-sm text-ink-soft">{unitTypes[unit.type]}</p>
      {unitActions(unit)}
      <div className="mt-4">{unitDetails(unit.id)}</div>
    </ActionModal>;
  }

  function createUnitForm(type: "chapter" | "branch" | "affinity", parentId?: never): ReactNode;
  function createUnitForm(type: "branchChapter" | "branchAffinity", parentId: string): ReactNode;
  function createUnitForm(type: keyof typeof unitTypes, parentId = "") {
    const child = type === "branchChapter" || type === "branchAffinity";
    return (
      <form action={createUnit} aria-label="Create an organization" className="space-y-3">
        {child ? (
          <label className="block text-sm font-semibold">Organization type
            <select name="type" className="login-input" defaultValue="branchChapter">
              <option value="branchChapter">Student branch chapter</option>
              <option value="branchAffinity">Student branch affinity group</option>
            </select>
          </label>
        ) : <input type="hidden" name="type" value={type} />}
        <input type="hidden" name="parentId" value={parentId} />
        <label className="block text-sm font-semibold">Organization name
          <input name="name" className="login-input" required maxLength={120} autoFocus />
        </label>
        <label className="block text-sm font-semibold">Organization logo
          <input name="logo" className="login-input" type="file" accept="image/png,image/jpeg" />
          <span className="mt-1 block font-normal text-ink-soft">Optional PNG or JPEG, up to 1 MB.</span>
        </label>
        <button className="btn btn-primary" type="submit">Create organization</button>
      </form>
    );
  }

  function unitActions(unit: (typeof units)[number]) {
    const manager = manageable.some(item => item.id === unit.id);
    if (!manager) return null;
    const deletable = canDeleteUnit(viewer, unit, systemWide, leads, units);
    return (
      <div className="flex flex-wrap gap-1.5">
        <ActionModal label={`Edit ${unit.name}`} title="Edit organization" icon="edit">
          <form action={editUnit} className="space-y-3">
            <input type="hidden" name="unitId" value={unit.id} />
            <label className="block text-sm font-semibold">Organization name
              <input name="name" className="login-input" defaultValue={unit.name} required maxLength={120} autoFocus />
            </label>
            <label className="block text-sm font-semibold">Replace organization logo
              <input name="logo" className="login-input" type="file" accept="image/png,image/jpeg" />
              <span className="mt-1 block font-normal text-ink-soft">Optional PNG or JPEG, up to 1 MB. Leave blank to keep the current logo.</span>
            </label>
            <button className="btn btn-primary" type="submit">Save changes</button>
          </form>
        </ActionModal>
        {unit.type === "branch" && (
          <ActionModal label={`Create an organization under ${unit.name}`} title={`Add to ${unit.name}`} icon="plus">
            {createUnitForm("branchChapter", unit.id)}
          </ActionModal>
        )}
        {members.length > 0 && (
          <ActionModal label={`Assign a volunteer to ${unit.name}`} title="Assign a volunteer" icon="person">
            {assignVolunteerForm(unit)}
          </ActionModal>
        )}
        <ActionModal label={`Post a role for ${unit.name}`} title="Post an open role" icon="role">
          {postRoleForm(unit.id)}
        </ActionModal>
        {deletable && (
          <ActionModal label={`Delete ${unit.name}`} title="Delete organization" icon="trash" tone="danger">
            <form action={deleteUnit} className="space-y-3">
              <input type="hidden" name="unitId" value={unit.id} />
              <p className="text-sm text-ink-soft">This removes the organization from active views while preserving its historical records.</p>
              <label className="block text-sm font-semibold">Enter <strong>{unit.name}</strong> to confirm
                <input name="confirmation" className="login-input" required autoComplete="off" />
              </label>
              <button className="btn bg-red-700 text-white hover:bg-red-800" type="submit">Delete organization</button>
            </form>
          </ActionModal>
        )}
      </div>
    );
  }

  function assignVolunteerForm(unit: (typeof units)[number]) {
    return (
      <form action={assignUnit} className="space-y-3">
        <input type="hidden" name="unitId" value={unit.id} />
        <label className="block text-sm font-semibold">Volunteer
          <select name="email" className="login-input" required defaultValue="">
            <option disabled value="">Select a volunteer</option>
            {members.map(member => <option key={member.email} value={member.email}>{member.name} · {member.email}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Role
          <select name="roleTitle" className="login-input" defaultValue="">
            <option value="">Volunteer</option>
            {unitAssignmentTitles(unit.id, roles, badges).filter(title => title !== "Chair" || canDesignateUnitChair(viewer, unit, systemWide, leads)).map(title => <option key={title} value={title}>{title}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" type="submit">Assign volunteer</button>
      </form>
    );
  }

  function postRoleForm(unitId: string) {
    return (
      <form action={addUnitRole} className="space-y-3">
        <input type="hidden" name="unitId" value={unitId} />
        <label className="block text-sm font-semibold">Role title
          <input name="title" className="login-input" maxLength={60} required />
        </label>
        <label className="block text-sm font-semibold">Responsibilities
          <textarea name="description" className="login-input" rows={3} maxLength={1000} required />
        </label>
        <button className="btn btn-primary" type="submit">Post role</button>
      </form>
    );
  }

  function unitDetails(unitId: string) {
    const unit = manageable.find(unit => unit.id === unitId);
    const manager = Boolean(unit);
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
          <div className="mt-3 scrollable-table" role="region" aria-label="Organization roles" tabIndex={0}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-paper-2 text-navy"><tr><th scope="col" className="px-3 py-2">Role</th><th scope="col" className="px-3 py-2">Volunteer</th>{manager && <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody className="divide-y divide-line">
                {assigned.flatMap(member => {
                  const customBadges = badges.filter(badge => badge.email === member.email && badge.unitId === unitId);
                  const labels = new Set(accepted.filter(item => item.email === member.email).map(item => item.label));
                  if (leads.some(lead => lead.email === member.email && lead.unitId === unitId)) labels.add("Unit chair");
                  const rows = [...customBadges.map(badge => ({ label: badge.label, badge })), ...[...labels].filter(label => !customBadges.some(badge => badge.label.toLowerCase() === label.toLowerCase())).map(label => ({ label, badge: undefined }))];
                  if (!rows.length) rows.push({ label: "Volunteer", badge: undefined });
                  return rows.map(({ label, badge }, index) => <tr key={`${member.email}-${badge?.id ?? label}`}>
                    <td className="wrap-anywhere px-3 py-3 align-top font-semibold text-navy">{label}</td>
                    <td className="wrap-anywhere px-3 py-3 align-top text-ink-soft">{member.name}</td>
                    {manager && <td className="px-2 py-3 align-top"><div className="flex gap-1">
                      {badge && <ActionModal label={`Edit ${badge.label}`} title="Edit role assignment" icon="edit" compact>
                        <form action={updateUnitBadge} className="space-y-3">
                          <input type="hidden" name="unitId" value={unitId} />
                          <input type="hidden" name="badgeId" value={badge.id} />
                          <label className="block text-sm font-semibold">Volunteer
                            <select name="email" className="login-input" defaultValue={member.email} required>
                              {members.map(volunteer => <option key={volunteer.email} value={volunteer.email}>{volunteer.name} · {volunteer.email}</option>)}
                            </select>
                          </label>
                          <label className="block text-sm font-semibold">Role title
                            <input name="label" className="login-input" defaultValue={badge.label} maxLength={60} required autoFocus />
                          </label>
                          <button className="btn btn-primary" type="submit">Save role assignment</button>
                        </form>
                      </ActionModal>}
                      {index === 0 && <ActionModal label={`Add role for ${member.name}`} title={`Add role for ${member.name}`} icon="plus" compact>
                        <form action={giveUnitBadge} className="space-y-3">
                          <input type="hidden" name="unitId" value={unitId} />
                          <input type="hidden" name="email" value={member.email} />
                          <label className="block text-sm font-semibold">Role title
                            <input name="label" className="login-input" maxLength={60} required />
                          </label>
                          <button className="btn btn-primary" type="submit">Add role</button>
                        </form>
                      </ActionModal>}
                    </div></td>}
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
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
      </>
    );
  }
}
