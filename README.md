# IEEE Rwanda Volunteer Hub

A standalone Next.js and Tailwind application for volunteer operations.

## Local preview

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and set `VOLUNTEER_SESSION_SECRET` to at least 32 random characters.
3. Run `npm run dev -- --hostname 127.0.0.1`, then sign in with the configured preview email and password.

The preview stores form submissions and attachments in the ignored `.volunteer-data/` directory. A volunteer can submit an event or funding request and view their own submissions. PDF, XLSX, DOCX, PNG, and JPEG attachments are accepted up to 4 MB total per request.

The **Volunteers** section lists the configured preview accounts by name and committee and lets each volunteer record and view their own hours. To test with additional accounts, set `VOLUNTEER_PREVIEW_ACCOUNTS` in `.env.local` to a JSON array of objects with `email`, `password`, `name`, and an optional `committee` and `role`. Use `admin` for roster management or `lead` with a committee to test team hours. Accounts without a role are volunteers. Adding a roster profile does not provision a sign-in account. Use synthetic accounts for preview testing.

The preview login is development-only. Production needs organization-managed sign-in, role-based review, and a dedicated private storage connection. The preview does not publish events to Google Calendar.
