import { formatUsd } from "@/lib/fund-amounts";
import { fundsForVolunteer } from "@/lib/listed-funds";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTeamAccess } from "@/lib/session";
import { organizerOptions } from "@/lib/volunteer-roster";
import { volunteerEvents, volunteerSubmissions } from "@/lib/volunteer-store";
import VolunteerForm from "@/app/components/VolunteerForm";
import { cookies } from "next/headers";
import { googleAvatarCookie, googleAvatarUrl, googleDisplayName, googleDisplayNameCookie } from "@/lib/google-avatar";
import AccountMenu from "./AccountMenu";
import OverviewActivity from "./OverviewActivity";
import { volunteerUnits } from "@/lib/volunteer-units";
import { volunteerHours } from "@/lib/volunteer-hours";
import VolunteerRoleBoard from "./VolunteerRoleBoard";
import VolunteerDirectory from "./VolunteerDirectory";
import VolunteerUnits from "./VolunteerUnits";
import { roster } from "@/lib/volunteer-roster";
import VolunteerHours from "./VolunteerHours";
import TeamView from "./TeamView";
import FundingReports, { ReleasedFunds } from "./FundingReports";
import { fundingReportStatuses } from "@/lib/funding-reports";
import "./workspace.css";

const baseNavigation = [
  { id: "overview", label: "Overview", href: "/" },
  { id: "events", label: "Event/Activity", href: "/?section=events" },
  { id: "funding", label: "Funding & reporting", href: "/?section=funding" },
  { id: "volunteers", label: "Volunteers", href: "/?section=volunteers" },
] as const;

export type DashboardParams = { section?: string; hours?: string; profile?: string; unitStatus?: string; team?: string; report?: string; request?: string; fund?: string; tab?: string; q?: string; role?: string; roleView?: string; group?: string };

export default async function Dashboard({ email, params }: { email: string; params: DashboardParams }) {
  const { section, hours, profile, unitStatus, team, report, request, fund, tab } = params;
  const access = await getTeamAccess();
  const sessionCookies = await cookies();
  const avatar = googleAvatarUrl(sessionCookies.get(googleAvatarCookie)?.value);
  const googleName = googleDisplayName(sessionCookies.get(googleDisplayNameCookie)?.value);
  if (section === "team" && !access) redirect("/");
  const navigation = access
    ? [...baseNavigation, { id: "team", label: access.role === "admin" ? "Admin" : "My team", href: "/?section=team" } as const]
    : baseNavigation;
  const current = navigation.find(item => item.id === section) ?? navigation[0];
  const volunteerTab = tab === "roles" || tab === "directory" || tab === "organizations" ? tab
    : unitStatus && !tab ? "organizations" : "profile";
  const reporting = current.id === "funding" && (tab === "reporting" || Boolean(request) || report === "saved");
  const funding = current.id === "funding" && !reporting;
  const funds = funding ? await fundsForVolunteer(email) : [];
  const initialFund = funds.find(item => item.id === fund && item.remainingCents > 0)?.id;
  const eventUnits = current.id === "events" ? await volunteerUnits() : [];
  const organizers = funding || current.id === "events" ? await organizerOptions() : [];
  const [records, activityEntries, fundingActivities] = await Promise.all([
    current.id === "overview" || reporting ? volunteerSubmissions(email) : [],
    current.id === "overview" ? volunteerHours(email) : [],
    funding ? volunteerEvents() : [],
  ]);
  const reportStatuses = await fundingReportStatuses(records.filter(record => record.kind === "funding").map(record => record.id));
  const eventCount = records.filter(record => record.kind === "event").length;

  return (
    <div className="volunteer-workspace">
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-inner">
          <Link href="/" aria-label="Volunteer Hub overview" className="dashboard-brand">
            <Image className="dashboard-logo" src="/img/ieee-rwanda-logo.png" alt="IEEE Rwanda" width={94} height={49} priority />
            <span>Volunteer Hub</span>
          </Link>
          <nav aria-label="Dashboard" className="dashboard-nav">
            {navigation.map((item, index) => (
              <Link key={item.id} href={item.href} prefetch={false} aria-current={current.id === item.id ? "page" : undefined}>
                <span className={`nav-glyph nav-glyph-${index}`} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
          <AccountMenu email={email} avatar={avatar} googleName={googleName} />
        </div>
      </header>

      <main className="dashboard-main">
        {current.id === "overview" ? (
          <>
            <header className="dashboard-hero">
              <div className="dashboard-hero-art">
                <Image
                  src="/img/ieee-rwanda-volunteers.jpg"
                  alt=""
                  fill
                  sizes="(max-width: 699px) 100vw, 60vw"
                  preload
                />
              </div>
              <div className="dashboard-hero-content">
                <p className="eyebrow text-[#a9e8fa]">IEEE Rwanda Subsection</p>
                <h1>Volunteer dashboard</h1>
                <p className="max-w-sm text-[#d8eaf5]">Track your volunteer hours, activities, and reports.</p>
              </div>
            </header>

            <OverviewActivity entries={activityEntries} records={records} statuses={reportStatuses} />

            <div className="dashboard-workflows">
              <Link className="workflow workflow-events" href="/?section=events">
                <span className="workflow-icon nav-glyph nav-glyph-1" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="workflow-title">Create an event or activity</span>
                  <span className="workflow-description">Submit dates, venue, and the vTools event link.</span>
                </span>
                <span className="workflow-arrow" aria-hidden="true">→</span>
              </Link>
              <Link className="workflow workflow-funding" href="/?section=funding">
                <span className="workflow-icon nav-glyph nav-glyph-2" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="workflow-title">Request funding</span>
                  <span className="workflow-description">Send a budget and supporting documents.</span>
                </span>
                <span className="workflow-arrow" aria-hidden="true">→</span>
              </Link>
            </div>

            {records.length > 0 && <section className="submission-panel" aria-labelledby="submissions">
              <div className="submission-header">
                <h2 id="submissions" className="panel-title">Your submissions</h2>
                <p className="text-sm text-ink-soft">{eventCount} {eventCount === 1 ? "event" : "events"} · {records.length - eventCount} funding {records.length - eventCount === 1 ? "request" : "requests"}</p>
              </div>
                <ul className="divide-y divide-line">
                  {records.map(record => (
                    <li key={record.id} className="submission-row">
                      <div className="min-w-0">
                        <strong className="wrap-anywhere text-navy">{record.title}</strong>
                        <p className="mt-1 text-sm text-ink-soft">{record.kind === "event" ? "Event/activity submission" : "Funding request"} · {record.date.replace("T", " ")}</p>
                        {record.leadVolunteerName && (
                          <p className="mt-1 wrap-anywhere text-sm text-ink-soft">
                            <strong className="text-navy">Lead volunteer</strong> · {record.leadVolunteerName} · {record.email}
                          </p>
                        )}
                        {(record.fundingSource || record.fundAllocations?.length || record.listedFunds?.length) ? (
                          <p className="mt-1 wrap-anywhere text-sm text-ink-soft">Funding sources · {[...(record.fundAllocations?.map(item => `${item.name} (${formatUsd(item.cents)})`) ?? record.listedFunds?.map(item => item.name) ?? []), record.fundingSource].filter(Boolean).join(", ")}</p>
                        ) : null}
                        {record.organizers?.length ? <p className="mt-1 wrap-anywhere text-sm text-ink-soft">{record.kind === "event" ? "Volunteers" : "Organizers"}: {record.organizers.map(member => member.name).join(", ")}</p> : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-navy">{reportStatuses.get(record.id)?.label ?? (record.releasedAt ? "Funds released" : record.approvedAt ? "Approved" : "Submitted")}</span>
                    </li>
                  ))}
                </ul>
            </section>}
          </>
        ) : (
          <>
            <header className="dashboard-section-header">
              <h1>{current.label}</h1>
            </header>
            {current.id === "funding" && (
              <nav aria-label="Funding and reporting" className="dashboard-nav mb-5">
                <Link href="/?section=funding" aria-current={funding ? "page" : undefined}>Funding</Link>
                <Link href="/?section=funding&tab=reporting" aria-current={reporting ? "page" : undefined}>Reporting</Link>
              </nav>
            )}
            {funding && (
              <section className="panel mb-5" aria-labelledby="listed-funds">
                <h2 id="listed-funds" className="panel-title">Your funds</h2>
                {funds.length ? <ul className="mt-3 divide-y divide-line">
                  {funds.map(item => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span>{item.name} · {formatUsd(item.remainingCents)} left</span>
                      {item.remainingCents > 0 && <Link className="action-link" href={`/?section=funding&fund=${item.id}#funding-request`}>Request from this fund</Link>}
                    </li>
                  ))}
                </ul> : <p className="mt-3 text-sm text-ink-soft">You have no available funding sources listed yet.</p>}
              </section>
            )}
            {reporting ? (
              <>
                <ReleasedFunds records={records} statuses={reportStatuses} />
                <FundingReports records={records} statuses={reportStatuses} saved={report === "saved"} requestId={request} />
              </>
            ) : current.id === "volunteers" ? (
              <>
                <nav aria-label="Volunteer sections" className="dashboard-nav mb-5">
                  {[
                    { id: "profile", label: "Profile and hours", href: "/?section=volunteers" },
                    { id: "organizations", label: "Organizations", href: "/?section=volunteers&tab=organizations" },
                    { id: "directory", label: "Directory", href: "/?section=volunteers&tab=directory" },
                    { id: "roles", label: "Volunteer roles", href: "/?section=volunteers&tab=roles" },
                  ].map(item => (
                    <Link key={item.id} href={item.href} aria-current={volunteerTab === item.id ? "page" : undefined}>{item.label}</Link>
                  ))}
                </nav>
                {volunteerTab === "roles" ? <VolunteerRoleBoard email={email} params={params} /> :
                  volunteerTab === "directory" ? <VolunteerDirectory members={await roster()} viewer={email} /> :
                  volunteerTab === "organizations" ? (
                    <VolunteerUnits members={await roster()} viewer={email} status={unitStatus} group={params.group ?? "chapter"} admin={access?.role === "admin"} />
                  ) : <VolunteerHours email={email} status={hours} profileStatus={profile} avatar={avatar} googleName={googleName} />}
              </>
            ) :
              current.id === "team" && access ? <TeamView access={access} status={team} /> : funding ? (
                <section className="panel">
                  <h2 id="funding-request" className="panel-title">Submit a funding request</h2>
                  {fundingActivities.some(item => item.submittedBy === email && item.vtools) ? (
                    <VolunteerForm key={initialFund ?? "funding"} kind="funding" contactEmail={email} organizers={organizers} initialFund={initialFund} funds={funds}
                      activities={fundingActivities.flatMap(item => item.submittedBy === email && item.vtools ? [{ id: item.id, title: item.title, date: item.date.slice(0, 10), vtools: item.vtools }] : [])} />
                  ) : (
                    <p className="mt-3 text-sm text-ink-soft">
                      <Link href="/?section=events" className="action-link">Create an event or activity</Link> before requesting funding.
                    </p>
                  )}
                </section>
              ) : (
                <div className="grid items-start gap-5 xl:grid-cols-[1.45fr_1fr]">
                  <section className="panel">
                    <h2 className="panel-title">Event/activity submission</h2>
                    <VolunteerForm kind="event" contactEmail={email} organizers={organizers} eventUnits={eventUnits.map(({ id, label }) => ({ id, label }))} />
                  </section>
                  <aside className="panel">
                    <h2 className="panel-title">Public calendar</h2>
                    <p className="my-3 text-ink-soft">Submissions go to IEEE Rwanda for review. Approved events and activities can be added to the public calendar.</p>
                    <a className="action-link" href="https://www.ieeerwanda.org/events">Browse and subscribe</a>
                  </aside>
                </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
