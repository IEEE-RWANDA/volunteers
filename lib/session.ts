import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { accessRequests, approvedVolunteer } from "./access-requests";
import { googleAvatarCookie } from "./google-avatar";
import { cookies } from "next/headers";

const cookieName = "volunteer_session";
const lifetime = 8 * 60 * 60;
const hash = (value: string) => createHash("sha256").update(value).digest();

const officerTitles = ["Chair", "Vice Chair", "Secretary", "Treasurer"] as const;
type OfficerTitle = typeof officerTitles[number];

type Account = { officerTitle?: OfficerTitle; email: string; name: string; committee?: string; role?: "admin" | "lead" | "volunteer" };
type PreviewAccount = Account & { password: string };

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

function accounts(): Account[] {
  if (process.env.NODE_ENV === "development") return previewAccounts();
  const configured: unknown = JSON.parse(process.env.VOLUNTEER_ACCOUNTS ?? "[]");
  if (!Array.isArray(configured)) throw new Error("VOLUNTEER_ACCOUNTS must be an array");
  const roster = new Map<string, Account>();
  for (const account of configured) {
    if (!account || typeof account.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) ||
        typeof account.name !== "string" || !account.name.trim() ||
        (account.role !== undefined && !["admin", "lead", "volunteer"].includes(account.role)) ||
        (account.committee !== undefined && typeof account.committee !== "string") ||
        (account.role === "lead" && !account.committee?.trim())) throw new Error("Invalid volunteer account");
    const email = account.email.toLowerCase();
    if (roster.has(email)) throw new Error("Duplicate volunteer account");
    roster.set(email, { email, name: account.name, committee: account.committee, role: account.role });
  }
  const officers: unknown = JSON.parse(process.env.VOLUNTEER_OFFICERS ?? "[]");
  if (!Array.isArray(officers)) throw new Error("VOLUNTEER_OFFICERS must be an array");
  const assignedTitles = new Set<OfficerTitle>();
  const assignedEmails = new Set<string>();
  for (const officer of officers) {
    if (!officer || typeof officer.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officer.email) ||
        typeof officer.name !== "string" || !officer.name.trim() ||
        !officerTitles.includes(officer.title) || assignedTitles.has(officer.title)) throw new Error("Invalid volunteer officer");
    const email = officer.email.toLowerCase();
    if (assignedEmails.has(email)) throw new Error("Duplicate volunteer officer");
    assignedEmails.add(email);
    assignedTitles.add(officer.title);
    roster.set(email, { ...roster.get(email), email, name: officer.name, officerTitle: officer.title, role: "admin" });
  }
  return [...roster.values()];
}

export async function accountRoster() {
  const roster = new Map(accounts().map(({ email, name, committee, officerTitle }) => [email, { email, name, committee, officerTitle }]));
  if (process.env.NODE_ENV !== "development") {
    for (const entry of await accessRequests()) {
      if (entry.decision?.status === "approved" && !roster.has(entry.email)) {
        roster.set(entry.email, { email: entry.email, name: entry.name, committee: undefined, officerTitle: undefined });
      }
    }
  }
  return [...roster.values()];
}

export async function getTeamAccess() {
  const email = await getVolunteer();
  const account = accounts().find(item => item.email === email);
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
  const [expires, signature, identity, extra] = session.split(".");
  if (extra !== undefined || !signature || !/^\d+$/.test(expires) ||
      Number(expires) <= Math.floor(Date.now() / 1000)) return null;
  const candidate = hash(signature);
  if (identity) {
    const email = Buffer.from(identity, "base64url").toString("utf8");
    if (!timingSafeEqual(candidate, hash(sign("google:" + identity + ":" + expires, secret)))) return null;
    return accounts().some(account => account.email === email) || await approvedVolunteer(email) ? email : null;
  }
  return accounts().find(account =>
    timingSafeEqual(candidate, hash(sign(account.email + ":" + expires, secret))))?.email ?? null;
}

export async function startVolunteerSession(email: string, password: string) {
  const account = previewAccounts().find(candidate => candidate.email === email.trim().toLowerCase());
  if (!account || !timingSafeEqual(hash(password), hash(account.password))) return false;
  return issueSession(account.email);
}

export async function startGoogleVolunteerSession(email: string, subject: string) {
  if (accounts().some(account => account.email === email) || (await approvedVolunteer(email))?.subject === subject) {
    return issueSession(email, true);
  }
  return false;
}

async function issueSession(email: string, google = false) {
  const secret = process.env.VOLUNTEER_SESSION_SECRET;
  if (!secret || secret.length < 32) return false;
  const expires = Math.floor(Date.now() / 1000) + lifetime;
  const identity = Buffer.from(email).toString("base64url");
  const signature = sign((google ? "google:" + identity : email) + ":" + expires, secret);
  (await cookies()).set(cookieName, expires + "." + signature + (google ? "." + identity : ""), {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: lifetime,
  });
  return true;
}

export async function endVolunteerSession() {
  const store = await cookies();
  store.delete(cookieName);
  store.delete(googleAvatarCookie);
}
