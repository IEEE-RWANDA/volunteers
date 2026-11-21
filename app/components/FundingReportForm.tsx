"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { attachmentCount, attachmentLimit } from "@/lib/volunteer-intake";

export default function FundingReportForm({ requests, selected, revision }: { requests: { id: string; title: string; date: string }[]; selected?: string; revision?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const files = Array.from(data.values()).filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > attachmentCount || files.reduce((total, file) => total + file.size, 0) > attachmentLimit) {
      setError("Attach up to five files totaling 4 MB or less.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/volunteers", { method: "POST", body: data });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setError(result?.error ?? "The report could not be saved. Try again.");
        return;
      }
      router.push("/dashboard?section=funding&report=saved");
      router.refresh();
    } catch {
      setError("The site could not be reached. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4" aria-label="Post-activity funding report">
      <input type="hidden" name="kind" value="funding-report" />
      <label className="block text-sm font-semibold">Funding request
        <select className="login-input" name="requestId" defaultValue={selected ?? ""} required>
          <option value="" disabled>Select the activity</option>
          {requests.map(request => <option key={request.id} value={request.id}>{request.title} · {request.date}</option>)}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block min-w-0 text-sm font-semibold">Receipts
          <input className="login-input" type="file" name="receipts" accept=".pdf,.png,.jpg,.jpeg" multiple required />
        </label>
        <label className="block min-w-0 text-sm font-semibold">Expense sheet (.xlsx)
          <input className="login-input" type="file" name="expense" accept=".xlsx" required />
        </label>
        <label className="block min-w-0 text-sm font-semibold">Event photos link
          <input className="login-input" type="url" name="photos" maxLength={1000} required />
        </label>
        <label className="block min-w-0 text-sm font-semibold">vTools event link
          <input className="login-input" type="url" name="vtools" maxLength={1000} required />
        </label>
      </div>
      <label className="block text-sm font-semibold">One-page activity report (PDF)
        <input className="login-input" type="file" name="summary" accept=".pdf" required />
      </label>
      <p className="text-sm text-ink-soft">Use the PDF to summarize what took place, the outcomes, and any budget differences. Files are private. Up to five files totaling 4 MB.</p>
      <button className="btn btn-primary disabled:opacity-60" type="submit" disabled={pending}>
        {pending ? "Submitting…" : revision ? "Submit revised report" : "Submit funding report"}
      </button>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    </form>
  );
}
