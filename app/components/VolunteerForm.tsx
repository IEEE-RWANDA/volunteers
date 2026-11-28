"use client";

import useFormDraft from "./useFormDraft";
import { draftKey } from "@/lib/browser-drafts";

import { useRef, useState, type FormEvent } from "react";
import { formatUsd, usdCents } from "@/lib/fund-amounts";
import type { FundBalance } from "@/lib/listed-funds";
import RequestPicker from "./RequestPicker";
import { useRouter } from "next/navigation";
import { attachmentLimit, fundingRequestAttachmentCount, type OrganizerOption, type Submission } from "@/lib/volunteer-intake";

const field = "mt-1 block w-full min-w-0 rounded-md border border-line bg-paper px-3 py-2.5 font-normal text-ink focus:border-blue focus:outline-2 focus:outline-blue/30";

export default function VolunteerForm({ kind, contactEmail, organizers = [], funds = [], initialFund, eventUnits = [], activities = [], editing }: { kind: "event" | "funding"; editing?: { record: Submission; committeeIds: string[]; volunteerIds: string[] }; contactEmail: string; organizers?: OrganizerOption[]; funds?: FundBalance[]; initialFund?: string; eventUnits?: { id: string; label: string }[]; activities?: { id: string; title: string; date: string; vtools: string; unitId?: string; fundingBlockedReason?: string | null }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ id?: string; error?: string }>({});
  const [organizationId, setOrganizationId] = useState(editing?.record.eventUnitId ?? "");
  const [committeeSelection, setCommitteeSelection] = useState<string[]>(editing?.committeeIds ?? []);
  const [selection, setSelection] = useState<string[]>(editing?.volunteerIds ?? []);
  const [selectedFunds, setSelectedFunds] = useState<string[]>(initialFund ? [initialFund] : []);
  const [fundAmounts, setFundAmounts] = useState<Record<string, string>>({});
  const previousFundAmounts = useRef<Record<string, string>>({});
  const [activityId, setActivityId] = useState("");
  const draft = useFormDraft(draftKey(contactEmail, editing ? `event:${editing.record.id}:${editing.record.revision ?? 0}` : kind), formRef,
    () => ({ selection, committeeSelection, selectedFunds, fundAmounts, activityId, organizationId }), saved => {
      const state = saved.state as { selection?: string[]; committeeSelection?: string[]; selectedFunds?: string[]; fundAmounts?: Record<string, string>; activityId?: string; organizationId?: string };
      setOrganizationId(eventUnits.some(unit => unit.id === state.organizationId) ? state.organizationId! : "");
      setCommitteeSelection((state.committeeSelection ?? []).filter(id => organizers.some(person => person.id === id)));
      setSelection((state.selection ?? []).filter(id => organizers.some(person => person.id === id)));
      setSelectedFunds((state.selectedFunds ?? []).filter(id => funds.some(fund => fund.id === id)));
      setFundAmounts(state.fundAmounts ?? {});
      setActivityId(activities.some(activity => activity.id === state.activityId) ? state.activityId! : "");
    });
  const activity = activities.find(item => item.id === activityId);
  const funding = kind === "funding";
  const fundOptions = funds.filter(fund => (!activity || !fund.unitId || fund.unitId === activity.unitId) && (fund.remainingCents > 0 || selectedFunds.includes(fund.id))).map(fund => ({
    id: fund.id, name: fund.name, committee: `${fund.unitName ? fund.unitName + " · " : ""}${formatUsd(fund.remainingCents)} left`,
  }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (funding && (!activity || activity.fundingBlockedReason)) {
      setResult({ error: activity?.fundingBlockedReason ?? "Select an event or activity before requesting funds." });
      return;
    }
    if (!funding && !committeeSelection.length) {
      setResult({ error: "Select at least one registered volunteer for the organizing committee." });
      return;
    }
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
        if (fund?.unitId && fund.unitId !== activity?.unitId) {
          setResult({ error: "Select funds assigned to this activity’s organization." });
          return;
        }
        const amount = fundAmounts[id]?.trim() ?? "";
        const cents = usdCents(amount);
        if (!fund || !cents || cents > fund.remainingCents) {
          setResult({ error: `Open Expected funding sources and enter an amount within the available balance for ${fund?.name ?? "each selected fund"}.` });
          return;
        }
        data.set(`fundAmount-${id}`, amount);
      }
    }
    const files = ["budget", "invoice", "approvalEmail", "eventPoster"].flatMap(key => data.getAll(key)).filter((item): item is File => item instanceof File && item.size > 0);
    if (files.length > fundingRequestAttachmentCount || files.reduce((total, file) => total + file.size, 0) > attachmentLimit) {
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
      await draft.clear();
      if (editing) {
        router.push("/?section=events&eventSaved=" + editing.record.id);
        router.refresh();
        return;
      }
      form.reset();
      setActivityId("");
      setSelection([]);
      setCommitteeSelection([]);
      setOrganizationId("");
      setSelectedFunds([]);
      setFundAmounts({});
      setResult({ id: body.id });
      router.refresh();
    } catch {
      setResult({ error: "The site could not be reached. Your entries are still here. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onChange={draft.changed} onClick={draft.changed} onSubmit={submit} className={`mt-6 space-y-4 text-sm ${funding ? "@container" : ""}`} aria-label={funding ? "Funding request" : "Event/activity submission"}>
      {(draft.status.includes("could not") || draft.status.includes("unavailable")) && <p role="alert" className="text-sm text-red-700">{draft.status}</p>}
      <fieldset disabled={!draft.ready} className="contents">
      <input type="hidden" name="kind" value={kind} />
      {editing && <><input type="hidden" name="eventId" value={editing.record.id} /><input type="hidden" name="baseRevision" value={editing.record.revision ?? 0} /><p className="rounded-md bg-paper-2 p-3 text-ink-soft">Changes need calendar review. The public calendar keeps the last published version until your update is approved and published.</p></>}
      <div className={funding ? "relative grid gap-5 @min-[440px]:grid-cols-2 @min-[440px]:before:pointer-events-none @min-[440px]:before:absolute @min-[440px]:before:inset-y-0 @min-[440px]:before:start-1/2 @min-[440px]:before:border-s @min-[440px]:before:border-line @min-[800px]:gap-8" : undefined}>
        <div className={`min-w-0 space-y-4 ${funding ? "@min-[440px]:flex @min-[440px]:flex-col" : ""}`}>
          {funding && <h3 className="font-display text-lg font-bold text-navy">Activity and funding details</h3>}
          {funding ? (
            <div>
              <RequestPicker name="fundingEventId" label="Event or activity" placeholder="Select an event or activity" searchLabel="Search your events and activities" emptyMessage="Create an event or activity before requesting funds." options={activities.map(item => ({ id: item.id, name: item.title, committee: item.date }))} selectedIds={activityId ? [activityId] : []} onChange={ids => {
                const id = ids[0] ?? "";
                setActivityId(id);
                const unitId = activities.find(item => item.id === id)?.unitId;
                setSelectedFunds(current => current.filter(fundId => {
                  const fund = funds.find(item => item.id === fundId);
                  return fund && (!fund.unitId || fund.unitId === unitId);
                }));
              }} field={field} multiple={false} />
              {activity?.fundingBlockedReason && <p role="status" className="mt-2 text-sm text-red-700">{activity.fundingBlockedReason}</p>}
            </div>
          ) : (
            <label className="block font-semibold">
              Event or activity title
              <input name="title" defaultValue={editing?.record.title} className={field} maxLength={150} required />
            </label>
          )}
          <div className={`grid gap-4 ${funding ? "@min-[800px]:grid-cols-2" : "sm:grid-cols-2"}`}>
            {!funding && (
              <RequestPicker name="committeeOrganizer" label="Organizing committee" placeholder="Select organizing committee" searchLabel="Search registered volunteers" emptyMessage="No registered volunteers are available." options={organizers} selectedIds={committeeSelection} onChange={setCommitteeSelection} field={field} />
            )}
            {funding && (
              <label className="block min-w-0 font-semibold">
                Lead volunteer name
                <input name="leadVolunteerName" className={field} maxLength={150} required />
              </label>
            )}
            <label className="block min-w-0 font-semibold">
              {funding ? "Lead volunteer email" : "Contact email"}
              <input name="email" type="email" defaultValue={editing?.record.email ?? contactEmail} className={field} maxLength={254} required />
            </label>
            {!funding && (
              <label className="block min-w-0 font-semibold">
                Starts (Kigali time)
                <input name="date" defaultValue={editing?.record.date} type="datetime-local" className={field} required />
              </label>
            )}
            {!funding && (
              <label className="block min-w-0 font-semibold">
                Ends (Kigali time)
                <input name="end" defaultValue={editing?.record.end} type="datetime-local" className={field} required />
              </label>
            )}
          </div>
          {!funding && (
            <>
              <p className="text-sm text-ink-soft">You’ll be listed as the event lead and can record hours for the volunteers selected below once the event ends.</p>
              <RequestPicker name="eventUnitId" label="Organization (required for funding)" placeholder="Select organization" searchLabel="Search organizations" emptyMessage="No organizations are available yet." options={eventUnits.map(unit => ({ id: unit.id, name: unit.label }))} selectedIds={organizationId ? [organizationId] : []} onChange={ids => setOrganizationId(ids[0] ?? "")} field={field} multiple={false} />
            </>
          )}
          <RequestPicker name="organizer" label={funding ? "Organizing committee" : "Volunteers"} placeholder="Select volunteers"
            searchLabel="Search by name or committee" emptyMessage="An admin needs to add volunteers to the directory first."
            options={organizers} selectedIds={selection} onChange={setSelection} field={field} />
          {funding && (
            <RequestPicker
              name="fund" label="Expected funding sources" placeholder="Select funds" searchLabel="Search funds"
              onOpen={() => { previousFundAmounts.current = { ...fundAmounts }; }}
              onCancel={() => { setFundAmounts(previousFundAmounts.current); draft.changed(); }}
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
                <input name="location" defaultValue={editing?.record.location} className={field} maxLength={250} required />
              </label>
              <label className="block font-semibold">
                vTools event link
                <input name="vtools" defaultValue={editing?.record.vtools} type="url" className={field} maxLength={1000} required />
              </label>
            </>
          )}
          {funding && <label className="block font-semibold">
            Intended use of funds
            <textarea name="intendedUse" rows={3} className={field} maxLength={1000} placeholder="Briefly describe what the requested funds will cover." required />
          </label>}
          {!funding && <label className="block font-semibold">
            Event or activity description
            <textarea name="details" defaultValue={editing?.record.details} rows={4} className={field} maxLength={4000} required />
          </label>}
        </div>
        {funding && (
          <section aria-labelledby="funding-documents" className="min-w-0 space-y-4 border-t border-line pt-6 @min-[440px]:flex @min-[440px]:flex-col @min-[440px]:border-t-0 @min-[440px]:pt-0">
            <h3 id="funding-documents" className="font-display text-lg font-bold text-navy">Documents and acknowledgement</h3>
            <fieldset className="space-y-3">
              <legend className="sr-only">Required funding documents</legend>
              <label className="block font-semibold">
                Funding approval email
                <input name="approvalEmail" type="file" className={field} accept=".pdf,.png,.jpg,.jpeg" required />
                <span className="mt-1 block font-normal text-ink-soft">From the IEEE entity providing the funds. Upload the email as a PDF or screenshot.</span>
              </label>
              <label className="block font-semibold">
                Event poster
                <input name="eventPoster" type="file" className={field} accept=".pdf,.png,.jpg,.jpeg" required />
              </label>
              <div>
                <label className="block font-semibold">
                  Budget expense sheet
                  <input name="budget" type="file" className={field} accept=".xlsx" required />
                </label>
                <a href="https://docs.google.com/spreadsheets/d/1sDA_Yyt780Eivl2DRBXuXaGvJxf2XP4hGuLr2E2lYfs/copy" target="_blank" rel="noopener noreferrer" className="action-link mt-1 inline-block">Make a copy of the budget template</a>
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
                <span>I will submit receipts within 30 days of the activity. I understand that funds from the same funder for a different activity can only be released after my previous reports for that funder are approved.</span>
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
          <input type="checkbox" name="acknowledgeVtools" value="yes" defaultChecked={Boolean(editing?.record.vtoolsAcknowledgedAt)} required className="mt-0.5 size-4 shrink-0 accent-blue" />
          <span>I have added IEEE Rwanda as a collaborator in vTools and set <strong>gentille.uwera@ieee.org</strong> as the contact email. I understand that Gentille Uwera will be contacted during funding clearance to confirm the collaborator and contact email in vTools.</span>
        </label>
      )}
      <div className="flex justify-center py-6">
        <button type="submit" className="btn btn-primary disabled:opacity-60" disabled={pending || (funding && (!activity || Boolean(activity.fundingBlockedReason) || !organizers.length || !fundOptions.length))}>
          {pending ? editing ? "Saving changes…" : "Submitting…" : editing ? "Save event changes" : funding ? "Submit funding request" : "Submit event or activity"}
        </button>
      </div>
      {result.error && <p role="alert" className="font-semibold text-red-700">{result.error}</p>}
      {result.id && (
        <p role="status" className="break-all rounded-md border border-line bg-paper-2 p-3 text-navy">
          Submission saved. Reference <strong>{result.id}</strong>. View it in Overview.
        </p>
      )}
      </fieldset>
    </form>
  );
}
