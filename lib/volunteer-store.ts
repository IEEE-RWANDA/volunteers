import type { FundAllocation, Submission } from "./volunteer-intake";
import { fundingApprovalComplete, type FundingApproval } from "./funding-approvals";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { link, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const directory = resolve(process.cwd(), ".volunteer-data");
const local = process.env.NODE_ENV === "development";
const bucket = "volunteer-files";
let storageClient: SupabaseClient | undefined;

function storage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase storage is not configured");
  return storageClient ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function isRecord(path: string) {
  return path.endsWith(".json");
}

export async function saveIntakeFile(path: string, data: Buffer | string, overwrite = false) {
  if (!local) {
    if (isRecord(path)) {
      const value = JSON.parse(typeof data === "string" ? data : data.toString("utf8"));
      const query = overwrite
        ? storage().from("volunteer_records").upsert({ path, data: value, updated_at: new Date().toISOString() }, { onConflict: "path" })
        : storage().from("volunteer_records").insert({ path, data: value });
      const { error } = await query;
      if (error?.code === "23505") throw Object.assign(new Error("Record already exists"), { code: "EEXIST" });
      if (error) throw error;
      return;
    }
    const { error } = await storage().storage.from(bucket).upload(path, data, {
      upsert: overwrite,
      contentType: "application/octet-stream",
    });
    if (error) throw error;
    return;
  }
  const destination = resolve(directory, path);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  const pending = destination + "." + randomUUID() + ".pending";
  try {
    await writeFile(pending, data, { flag: "wx", mode: 0o600 });
    if (overwrite) await rename(pending, destination);
    else await link(pending, destination);
  } finally {
    await unlink(pending).catch(() => {});
  }
}

export async function readIntakeFile(path: string): Promise<Uint8Array | null> {
  if (!local) {
    if (isRecord(path)) {
      const { data, error } = await storage().from("volunteer_records").select("data").eq("path", path).maybeSingle();
      if (error) throw error;
      return data ? new TextEncoder().encode(JSON.stringify(data.data)) : null;
    }
    const { data, error } = await storage().storage.from(bucket).download(path);
    if (error?.message.toLowerCase().includes("not found")) return null;
    if (error) throw error;
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  }
  return readFile(resolve(directory, path)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}

export async function removeIntakeFiles(paths: string[]) {
  if (!paths.length) return;
  if (!local) {
    const records = paths.filter(isRecord);
    const files = paths.filter(path => !isRecord(path));
    if (records.length) {
      const { error } = await storage().from("volunteer_records").delete().in("path", records);
      if (error) throw error;
    }
    if (files.length) {
      const { error } = await storage().storage.from(bucket).remove(files);
      if (error) throw error;
    }
    return;
  }
  await Promise.all(paths.map(path => unlink(resolve(directory, path))));
}

export async function listIntakeRecords(folder: string) {
  if (local) {
    return (await readdir(resolve(directory, folder)).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    })).filter(name => name.endsWith(".json")).map(name => folder + "/" + name);
  }
  const prefix = folder + "/";
  const { data, error } = await storage().from("volunteer_records").select("path")
    .gte("path", prefix).lt("path", folder + "0").order("path");
  if (error) throw error;
  return data.map(row => row.path);
}

export async function readIntakeJson<T>(path: string): Promise<T | null> {
  const bytes = await readIntakeFile(path);
  return bytes ? JSON.parse(new TextDecoder().decode(bytes)) as T : null;
}

type LegacyFundingApproval = { approvedAt: string; approvedBy: string };
type FundingRelease = { releasedAt: string; releasedAmount: string; recordedAt: string; recordedBy: string };
type AllocatedRelease = FundingRelease & { requestId: string; allocations: FundAllocation[] };

export async function allocatedReleases() {
  const paths = await listIntakeRecords("allocated-releases");
  const ledger = await Promise.all(paths.map((_, index) => readIntakeJson<AllocatedRelease>(`allocated-releases/${index}.json`)));
  if (ledger.some(entry => !entry)) throw new Error("Incomplete funding release ledger");
  return ledger.filter(entry => entry !== null);
}

export const submissionIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

async function withFundingStatus(record: Submission, ledger?: AllocatedRelease[]): Promise<Submission> {
  if (record.kind !== "funding") return record;
  const [legacyApproval, approvalPaths, legacyRelease, releases] = await Promise.all([
    readIntakeJson<LegacyFundingApproval>(`funding-approvals/${record.id}.json`),
    listIntakeRecords(`funding-approvals/${record.id}`),
    readIntakeJson<FundingRelease>(`funding-releases/${record.id}.json`),
    ledger ?? allocatedReleases(),
  ]);
  const approvals = (await Promise.all(approvalPaths.map(path => readIntakeJson<FundingApproval>(path))))
    .filter(approval => approval !== null)
    .sort((a, b) => a.approvedAt.localeCompare(b.approvedAt));
  const completed = fundingApprovalComplete(approvals);
  const finalApproval = approvals.at(-1);
  const release = releases.find(entry => entry.requestId === record.id) ?? legacyRelease;
  return {
    ...record,
    fundingApprovals: approvals,
    ...(legacyApproval ?? (completed && finalApproval ? { approvedAt: finalApproval.approvedAt, approvedBy: finalApproval.approvedBy } : {})),
    ...release,
  };
}

export async function fundingRequest(id: string) {
  if (!submissionIdPattern.test(id)) return null;
  const record = await readIntakeJson<Submission>(`records/${id}.json`);
  return record?.kind === "funding" ? withFundingStatus(record) : null;
}

export async function approveFunding(id: string, email: string, officerTitle: FundingApproval["officerTitle"]) {
  const path = `funding-approvals/${id}/${createHash("sha256").update(email).digest("hex")}.json`;
  if (await readIntakeJson<FundingApproval>(path)) return false;
  const approval: FundingApproval = { approvedAt: new Date().toISOString(), approvedBy: email, officerTitle };
  try {
    await saveIntakeFile(path, JSON.stringify(approval));
    return true;
  } catch (error) {
    if (await readIntakeJson<FundingApproval>(path)) return false;
    throw error;
  }
}

async function submissions() {
  const paths = await listIntakeRecords("records");
  const records = await Promise.all(paths.map(path => readIntakeJson<Submission>(path)));
  return records.filter((record) => record !== null).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function volunteerEvents() {
  return (await submissions()).filter(record => record.kind === "event");
}

export async function ownVolunteerEvent(id: string, email: string) {
  if (!submissionIdPattern.test(id)) return null;
  const record = await readIntakeJson<Submission>(`records/${id}.json`);
  return record?.kind === "event" && record.submittedBy === email ? record : null;
}

export async function volunteerSubmissions(email: string, releases?: AllocatedRelease[]) {
  const records = (await submissions()).filter(record => record.submittedBy === email);
  const ledger = releases ?? (records.some(record => record.kind === "funding") ? await allocatedReleases() : []);
  return Promise.all(records.map(record => withFundingStatus(record, ledger)));
}

export async function allFundingRequests() {
  const records = (await submissions()).filter(record => record.kind === "funding");
  const ledger = records.length ? await allocatedReleases() : [];
  return Promise.all(records.map(record => withFundingStatus(record, ledger)));
}

export async function privateAttachment(path: string, name: string) {
  const bytes = await readIntakeFile(path);
  return privateAttachmentResponse(bytes, name);
}

export function privateAttachmentResponse(bytes: Uint8Array | null, name: string, preview = false) {
  if (!bytes) return new Response(null, { status: 404 });
  const inline = preview && /\.pdf$/i.test(name) && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
  if (preview && !inline) return new Response(null, { status: 415 });
  const filename = encodeURIComponent(name).replace(/['()*]/g, char => "%" + char.charCodeAt(0).toString(16));
  return new Response(new Blob([Uint8Array.from(bytes)]), {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": inline ? "application/pdf" : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
