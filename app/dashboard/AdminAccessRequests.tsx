import { accessRequests } from "@/lib/access-requests";
import { reviewAccess } from "./access-actions";

const messages: Record<string, string> = {
  "access-approved": "Access approved. The volunteer can now sign in.",
  "access-rejected": "Access request rejected.",
  "access-stale": "This request has already been reviewed or is unavailable.",
  "access-error": "Could not save the decision. Please try again.",
};

export default async function AdminAccessRequests({ status }: { status?: string }) {
  const requests = (await accessRequests()).filter(request => !request.decision);
  const message = status && Object.hasOwn(messages, status) ? messages[status] : null;
  if (!requests.length) {
    return message ? <p id="approve-access" role="status" className="panel scroll-mt-5 text-sm font-semibold text-navy">{message}</p> : null;
  }

  return (
    <section className="panel scroll-mt-5" id="approve-access" aria-labelledby="approve-access-heading">
      <h2 id="approve-access-heading" className="panel-title">Approve access</h2>
      <p className="mt-2 text-sm text-ink-soft">Review requests from verified Google accounts. Approval grants volunteer access.</p>
      {message && <p role="status" className="mt-3 text-sm font-semibold text-navy">{message}</p>}
      <ul className="mt-3 divide-y divide-line">
        {requests.map(request => (
          <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="wrap-anywhere font-semibold text-navy">{request.name}</p>
              <p className="wrap-anywhere text-sm text-ink-soft">{request.email}</p>
            </div>
            <form action={reviewAccess} aria-label={`Review access for ${request.email}`} className="flex gap-2">
              <input type="hidden" name="id" value={request.id} />
              <button className="btn btn-primary" name="decision" value="approved">Approve</button>
              <button className="btn border border-line text-navy" name="decision" value="rejected">Reject</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
