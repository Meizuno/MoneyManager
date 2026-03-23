import { getQuery, sendRedirect } from "h3";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const accessToken = typeof query.access_token === "string" ? query.access_token : "";
  const refreshToken = typeof query.refresh_token === "string" ? query.refresh_token : "";

  if (!accessToken || !refreshToken) {
    return sendRedirect(event, "/login?error=missing_tokens");
  }

  const user = await verifyAccessToken(accessToken);
  if (!user) {
    return sendRedirect(event, "/login?error=invalid_token");
  }

  setAuthCookies(event, accessToken, refreshToken);
  return sendRedirect(event, "/");
});
