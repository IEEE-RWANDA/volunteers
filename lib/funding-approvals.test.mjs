import assert from "node:assert/strict";
import test from "node:test";
import { fundingApprovalComplete } from "./funding-approvals.ts";

const approvals = (...officerTitles) => officerTitles.map(officerTitle => ({ officerTitle }));

test("funding requires Chair, Treasurer, and Vice Chair or Secretary", () => {
  assert.equal(fundingApprovalComplete(approvals("Chair", "Treasurer")), false);
  assert.equal(fundingApprovalComplete(approvals("Chair", "Vice Chair", "Secretary")), false);
  assert.equal(fundingApprovalComplete(approvals("Treasurer", "Vice Chair", "Secretary")), false);
  assert.equal(fundingApprovalComplete(approvals("Chair", "Treasurer", "Vice Chair")), true);
  assert.equal(fundingApprovalComplete(approvals("Chair", "Treasurer", "Secretary")), true);
});
