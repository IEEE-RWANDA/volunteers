"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eventsForHours, eventsLedBy, eventParticipants } from "@/lib/event-hours";
import { getVolunteer } from "@/lib/session";
import { approveHourSubmissions, hourSubmissions, parseHours, saveTeamHours, submitVolunteerHours } from "@/lib/volunteer-hours";

function finish(status: string): never {
  redirect("/?section=volunteers&hours=" + status + "#hours-title");
}

export async function logHours(form: FormData) {
  const email = await getVolunteer();
  if (!email) redirect("/");
  const event = (await eventsLedBy(email)).find(item => item.id === form.get("eventId"));
  if (!event) finish("forbidden");
  const allowed = new Set(eventParticipants(event));
  const recipients = [...new Set(form.getAll("volunteer"))];
  const minutes = parseHours(form);
  const submitted = new Set((await hourSubmissions()).filter(item => item.eventId === event.id).map(item => item.email));
  if (!minutes || !recipients.length || !recipients.every(item => typeof item === "string" && allowed.has(item) && !submitted.has(item))) finish("invalid");
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

export async function submitHours(form: FormData) {
  const email = await getVolunteer();
  if (!email) redirect("/");
  const event = (await eventsForHours(email)).find(item => item.id === form.get("eventId"));
  const minutes = parseHours(form);
  if (!event) finish("forbidden");
  if (!minutes) finish("invalid");
  try {
    const saved = await submitVolunteerHours(email, {
      eventId: event.id, activity: event.title, date: event.date.slice(0, 10), minutes,
    });
    if (!saved) finish("duplicate");
  } catch {
    finish("unavailable");
  }
  revalidatePath("/");
  finish("submitted");
}

export async function approveHours(form: FormData) {
  const email = await getVolunteer();
  if (!email) redirect("/");
  const event = (await eventsLedBy(email)).find(item => item.id === form.get("eventId"));
  if (!event) finish("forbidden");
  const requested = [...new Set(form.getAll("submission"))];
  const submissions = (await hourSubmissions()).filter(item => !item.approval && item.eventId === event.id);
  const allowed = new Set(submissions.map(item => item.id));
  if (!requested.length || !requested.every(id => typeof id === "string" && allowed.has(id))) finish("invalid");
  try {
    await approveHourSubmissions(requested as string[], email);
  } catch {
    finish("unavailable");
  }
  revalidatePath("/");
  finish("approved");
}
