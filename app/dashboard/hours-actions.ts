"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getVolunteer } from "@/lib/session";
import { kigaliToday, parseHours, saveVolunteerHours } from "@/lib/volunteer-hours";

export async function logHours(form: FormData) {
  const email = await getVolunteer();
  if (!email) redirect("/");
  const entry = parseHours(form, kigaliToday());
  if (!entry) redirect("/?section=volunteers&hours=invalid");
  try {
    await saveVolunteerHours(email, entry);
  } catch {
    redirect("/?section=volunteers&hours=unavailable");
  }
  revalidatePath("/");
  redirect("/?section=volunteers&hours=saved");
}
