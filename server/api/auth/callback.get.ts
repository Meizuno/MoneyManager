import { sendRedirect } from "h3";

// OAuth return target. The auth service has already set the shared
// access/refresh cookies on COOKIE_DOMAIN before redirecting here — there are
// no tokens in the query (they must never ride in a URL). Just confirm the
// session resolves from those cookies and land the user home.
export default defineEventHandler(async (event) => {
  const user = await authenticate(event);
  return sendRedirect(event, user ? "/" : "/login?error=auth_failed");
});
