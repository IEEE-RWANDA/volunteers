import { readIntakeJson } from "@/lib/volunteer-store";

export const treasuryHistoryOwner = "kipngeno.koech@ieee.org";

type HistoryItem = {
  id: string;
  title: string;
  details: string[];
  email?: string;
  volunteerEmails?: string[];
  links?: { label: string; url: string }[];
};

type History = {
  incoming: HistoryItem[];
  payments: HistoryItem[];
  activities: HistoryItem[];
};

export default async function TreasuryHistory({ email }: { email: string }) {
  if (email !== treasuryHistoryOwner) return null;

  const history = await readIntakeJson<History>("treasury-history/ieee-rwanda.json");
  if (!history) return <p>Treasury history has not been imported.</p>;

  return (
    <div className="space-y-5">
      {([
        ["Incoming IEEE funds", history.incoming],
        ["Disbursements", history.payments],
        ["Activities and receipts", history.activities],
      ] as const).map(([title, items]) => (
        <section key={title} className="panel">
          <h2 className="panel-title">{title} ({items.length})</h2>
          <ul className="mt-3 divide-y divide-line">
            {items.map(item => (
              <li key={item.id} className="wrap-anywhere py-3">
                <h3 className="font-semibold text-navy">{item.title}</h3>
                {item.details.map((detail, index) => <p key={index} className="text-sm text-ink-soft">{detail}</p>)}
                {item.email && <p className="text-sm text-ink-soft">{item.email}</p>}
                {!!item.volunteerEmails?.length && <p className="text-sm text-ink-soft">Linked volunteers · {item.volunteerEmails.join(", ")}</p>}
                {item.links?.map(link => (
                  <a key={link.url} className="action-link mr-4" href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
