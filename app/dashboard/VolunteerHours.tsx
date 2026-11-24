import { volunteerExperience } from "@/lib/volunteer-units";
import VolunteerAvatar from "./VolunteerAvatar";
import UnitLogo from "./UnitLogo";
import { eventParticipants, eventsForHours, eventsLedBy } from "@/lib/event-hours";
import { updateProfile } from "./profile-actions";
import { roster, volunteerProfile } from "@/lib/volunteer-roster";
import { formatHours, hourSubmissions, volunteerHours } from "@/lib/volunteer-hours";
import { approveHours, logHours, submitHours } from "./hours-actions";
import HoursFields from "./HoursFields";

export default async function VolunteerHours({ email, status, profileStatus, avatar, googleName }: { email: string; status?: string; profileStatus?: string; avatar?: string; googleName?: string }) {
  const [directory, entries, events, ledEvents, submissions, experience, privateProfile] = await Promise.all([
    roster(), volunteerHours(email), eventsForHours(email), eventsLedBy(email), hourSubmissions(), volunteerExperience(email), volunteerProfile(email),
  ]);
  const names = new Map(directory.map(member => [member.email, member.name]));
  const profile = directory.find(member => member.email === email);
  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const ownSubmissions = new Map(submissions.filter(item => item.email === email).map(item => [item.eventId, item]));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <section className="panel" id="your-profile" aria-labelledby="profile-title">
          <h2 id="profile-title" className="panel-title">Your profile</h2>
          <div className="mt-4 flex items-center gap-3">
            <VolunteerAvatar avatar={avatar} name={googleName ?? profile?.name ?? email.split("@")[0]} size={56} />
            <div className="min-w-0">
              {(googleName || profile?.name) && <p className="wrap-anywhere font-semibold text-navy">{googleName ?? profile?.name}</p>}
              <p className="mt-0.5 wrap-anywhere text-sm text-ink-soft">{email}</p>
            </div>
          </div>
          <form action={updateProfile} className="mt-4 space-y-3">
            <label className="block text-sm font-semibold">Display name
              <input name="name" className="login-input" defaultValue={profile?.name ?? googleName ?? ""} maxLength={120} required />
            </label>
            <label className="block text-sm font-semibold">Bio (optional)
              <textarea name="bio" className="login-input" defaultValue={profile?.bio ?? ""} maxLength={500} rows={3} />
            </label>
            <label className="block text-sm font-semibold">IEEE member number (optional)
              <input name="ieeeMemberNumber" className="login-input" inputMode="numeric" pattern="[0-9]{1,20}" maxLength={20} defaultValue={privateProfile?.ieeeMemberNumber ?? ""} />
            </label>
            <button type="submit" className="btn btn-primary">Save profile</button>
            {profileStatus === "invalid-member-number" && <p role="alert" className="text-sm text-red-700">Enter your IEEE member number using digits only.</p>}
            {profileStatus === "saved" && <p role="status" className="text-sm font-semibold text-blue">Profile updated.</p>}
            {profileStatus === "invalid" && <p role="alert" className="text-sm text-red-700">Enter a display name and keep your bio under 500 characters.</p>}
            {profileStatus === "unavailable" && <p role="alert" className="text-sm text-red-700">Your profile could not be saved. Try again.</p>}
          </form>
        </section>
        {experience.length > 0 && (
          <section className="panel" aria-labelledby="volunteer-experience">
            <h2 id="volunteer-experience" className="panel-title">Volunteer experience</h2>
            <ul className="mt-3 divide-y divide-line">
              {experience.map(item => (
                <li key={`${item.unit.id}:${item.title}`} className="flex items-start gap-3 py-3">
                  <UnitLogo unit={item.unit} />
                  <div className="min-w-0">
                    <p className="wrap-anywhere font-semibold text-navy">{item.title}</p>
                    <p className="wrap-anywhere text-sm text-ink-soft">{item.unit.label}</p>
                    {item.description && <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-sm text-ink-soft">{item.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <section className="panel" aria-labelledby="hours-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="hours-title" className="panel-title">Volunteer hours</h2>
          <p className="text-sm text-ink-soft"><strong className="text-navy">{formatHours(total)}</strong> logged</p>
        </div>
        {status === "saved" && <p role="status" className="mt-3 text-sm font-semibold text-blue">Approved hours recorded.</p>}
        {status === "submitted" && <p role="status" className="mt-3 text-sm font-semibold text-blue">Hours submitted for approval.</p>}
        {status === "approved" && <p role="status" className="mt-3 text-sm font-semibold text-blue">Pending hours approved.</p>}
        {status === "duplicate" && <p role="alert" className="mt-3 text-sm text-red-700">You already submitted hours for this activity.</p>}
        {status === "forbidden" && <p role="alert" className="mt-3 text-sm text-red-700">You cannot log hours for this activity.</p>}
        {status === "invalid" && <p role="alert" className="mt-3 text-sm text-red-700">Select the required entries and enter a duration from 1 minute to 24 hours.</p>}
        {status === "unavailable" && <p role="alert" className="mt-3 text-sm text-red-700">Hours could not be saved. Try again.</p>}
        {events.length ? (
          <div className="mt-4 space-y-2">
            <h3 className="font-semibold text-navy">Submit your hours</h3>
            <p className="text-sm text-ink-soft">Assigned volunteers and unit chairs can submit their own hours after an activity ends. The activity lead must approve them.</p>
            {events.map(event => {
              const submission = ownSubmissions.get(event.id);
              return (
                <details key={event.id} className="rounded-md border border-line p-3 text-sm">
                  <summary className="cursor-pointer font-semibold text-navy">{event.title} · {event.date.slice(0, 10)}</summary>
                  {submission ? (
                    <p className="mt-3 text-ink-soft">{formatHours(submission.minutes)} · {submission.approval ? "Approved" : "Awaiting activity lead approval"}</p>
                  ) : (
                    <form action={submitHours} aria-label={`Submit your hours for ${event.title}`} className="mt-3 space-y-3">
                      <input type="hidden" name="eventId" value={event.id} />
                      <HoursFields />
                      <button className="btn btn-primary" type="submit">Submit hours</button>
                    </form>
                  )}
                </details>
              );
            })}
          </div>
        ) : <p className="mt-3 text-sm text-ink-soft">You can submit hours after an assigned activity or an activity in your unit ends.</p>}
        {ledEvents.length > 0 && (
          <div className="mt-6 space-y-2 border-t border-line pt-5">
            <h3 className="font-semibold text-navy">Manage activity hours</h3>
            <p className="text-sm text-ink-soft">As activity lead, approve pending submissions or record approved hours for any assigned participant.</p>
            {ledEvents.map(event => {
              const pending = submissions.filter(item => item.eventId === event.id && !item.approval);
              const submitted = new Set(submissions.filter(item => item.eventId === event.id).map(item => item.email));
              const recordable = eventParticipants(event).filter(recipient => !submitted.has(recipient));
              return (
                <details key={event.id} className="rounded-md border border-line p-3 text-sm">
                  <summary className="cursor-pointer font-semibold text-navy">{event.title} · {event.date.slice(0, 10)}</summary>
                  {pending.length > 0 && (
                    <form action={approveHours} className="mt-3 space-y-3 border-b border-line pb-4">
                      <input type="hidden" name="eventId" value={event.id} />
                      <p className="font-semibold">Pending submissions</p>
                      <ul className="space-y-1">
                        {pending.map(submission => (
                          <li key={submission.id}>{names.get(submission.email) ?? submission.email} · {formatHours(submission.minutes)}</li>
                        ))}
                      </ul>
                      {pending.map(submission => <input key={submission.id} type="hidden" name="submission" value={submission.id} />)}
                      <button className="btn btn-primary" type="submit">Approve all pending hours</button>
                    </form>
                  )}
                  {recordable.length > 0 && <form action={logHours} aria-label={`Record approved hours for ${event.title}`} className="mt-3 space-y-3">
                    <input type="hidden" name="eventId" value={event.id} />
                    <fieldset>
                      <legend className="font-semibold">Assigned participants</legend>
                      <ul className="mt-2 space-y-1">
                        {recordable.map(recipient => (
                          <li key={recipient}>
                            <label className="flex cursor-pointer items-center gap-2">
                              <input type="checkbox" name="volunteer" value={recipient} className="accent-blue" />
                              {names.get(recipient) ?? recipient}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </fieldset>
                    <HoursFields />
                    <button className="btn btn-primary" type="submit">Log approved hours</button>
                  </form>}
                </details>
              );
            })}
          </div>
        )}
        <div className="mt-6 border-t border-line pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-navy">Your hours history</h3>
            {entries.some(entry => entry.eventId) && (
              <a className="action-link text-sm" href="/api/volunteers/certificate" download>Download service certificate (PDF)</a>
            )}
          </div>
          {entries.length ? (
            <ul className="mt-2 divide-y divide-line">
              {entries.map(entry => (
                <li key={entry.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="wrap-anywhere font-medium text-navy">{entry.activity}</p>
                    <time dateTime={entry.date} className="text-sm text-ink-soft">{entry.date}</time>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-navy">{formatHours(entry.minutes)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-ink-soft">Your approved activities will appear here.</p>}
        </div>
      </section>
    </div>
  );
}
