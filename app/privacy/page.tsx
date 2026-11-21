import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy notice | IEEE Rwanda Volunteer Hub" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12 text-ink">
      <Link href="/" className="font-semibold text-blue underline">Volunteer Hub</Link>
      <h1 className="font-display text-4xl font-bold text-navy">Volunteer Hub privacy notice</h1>
      <p>IEEE Rwanda Subsection operates the Volunteer Hub to coordinate volunteer access, activities, funding and reporting.</p>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-navy">Google sign-in and access requests</h2>
        <p>We use your verified Google email, Google account identifier and profile name to process your access request, identify your account and sign you in. An IEEE Rwanda administrator reviews access requests. The Hub uses an essential session cookie to keep you signed in.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-navy">Volunteer records and documents</h2>
        <p>The Hub stores information you submit, including event details, volunteer hours, funding requests and reports. Funding documents are stored privately and accessed through the Hub by authorized reviewers. The Hub uses Vercel for hosting and private storage.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-navy">Questions and requests</h2>
        <p>To ask about your data or request a correction or deletion, email <a className="font-semibold text-blue underline" href="mailto:ieeerwanda@gmail.com">ieeerwanda@gmail.com</a>.</p>
      </section>
    </main>
  );
}
