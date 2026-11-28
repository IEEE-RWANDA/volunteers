import assert from "node:assert/strict";
import test from "node:test";
import { filterReleaseHistory, groupEventReleases, releaseAmountCents, releaseReportStatus } from "./release-history-filters.ts";

test("release filters combine search, actor, event and report status", () => {
  const rows = [
    { id: "one", title: "Workshop", date: "2026-11-16", amount: "800.00 USD", actor: "kip", method: "transfer", reported: "Changes requested", eventId: "workshop" },
    { id: "two", title: "Workshop", date: "2026-11-17", amount: "USD 200.10", actor: "cyiza", method: "transfer", reported: "Not submitted", eventId: "workshop" },
    { id: "three", title: "Flickr", date: "2026-08-13", amount: "USD 133.20", actor: "kip", method: "card", reported: "Covered · Flickr receipt" },
  ];
  assert.deepEqual(filterReleaseHistory(rows, "  WORKSHOP  ", "transfer-kip", "workshop", "Changes requested").map(row => row.id), ["one"]);
  assert.equal(filterReleaseHistory(rows, "", "", "workshop", "Not submitted").length, 1);
  assert.equal(filterReleaseHistory(rows, "", "card-kip", "unlinked", "Receipt covered")[0].id, "three");
  assert.equal(filterReleaseHistory(rows, "missing", "", "", "").length, 0);
  assert.equal(filterReleaseHistory(rows, "", "", "", "").reduce((sum, row) => sum + releaseAmountCents(row.amount), 0), 113330);
  assert.equal(releaseReportStatus("Receipt not matched — needs review"), "Receipt not matched");
  assert.equal(releaseAmountCents("USD\u00a01,234.56"), 123456);
  assert.equal(releaseAmountCents("12000 RWF"), null);
  assert.equal(releaseAmountCents(""), null);
});

test("same-event releases stay together, new releases join them, and unassigned stays separate", () => {
  const rows = [{ id: "a", eventId: "event", amount: "100 USD" }, { id: "b", amount: "20 USD" }, { id: "c", eventId: "event", amount: "50 USD" }];
  const groups = groupEventReleases(rows);
  assert.deepEqual(groups.map(([id, items]) => [id, items.map(item => item.id)]), [["event", ["a", "c"]], ["unlinked", ["b"]]]);
  assert.equal(groups.flatMap(([, items]) => items).reduce((sum, row) => sum + releaseAmountCents(row.amount), 0), 17000);
  assert.equal(groupEventReleases([...rows, { id: "d", eventId: "event" }])[0][1].length, 3);
});
