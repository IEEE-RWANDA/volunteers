"use client";

import { useState, type FormEvent } from "react";
import EventBudgetFields from "@/app/components/EventBudgetFields";
import type { EventBudget } from "@/lib/event-budget";
import { saveEventBudget } from "./event-budget-actions";

export default function EventBudgetPlanner({ id, initial }: { id: string; initial?: EventBudget }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage("");
    try {
      const result = await saveEventBudget(new FormData(event.currentTarget));
      setMessage(result.error ?? "Budget saved.");
    } catch { setMessage("Budget could not be saved. Please retry."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="mt-4 space-y-4">
    <input type="hidden" name="eventId" value={id} /><EventBudgetFields initial={initial} />
    <div className="text-center"><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save event budget"}</button><p role="status" className="mt-2 text-sm">{message}</p></div>
  </form>;
}
