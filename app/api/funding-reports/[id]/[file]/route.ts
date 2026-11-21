import { fundingReport } from "@/lib/funding-reports";
import { getTeamAccess } from "@/lib/session";
import { privateAttachment } from "@/lib/volunteer-store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const access = await getTeamAccess();
  if (access?.role !== "admin") return new Response(null, { status: 404 });
  const { id, file } = await params;
  if (!/^[0-4]$/.test(file)) return new Response(null, { status: 404 });
  const version = new URL(request.url).searchParams.get("version");
  if (version !== null && !/^[1-9][0-9]{0,5}$/.test(version)) return new Response(null, { status: 404 });
  const report = await fundingReport(id, version === null ? undefined : Number(version));
  const attachment = report?.attachments[Number(file)];
  if (!attachment) return new Response(null, { status: 404 });
  return privateAttachment(attachment.path, attachment.name);
}
