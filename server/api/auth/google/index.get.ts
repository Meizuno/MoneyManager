import { useRuntimeConfig, setUserSession } from "#imports";
import { createError, sendRedirect } from "h3";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const clientId = config.oauth?.google?.clientId as string | undefined;
  const redirectURL = config.oauth?.google?.redirectURL as string | undefined;

  if (!clientId || !redirectURL) {
    throw createError({
      statusCode: 500,
      statusMessage: "Google OAuth is not configured.",
    });
  }

  const state = crypto.randomUUID();
  await setUserSession(event, { oauthState: state });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectURL,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return sendRedirect(
    event,
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
});
