# IEEE Rwanda Volunteer Hub

A standalone Next.js and Tailwind application for volunteer operations.

## Local preview

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and set `VOLUNTEER_SESSION_SECRET` to at least 32 random characters.
3. Run `npm run dev -- --hostname 127.0.0.1`, then sign in with the configured preview email and password.

The preview stores form submissions and attachments in the ignored `.volunteer-data/` directory. A volunteer can submit an event or funding request and view their own submissions. PDF, XLSX, DOCX, PNG, and JPEG attachments are accepted up to 4 MB total per request.

The **Volunteers** section lists the configured preview accounts by name and committee and lets each volunteer record and view their own hours. To test with additional accounts, set `VOLUNTEER_PREVIEW_ACCOUNTS` in `.env.local` to a JSON array of objects with `email`, `password`, `name`, and an optional `committee` and `role`. Use `admin` for roster management or `lead` with a committee to test team hours. Accounts without a role are volunteers. Adding a roster profile does not provision a sign-in account. Use synthetic accounts for preview testing.

The preview does not publish events to Google Calendar.

## Production

Use a dedicated Vercel project with a private Blob store connected to Production. Set these Production environment variables:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from a Google OAuth web client with the authorized redirect URI `https://volunteers.ieeerwanda.org/api/auth/google/callback`.
- `VOLUNTEER_SESSION_SECRET` to a randomly generated secret of at least 32 characters.
- `VOLUNTEER_ACCOUNTS` to a JSON array of approved Google accounts with `email`, `name`, and an optional `role` and `committee`. A lead must have a committee. Adding a directory profile does not grant sign-in access.

Production sign-in accepts verified Gmail and Google Workspace accounts. Use the configured allowlist to bootstrap admins and leads. Other volunteers request access from the sign-in page and an admin reviews the request under **Approve access**. Deploy from a local checkout with `vercel deploy --prod` or use Vercel Git integration on a plan that supports the private organization repository.
