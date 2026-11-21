"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTeamAccess } from "@/lib/session";
import { approveFunding, fundingRequest, releaseFunding, saveIntakeFile } from "@/lib/volunteer-store";
import { releaseAllocatedFunds } from "@/lib/listed-funds";
import { usdCents } from "@/lib/fund-amounts";
import { kigaliToday } from "@/lib/volunteer-hours";

function finish(status: string): never {
  revalidatePath("/dashboard");
  redirect("/dashboard?section=team&team=" + status + "#admin-funding");
}

export async function approveRequest(form: FormData) {
  const access = await getTeamAccess();
  if (access?.role !== "admin") redirect("/dashboard");
  const request = await fundingRequest(String(form.get("requestId") ?? ""));
  if (!request || request.approvedAt || request.releasedAt) finish("funding-state");
  try {
    await approveFunding(request.id, access.email);
  } catch {
    finish("funding-write");
  }
  finish("funding-approved");
}

export async function recordRelease(form: FormData) {
  const access = await getTeamAccess();
  if (access?.role !== "admin") redirect("/dashboard");
  const request = await fundingRequest(String(form.get("requestId") ?? ""));
  if (!request?.approvedAt || request.releasedAt) finish("funding-state");

  const amount = String(form.get("amount") ?? "").trim();
  const currency = String(form.get("currency") ?? "").trim().toUpperCase();
  const date = String(form.get("date") ?? "");
  const parsed = new Date(date + "T00:00:00Z");
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isFinite(parsed.getTime()) ||
      !parsed.toISOString().startsWith(date) || date > kigaliToday()) finish("funding-invalid");
  if (request.fundAllocations?.length) {
    const status = await releaseAllocatedFunds(request, access.email, date).catch(() => "funding-write");
    finish(status);
  }
  if (!usdCents(amount) || !Intl.supportedValuesOf("currency").includes(currency)) finish("funding-invalid");

  const formatted = new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(Number(amount)) + " " + currency;
  try {
    await releaseFunding(request.id, access.email, date, formatted);
  } catch {
    finish("funding-write");
  }
  finish("funding-released");
}


export async function listFund(form: FormData) {
  const access = await getTeamAccess();
  if (access?.role !== "admin") redirect("/dashboard");
  const name = String(form.get("name") ?? "").trim();
  const usd = String(form.get("amount") ?? "").trim();
  const cents = usdCents(usd);
  if (!name || name.length > 150 || !cents) finish("fund-list-invalid");
  const id = randomUUID();
  try {
    await saveIntakeFile(`listed-funds/${id}.json`, JSON.stringify({ id, name, cents }));
  } catch {
    finish("funding-write");
  }
  finish("fund-listed");
}
