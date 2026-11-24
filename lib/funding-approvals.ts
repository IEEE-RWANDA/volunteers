import type { OfficerTitle } from "./session";

export type FundingApproval = {
  approvedAt: string;
  approvedBy: string;
  officerTitle: OfficerTitle;
};

export function fundingApprovalComplete(approvals: Pick<FundingApproval, "officerTitle">[]) {
  const roles = new Set(approvals.map(approval => approval.officerTitle));
  return roles.has("Chair") && roles.has("Treasurer") &&
    (roles.has("Vice Chair") || roles.has("Secretary"));
}
