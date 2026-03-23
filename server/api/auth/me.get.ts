import { getHeader, getCookie } from "h3";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const config = useRuntimeConfig();

  const token = (event.context.accessToken as string | undefined)
    ?? getHeader(event, "authorization")?.slice(7)
    ?? getCookie(event, "mm_access")
    ?? "";

  const profile = await $fetch<{ id: string; email: string; name: string; avatar_url: string }>(
    `${config.authServiceUrl}/me`,
    { headers: { authorization: `Bearer ${token}` } },
  );

  return {
    user: {
      id: user.id,
      email: profile.email ?? null,
      name: profile.name ?? null,
      picture: profile.avatar_url ?? null,
    },
  };
});
