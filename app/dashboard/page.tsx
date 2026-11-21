import { formatUsd } from "@/lib/fund-amounts";
import { listedFunds } from "@/lib/listed-funds";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTeamAccess, getVolunteer } from "@/lib/session";
import { organizerOptions } from "@/lib/volunteer-roster";
import { volunteerSubmissions } from "@/lib/volunteer-store";
import VolunteerForm from "@/app/components/VolunteerForm";
import { signOut } from "@/app/session-actions";
import VolunteerHours from "./VolunteerHours";
import TeamView from "./TeamView";
import FundingReports, { ReleasedFunds } from "./FundingReports";
import { fundingReportStatuses } from "@/lib/funding-reports";
import "./workspace.css";

const baseNavigation = [
  { id: "overview", label: "Overview", href: "/dashboard" },
  { id: "events", label: "Events", href: "/dashboard?section=events" },
  { id: "funding", label: "Funding & reporting", href: "/dashboard?section=funding" },
  { id: "volunteers", label: "Volunteers", href: "/dashboard?section=volunteers" },
] as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ section?: string; hours?: string; team?: string; report?: string; request?: string; fund?: string }> }) {
  const email = await getVolunteer();
  if (!email) redirect("/");
  const { section, hours, team, report, request, fund } = await searchParams;
  const access = await getTeamAccess();
  if (section === "team" && !access) redirect("/dashboard");
  const navigation = access
    ? [...baseNavigation, { id: "team", label: access.role === "admin" ? "Admin" : "My team", href: "/dashboard?section=team" } as const]
    : baseNavigation;
  const current = navigation.find(item => item.id === section) ?? navigation[0];
  const funds = current.id === "funding" ? await listedFunds() : [];
  const initialFund = funds.find(item => item.id === fund && item.remainingCents > 0)?.id;
  const organizers = current.id === "funding" ? await organizerOptions() : [];
  const records = current.id === "overview" || current.id === "funding" ? await volunteerSubmissions(email) : [];
  const reportStatuses = await fundingReportStatuses(records.filter(record => record.kind === "funding").map(record => record.id));
  const eventCount = records.filter(record => record.kind === "event").length;

  return (
    <div className="volunteer-workspace">
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-inner">
          <Link href="/dashboard" aria-label="Volunteer Hub overview" className="dashboard-brand">
            <Image className="dashboard-logo" src="/img/ieee-rwanda-logo.png" alt="IEEE Rwanda" width={94} height={49} priority />
            <span>Volunteer Hub</span>
          </Link>
          <nav aria-label="Dashboard" className="dashboard-nav">
            {navigation.map((item, index) => (
              <Link key={item.id} href={item.href} aria-current={current.id === item.id ? "page" : undefined}>
                <span className={`nav-glyph nav-glyph-${index}`} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="dashboard-account">
            <p className="wrap-anywhere font-semibold">{email}</p>
            <form action={signOut}>
              <button type="submit" className="cursor-pointer whitespace-nowrap text-blue hover:underline">Sign out</button>
            </form>
          </div>
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
                <p className="max-w-sm text-[#d8eaf5]">Plan committee activities and keep track of your submissions.</p>
              </div>
            </header>

            <div className="dashboard-workflows">
              <Link className="workflow workflow-events" href="/dashboard?section=events">
                <span className="workflow-icon nav-glyph nav-glyph-1" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="workflow-title">Add an event</span>
                  <span className="workflow-description">Submit dates, venue, and registration details.</span>
                </span>
                <span className="workflow-arrow" aria-hidden="true">→</span>
              </Link>
              <Link className="workflow workflow-funding" href="/dashboard?section=funding">
                <span className="workflow-icon nav-glyph nav-glyph-2" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="workflow-title">Request funding</span>
                  <span className="workflow-description">Send a budget and supporting documents.</span>
                </span>
                <span className="workflow-arrow" aria-hidden="true">→</span>
              </Link>
            </div>

            <section className="submission-panel" aria-labelledby="submissions">
              <div className="submission-header">
                <h2 id="submissions" className="panel-title">Your submissions</h2>
                <p className="text-sm text-ink-soft">{eventCount} {eventCount === 1 ? "event" : "events"} · {records.length - eventCount} funding {records.length - eventCount === 1 ? "request" : "requests"}</p>
              </div>
              {records.length === 0 ? (
                <div className="submission-empty">
                  <span className="empty-icon nav-glyph nav-glyph-2" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-navy">No submissions yet</p>
                    <p className="mt-1 text-sm text-ink-soft">Events and funding requests you submit will appear here.</p>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {records.map(record => (
                    <li key={record.id} className="submission-row">
                      <div className="min-w-0">
                        <strong className="wrap-anywhere text-navy">{record.title}</strong>
                        <p className="mt-1 text-sm text-ink-soft">{record.kind === "event" ? "Event suggestion" : "Funding request"} · {record.date.replace("T", " ")}</p>
                        {record.leadVolunteerName && (
                          <p className="mt-1 wrap-anywhere text-sm text-ink-soft">
                            <strong className="text-navy">Lead volunteer</strong> · {record.leadVolunteerName} · {record.email}
                          </p>
                        )}
                        {(record.fundingSource || record.fundAllocations?.length || record.listedFunds?.length) ? (
                          <p className="mt-1 wrap-anywhere text-sm text-ink-soft">Funding sources · {[...(record.fundAllocations?.map(item => `${item.name} (${formatUsd(item.cents)})`) ?? record.listedFunds?.map(item => item.name) ?? []), record.fundingSource].filter(Boolean).join(", ")}</p>
                        ) : null}
                        {record.organizers?.length ? <p className="mt-1 wrap-anywhere text-sm text-ink-soft">Organizers: {record.organizers.map(member => member.name).join(", ")}</p> : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-navy">{reportStatuses.get(record.id)?.label ?? (record.releasedAt ? "Funds released" : record.approvedAt ? "Approved" : "Submitted")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <>
            <header className="dashboard-section-header">
              <h1>{current.label}</h1>
            </header>
            {current.id === "funding" && funds.length > 0 && (
              <section className="panel" aria-labelledby="listed-funds">
                <h2 id="listed-funds" className="panel-title">Listed funds</h2>
                <ul className="mt-3 divide-y divide-line">
                  {funds.map(item => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span>{item.name} · {formatUsd(item.remainingCents)} left</span>
                      {item.remainingCents > 0 && <Link className="action-link" href={`/dashboard?section=funding&fund=${item.id}#funding-request`}>Request from this fund</Link>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {current.id === "funding" && <ReleasedFunds records={records} statuses={reportStatuses} />}
            {current.id === "volunteers" ? <VolunteerHours email={email} status={hours} /> :
              current.id === "team" && access ? <TeamView access={access} status={team} /> : (
              <div className="grid items-start gap-5 xl:grid-cols-[1.45fr_1fr]">
                <section className="panel">
                  <h2 id={current.id === "funding" ? "funding-request" : undefined} className="panel-title">{current.id === "events" ? "Suggest an event" : "Submit a funding request"}</h2>
                  <VolunteerForm key={initialFund ?? current.id} kind={current.id === "events" ? "event" : "funding"} contactEmail={email} organizers={organizers} initialFund={initialFund} funds={funds} />
                </section>
                <aside className="panel">
                  {current.id === "events" ? (
                    <>
                      <h2 className="panel-title">Public calendar</h2>
                      <p className="my-3 text-ink-soft">Event suggestions go to IEEE Rwanda for review. Approved events can be added to the public calendar.</p>
                      <a className="action-link" href="https://www.ieeerwanda.org/events">Browse and subscribe</a>
                    </>
                  ) : (
                    <>
                      <h2 className="panel-title">Budget and reporting</h2>
                      <ul className="mt-3 list-disc space-y-3 ps-5 text-ink-soft">
                        <li>Include quantities, unit costs, currency, and supporting quotes in your budget.</li>
                        <li>Confirm approval and payment arrangements before committing costs.</li>
                        <li>Save receipts and proof of payment. Compare actual costs with the approved budget in your report.</li>
                      </ul>
                    </>
                  )}
                </aside>
              </div>
            )}
            {current.id === "funding" && <FundingReports records={records} statuses={reportStatuses} saved={report === "saved"} requestId={request} />}
          </>
        )}
      </main>
    </div>
  );
}
