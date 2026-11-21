import { createHash } from "node:crypto";
import { listIntakeRecords, readIntakeJson, saveIntakeFile } from "./volunteer-store";

type AccessRequest = { email: string; name: string; subject: string; requestedAt: string };
type Decision = { status: "approved" | "rejected"; reviewedBy: string; reviewedAt: string };
const idFor = (email: string) => createHash("sha256").update(email).digest("hex");
const decisionPath = (id: string) => `access-decisions/${id}.json`;

export async function accessRequests() {
  const paths = await listIntakeRecords("access-requests");
  const entries = await Promise.all(paths.map(async path => {
    const id = path.slice("access-requests/".length, -5);
    const [request, decision] = await Promise.all([
      readIntakeJson<AccessRequest>(path), readIntakeJson<Decision>(decisionPath(id)),
    ]);
    return request ? { id, ...request, decision } : null;
  }));
  return entries.filter(entry => entry !== null).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export async function approvedVolunteer(email: string) {
  const id = idFor(email);
  const decision = await readIntakeJson<Decision>(decisionPath(id));
  return decision?.status === "approved" ? readIntakeJson<AccessRequest>(`access-requests/${id}.json`) : null;
}

export async function requestAccess(email: string, name: string, subject: string) {
  const id = idFor(email);
  const path = `access-requests/${id}.json`;
  let existing = await readIntakeJson<AccessRequest>(path);
  if (!existing) {
    try {
      await saveIntakeFile(path, JSON.stringify({ email, name, subject, requestedAt: new Date().toISOString() }));
    } catch (error) {
      existing = await readIntakeJson<AccessRequest>(path);
      if (!existing) throw error;
    }
  }
  if (existing && existing.subject !== subject) return "access";
  const decision = await readIntakeJson<Decision>(decisionPath(id));
  return decision?.status ?? "pending";
}

export async function decideAccess(id: string, status: Decision["status"], reviewer: string) {
  if (!/^[a-f0-9]{64}$/.test(id) || !["approved", "rejected"].includes(status) ||
      !await readIntakeJson<AccessRequest>(`access-requests/${id}.json`)) return false;
  const path = decisionPath(id);
  if (await readIntakeJson<Decision>(path)) return false;
  try {
    await saveIntakeFile(path, JSON.stringify({ status, reviewedBy: reviewer, reviewedAt: new Date().toISOString() }));
    return true;
  } catch (error) {
    if (await readIntakeJson<Decision>(path)) return false;
    throw error;
  }
}
