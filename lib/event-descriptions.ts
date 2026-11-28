import type { Submission } from "./volunteer-intake";

// Verified historical imports used the description for ledger notes. Keep the
// original records intact; unknown public descriptions must be supplied before approval.
const importedEvents: Record<string, string> = {
  "43022dca-9b38-b81f-d67e-771a655561ef": "A practical day moving from a research idea to a publishable paper: frame the work, build the evidence, write, and connect with the research community.",
  "6761ce93-8e9d-c6fd-9b28-5e2f8b6c1c16": "Students explored vehicle assembly and the connections between classroom learning, engineering careers, and industry.",
  "329bf695-91bb-1807-1644-07260468aa62": "",
  "3633be0a-ec72-cb8e-5141-43c99eabd1b7": "",
  "e79c0cde-9bf8-afc7-bca2-46b54cbc68f6": "IEEE Rwanda and its chapter partners are hosting a technology outreach event for secondary school students.",
  "0d650763-eaee-4ac3-81b4-b6bb9839a279": "",
  "80762167-6a2a-b30c-c297-fadf9952f573": "",
  "edbfecbb-3262-2522-2ae9-a96515f09934": "",
  "b152a0b9-10b0-d766-bcf5-1fbef3d32f98": "",
  "70963f9c-8734-f03d-3bd8-336372036bde": "Two days of technical learning, mentorship, and a hackathon, with conversations spanning AI, cybersecurity, cloud computing, and career development.",
  "5a0892f3-1ae2-02bf-00dc-b90aa6f66773": "A gathering of innovators, students, and technology leaders from across East Africa, with two days of ideas, collaboration, and connections.",
  "9d2c574c-1933-d80c-6887-7c6f8a7c431c": "",
  "25512bbf-8ccb-57ff-ad46-c5b6ad6e9f70": "A conversation with Jeewika Ranaweera on the industrial metaverse, digital inclusion, and responsible innovation.",
  "b5e47351-3b78-f9f6-eb8d-78513f48604a": "Photos from the IEEE Rwanda Microwave Theory and Technology Society visit to AUCA.",
  "9de9d101-8d60-3e13-b360-e463fa722cb3": "",
  "eaa6c699-7400-bee9-4598-b8015cb3a950": "",
  "e65d2473-859d-3619-a347-59c905b821f2": "",
  "cf59c998-6325-3c29-270c-a2436f75b1ec": "Photos from the joint industrial visit by the IEEE Geoscience and Remote Sensing, Industrial Electronics, and Aerospace and Electronic Systems societies.",
  "9f1476e7-85a2-fb24-6fa9-fb4c397e6c1c": "Students, professionals, researchers, and IEEE partners came together to celebrate the launch of the Rwanda Subsection.",
  "82c882d6-5424-d15f-5f69-54e891dcd72e": "",
};

export function hasLegacyTreasuryDescription(event: Submission) {
  return event.kind === "event" && event.publicDescription === undefined && Object.hasOwn(importedEvents, event.id);
}

export function publicEventDescription(event: Submission) {
  return event.publicDescription ?? (hasLegacyTreasuryDescription(event) ? importedEvents[event.id] : event.details);
}

export function eventTreasuryNotes(event: Submission) {
  return event.treasuryNotes ?? (hasLegacyTreasuryDescription(event) ? event.details : "");
}

export function eventForVolunteerForm(event: Submission): Submission {
  // Client props must not contain the original imported ledger text.
  return { ...event, details: publicEventDescription(event), publicDescription: publicEventDescription(event), treasuryNotes: undefined };
}
