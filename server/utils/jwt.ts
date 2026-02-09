import { SignJWT, jwtVerify } from "jose";
import { useRuntimeConfig } from "#imports";

type JwtUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
};

const parseDuration = (value: string, fallbackSeconds: number) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+)(s|m|h|d)?$/i);
  if (!match) return fallbackSeconds;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  return amount * (multipliers[unit] ?? 1);
};

const getJwtSecret = () => {
  const config = useRuntimeConfig();
  const secret = config.auth?.jwtSecret as string | undefined;
  if (!secret) {
    throw new Error("Missing auth.jwtSecret runtime config.");
  }
  return new TextEncoder().encode(secret);
};

export const getAccessTokenTTL = () => {
  const config = useRuntimeConfig();
  const value = (config.auth?.accessTokenTTL as string | undefined) ?? "900";
  return parseDuration(value, 900);
};

export const getRefreshTokenTTL = () => {
  const config = useRuntimeConfig();
  const value = (config.auth?.refreshTokenTTL as string | undefined) ?? "2592000";
  return parseDuration(value, 2592000);
};

export const signAccessToken = async (user: JwtUser, ttlSeconds: number) => {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: user.email ?? null,
    name: user.name ?? null,
    picture: user.picture ?? null,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(secret);
};

export const verifyAccessToken = async (token: string) => {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret);
  return payload;
};
