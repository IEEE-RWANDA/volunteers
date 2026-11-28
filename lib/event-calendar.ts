import { createHash } from "node:crypto";
import { calendarReviewAccess } from "./calendar-reviewers";
import { readIntakeJson, saveIntakeFile, submissionIdPattern, volunteerEvents } from "./volunteer-store";
import type { Submission } from "./volunteer-intake";

export const publicCalendarId = "c641c957c33ea9aff8bf76e246e6cd6228a835f2d015ec29d7cf92ff55eb7f60@group.calendar.google.com";
export type CalendarDecision = { approvedBy: string; approvedAt: string; fingerprint: string; publishedBy?: string; publishedAt?: string; calendarEventId?: string; calendarUrl?: string };
const pathFor = (id: string) => `event-calendar-decisions/${id}.json`;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function calendarConfigured() {
  return Boolean(process.env.EVENT_CALENDAR_CLIENT_ID && process.env.EVENT_CALENDAR_CLIENT_SECRET && process.env.EVENT_CALENDAR_REFRESH_TOKEN);
}

function calendarTime(value: string | undefined) {
  if (!value || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(value)) throw new Error("calendar-details");
  const normalized = value.length === 16 ? value + ":00" : value;
  const parsed = new Date(normalized + "Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 19) !== normalized) throw new Error("calendar-details");
  return { dateTime: normalized + "+02:00", timeZone: "Africa/Kigali" };
}

export function calendarEventPayload(event: Submission) {
  if (!event.title.trim() || !event.location?.trim() || !event.details.trim() || !event.vtools || !URL.canParse(event.vtools) || !["https:", "http:"].includes(new URL(event.vtools).protocol)) throw new Error("calendar-details");
  const start = calendarTime(event.date);
  const end = calendarTime(event.end);
  if (Date.parse(end.dateTime) <= Date.parse(start.dateTime)) throw new Error("calendar-details");
  return {
    id: digest("ieee-rwanda-portal:" + event.id),
    summary: event.title,
    location: event.location,
    description: `${event.details}\n\nvTools event: ${event.vtools}`,
    start, end,
    extendedProperties: { private: { portalActivityId: event.id } },
  };
}

export async function eventCalendarDecision(id: string) {
  if (!submissionIdPattern.test(id)) return null;
  const [approval, publication] = await Promise.all([
    readIntakeJson<CalendarDecision>(pathFor(id)),
    readIntakeJson<CalendarDecision>(`event-calendar-publications/${id}.json`),
  ]);
  return publication ?? approval;
}

async function publishToGoogle(payload: ReturnType<typeof calendarEventPayload>) {
  if (!calendarConfigured()) throw new Error("calendar-connection");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({ client_id: process.env.EVENT_CALENDAR_CLIENT_ID!, client_secret: process.env.EVENT_CALENDAR_CLIENT_SECRET!, refresh_token: process.env.EVENT_CALENDAR_REFRESH_TOKEN!, grant_type: "refresh_token" }),
  });
  if (!tokenResponse.ok) throw new Error("calendar-connection");
  const token = await tokenResponse.json();
  if (typeof token.access_token !== "string" || !token.access_token) throw new Error("calendar-connection");
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(publicCalendarId)}/events`;
  const headers = { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" };
  let response = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (response.status === 409) {
    response = await fetch(`${url}/${payload.id}`, { headers, cache: "no-store", signal: AbortSignal.timeout(10000) });
  }
  if (!response.ok) throw new Error("calendar-publish-error");
  const result = await response.json();
  if (result.id !== payload.id || result.extendedProperties?.private?.portalActivityId !== payload.extendedProperties.private.portalActivityId || result.status === "cancelled" || result.summary !== payload.summary || result.description !== payload.description || result.location !== payload.location || Date.parse(result.start?.dateTime) !== Date.parse(payload.start.dateTime) || Date.parse(result.end?.dateTime) !== Date.parse(payload.end.dateTime)) throw new Error("calendar-publish-error");
  return { id: payload.id, url: `https://calendar.google.com/calendar/event?eid=${Buffer.from(payload.id + " " + publicCalendarId).toString("base64url")}` };
}

export async function reviewCalendarEvent(actor: string, id: string, action: "approve" | "publish") {
  if (!(await calendarReviewAccess(actor)).canReview) return "calendar-forbidden";
  if (!submissionIdPattern.test(id)) return "calendar-details";
  const event = (await volunteerEvents()).find(event => event.id === id);
  if (!event) return "calendar-details";
  try {
    const payload = calendarEventPayload(event);
    const fingerprint = digest(JSON.stringify(payload));
    const previous = await eventCalendarDecision(id);
    if (previous?.publishedAt) return "calendar-published";
    if (action === "approve") {
      await saveIntakeFile(pathFor(id), JSON.stringify({ approvedBy: actor, approvedAt: new Date().toISOString(), fingerprint }), true);
      return "calendar-approved";
    }
    if (!previous || previous.fingerprint !== fingerprint) return "calendar-approval-required";
    const published = await publishToGoogle(payload);
    await saveIntakeFile(`event-calendar-publications/${id}.json`, JSON.stringify({ ...previous, publishedBy: actor, publishedAt: new Date().toISOString(), calendarEventId: published.id, calendarUrl: published.url }), true);
    return "calendar-published";
  } catch (error) {
    return error instanceof Error && ["calendar-details", "calendar-connection", "calendar-publish-error"].includes(error.message) ? error.message : "calendar-save-error";
  }
}
