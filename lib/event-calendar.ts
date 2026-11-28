import { publicEventDescription, eventTreasuryNotes } from "./event-descriptions";
import { createHash } from "node:crypto";
import { calendarReviewAccess } from "./calendar-reviewers";
import { readIntakeJson, saveIntakeFile, submissionIdPattern, volunteerEvent, volunteerEvents } from "./volunteer-store";
import type { Submission } from "./volunteer-intake";

export const publicCalendarId = "c641c957c33ea9aff8bf76e246e6cd6228a835f2d015ec29d7cf92ff55eb7f60@group.calendar.google.com";
export type PublicEvent = { id: string; title: string; description: string; startsAt: string; endsAt: string; location: string; url: string; posterUrl?: string };
export type CalendarDecision = { approvedBy: string; approvedAt: string; fingerprint: string; publicEvent?: PublicEvent; publishedFingerprint?: string; publishedBy?: string; publishedAt?: string; calendarEventId?: string; calendarUrl?: string };
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
  if (!event.title.trim() || !event.location?.trim() || !publicEventDescription(event)?.trim() || !event.vtools || !URL.canParse(event.vtools) || !["https:", "http:"].includes(new URL(event.vtools).protocol)) throw new Error("calendar-details");
  const start = calendarTime(event.date);
  const end = calendarTime(event.end);
  if (Date.parse(end.dateTime) <= Date.parse(start.dateTime)) throw new Error("calendar-details");
  return {
    id: digest("ieee-rwanda-portal:" + event.id),
    summary: event.title,
    location: event.location,
    description: `${publicEventDescription(event)}\n\nvTools event: ${event.vtools}`,
    start, end,
    extendedProperties: { private: { portalActivityId: event.id, ...(event.revision ? { portalRevision: String(event.revision) } : {}) } },
  };
}

export async function eventCalendarDecision(id: string) {
  if (!submissionIdPattern.test(id)) return null;
  const [approval, publication] = await Promise.all([
    readIntakeJson<CalendarDecision>(pathFor(id)),
    readIntakeJson<CalendarDecision>(`event-calendar-publications/${id}.json`),
  ]);
  return publication ? { ...publication, ...approval, publishedAt: publication.publishedAt, publishedBy: publication.publishedBy, calendarEventId: publication.calendarEventId, calendarUrl: publication.calendarUrl, publishedFingerprint: publication.fingerprint } : approval;
}

export function calendarEventState(event: Submission, decision: CalendarDecision | null | undefined) {
  let fingerprint = "";
  try { fingerprint = digest(JSON.stringify(calendarEventPayload(event))); } catch { /* Incomplete imported activities still need review. */ }
  const published = Boolean(fingerprint && decision?.publishedFingerprint === fingerprint);
  return { approved: Boolean(fingerprint && decision?.fingerprint === fingerprint), published, updating: Boolean(decision?.publishedAt), needsReview: !fingerprint || decision?.fingerprint !== fingerprint };
}

function publicEventDetails(event: Submission): PublicEvent {
  calendarEventPayload(event);
  return { id: event.id, title: event.title, description: publicEventDescription(event), startsAt: event.date, endsAt: event.end!, location: event.location!, url: event.vtools!, ...(event.eventPoster ? { posterUrl: `https://volunteers.ieeerwanda.org/api/public-events/${event.id}/poster/${event.eventPoster.id}` } : {}) };
}

export async function approvedPublicEvents() {
  const events = await volunteerEvents();
  const approved = await Promise.all(events.map(async event => {
    const decision = await eventCalendarDecision(event.id);
    if (!decision) return null;
    if (decision.publicEvent) {
      const privateNotes = eventTreasuryNotes(event);
      if (privateNotes && decision.publicEvent.description === privateNotes) return null;
      const { id, title, description, startsAt, endsAt, location, url, posterUrl } = decision.publicEvent;
      return { id, title, description, startsAt, endsAt, location, url, ...(posterUrl ? { posterUrl } : {}) };
    }
    // Legacy approvals have no snapshot; only expose a version whose reviewed fingerprint still matches.
    for (const candidate of [event, await readIntakeJson<Submission>(`records/${event.id}.json`)]) {
      if (!candidate) continue;
      try {
        if (digest(JSON.stringify(calendarEventPayload(candidate))) === decision.fingerprint) return publicEventDetails(candidate);
      } catch { /* Incomplete imported events cannot be published. */ }
    }
    return null;
  }));
  return approved.filter(event => event !== null).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

async function publishToGoogle(payload: ReturnType<typeof calendarEventPayload>, updating: boolean) {
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
  let response = updating ? await fetch(`${url}/${payload.id}`, { headers, cache: "no-store", signal: AbortSignal.timeout(10000) }) : await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(15000) });
  let existing = updating;
  if (!updating && response.status === 409) {
    response = await fetch(`${url}/${payload.id}`, { headers, cache: "no-store", signal: AbortSignal.timeout(10000) });
    existing = true;
  }
  if (!response.ok) throw new Error("calendar-publish-error");
  let result = await response.json();
  if (existing && result.id === payload.id && result.extendedProperties?.private?.portalActivityId === payload.extendedProperties.private.portalActivityId && result.status !== "cancelled") {
    const incomingRevision = Number(payload.extendedProperties.private.portalRevision ?? 0);
    const remoteRevision = Number(result.extendedProperties?.private?.portalRevision ?? 0);
    if (remoteRevision > incomingRevision) throw new Error("calendar-approval-required");
    if (remoteRevision < incomingRevision) {
      if (typeof result.etag !== "string") throw new Error("calendar-publish-error");
      const { id: eventId, ...changes } = payload;
      response = await fetch(`${url}/${eventId}`, { method: "PATCH", headers: { ...headers, "If-Match": result.etag }, body: JSON.stringify(changes), cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("calendar-publish-error");
      result = await response.json();
    }
  }
  if (result.id !== payload.id || result.extendedProperties?.private?.portalActivityId !== payload.extendedProperties.private.portalActivityId || result.status === "cancelled" || result.summary !== payload.summary || result.description !== payload.description || result.location !== payload.location || Date.parse(result.start?.dateTime) !== Date.parse(payload.start.dateTime) || Date.parse(result.end?.dateTime) !== Date.parse(payload.end.dateTime)) throw new Error("calendar-publish-error");
  return { id: payload.id, url: `https://calendar.google.com/calendar/event?eid=${Buffer.from(payload.id + " " + publicCalendarId).toString("base64url")}` };
}

export async function reviewCalendarEvent(actor: string, id: string, action: "approve" | "publish") {
  if (!(await calendarReviewAccess(actor)).canReview) return "calendar-forbidden";
  if (!submissionIdPattern.test(id)) return "calendar-details";
  const event = await volunteerEvent(id);
  if (!event) return "calendar-details";
  try {
    const payload = calendarEventPayload(event);
    const fingerprint = digest(JSON.stringify(payload));
    const previous = await eventCalendarDecision(id);
    if (previous?.publishedFingerprint === fingerprint) return "calendar-published";
    if (action === "approve") {
      await saveIntakeFile(pathFor(id), JSON.stringify({ approvedBy: actor, approvedAt: new Date().toISOString(), fingerprint, publicEvent: publicEventDetails(event) }), true);
      return "calendar-approved";
    }
    if (!previous || previous.fingerprint !== fingerprint) return "calendar-approval-required";
    const latest = await volunteerEvent(id);
    if (!latest || digest(JSON.stringify(calendarEventPayload(latest))) !== fingerprint) return "calendar-approval-required";
    const published = await publishToGoogle(payload, Boolean(previous.publishedAt));
    await saveIntakeFile(`event-calendar-publications/${id}.json`, JSON.stringify({ ...previous, publishedBy: actor, publishedAt: new Date().toISOString(), calendarEventId: published.id, calendarUrl: published.url }), true);
    return "calendar-published";
  } catch (error) {
    return error instanceof Error && ["calendar-details", "calendar-connection", "calendar-publish-error", "calendar-approval-required"].includes(error.message) ? error.message : "calendar-save-error";
  }
}
