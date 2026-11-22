export const googleAvatarCookie = "volunteer_google_avatar";

export function googleAvatarUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 512 || !URL.canParse(value)) return undefined;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !/^lh[0-9]+\.googleusercontent\.com$/.test(url.hostname)) return undefined;
  return url.href;
}
