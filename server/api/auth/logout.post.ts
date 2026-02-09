import { getCookie } from "h3";
import { clearUserSession } from "#imports";
import { getPrisma } from "../../utils/db";
import { clearAuthCookies } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const refreshToken = getCookie(event, "mm_refresh");
  if (refreshToken) {
    const prisma = getPrisma();
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  clearAuthCookies(event);
  await clearUserSession(event);

  return { ok: true };
});
