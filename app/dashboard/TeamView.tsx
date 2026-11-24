import type { getTeamAccess } from "@/lib/session";
import { listFundingReports, reportStatus } from "@/lib/funding-reports";
import { teamRoster } from "@/lib/volunteer-roster";
import { formatHours, teamHourTotals } from "@/lib/volunteer-hours";
import { reviewReport } from "./report-review-actions";
import AdminAccessRequests from "./AdminAccessRequests";
import AdminFundingRequests from "./AdminFundingRequests";
import VolunteerUnits from "./VolunteerUnits";
import { addVolunteer } from "./team-actions";

type Access = NonNullable<Awaited<ReturnType<typeof getTeamAccess>>>;

const messages: Record<string, { text: string; error?: boolean }> = {
  "volunteer-added": { text: "Volunteer added to the directory." },
  "invalid-volunteer": { text: "Enter a name, committee, and valid email.", error: true },
  duplicate: { text: "A volunteer with that email is already listed.", error: true },
  unavailable: { text: "The change could not be saved. Try again.", error: true },
};

export default async function TeamView({ access, status }: { access: Access; status?: string }) {
  const members = await teamRoster(access);
  const totals = await teamHourTotals(members.map(member => member.email));
  const reports = access.role === "admin" ? await listFundingReports() : [];
  const reviewMessages: Record<string, string> = {
    "report-approved": "Report approved.",
    "report-returned": "Report sent back. The volunteer can see your comments and resubmit.",
    "report-comments": "Add comments before sending the report back. Use up to 2,000 characters.",
    "report-state": "This report has changed or could not be saved. Check its status before trying again.",
  };
  const reviewMessage = status && Object.hasOwn(reviewMessages, status) ? reviewMessages[status] : null;
  const message = status && Object.hasOwn(messages, status) ? messages[status] : null;

  return (
    <div className="space-y-5">
      {message && (
        <p role={message.error ? "alert" : "status"} className={`panel font-semibold ${message.error ? "text-red-700" : "text-blue"}`}>
          {message.text}
        </p>
      )}
      {access.role === "admin" && <AdminAccessRequests status={status} />}
      {access.role === "admin" && <AdminFundingRequests status={status} />}
      {access.role === "admin" && <VolunteerUnits members={members} viewer={access.email} admin />}
      <div className={access.role === "admin" ? "grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]" : "max-w-3xl"}>
        <section className="panel" aria-labelledby="team-hours">
          <h2 id="team-hours" className="panel-title">{access.role === "lead" ? access.committee : "Volunteer roster"}</h2>
          <p className="mt-2 text-sm text-ink-soft">See each volunteer’s total. Event leads and student branch chairs log hours from the Volunteers page.</p>
          {members.length ? (
            <div className="mt-5">
                <ul className="mt-2 divide-y divide-line rounded-md border border-line">
                  {members.map(member => (
                    <li key={member.email}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block wrap-anywhere font-semibold text-navy">{member.name}</span>
                          {(member.officerTitle || member.committee) && (
                            <span className="block text-xs text-ink-soft">{[member.officerTitle, member.committee].filter(Boolean).join(" · ")}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-navy">{formatHours(totals.get(member.email) ?? 0)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
            </div>
          ) : <p className="mt-4 text-sm text-ink-soft">No volunteers are listed in this committee.</p>}
        </section>
        {access.role === "admin" && (
          <section className="panel" aria-labelledby="add-volunteer">
            <h2 id="add-volunteer" className="panel-title">Add a volunteer</h2>
            <p className="mt-2 text-sm text-ink-soft">Add a directory profile and assign it to a committee.</p>
            <form action={addVolunteer} className="mt-4 space-y-4">
              <label className="block text-sm font-semibold">Full name
                <input name="name" className="login-input" maxLength={120} required />
              </label>
              <label className="block text-sm font-semibold">Email address
                <input name="email" type="email" className="login-input" maxLength={254} required />
              </label>
              <label className="block text-sm font-semibold">Committee
                <input name="committee" className="login-input" maxLength={120} required />
              </label>
              <button className="btn btn-primary" type="submit">Add volunteer</button>
            </form>
          </section>
        )}
      </div>
      {access.role === "admin" && (
        <section className="panel" aria-labelledby="admin-reports">
          <h2 id="admin-reports" className="panel-title">Funding reports</h2>
          {reviewMessage && <p role="status" className="mt-2 text-sm font-semibold text-blue">{reviewMessage}</p>}
          {reports.length ? (
            <ul className="mt-3 divide-y divide-line">
              {reports.map(report => (
                <li className="space-y-2 py-3" key={report.requestId}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-navy">{report.title}</p>
                    <p className="text-sm font-semibold text-ink-soft">{reportStatus(report.review).label} · Version {report.version}</p>
                  </div>
                  <p className="text-sm text-ink-soft">{report.committee} · {report.submittedBy}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <a className="action-link" href={report.photos} target="_blank" rel="noreferrer">Event photos</a>
                    <a className="action-link" href={report.vtools} target="_blank" rel="noreferrer">vTools event</a>
                    {report.socialPost && <a className="action-link" href={report.socialPost} target="_blank" rel="noreferrer">Social media post</a>}
                    {report.attachments.map((file, index) => (
                      <a className="action-link wrap-anywhere" key={file.path} href={`/api/funding-reports/${report.requestId}/${index}?version=${report.version}`}>
                        {file.type} · {file.name}
                      </a>
                    ))}
                  </div>
                  {report.review?.comments && (
                    <p className="whitespace-pre-wrap wrap-anywhere rounded-md bg-paper-2 p-3 text-sm text-navy">{report.review.comments}</p>
                  )}
                  {!report.review && (
                    <form action={reviewReport} className="space-y-3 pt-2" aria-label={`Review report for ${report.title}`}>
                      <input type="hidden" name="requestId" value={report.requestId} />
                      <input type="hidden" name="version" value={report.version} />
                      <label className="block text-sm font-semibold">Review comments
                        <textarea className="login-input" name="comments" rows={2} maxLength={2000} />
                      </label>
                      <p className="text-xs text-ink-soft">Comments are required when sending a report back.</p>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-primary" type="submit" name="decision" value="approved">Approve report</button>
                        <button className="btn border border-line text-blue hover:bg-paper-2" type="submit" name="decision" value="returned">Send back</button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-ink-soft">Submitted funding reports will appear here.</p>}
        </section>
      )}
    </div>
  );
}
