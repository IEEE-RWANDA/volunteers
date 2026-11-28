"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTeamAccess } from "@/lib/session";
import { assignTreasuryFund } from "@/lib/treasury-assignments";
import { treasuryHistoryOwner } from "./TreasuryHistory";
import { treasuryReleaseHistory } from "@/lib/treasury-release-history";
import { saveIntakeFile, volunteerEvents } from "@/lib/volunteer-store";

export async function assignReleaseEvent(form: FormData) {
  const access = await getTeamAccess();
  if (access?.role !== "admin" || access.email !== treasuryHistoryOwner) redirect("/");
  let status = "release-event-invalid";
  try {
    const releaseId = String(form.get("releaseId") ?? "");
    const eventId = String(form.get("eventId") ?? "");
    const [releases, events] = await Promise.all([treasuryReleaseHistory(), volunteerEvents()]);
    if (releases.some(row => row.id === releaseId) && (!eventId || events.some(event => event.id === eventId))) {
      await saveIntakeFile(`release-event-links/${releaseId}.json`, JSON.stringify({ releaseId, eventId: eventId || null, recordedBy: access.email, recordedAt: new Date().toISOString() }), true);
      status = "release-event-saved";
    }
  } catch { status = "release-event-write"; }
  revalidatePath("/");
  redirect(`/?section=team&tab=balances&view=releases&team=${status}#fund-balances`);
}

export async function assignBalanceFund(form: FormData) {
  const access = await getTeamAccess();
  if (access?.role !== "admin" || access.email !== treasuryHistoryOwner) redirect("/");
  let status: string;
  try {
    const saved = await assignTreasuryFund(String(form.get("rowId") ?? ""), String(form.get("volunteerEmail") ?? ""),
      String(form.get("unitId") ?? ""), access.email);
    status = saved ? "fund-assigned" : "fund-assignment-invalid";
  } catch {
    status = "fund-assignment-write";
  }
  revalidatePath("/");
  redirect(`/?section=team&tab=balances&team=${status}#fund-balances`);
}
