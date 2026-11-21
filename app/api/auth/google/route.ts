import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { googleCallback, googleCredentials, googleFlowCookie, portalOrigin } from "@/lib/google-sign-in";

export function GET() {
  const credentials = googleCredentials();
  if (!credentials) return NextResponse.redirect(portalOrigin + "/?error=unavailable");

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: googleCallback,
    response_type: "code",
    scope: "openid email",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(googleFlowCookie, state + "." + verifier, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
  });
  return response;
}
