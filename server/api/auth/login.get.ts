import { sendRedirect, getHeader } from "h3";

export default defineEventHandler((event) => {
  const host = getHeader(event, "host") ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  const callbackUrl = encodeURIComponent(`${proto}://${host}/api/auth/callback`);
  // Send the browser to the app-local OAuth proxy rather than the auth
  // service directly: /auth-proxy/** is reverse-proxied to
  // NUXT_AUTH_SERVICE_URL, so the auth server stays on the internal
  // network and the app is the single public origin.
  return sendRedirect(event, `/auth-proxy/google?redirect_url=${callbackUrl}`);
});
