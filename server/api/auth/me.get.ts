import { getHeader, getCookie } from "h3";

type Profile = { id: string; email: string; name: string; avatar_url: string };

// Every server-rendered page asks for the signed-in user (plugins/
// auth.server.ts), and the profile behind it — name, e-mail, avatar —
// barely ever changes. Each user's is kept for a few minutes rather than
// fetched from the auth service on every page.
const PROFILE_TTL_MS = 5 * 60 * 1000;
const profiles = new Map<string, { profile: Profile; until: number }>();

async function profileOf(userId: string, token: string): Promise<Profile> {
  const now = Date.now();
  const cached = profiles.get(userId);
  if (cached && cached.until > now) return cached.profile;
  const profile = await $fetch<Profile>(`${useRuntimeConfig().authServiceUrl}/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  for (const [id, entry] of profiles) {
    if (entry.until <= now) profiles.delete(id);
  }
  profiles.set(userId, { profile, until: now + PROFILE_TTL_MS });
  return profile;
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);

  const token = (event.context.accessToken as string | undefined)
    ?? getHeader(event, "authorization")?.slice(7)
    ?? getCookie(event, "access_token")
    ?? "";

  const profile = await profileOf(user.id, token);

  return {
    user: {
      id: user.id,
      email: profile.email ?? null,
      name: profile.name ?? null,
      picture: profile.avatar_url ?? null,
    },
  };
});
