import type { OrganizerOption } from "./volunteer-intake";
import { createHash, createHmac } from "node:crypto";
import { previewRoster } from "./session";
import { listIntakeRecords, readIntakeFile, saveIntakeFile } from "./volunteer-store";

type Volunteer = { email: string; name: string; committee?: string };

export async function roster() {
  const preview = previewRoster();
  const members = new Map<string, Volunteer>(preview.map(member => [member.email, member]));
  if (process.env.NODE_ENV === "development" && preview.length) {
    const demoVolunteers = [
      { name: "Demo Aline", committee: "Events" },
      { name: "Demo Brian", committee: "Outreach" },
      { name: "Demo Claire", committee: "Events" },
      { name: "Demo David", committee: "Outreach" },
      { name: "Demo Esther", committee: "Communications" },
      { name: "Demo Felix", committee: "Communications" },
      { name: "Demo Grace", committee: "Events" },
    ];
    for (const [index, volunteer] of demoVolunteers.entries()) {
      const email = `demo-roster-${index + 1}@example.test`;
      members.set(email, { ...volunteer, email });
    }
  }
  const saved = await Promise.all((await listIntakeRecords("roster")).map(async (path) => {
    const data = await readIntakeFile(path);
    return data ? JSON.parse(new TextDecoder().decode(data)) as Volunteer : null;
  }));
  for (const member of saved) {
    if (member) members.set(member.email, member);
  }
  return [...members.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function addToRoster(member: Volunteer) {
  const id = createHash("sha256").update(member.email).digest("hex");
  await saveIntakeFile(`roster/${id}.json`, JSON.stringify(member));
}

export async function teamRoster(access: { role: "admin" } | { role: "lead"; committee: string }) {
  const members = await roster();
  return access.role === "admin" ? members : members.filter(member =>
    member.committee?.trim().toLowerCase() === access.committee.trim().toLowerCase());
}

export async function organizerOptions(): Promise<OrganizerOption[]> {
  const secret = process.env.VOLUNTEER_SESSION_SECRET;
  if (!secret || secret.length < 32) return [];
  return (await roster()).map(({ email, name, committee }) => ({
    id: createHmac("sha256", secret).update("funding-organizer:" + email).digest("hex"),
    name,
    committee,
  }));
}
