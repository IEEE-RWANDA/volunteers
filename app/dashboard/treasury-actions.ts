"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTeamAccess } from "@/lib/session";
import { assignTreasuryFund } from "@/lib/treasury-assignments";
import { treasuryHistoryOwner } from "./TreasuryHistory";

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
