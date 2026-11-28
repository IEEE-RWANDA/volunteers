import { receiptDriveEnabled, trashDriveReceipt, uploadDriveReceipt } from "@/lib/receipt-drive";
import { randomUUID } from "node:crypto";
import { attachmentCount, attachmentLimit, fundingRequestAttachmentCount, type Organizer, type Submission } from "@/lib/volunteer-intake";
import { fundingReport, ownFundingRequest, reportPath, type FundingReport } from "@/lib/funding-reports";
import { formatUsd, usdCents } from "@/lib/fund-amounts";
import { allocationTotal, fundsForVolunteer } from "@/lib/listed-funds";
import { volunteerUnits } from "@/lib/volunteer-units";
import { fundingLeadershipBlocks, unlinkedFundingActivity } from "@/lib/funding-leadership";
import { organizerDirectory } from "@/lib/volunteer-roster";
import { getVolunteer } from "@/lib/session";
import { ownVolunteerEvent, removeIntakeFiles, saveEventRevision, saveIntakeFile } from "@/lib/volunteer-store";

const bad = (error: string, status = 400) => Response.json({ error }, { status });

function validDate(value: string, timed: boolean) {
  if (!(timed ? /^\d{4}-\d\d-\d\dT\d\d:\d\d$/ : /^\d{4}-\d\d-\d\d$/).test(value)) return false;
  const date = new Date(timed ? value + "Z" : value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}

function supportedFile(name: string, bytes: Buffer) {
  const extension = name.split(".").at(-1)?.toLowerCase();
  const header = bytes.subarray(0, 8).toString("hex");
  switch (extension) {
    case "pdf": return header.startsWith("255044462d");
    case "xlsx":
    case "docx": return header.startsWith("504b0304");
    case "jpeg":
    case "jpg": return header.startsWith("ffd8ff");
    case "png": return header === "89504e470d0a1a0a";
    default: return false;
  }
}

const filesFrom = (form: FormData, key: string) =>
  form.getAll(key).filter((value): value is File => typeof value !== "string" && value.size > 0);
const cleanName = (file: File) => file.name.replace(/[\\/\r\n]/g, "_").slice(-150);
const webLink = (value: string) =>
  value.length <= 1000 && URL.canParse(value) && ["https:", "http:"].includes(new URL(value).protocol);

async function submitFundingReport(form: FormData, email: string) {
  const requestId = String(form.get("requestId") ?? "");
  const request = await ownFundingRequest(requestId, email);
  if (!request) return bad("Funding request not found.", 404);
  if (!request.releasedAt) return bad("You can submit a report after funds are released.", 409);
  const previous = await fundingReport(requestId);
  if (previous && previous.review?.decision !== "returned") {
    return bad("This report has already been submitted for review.", 409);
  }
  const version = (previous?.version ?? 0) + 1;

  const photos = String(form.get("photos") ?? "").trim();
  const vtools = String(form.get("vtools") ?? "").trim();
  const socialPost = String(form.get("socialPost") ?? "").trim();
  if (!webLink(photos) || !webLink(vtools) || !webLink(socialPost)) return bad("Enter valid photo, vTools, and social media post links.");

  const receipts = filesFrom(form, "receipts");
  const expense = filesFrom(form, "expense");
  const summary = filesFrom(form, "summary");
  if (!receipts.length || expense.length !== 1 || summary.length !== 1) {
    return bad("Attach receipts, one expense sheet, and one activity report PDF.");
  }
  const uploads = [
    ...receipts.map(file => ({ file, type: "receipt" as const, extensions: /\.(pdf|png|jpe?g)$/i })),
    { file: expense[0], type: "expense sheet" as const, extensions: /\.xlsx$/i },
    { file: summary[0], type: "activity report" as const, extensions: /\.pdf$/i },
  ];
  if (uploads.length > attachmentCount || uploads.reduce((total, item) => total + item.file.size, 0) > attachmentLimit) {
    return bad("Attach up to five files totaling 4 MB or less.", 413);
  }
  const report: FundingReport = {
    requestId, title: request.title, committee: request.committee, submittedBy: email,
    receivedAt: new Date().toISOString(), photos, vtools, socialPost, attachments: [],
  };
  const batch = randomUUID();
  const files = [];
  for (const [index, { file, type, extensions }] of uploads.entries()) {
    const name = cleanName(file);
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!extensions.test(name) || !supportedFile(name, bytes)) return bad("Use PDF or image receipts, an XLSX expense sheet, and a PDF activity report.");
    const path = `report-files/${requestId}/${batch}/${index}`;
    report.attachments.push({ name, type, path });
    files.push(bytes);
  }

  const saved: string[] = [];
  const driveIds: string[] = [];
  try {
    for (const [index, bytes] of files.entries()) {
      const attachment = report.attachments[index];
      if (attachment.type === "receipt" && receiptDriveEnabled()) {
        attachment.driveFileId = await uploadDriveReceipt(attachment.name, bytes);
        driveIds.push(attachment.driveFileId);
      } else {
        await saveIntakeFile(attachment.path, bytes);
        saved.push(attachment.path);
      }
    }
    await saveIntakeFile(reportPath(requestId, version), JSON.stringify(report));
  } catch {
    const cleanup = await Promise.allSettled([removeIntakeFiles(saved), ...driveIds.map(trashDriveReceipt)]);
    if (cleanup.some(result => result.status === "rejected")) console.error("Funding report attachment cleanup failed", requestId);
    if (await fundingReport(requestId, version).catch(() => null)) return bad("A report has already been submitted for this request.", 409);
    return bad("Your report could not be saved. Please try again.", 503);
  }
  return Response.json({ id: requestId }, { status: 201 });
}

export async function POST(request: Request) {
  const volunteer = await getVolunteer();
  if (!volunteer) return bad("Sign in to submit a request.", 401);
  if (request.headers.get("sec-fetch-site") === "cross-site") return bad("Invalid request origin.", 403);
  if (Number(request.headers.get("content-length")) > attachmentLimit + 64 * 1024) {
    return bad("Attachments must total 4 MB or less.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("The submission could not be read. Check the attachment sizes and try again.");
  }

  const field = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const kind = field("kind");
  if (kind === "funding-report") return submitFundingReport(form, volunteer);
  if (kind !== "event" && kind !== "funding") return bad("Select a submission type.");
  const editId = field("eventId");
  if (editId && kind !== "event") return bad("Only event submissions can be edited here.");
  const editing = editId ? await ownVolunteerEvent(editId, volunteer) : null;
  if (editId && !editing) return bad("Event not found or you are not its lead.", 404);
  const baseRevision = Number(field("baseRevision"));
  if (editing && (!/^\d+$/.test(field("baseRevision")) || !Number.isSafeInteger(baseRevision) || baseRevision !== (editing.revision ?? 0))) return bad("This event was updated elsewhere. Reload it before saving again.", 409);
  const activity = kind === "funding" ? await ownVolunteerEvent(field("fundingEventId"), volunteer) : null;
  if (kind === "funding" && !activity) return bad("Select an event or activity you created before requesting funds.");
  if (activity) {
    const blocks = await fundingLeadershipBlocks();
    const blocked = activity.eventUnitId && blocks.has(activity.eventUnitId)
      ? blocks.get(activity.eventUnitId) : unlinkedFundingActivity;
    if (blocked) return bad(blocked);
  }
  const title = activity?.title ?? field("title");
  const email = field("email");
  const leadVolunteerName = field("leadVolunteerName");
  let committee = field("committee");
  let eventVolunteerEmails: string[] | undefined;
  const eventUnitId = field("eventUnitId");
  const details = activity ? activity.details ?? "" : field("details");
  const intendedUse = kind === "funding" ? field("intendedUse") : undefined;
  if (kind === "funding" && (!intendedUse || intendedUse.length > 1000)) {
    return bad("Briefly describe the intended use of funds (up to 1,000 characters).");
  }
  const date = activity ? activity.date.slice(0, 10) : field("date");
  const end = field("end");
  const location = field("location");
  let amount: string | undefined;
  let fundAllocations: Submission["fundAllocations"];
  const vtools = activity ? activity.vtools ?? "" : field("vtools");
  if (!title || title.length > 150 ||
      !details || details.length > 4000 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad(kind === "funding"
      ? "Select an activity with a description and enter a valid lead volunteer email."
      : "Enter a title, description, and valid contact email.");
  }
  if (!validDate(date, kind === "event")) return bad("Enter a valid date.");
  if (kind === "event" && (!validDate(end, true) || end <= date || !location || location.length > 250)) {
    return bad("Enter an end time after the start time and a location.");
  }
  if (!webLink(vtools)) return bad("Enter a valid vTools event link starting with https:// or http://.");
  if (kind === "event" && eventUnitId && !(await volunteerUnits()).some(unit => unit.id === eventUnitId)) {
    return bad("Select an existing unit for this event.");
  }
  if (kind === "event" && field("acknowledgeVtools") !== "yes") {
    return bad("Confirm the IEEE Rwanda collaborator and contact email in vTools.");
  }
  if (kind === "funding") {
    if (field("acknowledgeReceipts") !== "yes") return bad("Acknowledge the receipts policy before submitting.");
    if (field("acknowledgeReceiptFormat") !== "yes") return bad("Confirm that all receipts will be EBM- or POS-generated.");
    if (!leadVolunteerName || leadVolunteerName.length > 150) return bad("Enter the lead volunteer name.");

    const chosenFunds = new Set(form.getAll("fund"));
    if (!chosenFunds.size) return bad("Select at least one expected funding source.");
    const funds = (await fundsForVolunteer(volunteer)).filter(fund => chosenFunds.has(fund.id));
    if (funds.length !== chosenFunds.size) return bad("A selected fund is unavailable to your account. Refresh and select again.");
    fundAllocations = [];
    for (const fund of funds) {
      if (fund.unitId && fund.unitId !== activity?.eventUnitId) return bad("A selected fund belongs to a different organization. Select funds assigned to this activity’s organization.");
      const cents = usdCents(field(`fundAmount-${fund.id}`));
      if (!cents || cents > fund.remainingCents) {
        return bad(`Enter a positive USD amount within the balance for ${fund.name} (${formatUsd(fund.remainingCents)} left).`);
      }
      fundAllocations.push({ id: fund.id, name: fund.name, cents });
    }
    const total = allocationTotal(fundAllocations);
    if (!Number.isSafeInteger(total) || total > 99_999_999_999_999) return bad("The total funding request is too large.");
    amount = formatUsd(total);
  }
  const chosen = new Set(form.getAll("organizer"));
  const committeeChosen = kind === "event" ? new Set(form.getAll("committeeOrganizer")) : chosen;
  if (!committeeChosen.size) return bad("Select at least one registered volunteer for the organizing committee.");
  if (chosen.size > 200 || committeeChosen.size > 200) return bad("Select up to 200 volunteers.");
  const directory = await organizerDirectory();
  const selected = directory.filter(member => chosen.has(member.id));
  const committeeMembers = directory.filter(member => committeeChosen.has(member.id));
  if (selected.length !== chosen.size || committeeMembers.length !== committeeChosen.size) return bad("A selected volunteer is no longer registered. Refresh and select again.");
  const organizers: Organizer[] = committeeMembers.map(({ name, committee }) => ({ name, committee }));
  committee = [...new Set(organizers.flatMap(member => member.committee ? [member.committee] : []))].join(", ") || "Volunteers";
  if (kind === "event") eventVolunteerEmails = [...new Set([...committeeMembers, ...selected].map(member => member.email))];

  const budget = filesFrom(form, "budget");
  const invoice = filesFrom(form, "invoice");
  const approvalEmail = filesFrom(form, "approvalEmail");
  const eventPoster = filesFrom(form, "eventPoster");
  const extraFiles = filesFrom(form, "attachments");
  const files = [...budget, ...invoice, ...approvalEmail, ...eventPoster];
  if (kind === "event" && (budget.length || invoice.length || approvalEmail.length || extraFiles.length || eventPoster.length > 1)) return bad("Attach one JPG or PNG event poster only.");
  if (kind === "event" && eventPoster.length && field("removeEventPoster") === "yes") return bad("Choose a replacement poster or remove the existing poster.");
  if (kind === "funding" && (budget.length !== 1 || !invoice.length || approvalEmail.length !== 1 || eventPoster.length !== 1 || extraFiles.length)) {
    return bad("Attach the funding approval email, budget, invoices, and event poster.");
  }
  if (files.length > fundingRequestAttachmentCount || files.reduce((total, file) => total + file.size, 0) > attachmentLimit) {
    return bad("Attach up to three invoices. All uploads must total 4 MB or less.", 413);
  }
  const uploads = [];
  for (const [index, file] of files.entries()) {
    const name = cleanName(file);
    const bytes = Buffer.from(await file.arrayBuffer());
    const extensions = kind === "event" ? /\.(png|jpe?g)$/i : index === 0 ? /\.xlsx$/i : /\.(pdf|png|jpe?g)$/i;
    if (!extensions.test(name) || !supportedFile(name, bytes)) {
      return bad(kind === "event" ? "Use a JPG or PNG image for the event poster." : "Use XLSX for the budget and PDF or images for the other documents.");
    }
    const label = index === 0 ? "Budget expense sheet" : index <= invoice.length ? "Invoice" : index === invoice.length + 1 ? "Funding approval email" : "Event poster";
    uploads.push({ name, bytes, label });
  }

  const id = randomUUID();
  const record: Submission = {
    id, kind, receivedAt: new Date().toISOString(), submittedBy: volunteer, title, email, committee, details, date, organizers, vtools, intendedUse,
    ...(kind === "event" ? { end, location, eventVolunteerEmails, eventCommitteeEmails: committeeMembers.map(member => member.email), eventUnitId: eventUnitId || undefined, vtoolsAcknowledgedAt: new Date().toISOString() } : { amount, leadVolunteerName, fundingEventId: activity?.id, fundAllocations, invoiceCount: invoice.length, attachmentLabels: uploads.map(upload => upload.label), receiptFormatAcknowledged: true, receiptsAcknowledgedAt: new Date().toISOString() }),
    attachments: uploads.map(upload => upload.name),
  };
  const poster = kind === "event" && uploads.length ? { id: randomUUID(), name: uploads[0].name, type: (/\.png$/i.test(uploads[0].name) ? "image/png" : "image/jpeg") as "image/png" | "image/jpeg" } : undefined;
  if (kind === "event") {
    record.eventPoster = poster;
    record.attachments = [];
  }
  if (editing) {
    const posterPath = poster ? `event-posters/${poster.id}` : undefined;
    try {
      if (posterPath) await saveIntakeFile(posterPath, uploads[0].bytes);
      const updated = { ...editing, eventPoster: poster ?? (field("removeEventPoster") === "yes" ? undefined : editing.eventPoster), title, email, committee, details, date, end, location, organizers, vtools, eventVolunteerEmails, eventCommitteeEmails: committeeMembers.map(member => member.email), eventUnitId: eventUnitId || undefined, vtoolsAcknowledgedAt: record.vtoolsAcknowledgedAt };
      if (!await saveEventRevision(updated, baseRevision)) {
        if (posterPath) await removeIntakeFiles([posterPath]);
        return bad("This event was updated elsewhere. Reload it before saving again.", 409);
      }
      return Response.json({ id: editing.id, revision: baseRevision + 1 }, { status: 200 });
    } catch {
      // A revision may have committed before a storage response failed; retain its poster.
      return bad("Your event changes could not be saved. Please try again.", 503);
    }
  }
  const saved: string[] = [];
  try {
    for (const [index, { bytes }] of uploads.entries()) {
      const path = poster ? `event-posters/${poster.id}` : `files/${id}/${index}`;
      await saveIntakeFile(path, bytes);
      saved.push(path);
    }
    await saveIntakeFile(`records/${id}.json`, JSON.stringify(record));
  } catch {
    await removeIntakeFiles(saved).catch(() => console.error("Volunteer attachment cleanup failed", id));
    console.error("Volunteer submission storage failed", id);
    return bad("Your submission could not be saved. Please try again.", 503);
  }
  return Response.json({ id }, { status: 201 });
}
