import { createError, getCookie } from "h3";
import { getDb } from "../../utils/db";
import { getAccessTokenTTL, getRefreshTokenTTL, signAccessToken } from "../../utils/jwt";
import { clearAuthCookies, setAuthCookies } from "../../utils/auth";

type RefreshRow = {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
};

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

export default defineEventHandler(async (event) => {
  const refreshToken = getCookie(event, "mm_refresh");
  if (!refreshToken) {
    clearAuthCookies(event);
    throw createError({ statusCode: 401, statusMessage: "Missing refresh token." });
  }

  const db = getDb(event);
  const refreshResult = await db
    .prepare(
      "SELECT id, user_id, token, expires_at, revoked_at FROM refresh_tokens WHERE token = ?",
    )
    .bind(refreshToken)
    .all();

  const refresh = refreshResult.results[0] as RefreshRow | undefined;
  if (!refresh || refresh.revoked_at) {
    clearAuthCookies(event);
    throw createError({ statusCode: 401, statusMessage: "Invalid refresh token." });
  }

  if (new Date(refresh.expires_at).getTime() <= Date.now()) {
    clearAuthCookies(event);
    throw createError({ statusCode: 401, statusMessage: "Refresh token expired." });
  }

  const userResult = await db
    .prepare("SELECT id, email, name, picture FROM users WHERE id = ?")
    .bind(refresh.user_id)
    .all();
  const user = userResult.results[0] as UserRow | undefined;
  if (!user) {
    clearAuthCookies(event);
    throw createError({ statusCode: 401, statusMessage: "User not found." });
  }

  const accessTTL = getAccessTokenTTL();
  const refreshTTL = getRefreshTokenTTL();
  const accessToken = await signAccessToken(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
    accessTTL,
  );

  const newRefreshToken = crypto.randomUUID();
  const refreshId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + refreshTTL * 1000).toISOString();

  await db
    .prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), refresh.id)
    .run();
  await db
    .prepare(
      "INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(refreshId, user.id, newRefreshToken, expiresAt)
    .run();

  setAuthCookies(event, accessToken, newRefreshToken, accessTTL, refreshTTL);

  return {
    accessToken,
    user,
  };
});
