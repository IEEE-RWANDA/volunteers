"use server";

import { getVolunteer } from "@/lib/session";
import { ownVolunteerEvent, saveIntakeFile } from "@/lib/volunteer-store";
import { parseEventBudget } from "@/lib/event-budget";

export async function saveEventBudget(form: FormData) {
  const email = await getVolunteer();
  if (!email) return { error: "Sign in to edit your budget." };
  const event = await ownVolunteerEvent(String(form.get("eventId") ?? ""), email);
  if (!event) return { error: "You can only edit budgets for your own activities." };
  try {
    const budget = parseEventBudget(JSON.parse(String(form.get("eventBudget") ?? "")));
    if (!budget) return { error: "Enter a valid total and complete each budget item." };
    await saveIntakeFile(`event-budgets/${event.id}.json`, JSON.stringify({ ...budget, updatedAt: new Date().toISOString(), updatedBy: email }), true);
    return { saved: true };
  } catch { return { error: "Budget could not be saved. Your changes are still here; please retry." }; }
}
