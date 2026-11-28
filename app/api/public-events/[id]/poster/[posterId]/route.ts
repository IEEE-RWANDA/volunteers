import { eventCalendarDecision } from "@/lib/event-calendar";
import { calendarReviewAccess } from "@/lib/calendar-reviewers";
import { getVolunteer } from "@/lib/session";
import { ownVolunteerEvent, readIntakeFile, submissionIdPattern, volunteerEvents } from "@/lib/volunteer-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; posterId: string }> }) {
  const { id, posterId } = await params;
  if (!submissionIdPattern.test(id) || !submissionIdPattern.test(posterId)) return new Response(null, { status: 404 });
  const decision = await eventCalendarDecision(id);
  const approved = decision?.publicEvent?.posterUrl === `https://volunteers.ieeerwanda.org/api/public-events/${id}/poster/${posterId}`;
  if (!approved) {
    const viewer = await getVolunteer();
    if (!viewer) return new Response(null, { status: 404 });
    const event = await ownVolunteerEvent(id, viewer) ?? ((await calendarReviewAccess(viewer)).canReview ? (await volunteerEvents()).find(event => event.id === id) : null);
    if (event?.eventPoster?.id !== posterId) return new Response(null, { status: 404 });
  }
  const bytes = await readIntakeFile(`event-posters/${posterId}`);
  if (!bytes) return new Response(null, { status: 404 });
  const header = Buffer.from(bytes.subarray(0, 8)).toString("hex");
  const type = header === "89504e470d0a1a0a" ? "image/png" : header.startsWith("ffd8ff") ? "image/jpeg" : null;
  if (!type) return new Response(null, { status: 415 });
  return new Response(Uint8Array.from(bytes), { headers: {
    "Content-Type": type,
    "Cache-Control": approved ? "public, max-age=60, s-maxage=60" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
}
