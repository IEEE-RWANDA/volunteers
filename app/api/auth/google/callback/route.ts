import { NextRequest, NextResponse } from "next/server";
import { googleCallback, googleCredentials, googleFlowCookie, portalOrigin } from "@/lib/google-sign-in";
import { startGoogleVolunteerSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  function finish(path: string) {
    const response = NextResponse.redirect(portalOrigin + path);
    response.cookies.set(googleFlowCookie, "", { secure: true, path: "/", maxAge: 0 });
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  const credentials = googleCredentials();
  const [state, verifier] = (request.cookies.get(googleFlowCookie)?.value ?? "").split(".");
  const code = request.nextUrl.searchParams.get("code");
  if (!credentials || !state || !verifier || !code ||
      state !== request.nextUrl.searchParams.get("state") ||
      request.nextUrl.searchParams.get("iss") !== "https://accounts.google.com") return finish("/?error=google");

  try {
    const token = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: credentials.clientId, client_secret: credentials.clientSecret, code,
        code_verifier: verifier, grant_type: "authorization_code", redirect_uri: googleCallback,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!token.ok) return finish("/?error=google");
    const { access_token: accessToken } = await token.json();
    if (typeof accessToken !== "string" || !accessToken) return finish("/?error=google");

    const userinfo = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!userinfo.ok) return finish("/?error=google");
    const { email, email_verified: verified, hd: hostedDomain } = await userinfo.json();
    if (typeof email !== "string" || verified !== true ||
        (!email.toLowerCase().endsWith("@gmail.com") && !(typeof hostedDomain === "string" && hostedDomain)) ||
        !await startGoogleVolunteerSession(email)) return finish("/?error=access");
    return finish("/dashboard");
  } catch {
    return finish("/?error=google");
  }
}
