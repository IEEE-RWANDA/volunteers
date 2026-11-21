"use server";

import { redirect } from "next/navigation";
import { endVolunteerSession, startVolunteerSession } from "@/lib/session";

export async function signIn(form: FormData) {
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string" ||
      email.length > 254 || password.length > 256 ||
      !await startVolunteerSession(email, password)) redirect("/?error=credentials");
  redirect("/");
}

export async function signOut() {
  await endVolunteerSession();
  redirect("/");
}
