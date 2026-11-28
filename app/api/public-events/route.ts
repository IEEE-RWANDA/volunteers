import { approvedPublicEvents } from "@/lib/event-calendar";

export async function GET() {
  try {
    return Response.json({ events: await approvedPublicEvents() }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } });
  } catch {
    return Response.json({ error: "Approved events are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
