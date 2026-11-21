"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTeamAccess } from "@/lib/session";
import { addToRoster, roster, teamRoster } from "@/lib/volunteer-roster";
import { kigaliToday, parseHours, saveTeamHours } from "@/lib/volunteer-hours";

function finish(status: string): never {
  revalidatePath("/dashboard");
  redirect("/dashboard?section=team&team=" + status);
}

export async function addVolunteer(form: FormData) {
  const access = await getTeamAccess();
  if (access?.role !== "admin") redirect("/dashboard");
  const field = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const name = field("name");
  const email = field("email").toLowerCase();
  const committee = field("committee");
  if (!name || name.length > 120 || !committee || committee.length > 120 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) finish("invalid-volunteer");
  if ((await roster()).some(member => member.email === email)) finish("duplicate");
  try {
    await addToRoster({ name, email, committee });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") finish("duplicate");
    finish("unavailable");
  }
  finish("volunteer-added");
}

export async function logTeamHours(form: FormData) {
  const access = await getTeamAccess();
  if (!access) redirect("/dashboard");
  const chosen = [...new Set(form.getAll("volunteer"))];
  const entry = parseHours(form, kigaliToday());
  if (!entry || !chosen.length || chosen.some(value => typeof value !== "string")) finish("invalid-hours");
  const allowed = new Set((await teamRoster(access)).map(member => member.email));
  const emails = chosen as string[];
  if (emails.some(email => !allowed.has(email))) finish("invalid-hours");
  try {
    await saveTeamHours(access.email, emails, entry);
  } catch {
    finish("unavailable");
  }
  finish("hours-saved");
}
