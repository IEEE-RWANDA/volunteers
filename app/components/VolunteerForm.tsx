"use client";

import { useState, type FormEvent } from "react";
import { formatUsd } from "@/lib/fund-amounts";
import type { FundBalance } from "@/lib/listed-funds";
import RequestPicker from "./RequestPicker";
import { useRouter } from "next/navigation";
import { attachmentCount, attachmentLimit, attachmentTypes, type OrganizerOption } from "@/lib/volunteer-intake";

const field = "mt-1 block w-full min-w-0 rounded-md border border-line bg-paper px-3 py-2.5 font-normal text-ink focus:border-blue focus:outline-2 focus:outline-blue/30";

export default function VolunteerForm({ kind, contactEmail, organizers = [], funds = [], initialFund }: { kind: "event" | "funding"; contactEmail: string; organizers?: OrganizerOption[]; funds?: FundBalance[]; initialFund?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ id?: string; error?: string }>({});
  const [selection, setSelection] = useState<string[]>([]);
  const [selectedFunds, setSelectedFunds] = useState<string[]>(initialFund ? [initialFund] : []);
  const funding = kind === "funding";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (funding && !data.getAll("organizer").length) {
      setResult({ error: "Select at least one volunteer for the organizing committee." });
      return;
    }
    const files = ["budget", "invoice", "attachments"].flatMap(key => data.getAll(key)).filter((item): item is File => item instanceof File && item.size > 0);
    if (files.length > attachmentCount || files.reduce((total, file) => total + file.size, 0) > attachmentLimit) {
      setResult({ error: "Attach up to five files totaling 4 MB or less." });
      return;
    }

    setPending(true);
    setResult({});
    try {
      const response = await fetch("/api/volunteers", { method: "POST", body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.id !== "string") {
        setResult({ error: body.error ?? "The submission could not be saved. Please try again." });
        return;
      }
      form.reset();
      setSelection([]);
      setSelectedFunds([]);
      setResult({ id: body.id });
      if (funding) router.refresh();
    } catch {
      setResult({ error: "The site could not be reached. Your entries are still here. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 text-sm" aria-label={funding ? "Funding request" : "Event suggestion"}>
      <input type="hidden" name="kind" value={kind} />
      <label className="block font-semibold">
        {funding ? "Activity name" : "Event title"}
        <input name="title" className={field} maxLength={150} required />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {!funding && (
          <label className="block min-w-0 font-semibold">
            Organizing committee
            <input name="committee" className={field} maxLength={150} required />
          </label>
        )}
        {funding && (
          <label className="block min-w-0 font-semibold">
            Lead volunteer name
            <input name="leadVolunteerName" className={field} maxLength={150} required />
          </label>
        )}
        <label className="block min-w-0 font-semibold">
          {funding ? "Lead volunteer email" : "Contact email"}
          <input name="email" type="email" defaultValue={contactEmail} className={field} maxLength={254} required />
        </label>
        <label className="block min-w-0 font-semibold">
          {funding ? "Proposed date" : "Starts (Kigali time)"}
          <input name="date" type={funding ? "date" : "datetime-local"} className={field} required />
        </label>
        {funding ? (!selectedFunds.length && (
          <label className="block min-w-0 font-semibold">
            Amount and currency
            <input name="amount" className={field} placeholder="e.g. 150,000 RWF" maxLength={80} required />
          </label>
        )) : (
          <label className="block min-w-0 font-semibold">
            Ends (Kigali time)
            <input name="end" type="datetime-local" className={field} required />
          </label>
        )}
      </div>
      {funding && (
        <RequestPicker name="organizer" label="Organizing committee" placeholder="Select volunteers"
          searchLabel="Search by name or committee" emptyMessage="An admin needs to add volunteers to the directory first."
          options={organizers} selectedIds={selection} onChange={setSelection} field={field} />
      )}
      {funding && (
        <>
          {funds.length > 0 && (
            <RequestPicker name="fund" label="Expected funding source" placeholder="Select funds" searchLabel="Search funds"
              emptyMessage="No funds have been listed." options={funds.filter(fund => fund.remainingCents > 0 || selectedFunds.includes(fund.id)).map(fund => ({ id: fund.id, name: fund.name, committee: `${formatUsd(fund.remainingCents)} left` }))} selectedIds={selectedFunds} onChange={setSelectedFunds} field={field} />
          )}
          {funds.filter(fund => selectedFunds.includes(fund.id)).map(fund => (
            <label key={fund.id} className="block font-semibold">
              Amount from {fund.name} (USD)
              <input name={`fundAmount-${fund.id}`} type="number" min="0.01" max={fund.remainingCents / 100} step="0.01" className={field} required />
              <span className="mt-1 block font-normal text-ink-soft">{formatUsd(fund.remainingCents)} left</span>
            </label>
          ))}
          <label className="block font-semibold">
            {funds.length ? (selectedFunds.length ? "Other funding source (optional)" : "Or type an expected funding source") : "Expected funding source"}
            <input name="fundingSource" className={field} maxLength={250} placeholder="e.g. IEEE Computer Society" required={!selectedFunds.length} />
          </label>
        </>
      )}
      {!funding && (
        <>
          <label className="block font-semibold">
            Location
            <input name="location" className={field} maxLength={250} required />
          </label>
          <label className="block font-semibold">
            Registration link (optional)
            <input name="registration" type="url" className={field} maxLength={1000} />
          </label>
        </>
      )}
      <label className="block font-semibold">
        {funding ? "Activity purpose and intended use of funds" : "Event description"}
        <textarea name="details" rows={4} className={field} maxLength={4000} required />
      </label>
      {funding && (
        <>
          <label className="block font-semibold">
            vTools event link
            <input name="vtools" type="url" className={field} maxLength={1000} required />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block min-w-0 font-semibold">
              Itemized budget
              <input name="budget" type="file" className={field} accept={attachmentTypes} required aria-describedby="funding-attachment-help" />
            </label>
            <label className="block min-w-0 font-semibold">
              Invoice
              <input name="invoice" type="file" className={field} accept={attachmentTypes} required aria-describedby="funding-attachment-help" />
            </label>
          </div>
          <label className="block font-semibold">
            Supporting documents (optional)
            <input name="attachments" type="file" className={field} accept={attachmentTypes} multiple aria-describedby="funding-attachment-help" />
          </label>
          <p id="funding-attachment-help" className="text-ink-soft">
            Private review only. Up to five PDF, Excel, Word, PNG, or JPEG files totaling 4 MB.
          </p>
        </>
      )}
      <button type="submit" className="btn btn-primary disabled:opacity-60" disabled={pending || (funding && !organizers.length)}>
        {pending ? "Submitting…" : funding ? "Submit funding request" : "Submit event suggestion"}
      </button>
      {result.error && <p role="alert" className="font-semibold text-red-700">{result.error}</p>}
      {result.id && (
        <p role="status" className="break-all rounded-md border border-line bg-paper-2 p-3 text-navy">
          Submission saved. Reference <strong>{result.id}</strong>. View it in Overview.
        </p>
      )}
    </form>
  );
}
