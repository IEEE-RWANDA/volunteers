import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getVolunteer } from "@/lib/session";
import { signIn } from "./session-actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; access?: string }> }) {
  if (await getVolunteer()) redirect("/dashboard");
  const { error, access } = await searchParams;

  return (
    <main className="login-layout">
      <section className="login-intro">
        <Image className="brand-logo" src="/img/logo-full.png" alt="IEEE Rwanda" width={190} height={68} priority />
        <div>
          <p className="eyebrow">IEEE Rwanda Subsection</p>
          <h1>Volunteer Hub</h1>
          <p className="intro-copy">Coordinate events and funding across IEEE Rwanda’s committees.</p>
        </div>
        <a href="https://www.ieeerwanda.org/" className="font-semibold underline underline-offset-4">IEEE Rwanda website</a>
      </section>
      <section className="login-form" aria-labelledby="sign-in">
        <div className="w-full max-w-sm">
          <h2 id="sign-in" className="font-display text-3xl font-bold text-navy">Sign in</h2>
          <p className="mt-2 text-ink-soft">Access your volunteer dashboard.</p>
          {process.env.NODE_ENV === "development" ? <form action={signIn} className="mt-7 space-y-5">
            <label className="block text-sm font-semibold">Email address
              <input className="login-input" name="email" type="email" autoComplete="username" maxLength={254} required />
            </label>
            <label className="block text-sm font-semibold">Password
              <input className="login-input" name="password" type="password" autoComplete="current-password" maxLength={256} required />
            </label>
            {error && <p role="alert" className="text-sm font-semibold text-red-700">The email or password is incorrect.</p>}
            <button className="btn btn-primary w-full" type="submit">Sign in</button>
          </form> : (
            <div className="mt-7 space-y-3">
              {error && (
                <p role="alert" className="text-sm font-semibold text-red-700">
                  {error === "rejected" ? "Your access request was declined. Contact the IEEE Rwanda administrator if you need help."
                    : error === "account" ? "Use a verified Gmail or Google Workspace account."
                    : error === "access" ? "This Google account has not been granted access to the Volunteer Hub."
                    : "Google sign-in could not be completed. Try again or contact the IEEE Rwanda administrator."}
                </p>
              )}
              {access === "pending" && (
                <p role="status" className="text-sm font-semibold text-navy">Access requested. Sign in again after an admin approves your request.</p>
              )}
              <a href="/api/auth/google" className="btn btn-primary w-full">Sign in with Google</a>
              <a href="/api/auth/google?mode=request" className="block text-center text-sm font-semibold text-blue underline">Request access with Google</a>
            </div>
          )}
          <Link href="/privacy" className="mt-5 block text-center text-sm text-ink-soft underline">Privacy notice</Link>
        </div>
      </section>
    </main>
  );
}
