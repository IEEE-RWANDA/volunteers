export default function VolunteerDirectory({ members, viewer }: {
  members: { email: string; name: string; bio?: string; committee?: string; officerTitle?: string }[];
  viewer: string;
}) {
  return (
    <section className="panel" aria-labelledby="directory-title">
      <h2 id="directory-title" className="panel-title">Volunteer directory</h2>
      <div className="mt-4 scrollable-table" role="region" aria-label="Volunteer directory table" tabIndex={0}>
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line bg-paper-2 text-navy">
            <tr>{["Volunteer", "Email", "Role / unit"].map(label => <th key={label} scope="col" className="px-3 py-2">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map(member => (
              <tr key={member.email}>
                <td className="px-3 py-3 align-top">
                  <p className="wrap-anywhere font-medium text-navy">
                    {member.name}{member.email === viewer && <span className="ms-2 text-xs text-ink-soft">(you)</span>}
                  </p>
                  {member.bio && <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-ink-soft">{member.bio}</p>}
                </td>
                <td className="px-3 py-3 align-top"><a className="action-link wrap-anywhere" href={`mailto:${member.email}`}>{member.email}</a></td>
                <td className="wrap-anywhere px-3 py-3 align-top text-ink-soft">{[member.officerTitle, member.committee].filter(Boolean).join(" · ") || "—"}</td>
              </tr>
            ))}
            {!members.length && <tr><td colSpan={3} className="px-3 py-6 text-center text-ink-soft">No volunteers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
