import { getTeamAccess } from "@/lib/session";
import { fundingRequest, privateAttachment } from "@/lib/volunteer-store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const access = await getTeamAccess();
  if (access?.role !== "admin") return new Response(null, { status: 404 });
  const { id, file } = await params;
  if (!/^[0-4]$/.test(file)) return new Response(null, { status: 404 });
  const request = await fundingRequest(id);
  const name = request?.attachments[Number(file)];
  if (!name) return new Response(null, { status: 404 });
  return privateAttachment(`files/${id}/${file}`, name);
}
