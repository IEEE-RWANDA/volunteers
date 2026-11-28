"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getVolunteer } from "@/lib/session";
import { setCalendarReviewer } from "@/lib/calendar-reviewers";

export async function updateCalendarReviewer(form: FormData) {
  const actor = await getVolunteer();
  const email = String(form.get("email") ?? "");
  const action = form.get("action");
  let status = "calendar-reviewer-error";
  if (actor && (action === "add" || action === "remove")) {
    try {
      if (await setCalendarReviewer(actor, email, action === "add")) status = "calendar-reviewer-saved";
    } catch {
      status = "calendar-reviewer-error";
    }
  }
  revalidatePath("/");
  redirect(`/?section=team&tab=events&team=${status}#admin-events`);
}
