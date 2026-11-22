export default function VolunteerDirectory({ members, viewer }: {
  members: { email: string; name: string; bio?: string; committee?: string; officerTitle?: string }[];
  viewer: string;
}) {
  return (
    <section className="panel" aria-labelledby="directory-title">
      <h2 id="directory-title" className="panel-title">Volunteer directory</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {members.map(member => (
          <li key={member.email} className="min-w-0 rounded-lg border border-line p-4">
            <p className="wrap-anywhere font-medium text-navy">
              {member.name}{member.email === viewer && <span className="ms-2 text-xs text-ink-soft">(you)</span>}
            </p>
            {(member.officerTitle || member.committee) && (
              <p className="mt-1 wrap-anywhere text-sm text-ink-soft">{[member.officerTitle, member.committee].filter(Boolean).join(" · ")}</p>
            )}
            {member.bio && <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm text-ink-soft">{member.bio}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
