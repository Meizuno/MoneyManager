import { createError, getQuery, sendRedirect } from "h3";
import { useRuntimeConfig, getUserSession, replaceUserSession } from "#imports";
import { getPrisma } from "../../../utils/db";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
};

type GoogleTokenInfo = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = typeof query.code === "string" ? query.code : "";
  const state = typeof query.state === "string" ? query.state : "";

  const session = await getUserSession(event);
  if (!session.oauthState || session.oauthState !== state) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid OAuth state.",
    });
  }

  const config = useRuntimeConfig();
  const clientId = config.oauth?.google?.clientId as string | undefined;
  const clientSecret = config.oauth?.google?.clientSecret as string | undefined;
  const redirectURL = config.oauth?.google?.redirectURL as string | undefined;
  const allowedEmailsRaw = config.auth?.allowedEmails as string | undefined;

  if (!clientId || !clientSecret || !redirectURL) {
    throw createError({
      statusCode: 500,
      statusMessage: "Google OAuth is not configured.",
    });
  }

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing OAuth code.",
    });
  }

  const tokenResponse = await $fetch<GoogleTokenResponse>(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectURL,
        grant_type: "authorization_code",
      }).toString(),
    },
  );

  const tokenInfo = await $fetch<GoogleTokenInfo>(
    "https://oauth2.googleapis.com/tokeninfo",
    {
      query: { id_token: tokenResponse.id_token },
    },
  );

  const userId = tokenInfo.sub;
  const email = tokenInfo.email ?? null;
  const name = tokenInfo.name ?? null;
  const picture = tokenInfo.picture ?? null;

  const allowedEmails = (allowedEmailsRaw ?? "")
    .split(/[,;\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const hasAllowlist = allowedEmails.length > 0;
  const isWhitelisted =
    Boolean(email) && allowedEmails.includes(email!.toLowerCase());
  if (hasAllowlist && !isWhitelisted) {
    return sendRedirect(event, "/?auth=forbidden");
  }

  const prisma = getPrisma();
  await prisma.user.upsert({
    where: { id: userId },
    update: {
      email,
      name,
      picture,
    },
    create: {
      id: userId,
      email,
      name,
      picture,
    },
  });

  const accessTTL = getAccessTokenTTL();
  const refreshTTL = getRefreshTokenTTL();
  const accessToken = await signAccessToken(
    { id: userId, email, name, picture },
    accessTTL,
  );
  const refreshToken = crypto.randomUUID();
  const refreshId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + refreshTTL * 1000).toISOString();

  await prisma.refreshToken.create({
    data: {
      id: refreshId,
      user_id: userId,
      token: refreshToken,
      expires_at: new Date(expiresAt),
    },
  });

  setAuthCookies(event, accessToken, refreshToken, accessTTL, refreshTTL);
  await replaceUserSession(event, {
    user: { id: userId, email, name, picture },
  });
  return sendRedirect(event, "/");
});
