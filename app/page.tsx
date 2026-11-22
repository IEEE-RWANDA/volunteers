import Image from "next/image";
import Link from "next/link";
import { getVolunteer } from "@/lib/session";
import Dashboard, { type DashboardParams } from "./dashboard/Dashboard";
import { signIn } from "./session-actions";

export default async function Page({ searchParams }: { searchParams: Promise<DashboardParams & { error?: string; access?: string }> }) {
  const params = await searchParams;
  const email = await getVolunteer();
  if (email) return <Dashboard email={email} params={params} />;
  const { error, access } = params;

  return (
    <main className="login-layout">
      <header className="login-masthead">
        <Image className="brand-logo" src="/img/logo-full.png" alt="IEEE Rwanda" width={190} height={68} priority />
      </header>
      <section className="login-intro" aria-labelledby="login-title">
        <Image src="/img/ieee-rwanda-volunteers.jpg" alt="" fill sizes="(max-width: 760px) 100vw, 58vw" preload className="login-photo" />
        <div className="login-intro-content">
          <p className="eyebrow">IEEE Rwanda Subsection</p>
          <h1 id="login-title">Volunteer Hub</h1>
          <p className="intro-copy">Organize events, manage funding, and track your volunteer work.</p>
        </div>
      </section>
      <section className="login-form" aria-labelledby="sign-in">
        <div className="w-full max-w-sm">
          <h2 id="sign-in" className="font-display text-4xl font-extrabold tracking-tight text-navy">Sign in</h2>
          <p className="mt-2 text-ink-soft">{process.env.NODE_ENV === "development" ? "Enter your local preview credentials." : "Use your approved Google account."}</p>
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
              <div className="mt-5 border-t border-line pt-5">
                <p className="text-sm text-ink-soft">New to the Volunteer Hub?</p>
                <a href="/api/auth/google?mode=request" className="mt-1 inline-block text-sm font-semibold text-blue underline underline-offset-4">Request access with Google</a>
                <p className="mt-2 text-sm text-ink-soft">If you are a unit chair, use the Google account with the exact email listed for you in IEEE vTools.</p>
              </div>
            </div>
          )}
          <Link href="/privacy" className="mt-6 inline-block text-xs text-ink-soft underline underline-offset-4">Privacy notice</Link>
        </div>
      </section>
    </main>
  );
}
