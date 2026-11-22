import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { getVolunteer } from "@/lib/session";
import { formatHours, kigaliToday, volunteerHours } from "@/lib/volunteer-hours";
import { roster } from "@/lib/volunteer-roster";

export async function GET() {
  const email = await getVolunteer();
  if (!email) return new Response("Sign in to download your certificate.", { status: 401 });
  const [members, entries] = await Promise.all([roster(), volunteerHours(email)]);
  const eventHours = entries.filter(entry => entry.eventId);
  const profile = members.find(member => member.email === email);
  if (!profile || !eventHours.length) return new Response("There are no recorded event hours to certify.", { status: 404 });

  const pdf = await PDFDocument.create();
  pdf.setTitle("IEEE Rwanda Certificate of Volunteer Service");
  pdf.setAuthor("IEEE Rwanda Subsection");
  pdf.registerFontkit(fontkit);
  const [logo, font] = await Promise.all([
    readFile(join(process.cwd(), "public/img/logo-full.png")).then(bytes => pdf.embedPng(bytes)),
    readFile(join(process.cwd(), "app/fonts/inter-certificate.ttf")).then(bytes => pdf.embedFont(bytes, { subset: true })),
  ]);
  const page = pdf.addPage([842, 595]);
  const navy = rgb(0, 0.157, 0.333);
  const blue = rgb(0, 0.384, 0.608);
  const ink = rgb(0.19, 0.26, 0.33);
  const supported = new Set(font.getCharacterSet());
  const name = Array.from(profile.name.replace(/\s+/g, " ")).map(character =>
    supported.has(character.codePointAt(0)!) ? character : "?").join("");
  const count = new Set(eventHours.map(entry => entry.eventId)).size;
  const duration = formatHours(eventHours.reduce((sum, entry) => sum + entry.minutes, 0));
  const firstDate = eventHours.at(-1)!.date;
  const lastDate = eventHours[0].date;

  page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderWidth: 1.5, borderColor: navy });
  page.drawRectangle({ x: 24, y: 557, width: 794, height: 14, color: navy });
  const logoSize = logo.scaleToFit(180, 60);
  page.drawImage(logo, { x: (842 - logoSize.width) / 2, y: 464, ...logoSize });

  function center(text: string, y: number, size: number, color = ink) {
    const fitSize = Math.min(size, 670 * size / font.widthOfTextAtSize(text, size));
    page.drawText(text, { x: (842 - font.widthOfTextAtSize(text, fitSize)) / 2, y, size: fitSize, font, color });
  }

  center("Certificate of Volunteer Service", 390, 33, navy);
  center("IEEE Rwanda Subsection recognizes", 339, 15);
  center(name, 274, 42, blue);
  page.drawLine({ start: { x: 166, y: 251 }, end: { x: 676, y: 251 }, thickness: 1, color: blue });
  center(`for completing ${duration} of volunteer service across ${count} ${count === 1 ? "event" : "events"}.`, 200, 16);
  center(firstDate === lastDate ? `Service date: ${firstDate}` : `Service period: ${firstDate} to ${lastDate}`, 164, 13);
  center(`Issued by the IEEE Rwanda Volunteer Hub on ${kigaliToday()}`, 80, 12);

  return new Response(Uint8Array.from(await pdf.save()), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="ieee-rwanda-volunteer-service.pdf"',
      "cache-control": "private, no-store",
    },
  });
}
