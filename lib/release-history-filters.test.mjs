import assert from "node:assert/strict";
import test from "node:test";
import { filterReleaseHistory, groupEventReleases, releaseAmountCents, releaseReportStatus, releaseReportColor } from "./release-history-filters.ts";

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

test("report row colors cover completion, corrections, missing reporting and neutral states", () => {
  for (const status of ["Report submitted", "Report approved", "Covered · Receipt 123"]) assert.equal(releaseReportColor(status), "bg-green-50");
  assert.equal(releaseReportColor("Changes requested"), "bg-red-50");
  for (const status of ["Not submitted", "Partially reported", "Receipt not matched — needs review"]) assert.equal(releaseReportColor(status), "bg-yellow-50");
  assert.equal(releaseReportColor("Not assigned to an event"), "");
  assert.equal(releaseReportColor("Unknown status"), "");
});

test("same-event releases stay together, new releases join them, and unassigned stays separate", () => {
  const rows = [{ id: "a", eventId: "event", amount: "100 USD" }, { id: "b", amount: "20 USD" }, { id: "c", eventId: "event", amount: "50 USD" }];
  const groups = groupEventReleases(rows);
  assert.deepEqual(groups.map(([id, items]) => [id, items.map(item => item.id)]), [["event", ["a", "c"]], ["unlinked", ["b"]]]);
  assert.equal(groups.flatMap(([, items]) => items).reduce((sum, row) => sum + releaseAmountCents(row.amount), 0), 17000);
  assert.equal(groupEventReleases([...rows, { id: "d", eventId: "event" }])[0][1].length, 3);
});

test("shared release allocates exact cents across events without double-counting its balance", async () => {
  const { validateEventAllocations, expandReleaseAllocations } = await import("./release-history-filters.ts");
  const events = new Set(["a", "b"]);
  const allocations = validateEventAllocations(["a", "b"], ["40.10", "35.20"], 10000, events);
  assert.deepEqual(allocations, [{ eventId: "a", cents: 4010 }, { eventId: "b", cents: 3520 }]);
  const parts = expandReleaseAllocations([{ id: "shared", title: "Release", amount: "100 USD", eventAllocations: allocations }]);
  assert.equal(parts.length, 3);
  assert.equal(parts[0].reported, "Not submitted");
  assert.equal(parts[2].reported, "Not assigned to an event");
  assert.equal(parts[2].remainingCents, 2470);
  assert.equal(parts.reduce((sum, part) => sum + releaseAmountCents(part.amount), 0), 10000);
  assert.equal(filterReleaseHistory(parts, "", "", "a", "")[0].amount, "40.10 USD");
  assert.equal(filterReleaseHistory(parts, "", "", "unlinked", "")[0].amount, "24.70 USD");
  for (const [ids, amounts, total] of [
    [["a", "b"], ["60", "41"], 10000], [["a", "a"], ["1", "2"], 10000],
    [["missing"], ["1"], 10000], [["a"], ["0"], 10000], [["a"], ["-1"], 10000],
    [["a"], ["0.001"], 10000], [["a"], ["NaN"], 10000], [["a"], ["1"], null],
    [["a"], [], 10000],
  ]) assert.equal(validateEventAllocations(ids, amounts, total, events), null);
  assert.deepEqual(validateEventAllocations([], [], null, events), []);
  assert.equal(expandReleaseAllocations([{ id: "full", amount: "40.10 USD", eventAllocations: [allocations[0]] }]).length, 1);
});


test("a split release uses each event report, never its source release report", async () => {
  const { expandReleaseAllocations } = await import("./release-history-filters.ts");
  const parts = expandReleaseAllocations([{ id: "shared", amount: "100 USD", reported: "Report approved", eventAllocations: [
    { eventId: "a", cents: 4000, reported: "Report submitted" }, { eventId: "b", cents: 3500, reported: "Not submitted" },
  ] }]);
  assert.deepEqual(parts.map(part => part.reported), ["Report submitted", "Not submitted", "Not assigned to an event"]);
});

test("future releases remain fully assigned to the original event", async () => {
  const { validReleaseEventEdit } = await import("./release-history-filters.ts");
  const release = { amount: "100 USD", eventId: "original" };
  assert.equal(validReleaseEventEdit(release, [{ eventId: "original", cents: 10000 }]), true);
  assert.equal(validReleaseEventEdit(release, [{ eventId: "original", cents: 4000 }, { eventId: "other", cents: 6000 }]), false);
  assert.equal(validReleaseEventEdit(release, [{ eventId: "other", cents: 10000 }]), false);
  assert.equal(validReleaseEventEdit(release, []), false);
  assert.equal(validReleaseEventEdit({ ...release, historicalSplitAllowed: true }, [{ eventId: "other", cents: 4000 }]), true);
});
