import { sendRedirect, getHeader } from "h3";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const host = getHeader(event, "host") ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  const callbackUrl = encodeURIComponent(`${proto}://${host}/api/auth/callback`);
  return sendRedirect(event, `${config.authServiceUrl}/google?redirect_url=${callbackUrl}`);
});
