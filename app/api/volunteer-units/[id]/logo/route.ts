import { getVolunteer } from "@/lib/session";
import { readIntakeFile } from "@/lib/volunteer-store";
import { volunteerUnits } from "@/lib/volunteer-units";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getVolunteer()) return new Response(null, { status: 401 });
  const { id } = await params;
  const unit = (await volunteerUnits()).find(item => item.id === id);
  if (!unit?.logoId || !unit.logoType) return new Response(null, { status: 404 });
  const bytes = await readIntakeFile(`volunteer-unit-logos/${unit.logoId}`);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(Uint8Array.from(bytes), {
    headers: { "content-type": unit.logoType, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
  });
}
