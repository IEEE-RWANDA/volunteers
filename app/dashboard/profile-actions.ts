"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getVolunteer } from "@/lib/session";
import { saveVolunteerProfile } from "@/lib/volunteer-roster";

export async function updateProfile(form: FormData) {
  const email = await getVolunteer();
  if (!email) redirect("/");
  const name = String(form.get("name") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  if (!name || name.length > 120 || bio.length > 500) redirect("/?section=volunteers&profile=invalid#your-profile");
  const ieeeMemberNumber = String(form.get("ieeeMemberNumber") ?? "").trim();
  if (ieeeMemberNumber && !/^[0-9]{1,20}$/.test(ieeeMemberNumber)) {
    redirect("/?section=volunteers&profile=invalid-member-number#your-profile");
  }
  try {
    await saveVolunteerProfile({ email, name, bio, ieeeMemberNumber });
  } catch {
    redirect("/?section=volunteers&profile=unavailable#your-profile");
  }
  revalidatePath("/");
  redirect("/?section=volunteers&profile=saved#your-profile");
}
