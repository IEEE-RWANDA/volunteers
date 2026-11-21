"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTeamAccess } from "@/lib/session";
import { fundingReport, saveReportReview } from "@/lib/funding-reports";

function finish(status: string): never {
  revalidatePath("/dashboard");
  redirect("/dashboard?section=team&team=" + status + "#admin-reports");
}

export async function reviewReport(form: FormData) {
  const access = await getTeamAccess();
  if (access?.role !== "admin") redirect("/dashboard");
  const id = String(form.get("requestId") ?? "");
  const decision = form.get("decision");
  const comments = String(form.get("comments") ?? "").trim();
  if ((decision !== "approved" && decision !== "returned") ||
      comments.length > 2000 || (decision === "returned" && !comments)) finish("report-comments");
  const report = await fundingReport(id);
  if (!report || String(report.version) !== form.get("version") || report.review) finish("report-state");
  try {
    await saveReportReview(id, report.version, {
      decision, comments, reviewedAt: new Date().toISOString(), reviewedBy: access.email,
    });
  } catch {
    finish("report-state");
  }
  finish(decision === "approved" ? "report-approved" : "report-returned");
}
