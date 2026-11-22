import type { Submission } from "./volunteer-intake";
import { unitLeads, volunteerUnits } from "./volunteer-units";
import { volunteerEvents } from "./volunteer-store";

export function canLogEventHours(event: Submission, email: string, chairedBranches: Set<string>, now = Date.now()) {
  if (event.kind !== "event" || !event.end || !(Date.parse(event.end + "+02:00") <= now)) return false;
  return event.submittedBy === email || Boolean(event.eventUnitId && chairedBranches.has(event.eventUnitId));
}

export function eventParticipants(event: Submission) {
  return [...new Set([event.submittedBy, ...event.eventVolunteerEmails ?? []])];
}

export async function eventsForHours(email: string) {
  const [events, units, chairs] = await Promise.all([volunteerEvents(), volunteerUnits(), unitLeads()]);
  const branches = new Set(units.filter(unit => unit.type === "branch" &&
    chairs.some(chair => chair.email === email && chair.unitId === unit.id)).map(unit => unit.id));
  const managed = new Set(units.filter(unit => branches.has(unit.id) ||
    (unit.parentId && branches.has(unit.parentId))).map(unit => unit.id));
  return events.filter(event => canLogEventHours(event, email, managed));
}
