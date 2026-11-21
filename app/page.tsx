import Image from "next/image";
import { redirect } from "next/navigation";
import { getVolunteer } from "@/lib/session";
import { signIn } from "./session-actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getVolunteer()) redirect("/dashboard");
  const { error } = await searchParams;

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
          <form action={signIn} className="mt-7 space-y-5">
            <label className="block text-sm font-semibold">Email address
              <input className="login-input" name="email" type="email" autoComplete="username" maxLength={254} required />
            </label>
            <label className="block text-sm font-semibold">Password
              <input className="login-input" name="password" type="password" autoComplete="current-password" maxLength={256} required />
            </label>
            {error && <p role="alert" className="text-sm font-semibold text-red-700">The email or password is incorrect.</p>}
            <button className="btn btn-primary w-full" type="submit">Sign in</button>
          </form>
        </div>
      </section>
    </main>
  );
}
