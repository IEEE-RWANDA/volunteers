"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eventsForHours, eventParticipants } from "@/lib/event-hours";
import { getVolunteer } from "@/lib/session";
import { parseHours, saveTeamHours } from "@/lib/volunteer-hours";

function finish(status: string): never {
  redirect("/?section=volunteers&hours=" + status + "#hours-title");
}

export async function logHours(form: FormData) {
  const email = await getVolunteer();
  if (!email) redirect("/");
  const event = (await eventsForHours(email)).find(item => item.id === form.get("eventId"));
  if (!event) finish("forbidden");
  const allowed = new Set(eventParticipants(event));
  const recipients = [...new Set(form.getAll("volunteer"))];
  const minutes = parseHours(form);
  if (!minutes || !recipients.length || !recipients.every(item => typeof item === "string" && allowed.has(item))) finish("invalid");
  try {
    await saveTeamHours(email, recipients as string[], {
      eventId: event.id, activity: event.title, date: event.date.slice(0, 10), minutes,
    });
  } catch {
    finish("unavailable");
  }
  revalidatePath("/");
  finish("saved");
}
