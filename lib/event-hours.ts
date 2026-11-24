import type { Submission } from "./volunteer-intake";
import { unitLeads, volunteerUnits } from "./volunteer-units";
import { volunteerEvents } from "./volunteer-store";

export function canLogEventHours(event: Submission, email: string, managedUnits: Set<string>, now = Date.now()) {
  if (event.kind !== "event" || !event.end || !(Date.parse(event.end + "+02:00") <= now)) return false;
  return eventParticipants(event).includes(email) || Boolean(event.eventUnitId && managedUnits.has(event.eventUnitId));
}

export function eventParticipants(event: Submission) {
  return [...new Set([event.submittedBy, ...event.eventVolunteerEmails ?? []])];
}

export async function eventsForHours(email: string) {
  const [events, units, chairs] = await Promise.all([volunteerEvents(), volunteerUnits(), unitLeads()]);
  const chaired = new Set(chairs.filter(chair => chair.email === email).map(chair => chair.unitId));
  const managed = new Set(units.filter(unit => chaired.has(unit.id) ||
    (unit.parentId && chaired.has(unit.parentId))).map(unit => unit.id));
  return events.filter(event => canLogEventHours(event, email, managed));
}

export async function eventsLedBy(email: string) {
  return (await volunteerEvents()).filter(event => canLogEventHours(event, email, new Set()) && event.submittedBy === email);
}
