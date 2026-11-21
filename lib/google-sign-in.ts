export const portalOrigin = "https://volunteers.ieeerwanda.org";
export const googleCallback = portalOrigin + "/api/auth/google/callback";
export const googleFlowCookie = "__Host-volunteer_google_flow";

export function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}
