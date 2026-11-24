# IEEE Rwanda Volunteer Hub

A standalone Next.js and Tailwind application for volunteer operations.

## Local preview

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and set `VOLUNTEER_SESSION_SECRET` to at least 32 random characters.
3. Run `npm run dev -- --hostname 127.0.0.1`, then sign in with the configured preview email and password.

The preview stores form submissions and attachments in the ignored `.volunteer-data/` directory. Production stores structured records in Supabase Postgres and attachments in a private Supabase Storage bucket. A volunteer can submit an event or funding request and view their own submissions. PDF, XLSX, DOCX, PNG, and JPEG attachments are accepted up to 4 MB total per request.

The **Volunteers** section lists the configured preview accounts by name and committee and lets each volunteer record and view their own hours. To test with additional accounts, set `VOLUNTEER_PREVIEW_ACCOUNTS` in `.env.local` to a JSON array of objects with `email`, `password`, `name`, and an optional `committee` and `role`. Use `admin` for roster management or `lead` with a committee to test team hours. Accounts without a role are volunteers. Adding a roster profile does not provision a sign-in account. Use synthetic accounts for preview testing.

The preview does not publish events to Google Calendar.

## Production

Connect a Supabase Marketplace resource to the Vercel project for Production and Preview. The app uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; initial setup and migration also use `POSTGRES_URL`. Run `npm run storage:setup` once with those variables to create the private records table and file bucket.

Set these Production environment variables:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from a Google OAuth web client with the authorized redirect URI `https://volunteers.ieeerwanda.org/api/auth/google/callback`.
- `VOLUNTEER_SESSION_SECRET` to a randomly generated secret of at least 32 characters.
- `VOLUNTEER_ACCOUNTS` to a JSON array of approved Google accounts with `email`, `name`, and an optional `role` and `committee`. A lead must have a committee. Adding a directory profile does not grant sign-in access.

- `VOLUNTEER_OFFICERS` to a JSON array of the approved officers, each with `email`, `name`, and `title` (Chair, Vice Chair, Secretary, or Treasurer). Configured officers receive admin access.

Production sign-in accepts verified Gmail and Google Workspace accounts. Use the configured allowlist to bootstrap admins and leads. Other volunteers request access from the sign-in page and an admin reviews the request under **Approve access**.

The public GitHub repository is connected to Vercel and automatically deploys pushes to `main`.

Admins can manage chapters and student branches system-wide. Designate branch and chapter chairs from the unit assignment form. A student branch chair also manages the chapters of that branch.

Admins can view event submissions and funding requests. Funding is fully approved only after approval by the Chair, Treasurer, and either the Vice Chair or Secretary. Gentille Uwera is the designated calendar reviewer; automatic calendar publishing is not enabled until the public calendar integration is configured.
