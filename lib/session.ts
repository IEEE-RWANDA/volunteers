import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "volunteer_session";
const lifetime = 8 * 60 * 60;
const hash = (value: string) => createHash("sha256").update(value).digest();

type PreviewAccount = { email: string; password: string; name: string; committee?: string; role?: "admin" | "lead" | "volunteer" };

function previewAccounts(): PreviewAccount[] {
  // shortcut: local preview accounts, replace with organization sign-in before hosting.
  if (process.env.NODE_ENV !== "development") return [];
  const email = process.env.VOLUNTEER_PREVIEW_EMAIL;
  const password = process.env.VOLUNTEER_PREVIEW_PASSWORD;
  const primary = email && password
    ? [{ email: email.toLowerCase(), password, name: process.env.VOLUNTEER_PREVIEW_NAME?.trim() || "Preview Volunteer" }]
    : [];
  const configured = process.env.VOLUNTEER_PREVIEW_ACCOUNTS;
  if (!configured) return primary;

  const roster: unknown = JSON.parse(configured);
  if (!Array.isArray(roster)) throw new Error("VOLUNTEER_PREVIEW_ACCOUNTS must be an array");
  const accounts = new Map<string, PreviewAccount>(primary.map(account => [account.email, account]));
  for (const account of roster) {
    if (!account || typeof account.email !== "string" || typeof account.password !== "string" ||
        typeof account.name !== "string" || !account.email.trim() || !account.password || !account.name.trim() ||
        (account.committee !== undefined && typeof account.committee !== "string") ||
        (account.role !== undefined && !["admin", "lead", "volunteer"].includes(account.role))) {
      throw new Error("Each preview account needs an email, password, and name");
    }
    const email = account.email.trim().toLowerCase();
    accounts.set(email, { ...account, email });
  }
  return Array.from(accounts.values());
}

export function previewRoster() {
  return previewAccounts().map(({ email, name, committee }) => ({ email, name, committee }));
}

export async function getTeamAccess() {
  const email = await getVolunteer();
  const account = previewAccounts().find(item => item.email === email);
  if (account?.role === "admin") return { email: account.email, role: account.role } as const;
  if (account?.role === "lead" && account.committee?.trim()) {
    return { email: account.email, role: account.role, committee: account.committee } as const;
  }
  return null;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function getVolunteer() {
  const secret = process.env.VOLUNTEER_SESSION_SECRET;
  const session = (await cookies()).get(cookieName)?.value;
  if (!secret || secret.length < 32 || !session) return null;
  const [expires, signature, extra] = session.split(".");
  if (extra !== undefined || !signature || !/^\d+$/.test(expires) ||
      Number(expires) <= Math.floor(Date.now() / 1000)) return null;
  const candidate = hash(signature);
  return previewAccounts().find(account =>
    timingSafeEqual(candidate, hash(sign(account.email + ":" + expires, secret))))?.email ?? null;
}

export async function startVolunteerSession(email: string, password: string) {
  const secret = process.env.VOLUNTEER_SESSION_SECRET;
  const account = previewAccounts().find(candidate => candidate.email === email.trim().toLowerCase());
  if (!secret || secret.length < 32 || !account ||
      !timingSafeEqual(hash(password), hash(account.password))) return false;
  const expires = Math.floor(Date.now() / 1000) + lifetime;
  const signature = sign(account.email + ":" + expires, secret);
  (await cookies()).set(cookieName, expires + "." + signature, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: lifetime,
  });
  return true;
}

export async function endVolunteerSession() {
  (await cookies()).delete(cookieName);
}
