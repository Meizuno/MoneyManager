import { sendRedirect, getHeader } from "h3";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const host = getHeader(event, "host") ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  const callbackUrl = encodeURIComponent(`${proto}://${host}/api/auth/callback`);
  // The browser runs the OAuth flow on the auth server's PUBLIC origin —
  // it owns its /google/callback and Google redirect_uri. Use the public
  // URL here; server-to-server calls (validate/refresh/me) keep using the
  // internal authServiceUrl. Falls back to authServiceUrl when no separate
  // public URL is configured (dev / single-URL setups).
  const authBase = config.authPublicUrl || config.authServiceUrl;
  return sendRedirect(event, `${authBase}/google?redirect_url=${callbackUrl}`);
});
