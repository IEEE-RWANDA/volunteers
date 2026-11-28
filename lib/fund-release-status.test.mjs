import assert from "node:assert/strict";
import test from "node:test";
import { fundReleaseStatus } from "./fund-release-status.ts";

test("fund release status includes overspent funds as fully released and keeps untouched funds separate", () => {
  assert.equal(fundReleaseStatus({ released: 0, balance: 20000 }), "not-released");
  assert.equal(fundReleaseStatus({ released: 10000, balance: 10000 }), "partially-released");
  assert.equal(fundReleaseStatus({ released: 20000, balance: 0 }), "fully-released");
  assert.equal(fundReleaseStatus({ released: 21000, balance: -1000 }), "fully-released");
  assert.equal(fundReleaseStatus({ released: 0, balance: 0 }), "not-released");
});
