export const attachmentLimit = 4 * 1024 * 1024;
export const attachmentCount = 5;
export const attachmentTypes = ".pdf,.xlsx,.docx,.png,.jpg,.jpeg";

export type Organizer = { name: string; committee?: string };
export type OrganizerOption = Organizer & { id: string };

export type FundAllocation = { id: string; name: string; cents: number };

export type Submission = {
  id: string;
  kind: "event" | "funding";
  receivedAt: string;
  submittedBy: string;
  title: string;
  email: string;
  leadVolunteerName?: string;
  fundingSource?: string;
  fundAllocations?: FundAllocation[];
  listedFunds?: { id: string; name: string }[];
  committee: string;
  organizers?: Organizer[];
  details: string;
  date: string;
  end?: string;
  location?: string;
  registration?: string;
  vtools?: string;
  amount?: string;
  approvedAt?: string;
  releasedAt?: string;
  releasedAmount?: string;
  demo?: boolean;
  attachments: string[];
};
