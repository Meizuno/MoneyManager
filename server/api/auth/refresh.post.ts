import { createError, getCookie } from "h3";
import { getPrisma } from "../../utils/db";
import { getAccessTokenTTL, getRefreshTokenTTL, signAccessToken } from "../../utils/jwt";
import { clearAuthCookies, setAuthCookies } from "../../utils/auth";

type RefreshRow = {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
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

  const prisma = getPrisma();
  const refresh = (await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  })) as RefreshRow | null;
  if (!refresh) {
    clearAuthCookies(event);
    throw createError({ statusCode: 401, statusMessage: "Invalid refresh token." });
  }

  if (new Date(refresh.expires_at).getTime() <= Date.now()) {
    clearAuthCookies(event);
    throw createError({ statusCode: 401, statusMessage: "Refresh token expired." });
  }

  const user = (await prisma.user.findUnique({
    where: { id: refresh.user_id },
    select: { id: true, email: true, name: true, picture: true },
  })) as UserRow | null;
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
  const expiresAt = new Date(Date.now() + refreshTTL * 1000).toISOString();

  await prisma.refreshToken.update({
    where: { id: refresh.id },
    data: {
      token: newRefreshToken,
      expires_at: new Date(expiresAt),
    },
  });

  setAuthCookies(event, accessToken, newRefreshToken, accessTTL, refreshTTL);

  return {
    accessToken,
    user,
  };
});
