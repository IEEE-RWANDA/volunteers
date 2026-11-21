"use server";

import { redirect } from "next/navigation";
import { decideAccess } from "@/lib/access-requests";
import { getTeamAccess } from "@/lib/session";

export async function reviewAccess(form: FormData) {
  const reviewer = await getTeamAccess();
  if (reviewer?.role !== "admin") redirect("/");
  const id = form.get("id");
  const decision = form.get("decision");
  let status = "access-stale";
  if (typeof id === "string" && (decision === "approved" || decision === "rejected")) {
    try {
      if (await decideAccess(id, decision, reviewer.email)) status = "access-" + decision;
    } catch {
      status = "access-error";
    }
  }
  redirect("/?section=team&team=" + status + "#approve-access");
}
