import type { FundAllocation, Submission } from "./volunteer-intake";
import { del, get, list, put } from "@vercel/blob";
import { link, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const prefix = "volunteer-intake/";
const directory = resolve(process.cwd(), ".volunteer-data");
const local = process.env.NODE_ENV === "development";

export async function saveIntakeFile(path: string, data: Buffer | string) {
  if (!local) {
    await put(prefix + path, data, { access: "private", allowOverwrite: false, contentType: "application/octet-stream" });
    return;
  }
  const destination = resolve(directory, path);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  const pending = destination + "." + randomUUID() + ".pending";
  try {
    await writeFile(pending, data, { flag: "wx", mode: 0o600 });
    await link(pending, destination);
  } finally {
    await unlink(pending).catch(() => {});
  }
}

export async function readIntakeFile(path: string): Promise<Uint8Array | null> {
  if (!local) {
    const blob = await get(prefix + path, { access: "private", useCache: false });
    if (blob?.statusCode !== 200) return null;
    return new Uint8Array(await new Response(blob.stream).arrayBuffer());
  }
  return readFile(resolve(directory, path)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}

export async function removeIntakeFiles(paths: string[]) {
  if (!paths.length) return;
  if (!local) {
    await del(paths.map(path => prefix + path));
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

  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: prefix + folder + "/", cursor });
    paths.push(...page.blobs.map(blob => blob.pathname.slice(prefix.length)));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return paths;
}

export async function readIntakeJson<T>(path: string): Promise<T | null> {
  const bytes = await readIntakeFile(path);
  return bytes ? JSON.parse(new TextDecoder().decode(bytes)) as T : null;
}

type FundingApproval = { approvedAt: string; approvedBy: string };
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
  const [approval, legacyRelease, releases] = await Promise.all([
    readIntakeJson<FundingApproval>(`funding-approvals/${record.id}.json`),
    readIntakeJson<FundingRelease>(`funding-releases/${record.id}.json`),
    ledger ?? allocatedReleases(),
  ]);
  const release = releases.find(entry => entry.requestId === record.id) ?? legacyRelease;
  return { ...record, ...approval, ...release };
}

export async function fundingRequest(id: string) {
  if (!submissionIdPattern.test(id)) return null;
  const record = await readIntakeJson<Submission>(`records/${id}.json`);
  return record?.kind === "funding" ? withFundingStatus(record) : null;
}

export async function approveFunding(id: string, email: string) {
  const approval: FundingApproval = { approvedAt: new Date().toISOString(), approvedBy: email };
  await saveIntakeFile(`funding-approvals/${id}.json`, JSON.stringify(approval));
}

async function submissions() {
  const paths = await listIntakeRecords("records");
  const records = await Promise.all(paths.map(path => readIntakeJson<Submission>(path)));
  return records.filter((record) => record !== null).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
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
  if (!bytes) return new Response(null, { status: 404 });
  const filename = encodeURIComponent(name).replace(/['()*]/g, char => "%" + char.charCodeAt(0).toString(16));
  return new Response(new Blob([Uint8Array.from(bytes)]), {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": "application/octet-stream",
      "Content-Disposition": "attachment; filename*=UTF-8''" + filename,
    },
  });
}
