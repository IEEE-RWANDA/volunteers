import Link from "next/link";
import { openUnitRoles, roleApplications, unitTypes, volunteerUnits } from "@/lib/volunteer-units";
import { applyToUnitRole } from "./team-actions";
import UnitLogo from "./UnitLogo";

const boardUrl = "/?section=volunteers&tab=roles";

export default async function VolunteerRoleBoard({ email, params }: {
  email: string;
  params: { q?: string; role?: string; roleView?: string; unitStatus?: string };
}) {
  const [units, openings, applications] = await Promise.all([volunteerUnits(), openUnitRoles(), roleApplications()]);
  const unitById = new Map(units.map(unit => [unit.id, unit]));
  const own = new Map(applications.filter(item => item.email === email).map(item => [item.roleId, item]));
  const applied = params.roleView === "applications";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const matches = openings.flatMap(role => {
    const unit = unitById.get(role.unitId);
    if (!unit || (applied && !own.has(role.id))) return [];
    const searchable = `${role.title} ${unit.label} ${role.description}`.toLowerCase();
    return searchable.includes(query.toLowerCase()) ? [{ ...role, unit }] : [];
  }).sort((a, b) => a.title.localeCompare(b.title));
  const selected = matches.find(role => role.id === params.role) ?? matches[0];
  const currentUrl = boardUrl + (applied ? "&roleView=applications" : "") + (query ? "&q=" + encodeURIComponent(query) : "");
  const selectedApplication = selected ? own.get(selected.id) : undefined;

  function status(roleId: string) {
    const application = own.get(roleId);
    return application?.decision === "approved" ? "Accepted"
      : application?.decision === "declined" ? "Declined"
      : application ? "Application submitted" : "";
  }

  return (
    <section aria-labelledby="role-board" className="space-y-4">
      <div className="panel">
        <h2 id="role-board" className="panel-title">Volunteer roles</h2>
        <nav aria-label="Volunteer role views" className="dashboard-nav mt-3 !justify-start">
          <Link href={boardUrl} aria-current={!applied ? "page" : undefined}>Open roles</Link>
          <Link href={boardUrl + "&roleView=applications"} aria-current={applied ? "page" : undefined}>My applications</Link>
        </nav>
        <form action="/" method="get" className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="section" value="volunteers" />
          <input type="hidden" name="tab" value="roles" />
          {applied && <input type="hidden" name="roleView" value="applications" />}
          <label className="min-w-0 grow text-sm font-semibold">Search roles
            <input name="q" type="search" defaultValue={query} className="login-input" maxLength={100} placeholder="Role, chapter, or student branch" />
          </label>
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
      </div>
      {selected ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <ul aria-label="Matching roles" className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
            {matches.map(role => (
              <li key={role.id}>
                <Link href={`${currentUrl}&role=${role.id}`} aria-current={selected.id === role.id ? "true" : undefined}
                  className={`flex items-start gap-3 border-s-4 p-4 hover:bg-paper-2 ${selected.id === role.id ? "border-blue bg-paper-2" : "border-transparent"}`}>
                  <UnitLogo unit={role.unit} />
                  <div className="min-w-0">
                    <p className="wrap-anywhere font-semibold text-navy">{role.title}</p>
                    <p className="mt-1 wrap-anywhere text-sm text-ink-soft">{role.unit.label}</p>
                    {status(role.id) && <p className="mt-1 text-xs font-semibold text-blue">{status(role.id)}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <article className="panel" aria-labelledby="selected-volunteer-role">
            <div className="flex items-center gap-3">
              <UnitLogo unit={selected.unit} />
              <div className="min-w-0">
                <h3 id="selected-volunteer-role" className="wrap-anywhere font-display text-2xl font-bold text-navy">{selected.title}</h3>
                <p className="mt-1 wrap-anywhere text-sm text-ink-soft">{selected.unit.label} · {unitTypes[selected.unit.type]}</p>
              </div>
            </div>
            <div className="my-5 border-y border-line py-5">
              <h4 className="font-semibold text-navy">Responsibilities</h4>
              <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed text-ink-soft">{selected.description}</p>
            </div>
            {params.unitStatus === "unit-unavailable" && <p role="alert" className="mb-3 text-sm text-red-700">Your application could not be saved. Try again.</p>}
            {selectedApplication ? (
              <p role="status" className="text-sm font-semibold text-navy">{status(selected.id)}</p>
            ) : (
              <form action={applyToUnitRole}>
                <input type="hidden" name="roleId" value={selected.id} />
                <button type="submit" className="btn btn-primary">Apply for this role</button>
              </form>
            )}
          </article>
        </div>
      ) : (
        <p className="panel text-sm text-ink-soft">
          {query ? "No roles match your search." : applied ? "Your applications will appear here." : "No volunteer roles have been posted yet."}
        </p>
      )}
    </section>
  );
}
