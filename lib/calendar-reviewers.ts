import { createHash } from "node:crypto";
import { accountRoster } from "./session";
import { listIntakeRecords, readIntakeJson, saveIntakeFile } from "./volunteer-store";

type Delegation = { email: string; active: boolean; changedBy: string; changedAt: string };
const pathFor = (email: string) => `calendar-reviewers/${createHash("sha256").update(email).digest("hex")}.json`;

export async function calendarReviewAccess(email: string) {
  const members = await accountRoster();
  const member = members.find(member => member.email === email);
  const secretary = member?.officerTitle === "Secretary";
  const delegation = member && !secretary ? await readIntakeJson<Delegation>(pathFor(email)) : null;
  return { canManage: secretary, canReview: secretary || Boolean(delegation?.active) };
}

export async function calendarReviewers() {
  const [members, paths] = await Promise.all([accountRoster(), listIntakeRecords("calendar-reviewers")]);
  const delegations = await Promise.all(paths.map(path => readIntakeJson<Delegation>(path)));
  return members.filter(member => member.officerTitle === "Secretary" || delegations.some(item => item?.email === member.email && item.active));
}

export async function setCalendarReviewer(actor: string, email: string, active: boolean) {
  if (!(await calendarReviewAccess(actor)).canManage) return false;
  const member = (await accountRoster()).find(member => member.email === email);
  if (!member || member.officerTitle === "Secretary") return false;
  await saveIntakeFile(pathFor(email), JSON.stringify({ email, active, changedBy: actor, changedAt: new Date().toISOString() }), true);
  return true;
}
