"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountRoster, getTeamAccess } from "@/lib/session";
import { approveFunding, fundingRequest, saveIntakeFile } from "@/lib/volunteer-store";
import { allocationTotal, releaseFunding } from "@/lib/listed-funds";
import { formatUsd, usdCents } from "@/lib/fund-amounts";
import { kigaliToday } from "@/lib/volunteer-hours";

function finish(status: string): never {
  revalidatePath("/");
  redirect("/?section=team&tab=funding&team=" + status + "#admin-funding");
}

export async function approveRequest(form: FormData) {
  const access = await getTeamAccess();
  if (access?.role !== "admin" || !access.officerTitle) redirect("/");
  const request = await fundingRequest(String(form.get("requestId") ?? ""));
  if (!request || request.approvedAt || request.releasedAt) finish("funding-state");
  if (request.fundingApprovals?.some(approval => approval.approvedBy === access.email)) finish("funding-state");
  if (request.receiptsAcknowledgedAt && form.get("invoiceMatches") !== "yes") finish("funding-invoice");
  try {
    if (!await approveFunding(request.id, access.email, access.officerTitle)) finish("funding-state");
  } catch {
    finish("funding-write");
  }
  const updated = await fundingRequest(request.id);
  finish(updated?.approvedAt ? "funding-approved" : "funding-approval-recorded");
}

export async function recordRelease(form: FormData) {
  const access = await getTeamAccess();
  if (access?.role !== "admin") redirect("/");
  const request = await fundingRequest(String(form.get("requestId") ?? ""));
  if (!request?.approvedAt || request.releasedAt) finish("funding-state");

  const amount = String(form.get("amount") ?? "").trim();
  const currency = String(form.get("currency") ?? "").trim().toUpperCase();
  const date = String(form.get("date") ?? "");
  const today = kigaliToday();
  const parsed = new Date(date + "T00:00:00Z");
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isFinite(parsed.getTime()) ||
      !parsed.toISOString().startsWith(date) || date > today) finish("funding-invalid");
  const allocations = request.fundAllocations ?? [];
  if (!allocations.length && (!usdCents(amount) || !Intl.supportedValuesOf("currency").includes(currency))) finish("funding-invalid");
  const formatted = allocations.length ? formatUsd(allocationTotal(allocations))
    : new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(Number(amount)) + " " + currency;
  const status = await releaseFunding(request, access.email, date, formatted).catch(() => "funding-write");
  finish(status);
}


export async function listFund(form: FormData) {
  const access = await getTeamAccess();
  if (access?.role !== "admin") redirect("/");
  const name = String(form.get("name") ?? "").trim();
  const usd = String(form.get("amount") ?? "").trim();
  const cents = usdCents(usd);
  const volunteerEmail = String(form.get("volunteerEmail") ?? "");
  if (!name || name.length > 150 || !cents || !(await accountRoster()).some(account => account.email === volunteerEmail)) finish("fund-list-invalid");
  const id = randomUUID();
  try {
    await saveIntakeFile(`listed-funds/${id}.json`, JSON.stringify({ id, name, cents, volunteerEmail }));
  } catch {
    finish("funding-write");
  }
  finish("fund-listed");
}
