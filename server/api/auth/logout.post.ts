import { getCookie } from "h3";
import { clearUserSession } from "#imports";
import { getDb } from "../../utils/db";
import { clearAuthCookies } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const refreshToken = getCookie(event, "mm_refresh");
  if (refreshToken) {
    const db = getDb(event);
    await db
      .prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE token = ?")
      .bind(new Date().toISOString(), refreshToken)
      .run();
  }

  clearAuthCookies(event);
  await clearUserSession(event);

  return { ok: true };
});
