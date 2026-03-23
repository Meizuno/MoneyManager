import { getCookie, getHeader, setCookie } from "h3";
import type { H3Event } from "h3";
import { createError } from "h3";

export type AuthUser = { id: string };

export const verifyAccessToken = async (token: string): Promise<AuthUser | null> => {
  try {
    const config = useRuntimeConfig();
    const result = await $fetch<{ user_id: string }>(
      `${config.authServiceUrl}/auth/validate`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!result.user_id) return null;
    return { id: result.user_id };
  } catch {
    return null;
  }
};

export const getAuthUser = async (event: H3Event): Promise<AuthUser | null> => {
  const header = getHeader(event, "authorization");
  const token = header?.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : (getCookie(event, "mm_access") ?? null);
  if (!token) return null;
  return verifyAccessToken(token);
};

export const requireAuthUser = async (event: H3Event): Promise<AuthUser> => {
  if (event.context.authUser) return event.context.authUser as AuthUser;
  const user = await getAuthUser(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  return user;
};

export const setAuthCookies = (event: H3Event, accessToken: string, refreshToken: string) => {
  const secure = process.env.NODE_ENV === "production";
  setCookie(event, "mm_access", accessToken, {
    httpOnly: true, sameSite: "lax", secure, path: "/",
  });
  setCookie(event, "mm_refresh", refreshToken, {
    httpOnly: true, sameSite: "lax", secure, path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
};

export const clearAuthCookies = (event: H3Event) => {
  setCookie(event, "mm_access", "", { path: "/", maxAge: 0 });
  setCookie(event, "mm_refresh", "", { path: "/", maxAge: 0 });
};
