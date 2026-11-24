import { createHash, randomUUID } from "node:crypto";
import { listIntakeRecords, readIntakeFile, readIntakeJson, saveIntakeFile } from "./volunteer-store";

type Entry = { eventId?: string; id: string; date: string; activity: string; minutes: number; recordedAt: string };
type TeamEntry = Entry & { recipients: string[]; loggedBy: string };
type HoursDetails = Pick<Entry, "date" | "activity" | "minutes">;
export type HourSubmission = Entry & { eventId: string; email: string };
type HourApproval = { approvedAt: string; approvedBy: string };

const folder = (email: string) => "hours/" + createHash("sha256").update(email).digest("hex");

export function kigaliToday() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Kigali", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function parseHours(form: FormData) {
  const hours = form.get("hours");
  const minutes = form.get("minutes");
  if (typeof hours !== "string" || !/^\d{0,2}$/.test(hours) ||
      typeof minutes !== "string" || !/^\d{0,2}$/.test(minutes) || Number(minutes) > 59) return null;
  const duration = Number(hours) * 60 + Number(minutes);
  return duration >= 1 && duration <= 1440 ? duration : null;
}

export async function saveTeamHours(loggedBy: string, recipients: string[], details: HoursDetails & { eventId: string }) {
  const entry: TeamEntry = { ...details, id: randomUUID(), recordedAt: new Date().toISOString(), loggedBy, recipients };
  await saveIntakeFile(`team-hours/${entry.id}.json`, JSON.stringify(entry));
}

export async function submitVolunteerHours(email: string, details: HoursDetails & { eventId: string }) {
  const id = createHash("sha256").update(JSON.stringify([details.eventId, email])).digest("hex");
  const path = `hour-submissions/${id}.json`;
  if (await readIntakeJson<HourSubmission>(path)) return false;
  const entry: HourSubmission = { ...details, id, email, recordedAt: new Date().toISOString() };
  try {
    await saveIntakeFile(path, JSON.stringify(entry));
    return true;
  } catch (error) {
    if (await readIntakeJson<HourSubmission>(path)) return false;
    throw error;
  }
}

export async function hourSubmissions() {
  const submissions = await readHours<HourSubmission>("hour-submissions");
  return Promise.all(submissions.map(async submission => ({
    ...submission,
    approval: await readIntakeJson<HourApproval>(`hour-approvals/${submission.id}.json`),
  })));
}

export async function approveHourSubmissions(ids: string[], approvedBy: string) {
  const approval: HourApproval = { approvedAt: new Date().toISOString(), approvedBy };
  await Promise.all(ids.map(async id => {
    const path = `hour-approvals/${id}.json`;
    if (await readIntakeJson<HourApproval>(path)) return;
    try {
      await saveIntakeFile(path, JSON.stringify(approval));
    } catch (error) {
      if (!await readIntakeJson<HourApproval>(path)) throw error;
    }
  }));
}

async function readHours<T extends Entry>(path: string): Promise<T[]> {
  const files = await listIntakeRecords(path);
  const entries = await Promise.all(files.map(async (file) => {
    const data = await readIntakeFile(file);
    return data ? JSON.parse(new TextDecoder().decode(data)) as T : null;
  }));
  return entries.flatMap(entry => entry === null ? [] : [entry as T]);
}

export async function volunteerHours(email: string, teamEntries?: TeamEntry[]) {
  const [personal, team, submissions] = await Promise.all([
    readHours<Entry>(folder(email)),
    teamEntries ?? readHours<TeamEntry>("team-hours"),
    hourSubmissions(),
  ]);
  return [...personal, ...team.filter(entry => entry.recipients.includes(email)),
    ...submissions.filter(entry => entry.email === email && entry.approval)]
    .sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt));
}

export async function teamHourTotals(emails: string[]) {
  const team = await readHours<TeamEntry>("team-hours");
  const totals = await Promise.all(emails.map(async email => {
    const entries = await volunteerHours(email, team);
    return [email, entries.reduce((sum, entry) => sum + entry.minutes, 0)] as const;
  }));
  return new Map(totals);
}

export function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? hours + " hr" : "", remainder || !hours ? remainder + " min" : ""].filter(Boolean).join(" ");
}
