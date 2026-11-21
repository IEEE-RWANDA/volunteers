"use client";

import { useState, type FormEvent } from "react";
import { formatUsd, usdCents } from "@/lib/fund-amounts";
import type { FundBalance } from "@/lib/listed-funds";
import RequestPicker from "./RequestPicker";
import { useRouter } from "next/navigation";
import { attachmentCount, attachmentLimit, type OrganizerOption } from "@/lib/volunteer-intake";

const field = "mt-1 block w-full min-w-0 rounded-md border border-line bg-paper px-3 py-2.5 font-normal text-ink focus:border-blue focus:outline-2 focus:outline-blue/30";

export default function VolunteerForm({ kind, contactEmail, organizers = [], funds = [], initialFund }: { kind: "event" | "funding"; contactEmail: string; organizers?: OrganizerOption[]; funds?: FundBalance[]; initialFund?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ id?: string; error?: string }>({});
  const [selection, setSelection] = useState<string[]>([]);
  const [selectedFunds, setSelectedFunds] = useState<string[]>(initialFund ? [initialFund] : []);
  const [fundAmounts, setFundAmounts] = useState<Record<string, string>>({});
  const funding = kind === "funding";
  const committees = [...new Set(organizers.flatMap(member => member.committee ? [member.committee] : []))].sort();
  const fundOptions = funds.filter(fund => fund.remainingCents > 0 || selectedFunds.includes(fund.id)).map(fund => ({
    id: fund.id, name: fund.name, committee: `${formatUsd(fund.remainingCents)} left`,
  }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (funding && !data.getAll("organizer").length) {
      setResult({ error: "Select at least one volunteer for the organizing committee." });
      return;
    }
    if (funding) {
      if (!selectedFunds.length) {
        setResult({ error: "Select at least one expected funding source." });
        return;
      }
      for (const id of selectedFunds) {
        const fund = funds.find(item => item.id === id);
        const amount = fundAmounts[id]?.trim() ?? "";
        const cents = usdCents(amount);
        if (!fund || !cents || cents > fund.remainingCents) {
          setResult({ error: `Open Expected funding sources and enter an amount within the available balance for ${fund?.name ?? "each selected fund"}.` });
          return;
        }
        data.set(`fundAmount-${id}`, amount);
      }
    }
    const files = ["budget", "invoice", "approvalEmail"].flatMap(key => data.getAll(key)).filter((item): item is File => item instanceof File && item.size > 0);
    if (files.length > attachmentCount || files.reduce((total, file) => total + file.size, 0) > attachmentLimit) {
      setResult({ error: "Attach up to three invoices. All uploads must total 4 MB or less." });
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
      setFundAmounts({});
      setResult({ id: body.id });
      if (funding) router.refresh();
    } catch {
      setResult({ error: "The site could not be reached. Your entries are still here. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={`mt-6 space-y-4 text-sm ${funding ? "@container" : ""}`} aria-label={funding ? "Funding request" : "Event submission"}>
      <input type="hidden" name="kind" value={kind} />
      <div className={funding ? "relative grid gap-5 @min-[440px]:grid-cols-2 @min-[440px]:before:pointer-events-none @min-[440px]:before:absolute @min-[440px]:before:inset-y-0 @min-[440px]:before:start-1/2 @min-[440px]:before:border-s @min-[440px]:before:border-line @min-[800px]:gap-8" : undefined}>
        <div className={`min-w-0 space-y-4 ${funding ? "@min-[440px]:flex @min-[440px]:flex-col" : ""}`}>
          {funding && <h3 className="font-display text-lg font-bold text-navy">Activity and funding details</h3>}
          <label className="block font-semibold">
            {funding ? "Activity name" : "Event title"}
            <input name="title" className={field} maxLength={150} required />
          </label>
          <div className={`grid gap-4 ${funding ? "@min-[800px]:grid-cols-2" : "sm:grid-cols-2"}`}>
            {!funding && (
              <label className="block min-w-0 font-semibold">
                Organizing committee
                <input name="committee" list="event-committees" className={field} maxLength={150} required />
                <datalist id="event-committees">
                  {committees.map(committee => <option key={committee} value={committee} />)}
                </datalist>
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
            {!funding && (
              <label className="block min-w-0 font-semibold">
                Ends (Kigali time)
                <input name="end" type="datetime-local" className={field} required />
              </label>
            )}
          </div>
          <RequestPicker name="organizer" label={funding ? "Organizing committee" : "Volunteers"} placeholder="Select volunteers"
            searchLabel="Search by name or committee" emptyMessage="An admin needs to add volunteers to the directory first."
            options={organizers} selectedIds={selection} onChange={setSelection} field={field} />
          {funding && (
            <RequestPicker
              name="fund" label="Expected funding sources" placeholder="Select funds" searchLabel="Search funds"
              emptyMessage="No funds are available to request." options={fundOptions}
              selectedIds={selectedFunds} onChange={setSelectedFunds} field={field}
              summary={fund => {
                const cents = usdCents(fundAmounts[fund.id]?.trim() ?? "");
                return cents ? `${fund.name} (${formatUsd(cents)})` : fund.name;
              }}
              renderSelected={fund => (
                <label className="block px-3 pb-3 text-sm font-semibold">
                  Amount from {fund.name} (USD)
                  <input
                    inputMode="decimal" className={field} maxLength={15}
                    value={fundAmounts[fund.id] ?? ""}
                    onChange={event => setFundAmounts({ ...fundAmounts, [fund.id]: event.target.value })}
                    onKeyDown={event => {
                      if (event.key === "Enter") event.preventDefault();
                    }}
                  />
                </label>
              )}
            />
          )}
          {!funding && (
            <>
              <label className="block font-semibold">
                Location
                <input name="location" className={field} maxLength={250} required />
              </label>
              <label className="block font-semibold">
                vTools event link
                <input name="vtools" type="url" className={field} maxLength={1000} required />
              </label>
            </>
          )}
          <label className={`block font-semibold ${funding ? "@min-[440px]:flex @min-[440px]:flex-1 @min-[440px]:flex-col" : ""}`}>
            {funding ? "Activity purpose and intended use of funds" : "Event description"}
            <textarea name="details" rows={4} className={`${field} ${funding ? "@min-[440px]:flex-1" : ""}`} maxLength={4000} required />
          </label>
        </div>
        {funding && (
          <section aria-labelledby="funding-documents" className="min-w-0 space-y-4 border-t border-line pt-6 @min-[440px]:flex @min-[440px]:flex-col @min-[440px]:border-t-0 @min-[440px]:pt-0">
            <h3 id="funding-documents" className="font-display text-lg font-bold text-navy">Documents and acknowledgement</h3>
            <label className="block font-semibold">
              vTools event link
              <input name="vtools" type="url" className={field} maxLength={1000} required />
            </label>
            <fieldset className="space-y-3">
              <legend className="sr-only">Required funding documents</legend>
              <label className="block font-semibold">
                Funding approval email
                <input name="approvalEmail" type="file" className={field} accept=".pdf,.png,.jpg,.jpeg" required />
                <span className="mt-1 block font-normal text-ink-soft">Upload the email as a PDF or screenshot.</span>
              </label>
              <div>
                <label className="block font-semibold">
                  Budget expense sheet
                  <input name="budget" type="file" className={field} accept=".xlsx" required />
                </label>
                <a href="/templates/funding-budget.xlsx" download className="action-link mt-1 inline-block">Download the Excel budget template</a>
              </div>
              <label className="block font-semibold">
                Invoices
                <input name="invoice" type="file" className={field} accept=".pdf,.png,.jpg,.jpeg" multiple required />
                <span className="mt-1 block font-normal text-ink-soft">The invoices must add up to the full amount requested.</span>
              </label>
            </fieldset>
            <fieldset className="space-y-3 rounded-md border border-line bg-paper-2 p-3 @min-[440px]:mt-auto">
              <legend className="sr-only">Receipt acknowledgements</legend>
              <label className="flex items-start gap-3">
                <input type="checkbox" name="acknowledgeReceipts" value="yes" required className="mt-0.5 size-4 shrink-0 accent-blue" />
                <span>I will submit receipts within 30 days of the activity. I understand that funds for a different activity can only be released once I submit receipts for previous activities.</span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" name="acknowledgeReceiptFormat" value="yes" required className="mt-0.5 size-4 shrink-0 accent-blue" />
                <span>I will ensure that all receipts are generated by EBM or a point-of-sale (POS) system. I understand that failing to follow the receipts requirements may affect future funding requests.</span>
              </label>
            </fieldset>
          </section>
        )}
      </div>
      {!funding && (
        <label className="flex items-start gap-3 rounded-md border border-line bg-paper-2 p-3">
          <input type="checkbox" name="acknowledgeVtools" value="yes" required className="mt-0.5 size-4 shrink-0 accent-blue" />
          <span>I have added IEEE Rwanda as a collaborator in vTools and set <strong>gentille.uwera@ieee.org</strong> as the contact email. I understand that Gentille Uwera will be contacted during funding clearance to confirm the collaborator and contact email in vTools.</span>
        </label>
      )}
      <div className="flex justify-center">
        <button type="submit" className="btn btn-primary disabled:opacity-60" disabled={pending || (funding && (!organizers.length || !fundOptions.length))}>
          {pending ? "Submitting…" : funding ? "Submit funding request" : "Submit event"}
        </button>
      </div>
      {result.error && <p role="alert" className="font-semibold text-red-700">{result.error}</p>}
      {result.id && (
        <p role="status" className="break-all rounded-md border border-line bg-paper-2 p-3 text-navy">
          Submission saved. Reference <strong>{result.id}</strong>. View it in Overview.
        </p>
      )}
    </form>
  );
}
