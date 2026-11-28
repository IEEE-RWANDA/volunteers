"use client";

import { useRef, useState, type FormEvent } from "react";
import useFormDraft from "@/app/components/useFormDraft";
import { draftKey } from "@/lib/browser-drafts";
import EventBudgetFields from "@/app/components/EventBudgetFields";
import type { EventBudget } from "@/lib/event-budget";
import { saveEventBudget } from "./event-budget-actions";

export default function EventBudgetPlanner({ id, email, initial }: { id: string; email: string; initial?: EventBudget }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [budget, setBudget] = useState(initial);
  const [version, setVersion] = useState(0);
  const draft = useFormDraft(draftKey(email, `budget:${id}`), formRef, () => null, saved => {
    const value = saved.entries.find(([name]) => name === "eventBudget")?.[1];
    if (typeof value === "string") { setBudget(JSON.parse(value)); setVersion(version => version + 1); }
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage("");
    try {
      const result = await saveEventBudget(new FormData(event.currentTarget));
      if (result.saved) await draft.clear();
      setMessage(result.error ?? "Budget saved.");
    } catch { setMessage("Budget could not be saved. Please retry."); }
    finally { setPending(false); }
  }
  return <form ref={formRef} onChange={draft.changed} onClick={draft.changed} onSubmit={submit} className="mt-4 space-y-4">
    <p role="status" className="text-sm text-ink-soft">{draft.status}</p>
    <fieldset disabled={!draft.ready} className="contents">
    <input type="hidden" name="eventId" value={id} /><EventBudgetFields key={version} initial={budget} />
    <div className="text-center"><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save event budget"}</button><p role="status" className="mt-2 text-sm">{message}</p></div>
    </fieldset>
  </form>;
}
