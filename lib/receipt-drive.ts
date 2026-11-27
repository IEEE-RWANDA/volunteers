import { randomUUID } from "node:crypto";

export function receiptDriveEnabled() {
  return process.env.RECEIPT_DRIVE_ENABLED === "true";
}

async function authorization() {
  const clientId = process.env.RECEIPT_DRIVE_CLIENT_ID;
  const secret = process.env.RECEIPT_DRIVE_CLIENT_SECRET;
  const refresh = process.env.RECEIPT_DRIVE_REFRESH_TOKEN;
  if (!clientId || !secret || !refresh) throw new Error("Receipt Drive OAuth is not configured");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Receipt Drive authorization failed");
  const { access_token } = await response.json();
  if (typeof access_token !== "string" || !access_token) throw new Error("Receipt Drive token is missing");
  return { Authorization: `Bearer ${access_token}` };
}

export async function uploadDriveReceipt(name: string, bytes: Buffer) {
  const folder = process.env.RECEIPT_DRIVE_FOLDER_ID;
  if (!folder) throw new Error("Receipt Drive folder is not configured");
  const boundary = randomUUID();
  const metadata = JSON.stringify({ name, parents: [folder] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id", {
    method: "POST",
    headers: { ...await authorization(), "Content-Type": `multipart/related; boundary=${boundary}` },
    body: Uint8Array.from(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Receipt Drive upload failed");
  const { id } = await response.json();
  if (typeof id !== "string" || !/^[\w-]+$/.test(id)) throw new Error("Receipt Drive file ID is invalid");
  return id;
}

export async function readDriveReceipt(id: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, {
    headers: await authorization(),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Receipt Drive download failed");
  return new Uint8Array(await response.arrayBuffer());
}

export async function trashDriveReceipt(id: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true`, {
    method: "PATCH",
    headers: { ...await authorization(), "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
    cache: "no-store",
  });
  if (!response.ok && response.status !== 404) throw new Error("Receipt Drive cleanup failed");
}
