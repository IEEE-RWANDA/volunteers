import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

// Uses the existing registered local callback; tokens are saved only to the ignored local environment file.
const clientId = process.env.EVENT_CALENDAR_CLIENT_ID || process.env.RECEIPT_DRIVE_CLIENT_ID;
const clientSecret = process.env.EVENT_CALENDAR_CLIENT_SECRET || process.env.RECEIPT_DRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error("Configure the existing Google OAuth client before connecting Calendar.");
const callback = "http://127.0.0.1:3217/oauth/callback";
const state = randomBytes(32).toString("base64url");
const verifier = randomBytes(32).toString("base64url");
const scope = "https://www.googleapis.com/auth/calendar.events.owned";
const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authorization.search = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: "code", access_type: "offline", prompt: "consent", scope: `openid email ${scope}`, login_hint: "ieeerwanda@gmail.com", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
const server = createServer(async (request, response) => {
  const url = new URL(request.url, callback);
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  if (url.pathname !== "/oauth/callback" || url.searchParams.get("state") !== state || !url.searchParams.get("code")) {
    response.writeHead(400).end("Calendar authorization was not completed. Retry from the setup link.");
    return;
  }
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: url.searchParams.get("code"), code_verifier: verifier, redirect_uri: callback, grant_type: "authorization_code" }), signal: AbortSignal.timeout(10000) });
    if (!tokenResponse.ok) throw new Error("Token exchange failed");
    const token = await tokenResponse.json();
    if (!token.refresh_token || !token.access_token || !token.scope?.split(" ").includes(scope)) throw new Error("Calendar permission or offline authorization is missing");
    const identityResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10000) });
    if (!identityResponse.ok) throw new Error("Owner verification failed");
    const identity = await identityResponse.json();
    if (identity.email !== "ieeerwanda@gmail.com" || identity.email_verified !== true) throw new Error("Use the IEEE Rwanda calendar owner account");
    let environment = await readFile(".env.local", "utf8");
    for (const [key, value] of Object.entries({ EVENT_CALENDAR_CLIENT_ID: clientId, EVENT_CALENDAR_CLIENT_SECRET: clientSecret, EVENT_CALENDAR_REFRESH_TOKEN: token.refresh_token })) {
      environment = environment.split("\n").filter(line => !line.startsWith(key + "=")).join("\n").trimEnd() + `\n${key}=${value}\n`;
    }
    await writeFile(".env.local", environment, { mode: 0o600 });
    response.end("IEEE Rwanda Calendar connected locally. Return to the local Volunteer Hub to test publishing.");
    console.log("Calendar owner connected. Credentials saved locally; nothing deployed.");
    server.close();
  } catch (error) {
    console.error("Calendar setup failed:", error.message);
    response.writeHead(400).end("Calendar connection failed. Check the local setup console and retry.");
  }
});
server.listen(3217, "127.0.0.1", () => console.log("Authorize the calendar owner:\n" + authorization));
