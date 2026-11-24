import { fundingRequest, listIntakeRecords, readIntakeJson, saveIntakeFile, submissionIdPattern } from "./volunteer-store";

export type FundingReport = {
  requestId: string;
  title: string;
  committee: string;
  submittedBy: string;
  receivedAt: string;
  photos: string;
  vtools: string;
  socialPost?: string;
  attachments: { name: string; path: string; type: "receipt" | "expense sheet" | "activity report" }[];
};

export async function ownFundingRequest(id: string, email: string) {
  const request = await fundingRequest(id);
  return request?.submittedBy === email ? request : null;
}

export type ReportReview = {
  decision: "approved" | "returned";
  comments: string;
  reviewedAt: string;
  reviewedBy: string;
};

export function reportPath(id: string, version: number) {
  return version === 1 ? `funding-reports/${id}.json` : `funding-report-revisions/${id}/${version}.json`;
}

export async function fundingReport(id: string, version?: number) {
  if (!submissionIdPattern.test(id)) return null;
  if (version === undefined) {
    const paths = await listIntakeRecords("funding-report-revisions/" + id);
    version = paths.reduce((latest, path) =>
      Math.max(latest, Number(path.split("/").at(-1)?.slice(0, -5)) || 1), 1);
  }
  const report = await readIntakeJson<FundingReport>(reportPath(id, version));
  if (!report) return null;
  const review = await readIntakeJson<ReportReview>(`funding-report-reviews/${id}/${version}.json`);
  return { ...report, version, review };
}

export async function saveReportReview(id: string, version: number, review: ReportReview) {
  await saveIntakeFile(`funding-report-reviews/${id}/${version}.json`, JSON.stringify(review));
}

export type ReportStatus = { label: string; review: ReportReview | null };
export function reportStatus(review: ReportReview | null): ReportStatus {
  return { label: review?.decision === "approved" ? "Report approved" : review?.decision === "returned" ? "Changes requested" : "Report submitted", review };
}

export async function fundingReportStatuses(ids: string[]) {
  const entries = await Promise.all(ids.map(async id => {
    const report = await fundingReport(id);
    return report ? [id, reportStatus(report.review)] as const : null;
  }));
  return new Map(entries.filter(entry => entry !== null));
}

export async function listFundingReports() {
  const paths = await listIntakeRecords("funding-reports");
  return (await Promise.all(paths.map(path => fundingReport(path.slice("funding-reports/".length, -5)))))
    .filter(report => report !== null)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}
